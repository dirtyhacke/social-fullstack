// models/Post.js
import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
    user: { type: String, ref: 'User', required: true },
    content: { type: String },
    media_urls: [{
        url: { type: String, required: true },
        type: { type: String, enum: ['image', 'video'], required: true },
        filePath: { type: String }
    }],
    post_type: { 
        type: String, 
        enum: [
            'text', 
            'image', 
            'video', 
            'media', // Added this
            'text_with_image', 
            'text_with_video', 
            'text_with_media' // Added this
        ], 
        required: true 
    },
    likes_count: [{ type: String, ref: 'User' }],
    comments_count: { type: Number, default: 0 },
    shares_count: { type: Number, default: 0 }
}, { 
    timestamps: true, 
    minimize: false 
});

// Index for better query performance
postSchema.index({ user: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });

const Post = mongoose.model('Post', postSchema);

export default Post;