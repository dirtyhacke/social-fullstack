// controllers/postController.js
import imagekit from "../configs/imageKit.js";
import Post from "../models/Post.js";
import User from "../models/User.js";
import Comment from "../models/Comment.js";
import Share from "../models/Share.js";

// Add Post
export const addPost = async (req, res) => {
    try {
        const userId = req.userId;
        const { content, post_type } = req.body;
        const mediaFiles = req.files;

        console.log('➕ Add Post - User:', userId);
        console.log('📁 Media files received:', mediaFiles?.length);

        // Verify user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }

        let media_urls = [];

        if (mediaFiles && mediaFiles.length) {
            media_urls = await Promise.all(
                mediaFiles.map(async (file) => {
                    console.log('📤 Uploading media:', file.originalname, 'Type:', file.mimetype);
                    
                    if (!file.buffer) {
                        console.log('❌ No buffer found for file:', file.originalname);
                        throw new Error('Invalid file buffer');
                    }

                    const response = await imagekit.upload({
                        file: file.buffer,
                        fileName: file.originalname,
                        folder: "posts",
                    });

                    console.log('✅ Media uploaded to ImageKit:', response.filePath);

                    // Determine file type
                    const fileType = file.mimetype.startsWith('image/') ? 'image' : 'video';
                    
                    // Generate URL with transformations for images, original for videos
                    let url;
                    if (fileType === 'image') {
                        url = imagekit.url({
                            path: response.filePath,
                            transformation: [
                                { quality: 'auto' },
                                { format: 'webp' },
                                { width: '1280' }
                            ]
                        });
                    } else {
                        // For videos, use the original URL
                        url = response.url;
                    }
                    
                    return {
                        url: url,
                        type: fileType,
                        filePath: response.filePath
                    };
                })
            ).catch(error => {
                console.log('❌ Error uploading media:', error);
                throw error;
            });
        }

        // Determine post type automatically if not provided
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

        await Post.create({
            user: userId,
            content: content || "",
            media_urls,
            post_type: finalPostType
        });
        
        console.log('✅ Post created successfully with', media_urls.length, 'media files');
        res.json({ success: true, message: "Post created successfully" });
    } catch (error) {
        console.log('💥 Error in addPost:', error);
        res.json({ success: false, message: error.message });
    }
}

// Get Posts
export const getFeedPosts = async (req, res) => {
    try {
        const userId = req.userId;

        console.log('📝 Get Feed Posts - User:', userId);

        // Verify user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }

        // User connections and followings 
        const userIds = [userId, ...(user.connections || []), ...(user.following || [])];
        const posts = await Post.find({ user: { $in: userIds } })
            .populate('user')
            .sort({ createdAt: -1 });

        res.json({ success: true, posts });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}

// Like Post
export const likePost = async (req, res) => {
    try {
        const userId = req.userId;
        const { postId } = req.body;

        console.log('❤️ Like Post - User:', userId, 'Post:', postId);

        // Verify user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }

        const post = await Post.findById(postId);
        if (!post) {
            return res.json({ success: false, message: "Post not found" });
        }

        if (post.likes_count.includes(userId)) {
            post.likes_count = post.likes_count.filter(likeUserId => likeUserId !== userId);
            await post.save();
            res.json({ success: true, message: 'Post unliked', liked: false });
        } else {
            post.likes_count.push(userId);
            await post.save();
            res.json({ success: true, message: 'Post liked', liked: true });
        }

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}

// Get comments count for a post
export const getCommentsCount = async (req, res) => {
    try {
        const { postId } = req.params;
        const count = await Comment.countDocuments({ post: postId });
        res.json({ success: true, count });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}

// Add comment to a post
export const addComment = async (req, res) => {
    try {
        const userId = req.userId;
        const { postId, content } = req.body;

        console.log('💬 Add Comment - User:', userId, 'Post:', postId, 'Content:', content);

        // Verify user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }

        // Check if post exists
        const post = await Post.findById(postId);
        if (!post) {
            return res.json({ success: false, message: "Post not found" });
        }

        await Comment.create({
            user: userId,
            post: postId,
            content
        });

        // Update post comments count
        await Post.findByIdAndUpdate(postId, { $inc: { comments_count: 1 } });

        res.json({ success: true, message: 'Comment added successfully' });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}

// Get shares count for a post
export const getSharesCount = async (req, res) => {
    try {
        const { postId } = req.params;
        const count = await Share.countDocuments({ post: postId });
        res.json({ success: true, count });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}

// Share a post
export const sharePost = async (req, res) => {
    try {
        const userId = req.userId;
        const { postId } = req.body;

        console.log('🔄 Share Post - User:', userId, 'Post:', postId);

        // Verify user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }

        // Check if post exists
        const post = await Post.findById(postId);
        if (!post) {
            return res.json({ success: false, message: "Post not found" });
        }

        // Check if user already shared this post
        const existingShare = await Share.findOne({ user: userId, post: postId });
        if (existingShare) {
            return res.json({ success: false, message: 'Post already shared' });
        }

        // Create share record
        await Share.create({
            user: userId,
            post: postId
        });

        // Update post shares count
        await Post.findByIdAndUpdate(postId, { $inc: { shares_count: 1 } });

        res.json({ success: true, message: 'Post shared successfully' });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}

// Get post comments with user profiles
export const getPostComments = async (req, res) => {
    try {
        const { postId } = req.params;
        console.log('🔍 Fetching comments for post:', postId);
        
        const comments = await Comment.find({ post: postId }).sort({ createdAt: -1 });
        console.log('📝 Found comments:', comments.length);
        
        // Manual population for String references
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
                            username: user.username,
                            full_name: user.full_name,
                            profile_picture: user.profile_picture
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
                        ...comment.toObject(),
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

        const comment = await Comment.findById(commentId);
        if (!comment) {
            return res.json({ success: false, message: "Comment not found" });
        }

        // Check if user owns the comment
        if (comment.user !== userId) {
            return res.json({ success: false, message: "You can only edit your own comments" });
        }

        comment.content = content;
        await comment.save();

        res.json({ success: true, message: 'Comment updated successfully' });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}

// Delete comment
export const deleteComment = async (req, res) => {
    try {
        const userId = req.userId;
        const { commentId } = req.params;

        console.log('🗑️ Delete Comment - User:', userId, 'Comment:', commentId);

        const comment = await Comment.findById(commentId);
        if (!comment) {
            return res.json({ success: false, message: "Comment not found" });
        }

        // Check if user owns the comment
        if (comment.user !== userId) {
            return res.json({ success: false, message: "You can only delete your own comments" });
        }

        await Comment.findByIdAndDelete(commentId);

        // Update post comments count
        await Post.findByIdAndUpdate(comment.post, { $inc: { comments_count: -1 } });

        res.json({ success: true, message: 'Comment deleted successfully' });
    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}