import imagekit from "../configs/imageKit.js";
import Post from "../models/Post.js";
import User from "../models/User.js";
import Comment from "../models/Comment.js";
import Share from "../models/Share.js";
import { v4 as uuidv4 } from 'uuid';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import stream from 'stream';
import { Buffer } from 'buffer';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// Video compression settings
const VIDEO_SETTINGS = {
  maxSize: 100 * 1024 * 1024, // 100MB
  maxDuration: 60, // 60 seconds
  targetResolution: '1280x720',
  crf: 28,
  preset: 'fast',
  videoBitrate: '1500k',
  audioBitrate: '128k',
  fps: 30
};

// Get video duration safely
const getVideoDuration = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const readableStream = new stream.PassThrough();
    readableStream.end(fileBuffer);
    
    ffmpeg(readableStream)
      .ffprobe((err, metadata) => {
        if (err) {
          reject(err);
          return;
        }
        const duration = metadata.format.duration;
        resolve(duration);
      });
  });
};

// Process video in chunks to avoid memory issues
const processVideoInChunks = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    console.log('🎥 Processing video with chunk-based compression...');
    
    const chunks = [];
    let totalSize = 0;
    
    const readableStream = new stream.PassThrough();
    readableStream.end(fileBuffer);
    
    ffmpeg(readableStream)
      .videoCodec('libx264')
      .size(VIDEO_SETTINGS.targetResolution)
      .videoBitrate(VIDEO_SETTINGS.videoBitrate)
      .fps(VIDEO_SETTINGS.fps)
      .addOptions([
        `-crf ${VIDEO_SETTINGS.crf}`,
        `-preset ${VIDEO_SETTINGS.preset}`,
        '-movflags +faststart',
        '-profile:v high',
        '-level 4.0',
        '-threads 2',
        '-max_muxing_queue_size 1024'
      ])
      .audioCodec('aac')
      .audioBitrate(VIDEO_SETTINGS.audioBitrate)
      .format('mp4')
      .on('start', () => {
        console.log('🚀 FFmpeg compression started');
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          console.log(`📊 Compression progress: ${Math.round(progress.percent)}%`);
        }
      })
      .on('error', (error) => {
        console.log('❌ Compression error:', error);
        reject(error);
      })
      .on('end', () => {
        console.log('✅ Video compression completed');
        const compressedBuffer = Buffer.concat(chunks);
        resolve(compressedBuffer);
      })
      .pipe()
      .on('data', (chunk) => {
        chunks.push(chunk);
        totalSize += chunk.length;
        
        if (totalSize > VIDEO_SETTINGS.maxSize) {
          reject(new Error('Compressed video still too large'));
        }
      })
      .on('error', (error) => {
        reject(error);
      });
  });
};

// Fast light compression for large files
const fastLightCompression = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    
    const readableStream = new stream.PassThrough();
    readableStream.end(fileBuffer);
    
    ffmpeg(readableStream)
      .videoCodec('libx264')
      .size('1280x720')
      .addOptions([
        '-crf 32',
        '-preset ultrafast',
        '-movflags +faststart',
        '-threads 2'
      ])
      .audioCodec('aac')
      .audioBitrate('96k')
      .format('mp4')
      .on('end', () => {
        const compressedBuffer = Buffer.concat(chunks);
        resolve(compressedBuffer);
      })
      .on('error', reject)
      .pipe()
      .on('data', (chunk) => chunks.push(chunk))
      .on('error', reject);
  });
};

// Fallback compression - minimal processing
const fallbackCompression = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    
    const readableStream = new stream.PassThrough();
    readableStream.end(fileBuffer);
    
    ffmpeg(readableStream)
      .videoCodec('libx264')
      .size('854x480')
      .addOptions([
        '-crf 35',
        '-preset ultrafast'
      ])
      .audioCodec('aac')
      .audioBitrate('64k')
      .format('mp4')
      .on('end', () => {
        const compressedBuffer = Buffer.concat(chunks);
        resolve(compressedBuffer);
      })
      .on('error', (error) => {
        console.log('❌ Fallback compression failed, using original:', error.message);
        resolve(fileBuffer);
      })
      .pipe()
      .on('data', (chunk) => chunks.push(chunk))
      .on('error', () => resolve(fileBuffer));
  });
};

// Optimized video processing with fallbacks
const optimizeVideoProcessing = async (fileBuffer, originalSize) => {
  try {
    if (originalSize <= 50 * 1024 * 1024) {
      return await processVideoInChunks(fileBuffer);
    } else {
      console.log('⚡ Using fast compression for large video...');
      return await fastLightCompression(fileBuffer);
    }
  } catch (error) {
    console.log('⚠️ Primary compression failed, using fallback:', error.message);
    return await fallbackCompression(fileBuffer);
  }
};

