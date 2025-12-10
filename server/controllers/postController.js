import imagekit from "../configs/imageKit.js";
import cloudinary from "../configs/cloudinary.js";
import Post from "../models/Post.js";
import User from "../models/User.js";
import Comment from "../models/Comment.js";
import Share from "../models/Share.js";
import { v4 as uuidv4 } from 'uuid';
import stream from 'stream';

// =========== UPDATED: Get Feed Posts - OPTIMIZED ===========
export const getFeedPosts = async (req, res) => {
    try {
        const userId = req.userId;
        console.log('🚀 INSTANT - Get Feed Posts - User:', userId);

        const currentUser = await User.findById(userId).select('following connections');
        if (!currentUser) {
            return res.json({ success: false, message: "User not found" });
        }

        const followingIds = currentUser.following || [];
        const connectionIds = currentUser.connections || [];
        
        const userIDsToFetch = [
            userId,
            ...followingIds, 
            ...connectionIds
        ];

        console.log(`👥 Fetching posts from ${userIDsToFetch.length} users`);

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // SINGLE QUERY FOR ALL DATA
        const posts = await Post.find({
            user: { $in: userIDsToFetch }
        })
        .populate({
            path: 'user',
            select: '_id username full_name profile_picture',
            options: { allowNull: true }
        })
        .select('_id user content post_type likes_count comments_count shares_count media_urls createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

        console.log(`✅ INSTANT - Feed loaded: ${posts.length} posts`);

        // Process video URLs for Cloudinary videos
        const processedPosts = posts.map(post => {
            if (post.media_urls && post.media_urls.length > 0) {
                const processedMedia = post.media_urls.map(media => {
                    // If it's a Cloudinary video, add streaming URL and thumbnail
                    if (media.storage === 'cloudinary' && media.type === 'video') {
                        return {
                            ...media,
                            url: cloudinary.url(media.public_id, { 
                                resource_type: 'video',
                                flags: 'streaming_attachment'
                            }),
                            thumbnail: cloudinary.url(media.public_id, {
                                resource_type: 'video',
                                transformation: [
                                    { width: 320, height: 180, crop: 'fill' },
                                    { quality: 'auto' },
                                    { fetch_format: 'auto' }
                                ]
                            }),
                            hls_url: cloudinary.url(media.public_id, {
                                resource_type: 'video',
                                streaming_profile: 'hd',
                                format: 'm3u8'
                            }),
                            dash_url: cloudinary.url(media.public_id, {
                                resource_type: 'video',
                                streaming_profile: 'hd',
                                format: 'mpd'
                            })
                        };
                    }
                    return media;
                });
                return { ...post, media_urls: processedMedia };
            }
            return post;
        });

        const validPosts = processedPosts.filter(post => post && post.user);
        
        res.json({ 
            success: true, 
            posts: validPosts,
            pagination: {
                page,
                limit,
                hasMore: posts.length === limit
            }
        });
    } catch (error) {
        console.log('💥 Error in getFeedPosts:', error);
        res.json({ success: false, message: error.message });
    }
}

// Helper function to detect file type from magic bytes
const detectFileTypeFromBuffer = (buffer) => {
    if (!buffer || buffer.length < 12) return 'unknown';
    
    const hex = buffer.slice(0, 12).toString('hex');
    
    // Common file signatures
    const signatures = {
        // Images
        'png': ['89504e470d0a1a0a'],
        'jpg': ['ffd8ffe0', 'ffd8ffe1', 'ffd8ffe2', 'ffd8ffe3', 'ffd8ffe8'],
        'jpeg': ['ffd8ffe0', 'ffd8ffe1', 'ffd8ffe2', 'ffd8ffe3', 'ffd8ffe8'],
        'gif': ['47494638'],
        'webp': ['52494646'],
        
        // Videos
        'mp4': ['6674797069736f6d', '667479706d703432', '0000001866747970'],
        'avi': ['52494646'],
        'mov': ['6674797061747421', '6674797071742020'],
        'webm': ['1a45dfa3'],
        'mkv': ['1a45dfa3'],
        'wmv': ['3026b2758e66cf11'],
        'flv': ['464c5601']
    };
    
    for (const [type, sigs] of Object.entries(signatures)) {
        for (const sig of sigs) {
            if (hex.startsWith(sig)) {
                return type;
            }
        }
    }
    
    return 'unknown';
};

// =========== UPDATED: Add Post with Smart File Handling ===========
export const addPost = async (req, res) => {
    try {
        const userId = req.userId;
        const { content, post_type } = req.body;
        const mediaFiles = req.files;

        console.log('➕ Add Post - User:', userId);
        console.log('📁 Media files received:', mediaFiles?.length);

        const user = await User.findById(userId);
        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }

        let media_urls = [];
        let videoUploadPromises = [];

        if (mediaFiles && mediaFiles.length) {
            for (let i = 0; i < mediaFiles.length; i++) {
                const file = mediaFiles[i];
                console.log('📤 Processing media:', file.originalname, 'Type:', file.mimetype, 'Size:', (file.size / 1024 / 1024).toFixed(2) + 'MB');
                
                // =========== STEP 1: BASIC VALIDATION ===========
                if (!file.buffer || file.buffer.length === 0) {
                    console.log('❌ No buffer found for file:', file.originalname);
                    throw new Error('Invalid file buffer. File may be corrupted.');
                }

                // =========== STEP 2: DETECT ACTUAL FILE TYPE ===========
                const actualFileType = detectFileTypeFromBuffer(file.buffer);
                const declaredMimeType = file.mimetype;
                const isDeclaredImage = declaredMimeType?.startsWith('image/');
                const isDeclaredVideo = declaredMimeType?.startsWith('video/');
                
                console.log(`🔍 File analysis:`, {
                    originalName: file.originalname,
                    declaredType: declaredMimeType,
                    actualType: actualFileType,
                    fileExtension: file.originalname.split('.').pop().toLowerCase()
                });

                // =========== STEP 3: HANDLE MISMATCHED FILES ===========
                let finalFileType = 'unknown';
                
                if (actualFileType === 'png' || actualFileType === 'jpg' || actualFileType === 'jpeg' || actualFileType === 'gif' || actualFileType === 'webp') {
                    // File is actually an image
                    if (isDeclaredVideo) {
                        console.log(`⚠️ File mismatch: Declared as video but is actually ${actualFileType.toUpperCase()} image`);
                        console.log(`ℹ️ Converting to image upload instead...`);
                    }
                    finalFileType = 'image';
                    
                } else if (actualFileType === 'mp4' || actualFileType === 'mov' || actualFileType === 'avi' || actualFileType === 'webm' || actualFileType === 'mkv') {
                    // File is actually a video
                    if (isDeclaredImage) {
                        console.log(`⚠️ File mismatch: Declared as image but is actually ${actualFileType.toUpperCase()} video`);
                        console.log(`ℹ️ Converting to video upload instead...`);
                    }
                    finalFileType = 'video';
                    
                } else {
                    // Unknown file type
                    if (isDeclaredImage) {
                        console.log(`⚠️ Could not verify image format, trusting declared type`);
                        finalFileType = 'image';
                    } else if (isDeclaredVideo) {
                        console.log(`⚠️ Could not verify video format, trusting declared type`);
                        finalFileType = 'video';
                    } else {
                        throw new Error('Unsupported or corrupted file. Please upload valid images or videos.');
                    }
                }

                // =========== STEP 4: SIZE VALIDATION ===========
                const maxImageSize = 50 * 1024 * 1024; // 50MB
                const maxVideoSize = 500 * 1024 * 1024; // 500MB
                const maxSize = finalFileType === 'video' ? maxVideoSize : maxImageSize;
                
                if (file.size > maxSize) {
                    throw new Error(`${finalFileType.charAt(0).toUpperCase() + finalFileType.slice(1)} too large. Maximum size is ${maxSize / 1024 / 1024}MB. Your file: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
                }

                // =========== STEP 5: UPLOAD BASED ON FINAL TYPE ===========
                if (finalFileType === 'image') {
                    // =========== UPLOAD TO IMAGEKIT ===========
                    console.log(`📤 Uploading as image to ImageKit:`, file.originalname);

                    try {
                        const response = await imagekit.upload({
                            file: file.buffer,
                            fileName: `img_${uuidv4()}_${Date.now()}_${file.originalname}`,
                            folder: `posts/images/${userId}`,
                            useUniqueFileName: true,
                        });

                        console.log(`✅ Image uploaded to ImageKit:`, response.filePath);

                        // Get optimized image URL
                        const url = imagekit.url({
                            path: response.filePath,
                            transformation: [
                                { quality: 'auto' },
                                { format: 'webp' },
                                { width: '1280' }
                            ]
                        });

                        media_urls.push({
                            url: url,
                            thumbnail: url,
                            type: 'image',
                            filePath: response.filePath,
                            size: file.size,
                            duration: 0,
                            storage: 'imagekit',
                            mime_type: 'image/' + actualFileType,
                            original_name: file.originalname,
                            detected_type: actualFileType,
                            was_mismatched: actualFileType !== 'unknown' && isDeclaredVideo
                        });
                        
                        console.log(`✅ Image stored successfully`);
                        
                    } catch (uploadError) {
                        console.log('❌ Image upload failed:', uploadError.message);
                        throw new Error(`Failed to upload image: ${uploadError.message}`);
                    }
                    
                } else if (finalFileType === 'video') {
                    // =========== UPLOAD TO CLOUDINARY ===========
                    console.log(`🎬 Uploading as video to Cloudinary:`, file.originalname);
                    
                    // Create upload promise for this video
                    const videoUploadPromise = new Promise(async (resolve, reject) => {
                        try {
                            // Create a readable stream from buffer
                            const bufferStream = new stream.PassThrough();
                            bufferStream.end(file.buffer);
                            
                            // Generate unique file name
                            const uniqueFileName = `vid_${userId}_${Date.now()}_${uuidv4().substring(0, 8)}`;
                            
                            // Upload to Cloudinary
                            const uploadResult = await new Promise((resolveUpload, rejectUpload) => {
                                const uploadStream = cloudinary.uploader.upload_stream(
                                    {
                                        resource_type: 'video',
                                        folder: `posts/videos/${userId}`,
                                        public_id: uniqueFileName,
                                        chunk_size: 6000000,
                                        eager: [
                                            { 
                                                width: 320, 
                                                height: 180, 
                                                crop: 'fill', 
                                                format: 'jpg',
                                                quality: 'auto'
                                            }
                                        ],
                                        eager_async: false,
                                        timeout: 300000
                                    },
                                    (error, result) => {
                                        if (error) {
                                            console.log('❌ Cloudinary upload error:', error.message);
                                            rejectUpload(error);
                                            return;
                                        }
                                        resolveUpload(result);
                                    }
                                );
                                
                                bufferStream.pipe(uploadStream);
                            });

                            console.log(`✅ Video uploaded to Cloudinary:`, uploadResult.public_id);
                            
                            // Get thumbnail URL
                            let thumbnailUrl = uploadResult.secure_url.replace(/\.[^/.]+$/, ".jpg");
                            if (uploadResult.eager && uploadResult.eager.length > 0) {
                                thumbnailUrl = uploadResult.eager[0].secure_url;
                            }

                            const videoData = {
                                url: uploadResult.secure_url,
                                thumbnail: thumbnailUrl,
                                public_id: uploadResult.public_id,
                                type: 'video',
                                size: uploadResult.bytes || file.size,
                                duration: Math.round(uploadResult.duration || 0),
                                width: uploadResult.width,
                                height: uploadResult.height,
                                format: uploadResult.format,
                                storage: 'cloudinary',
                                mime_type: 'video/' + actualFileType,
                                original_name: file.originalname,
                                detected_type: actualFileType,
                                was_mismatched: actualFileType !== 'unknown' && isDeclaredImage
                            };

                            media_urls.push(videoData);
                            console.log(`✅ Video stored successfully: ${uploadResult.duration}s, ${uploadResult.format}`);
                            resolve(videoData);
                            
                        } catch (videoError) {
                            console.log('❌ Video upload failed:', videoError.message);
                            reject(new Error(`Failed to upload video: ${videoError.message}`));
                        }
                    });
                    
                    videoUploadPromises.push(videoUploadPromise);
                }
            }
        }

        // Wait for all video uploads to complete
        if (videoUploadPromises.length > 0) {
            console.log(`⏳ Waiting for ${videoUploadPromises.length} video upload(s) to complete...`);
            await Promise.all(videoUploadPromises);
            console.log(`✅ All video uploads completed`);
        }

        // Determine post type
        const finalPostType = determinePostType(content, media_urls, post_type);
        
        // Create the post
        const newPost = await Post.create({
            user: userId,
            content: content || "",
            media_urls,
            post_type: finalPostType
        });
        
        console.log('✅ Post created successfully with', media_urls.length, 'media files');
        
        // Log media details
        media_urls.forEach((media, index) => {
            console.log(`   Media ${index + 1}: ${media.type} (${media.storage})`);
            if (media.was_mismatched) {
                console.log(`       ⚠️ File was corrected from wrong type`);
            }
        });
        
        res.json({ 
            success: true, 
            message: "Post created successfully", 
            post: newPost 
        });
        
    } catch (error) {
        console.log('💥 Error in addPost:', error.message);
        res.json({ 
            success: false, 
            message: error.message
        });
    }
}

// Helper function to determine post type
const determinePostType = (content, media_urls, specifiedType) => {
    if (specifiedType) return specifiedType;

    const hasImages = media_urls.some(media => media.type === 'image');
    const hasVideos = media_urls.some(media => media.type === 'video');
    const hasText = content && content.trim().length > 0;

    if (hasText && hasImages && hasVideos) return 'text_with_media';
    if (hasText && hasImages) return 'text_with_image';
    if (hasText && hasVideos) return 'text_with_video';
    if (hasImages && hasVideos) return 'media';
    if (hasImages) return 'image';
    if (hasVideos) return 'video';
    if (hasText) return 'text';
    return 'text';
}

// =========== NEW: Validate File Before Upload ===========
export const validateMediaFile = async (req, res) => {
    try {
        const file = req.file;
        
        if (!file) {
            return res.json({ success: false, message: "No file provided" });
        }

        console.log('🔍 Validating file:', {
            name: file.originalname,
            mimetype: file.mimetype,
            size: (file.size / 1024 / 1024).toFixed(2) + 'MB'
        });

        // Detect actual file type
        const actualFileType = detectFileTypeFromBuffer(file.buffer);
        const isDeclaredImage = file.mimetype?.startsWith('image/');
        const isDeclaredVideo = file.mimetype?.startsWith('video/');

        let finalType = 'unknown';
        let message = '';

        if (actualFileType === 'png' || actualFileType === 'jpg' || actualFileType === 'jpeg' || actualFileType === 'gif' || actualFileType === 'webp') {
            finalType = 'image';
            if (isDeclaredVideo) {
                message = `File is actually a ${actualFileType.toUpperCase()} image but was declared as video. It will be uploaded as an image.`;
            }
        } else if (actualFileType === 'mp4' || actualFileType === 'mov' || actualFileType === 'avi' || actualFileType === 'webm' || actualFileType === 'mkv') {
            finalType = 'video';
            if (isDeclaredImage) {
                message = `File is actually a ${actualFileType.toUpperCase()} video but was declared as image. It will be uploaded as a video.`;
            }
        } else {
            if (isDeclaredImage) finalType = 'image';
            else if (isDeclaredVideo) finalType = 'video';
            message = 'Could not verify file format. Uploading based on declared type.';
        }

        // Check size limits
        const maxImageSize = 50 * 1024 * 1024;
        const maxVideoSize = 500 * 1024 * 1024;
        const maxSize = finalType === 'video' ? maxVideoSize : maxImageSize;
        
        if (file.size > maxSize) {
            return res.json({ 
                success: false, 
                message: `${finalType.charAt(0).toUpperCase() + finalType.slice(1)} too large. Maximum size is ${maxSize / 1024 / 1024}MB. Your file: ${(file.size / 1024 / 1024).toFixed(2)}MB` 
            });
        }

        res.json({ 
            success: true, 
            message: message || 'File is valid for upload',
            fileType: finalType,
            actualType: actualFileType,
            declaredType: file.mimetype,
            size: file.size,
            maxAllowed: maxSize,
            willCorrect: actualFileType !== 'unknown' && ((isDeclaredVideo && finalType === 'image') || (isDeclaredImage && finalType === 'video'))
        });

    } catch (error) {
        console.log('💥 Error in validateMediaFile:', error);
        res.json({ success: false, message: error.message });
    }
}

// =========== REST OF THE FUNCTIONS (SAME AS BEFORE) ===========
// [Keep all the other functions exactly as they were in your original code]

// Get Posts for User Profile (with privacy check) - OPTIMIZED
export const getUserProfilePosts = async (req, res) => {
    try {
        const { profileId } = req.body;
        const userId = req.userId;

        console.log('👤 Get Profile Posts - Profile:', profileId, 'User:', userId);

        if (!profileId) {
            return res.json({ success: false, message: "Profile ID is required" });
        }

        const profileUser = await User.findById(profileId).select('settings followers connections');
        if (!profileUser) {
            return res.json({ success: false, message: "User not found" });
        }

        if (profileUser.settings?.profilePrivacy === 'private') {
            const isFollower = profileUser.followers?.includes(userId) || false;
            const isOwner = userId === profileId;
            const isConnection = profileUser.connections?.includes(userId) || false;
            
            if (!isFollower && !isOwner && !isConnection) {
                return res.json({ success: true, posts: [] });
            }
        }

        const posts = await Post.find({ user: profileId })
            .populate({
                path: 'user',
                select: '_id username full_name profile_picture'
            })
            .select('_id user content media_urls post_type likes_count comments_count shares_count createdAt')
            .sort({ createdAt: -1 })
            .lean();

        res.json({ success: true, posts: posts || [] });
    } catch (error) {
        console.log('💥 Error in getUserProfilePosts:', error);
        res.json({ success: false, message: error.message });
    }
}

// Like Post
export const likePost = async (req, res) => {
    try {
        const userId = req.userId;
        const { postId } = req.body;

        console.log('❤️ Like Post - User:', userId, 'Post:', postId);

        const user = await User.findById(userId);
        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }

        const post = await Post.findById(postId);
        if (!post) {
            return res.json({ success: false, message: "Post not found" });
        }

        if (!Array.isArray(post.likes_count)) {
            post.likes_count = [];
        }

        if (post.likes_count.includes(userId)) {
            post.likes_count = post.likes_count.filter(likeUserId => likeUserId.toString() !== userId.toString());
            await post.save();
            res.json({ success: true, message: 'Post unliked', liked: false });
        } else {
            post.likes_count.push(userId);
            await post.save();
            res.json({ success: false, message: 'Post liked', liked: true });
        }

    } catch (error) {
        console.log('💥 Error in likePost:', error);
        res.json({ success: false, message: error.message });
    }
}

// Get comments count for a post
export const getCommentsCount = async (req, res) => {
    try {
        const { postId } = req.params;
        
        if (!postId) {
            return res.json({ success: false, message: "Post ID is required" });
        }

        const count = await Comment.countDocuments({ post: postId });
        res.json({ success: true, count: count || 0 });
    } catch (error) {
        console.log('💥 Error in getCommentsCount:', error);
        res.json({ success: false, message: error.message });
    }
}

// Add comment to a post
export const addComment = async (req, res) => {
    try {
        const userId = req.userId;
        const { postId, content } = req.body;

        console.log('💬 Add Comment - User:', userId, 'Post:', postId, 'Content:', content);

        if (!postId || !content?.trim()) {
            return res.json({ success: false, message: "Post ID and content are required" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }

        const post = await Post.findById(postId);
        if (!post) {
            return res.json({ success: false, message: "Post not found" });
        }

        const newComment = await Comment.create({
            user: userId,
            post: postId,
            content: content.trim()
        });

        await Post.findByIdAndUpdate(postId, { 
            $inc: { comments_count: 1 } 
        });

        res.json({ success: true, message: 'Comment added successfully', comment: newComment });
    } catch (error) {
        console.log('💥 Error in addComment:', error);
        res.json({ success: false, message: error.message });
    }
}

// Get shares count for a post
export const getSharesCount = async (req, res) => {
    try {
        const { postId } = req.params;
        
        if (!postId) {
            return res.json({ success: false, message: "Post ID is required" });
        }

        const count = await Share.countDocuments({ post: postId });
        res.json({ success: true, count: count || 0 });
    } catch (error) {
        console.log('💥 Error in getSharesCount:', error);
        res.json({ success: false, message: error.message });
    }
}

// Share a post
export const sharePost = async (req, res) => {
    try {
        const userId = req.userId;
        const { postId } = req.body;

        console.log('🔄 Share Post - User:', userId, 'Post:', postId);

        if (!postId) {
            return res.json({ success: false, message: "Post ID is required" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }

        const post = await Post.findById(postId);
        if (!post) {
            return res.json({ success: false, message: "Post not found" });
        }

        const existingShare = await Share.findOne({ user: userId, post: postId });
        if (existingShare) {
            return res.json({ success: false, message: 'Post already shared' });
        }

        await Share.create({
            user: userId,
            post: postId
        });

        await Post.findByIdAndUpdate(postId, { 
            $inc: { shares_count: 1 } 
        });

        res.json({ success: true, message: 'Post shared successfully' });
    } catch (error) {
        console.log('💥 Error in sharePost:', error);
        res.json({ success: false, message: error.message });
    }
}

// Get post comments with user profiles - OPTIMIZED
export const getPostComments = async (req, res) => {
    try {
        const { postId } = req.params;
        
        if (!postId) {
            return res.json({ success: false, message: "Post ID is required" });
        }
        
        console.log('🔍 Fetching comments for post:', postId);
        
        const comments = await Comment.find({ post: postId })
            .populate({
                path: 'user',
                select: '_id username full_name profile_picture',
                options: { allowNull: true }
            })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        console.log('✅ Found comments:', comments.length);
        
        const safeComments = comments.map(comment => ({
            _id: comment._id,
            content: comment.content,
            post: comment.post,
            createdAt: comment.createdAt,
            updatedAt: comment.updatedAt,
            user: comment.user ? {
                _id: comment.user._id,
                username: comment.user.username || 'unknown',
                full_name: comment.user.full_name || 'Unknown User',
                profile_picture: comment.user.profile_picture || ''
            } : {
                _id: comment.user,
                username: 'deleted_user',
                full_name: 'Deleted User',
                profile_picture: ''
            }
        }));

        res.json({ success: true, comments: safeComments });
    } catch (error) {
        console.log('💥 Error in getPostComments:', error);
        res.json({ success: false, message: error.message });
    }
}

// Update comment
export const updateComment = async (req, res) => {
    try {
        const userId = req.userId;
        const { commentId } = req.params;
        const { content } = req.body;

        console.log('✏️ Update Comment - User:', userId, 'Comment:', commentId);

        if (!commentId || !content?.trim()) {
            return res.json({ success: false, message: "Comment ID and content are required" });
        }

        const comment = await Comment.findById(commentId);
        if (!comment) {
            return res.json({ success: false, message: "Comment not found" });
        }

        if (comment.user.toString() !== userId) {
            return res.json({ success: false, message: "You can only edit your own comments" });
        }

        comment.content = content.trim();
        await comment.save();

        res.json({ success: true, message: 'Comment updated successfully', comment });
    } catch (error) {
        console.log('💥 Error in updateComment:', error);
        res.json({ success: false, message: error.message });
    }
}

// Delete comment
export const deleteComment = async (req, res) => {
    try {
        const userId = req.userId;
        const { commentId } = req.params;

        console.log('🗑️ Delete Comment - User:', userId, 'Comment:', commentId);

        if (!commentId) {
            return res.json({ success: false, message: "Comment ID is required" });
        }

        const comment = await Comment.findById(commentId);
        if (!comment) {
            return res.json({ success: false, message: "Comment not found" });
        }

        if (comment.user.toString() !== userId) {
            return res.json({ success: false, message: "You can only delete your own comments" });
        }

        await Comment.findByIdAndDelete(commentId);

        await Post.findByIdAndUpdate(comment.post, { 
            $inc: { comments_count: -1 } 
        });

        res.json({ success: true, message: 'Comment deleted successfully' });
    } catch (error) {
        console.log('💥 Error in deleteComment:', error);
        res.json({ success: false, message: error.message });
    }
}

// Delete Post
export const deletePost = async (req, res) => {
    try {
        const userId = req.userId;
        const { postId } = req.params;

        console.log('🗑️ Delete Post - User:', userId, 'Post:', postId);

        if (!postId) {
            return res.json({ success: false, message: "Post ID is required" });
        }

        const post = await Post.findById(postId);
        if (!post) {
            return res.json({ success: false, message: "Post not found" });
        }

        if (post.user.toString() !== userId) {
            return res.json({ success: false, message: "You can only delete your own posts" });
        }

        // Delete Cloudinary videos if any
        if (post.media_urls && post.media_urls.length > 0) {
            for (const media of post.media_urls) {
                if (media.storage === 'cloudinary' && media.public_id) {
                    try {
                        await cloudinary.uploader.destroy(media.public_id, {
                            resource_type: 'video',
                            invalidate: true
                        });
                        console.log(`✅ Deleted Cloudinary video: ${media.public_id}`);
                    } catch (cloudinaryError) {
                        console.log(`⚠️ Could not delete Cloudinary video ${media.public_id}:`, cloudinaryError.message);
                    }
                }
            }
        }

        await Comment.deleteMany({ post: postId });
        await Share.deleteMany({ post: postId });
        await Post.findByIdAndDelete(postId);

        res.json({ success: true, message: 'Post deleted successfully' });
    } catch (error) {
        console.log('💥 Error in deletePost:',  error);
        res.json({ success: false, message: error.message });
    }
}

// =========== NEW: Get Post Video ===========
export const getPostVideo = async (req, res) => {
    try {
        const { postId, mediaIndex } = req.params;
        console.log(`🎬 Loading video for post ${postId}, media ${mediaIndex}`);

        const post = await Post.findById(postId).lean();
        
        if (!post || !post.media_urls || !post.media_urls[mediaIndex]) {
            return res.json({ success: false, message: "Video not found" });
        }

        const media = post.media_urls[mediaIndex];
        
        if (media.type !== 'video') {
            return res.json({ success: false, message: "Not a video" });
        }

        res.json({ 
            success: true, 
            video: {
                url: media.url,
                thumbnail: media.thumbnail,
                size: media.size,
                duration: media.duration
            }
        });
    } catch (error) {
        console.log('💥 Error in getPostVideo:', error);
        res.json({ success: false, message: error.message });
    }
}

// =========== NEW: Get Video Processing Status ===========
export const getVideoProcessingStatus = async (req, res) => {
    try {
        const { publicId } = req.params;
        
        const result = await cloudinary.api.resource(publicId, {
            resource_type: 'video'
        });

        res.json({
            success: true,
            status: result.status,
            duration: result.duration,
            width: result.width,
            height: result.height,
            format: result.format,
            bit_rate: result.bit_rate,
            eager_status: result.eager ? result.eager[0]?.status : 'completed'
        });
    } catch (error) {
        console.log('💥 Error in getVideoProcessingStatus:', error);
        res.json({ success: false, message: error.message });
    }
}

// =========== NEW: Delete Cloudinary Media ===========
export const deleteCloudinaryMedia = async (req, res) => {
    try {
        const { publicId, resourceType = 'video' } = req.body;
        
        const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType,
            invalidate: true
        });

        res.json({ success: true, result });
    } catch (error) {
        console.log('💥 Error in deleteCloudinaryMedia:', error);
        res.json({ success: false, message: error.message });
    }
}