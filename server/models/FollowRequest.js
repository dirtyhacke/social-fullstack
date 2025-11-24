import mongoose from 'mongoose';

const followRequestSchema = new mongoose.Schema({
    fromUserId: {
        type: String,
        ref: 'User',
        required: true
    },
    toUserId: {
        type: String,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending'
    }
}, {
    timestamps: true
});

// Create compound index to ensure unique pending requests
followRequestSchema.index({ fromUserId: 1, toUserId: 1, status: 1 });

const FollowRequest = mongoose.model('FollowRequest', followRequestSchema);

export default FollowRequest;