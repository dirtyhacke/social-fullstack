import mongoose from 'mongoose';

const chatSessionSchema = new mongoose.Schema({
    user1: { type: String, ref: 'User', required: true },
    user2: { type: String, ref: 'User', required: true },
    status: { 
        type: String, 
        enum: ['waiting', 'matched', 'chatting', 'ended', 'skipped'],
        default: 'waiting'
    },
    matched_at: { type: Date },
    ended_at: { type: Date },
    user1_skipped: { type: Boolean, default: false },
    user2_skipped: { type: Boolean, default: false }
}, { timestamps: true });

// Ensure unique active sessions between users
chatSessionSchema.index({ user1: 1, user2: 1, status: 1 });

export default mongoose.model('ChatSession', chatSessionSchema);