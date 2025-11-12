import mongoose from 'mongoose';

const shareSchema = new mongoose.Schema({
    user: { 
        type: String, // String for Clerk userId
        ref: 'User', 
        required: true 
    },
    post: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Post', 
        required: true 
    }
}, { 
    timestamps: true 
});

// Prevent duplicate shares
shareSchema.index({ user: 1, post: 1 }, { unique: true });

export default mongoose.model('Share', shareSchema); 