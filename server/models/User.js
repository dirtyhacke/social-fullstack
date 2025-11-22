import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    _id: {type: String, required: true },
    email: {type: String, required: true },
    full_name: {type: String, required: true },
    username: {type: String, unique: true },
    bio: {type: String, default: 'Hey there! I am using PingUp.' },
    profile_picture: {type: String, default: '' },
    cover_photo: {type: String, default: '' },
    location: {type: String, default: '' },
    followers: [{type: String, ref: 'User' }],
    following: [{type: String, ref: 'User' }],
    connections: [{type: String, ref: 'User' }],
    lastSeen: { type: Date, default: Date.now },
    settings: {
        profilePrivacy: {
            type: String,
            enum: ['public', 'private'],
            default: 'public'
        },
        messageSetting: {
            type: String,
            enum: ['anyone', 'custom', 'private'],
            default: 'anyone'
        },
        allowedMessagingUsers: [{
            type: String,
            ref: 'User'
        }]
    }
},{timestamps: true, minimize: false})

const User = mongoose.model('User', userSchema)

export default User