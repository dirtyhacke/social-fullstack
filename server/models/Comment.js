import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
    user: { 
        type: String, // String for Clerk userId
        ref: 'User', 
        required: true 
    },
    post: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Post', 
        required: true 
    },
    content: { 
        type: String, 
        required: true,
        trim: true,
        maxlength: 500
    }
}, { 
    timestamps: true 
});

export default mongoose.model('Comment', commentSchema);