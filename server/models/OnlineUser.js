import mongoose from 'mongoose';

const onlineUserSchema = new mongoose.Schema({
    user: { type: String, ref: 'User', required: true, unique: true },
    socket_id: { type: String },
    is_searching: { type: Boolean, default: false },
    last_active: { type: Date, default: Date.now },
    preferences: {
        gender: { type: String, enum: ['male', 'female', 'any'], default: 'any' },
        age_range: {
            min: { type: Number, default: 18 },
            max: { type: Number, default: 60 }
        }
    }
}, { timestamps: true });

// TTL index to automatically remove inactive users after 5 minutes
onlineUserSchema.index({ last_active: 1 }, { expireAfterSeconds: 300 });

export default mongoose.model('OnlineUser', onlineUserSchema);