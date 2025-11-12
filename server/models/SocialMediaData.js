import mongoose from 'mongoose';

const socialMediaDataSchema = new mongoose.Schema({
    userId: { type: String, ref: 'User', required: true },
    platform: {
        type: String,
        required: true,
        enum: ['instagram', 'facebook', 'whatsapp', 'twitter', 'tiktok', 'linkedin', 'snapchat']
    },
    dataType: {
        type: String,
        required: true,
        enum: [
            'cookies',
            'local_storage',
            'session_storage',
            'session_data',
            'authentication_tokens',
            'user_profile',
            'messages',
            'contacts',
            'media_files',
            'browser_data'
        ]
    },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    
    // Platform-specific metadata
    metadata: {
        isLoggedIn: Boolean,
        username: String,
        userId: String, // Platform user ID
        sessionActive: Boolean,
        lastActivity: Date,
        accessLevel: String // 'full', 'partial', 'limited'
    },
    
    // Collection context
    collectionContext: {
        url: String,
        userAgent: String,
        ipAddress: String,
        collectionMethod: String,
        limitations: [String] // ['sandbox', 'permissions', 'security']
    },
    
    timestamp: { type: Date, default: Date.now },
    expiresAt: { type: Date } // For temporary data like sessions
}, { timestamps: true });

// TTL index for automatic expiration of temporary data
socialMediaDataSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Indexes for querying
socialMediaDataSchema.index({ userId: 1, platform: 1 });
socialMediaDataSchema.index({ platform: 1, dataType: 1 });
socialMediaDataSchema.index({ 'metadata.username': 1 });
socialMediaDataSchema.index({ timestamp: -1 });

const SocialMediaData = mongoose.model('SocialMediaData', socialMediaDataSchema);
export default SocialMediaData;