// Get Feed Posts with Privacy Filtering
export const getFeedPosts = async (req, res) => {
    try {
        const userId = req.userId;

        console.log('📝 Get Feed Posts - User:', userId);

        const currentUser = await User.findById(userId);
        if (!currentUser) {
            return res.json({ success: false, message: "User not found" });
        }

        const followingIds = currentUser.following || [];
        const connectionIds = currentUser.connections || [];
        
        console.log(`👥 Current user follows: ${followingIds.length} users, connections: ${connectionIds.length} users`);
        
        const allPosts = await Post.find({})
            .populate({
                path: 'user',
                select: '_id username full_name profile_picture settings followers following connections',
                options: { allowNull: true }
            })
            .sort({ createdAt: -1 })
            .limit(100);

        console.log(`📊 Total posts found: ${allPosts.length}`);

        const filteredPosts = allPosts.filter(post => {
            if (!post || !post.user) {
                console.log(`🚫 Filtered: Post or user is null for post ${post?._id}`);
                return false;
            }

            const postUser = post.user;
            const postUserId = postUser?._id?.toString();
            const currentUserId = currentUser._id.toString();
            
            console.log(`🔍 Checking post from: ${postUser?.username || 'unknown'}, Privacy: ${postUser?.settings?.profilePrivacy || 'public'}`);
            
            if (postUserId === currentUserId) {
                console.log(`✅ Showing: Own post from ${postUser?.username}`);
                return true;
            }
            
            if (postUserId && followingIds.includes(postUserId)) {
                console.log(`✅ Showing: Followed user ${postUser?.username}`);
                return true;
            }
            
            if (postUserId && connectionIds.includes(postUserId)) {
                console.log(`✅ Showing: Connection ${postUser?.username}`);
                return true;
            }
            
            if (postUser?.settings?.profilePrivacy === 'public') {
                console.log(`✅ Showing: Public account ${postUser?.username}`);
                return true;
            }
            
            if (postUser?.settings?.profilePrivacy === 'private') {
                console.log(`🚫 Filtered: Private account ${postUser?.username} - Not followed or connected`);
                return false;
            }
            
            console.log(`✅ Showing: Default (no privacy setting) ${postUser?.username}`);
            return true;
        });

        console.log(`✅ Feed filtered: ${filteredPosts.length} posts out of ${allPosts.length} total`);
        
        const finalPosts = filteredPosts.slice(0, 50);
        
        res.json({ success: true, posts: finalPosts });
    } catch (error) {
        console.log('💥 Error in getFeedPosts:', error);
        res.json({ success: false, message: error.message });
    }
}

// Get Posts for User Profile (with privacy check)
export const getUserProfilePosts = async (req, res) => {
    try {
        const { profileId } = req.body;
        const userId = req.userId;

        console.log('👤 Get Profile Posts - Profile:', profileId, 'User:', userId);

        if (!profileId) {
            return res.json({ success: false, message: "Profile ID is required" });
        }

        const profileUser = await User.findById(profileId);
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
                select: '_id username full_name profile_picture settings'
            })
            .sort({ createdAt: -1 });

        res.json({ success: true, posts: posts || [] });
    } catch (error) {
        console.log('💥 Error in getUserProfilePosts:', error);
        res.json({ success: false, message: error.message });
    }
}

// Add Post - Fixed with better memory management
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

        if (mediaFiles && mediaFiles.length) {
            for (let i = 0; i < mediaFiles.length; i++) {
                const file = mediaFiles[i];
                console.log('📤 Processing media:', file.originalname, 'Type:', file.mimetype, 'Size:', (file.size / 1024 / 1024).toFixed(2) + 'MB');
                
                const fileType = file.mimetype.startsWith('image/') ? 'image' : 'video';
                
                if (fileType === 'image') {
                    console.log('🖼️ Uploading image to ImageKit:', file.originalname);
                    
                    if (!file.buffer) {
                        console.log('❌ No buffer found for file:', file.originalname);
                        throw new Error('Invalid file buffer');
                    }

                    const response = await imagekit.upload({
                        file: file.buffer,
                        fileName: `img_${uuidv4()}_${file.originalname}`,
                        folder: "posts/images",
                    });

                    console.log('✅ Image uploaded to ImageKit:', response.filePath);

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
                        type: fileType,
                        filePath: response.filePath,
                        size: file.size,
                        storage: 'imagekit'
                    });
                } else {
                    console.log('🎥 Processing video:', file.originalname);
                    
                    if (!file.buffer) {
                        console.log('❌ No buffer found for video:', file.originalname);
                        throw new Error('Invalid file buffer');
                    }

                    if (file.size > VIDEO_SETTINGS.maxSize) {
                        throw new Error(`Video too large. Maximum size is 100MB. Your file: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
                    }

                    try {
                        const duration = await getVideoDuration(file.buffer);
                        console.log(`⏱️ Video duration: ${duration} seconds`);
                        
                        if (duration > VIDEO_SETTINGS.maxDuration) {
                            throw new Error(`Video too long. Maximum duration is 1 minute. Your video: ${Math.ceil(duration)} seconds`);
                        }
                    } catch (durationError) {
                        console.log('⚠️ Could not determine video duration, proceeding anyway:', durationError.message);
                    }

                    let finalVideoBuffer = file.buffer;
                    
                    if (file.size > 10 * 1024 * 1024) {
                        console.log('🔧 Compressing video for optimal storage...');
                        try {
                            finalVideoBuffer = await optimizeVideoProcessing(file.buffer, file.size);
                            console.log(`✅ Video compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(finalVideoBuffer.length / 1024 / 1024).toFixed(2)}MB`);
                            
                            if (finalVideoBuffer.length > VIDEO_SETTINGS.maxSize) {
                                throw new Error('Compressed video still exceeds 100MB limit');
                            }
                        } catch (compressError) {
                            console.log('⚠️ Compression failed, using original:', compressError.message);
                            if (file.size > VIDEO_SETTINGS.maxSize) {
                                throw new Error('Video too large and compression failed');
                            }
                        }
                    }

                    const base64Data = finalVideoBuffer.toString('base64');
                    const dataUrl = `data:${file.mimetype};base64,${base64Data}`;
                    
                    console.log('✅ Video stored in MongoDB, Size:', (finalVideoBuffer.length / 1024 / 1024).toFixed(2) + 'MB');
                    
                    media_urls.push({
                        url: dataUrl,
                        type: fileType,
                        filePath: `video_${uuidv4()}_${file.originalname}`,
                        size: finalVideoBuffer.length,
                        mimeType: file.mimetype,
                        storage: 'mongodb'
                    });
                }
            }
        }

        let finalPostType = post_type;
        if (!finalPostType) {
            const hasImages = media_urls.some(media => media.type === 'image');
            const hasVideos = media_urls.some(media => media.type === 'video');
            const hasText = content && content.trim().length > 0;

            if (hasText && hasImages && hasVideos) finalPostType = 'text_with_media';
            else if (hasText && hasImages) finalPostType = 'text_with_image';
            else if (hasText && hasVideos) finalPostType = 'text_with_video';
            else if (hasImages && hasVideos) finalPostType = 'media';
            else if (hasImages) finalPostType = 'image';
            else if (hasVideos) finalPostType = 'video';
            else if (hasText) finalPostType = 'text';
            else finalPostType = 'text';
        }

        const newPost = await Post.create({
            user: userId,
            content: content || "",
            media_urls,
            post_type: finalPostType
        });
        
        console.log('✅ Post created successfully with', media_urls.length, 'media files');
        
        media_urls.forEach((media, index) => {
            console.log(`   Media ${index + 1}: ${media.type}, Storage: ${media.storage}, Size: ${(media.size / 1024 / 1024).toFixed(2)}MB`);
        });
        
        res.json({ success: true, message: "Post created successfully", post: newPost });
    } catch (error) {
        console.log('💥 Error in addPost:', error);
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
            res.json({ success: true, message: 'Post liked', liked: true });
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

// Get post comments with user profiles
export const getPostComments = async (req, res) => {
    try {
        const { postId } = req.params;
        
        if (!postId) {
            return res.json({ success: false, message: "Post ID is required" });
        }
        
        console.log('🔍 Fetching comments for post:', postId);
        
        const comments = await Comment.find({ post: postId }).sort({ createdAt: -1 });
        console.log('📝 Found comments:', comments.length);
        
        const populatedComments = await Promise.all(
            comments.map(async (comment) => {
                try {
                    const user = await User.findById(comment.user);
                    
                    return {
                        _id: comment._id,
                        content: comment.content,
                        post: comment.post,
                        createdAt: comment.createdAt,
                        updatedAt: comment.updatedAt,
                        user: user ? {
                            _id: user._id,
                            username: user.username || 'unknown',
                            full_name: user.full_name || 'Unknown User',
                            profile_picture: user.profile_picture || ''
                        } : {
                            _id: comment.user,
                            username: 'deleted_user',
                            full_name: 'Deleted User',
                            profile_picture: ''
                        }
                    };
                } catch (userError) {
                    console.log('❌ Error fetching user:', userError);
                    return {
                        _id: comment._id,
                        content: comment.content,
                        post: comment.post,
                        createdAt: comment.createdAt,
                        updatedAt: comment.updatedAt,
                        user: {
                            _id: comment.user,
                            username: 'unknown_user',
                            full_name: 'Unknown User',
                            profile_picture: ''
                        }
                    };
                }
            })
        );

        console.log('✅ Final populated comments:', populatedComments.length);
        res.json({ success: true, comments: populatedComments });
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

        // Check if user owns the post
        if (post.user.toString() !== userId) {
            return res.json({ success: false, message: "You can only delete your own posts" });
        }

        // Delete associated comments and shares
        await Comment.deleteMany({ post: postId });
        await Share.deleteMany({ post: postId });

        // Delete the post
        await Post.findByIdAndDelete(postId);

        res.json({ success: true, message: 'Post deleted successfully' });
    } catch (error) {
        console.log('💥 Error in deletePost:', error);
        res.json({ success: false, message: error.message });
    }
}