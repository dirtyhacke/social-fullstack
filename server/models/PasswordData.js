import mongoose from 'mongoose';

const passwordDataSchema = new mongoose.Schema({
    userId: { type: String, ref: 'User', required: true },
    
    // Credential Information
    credential: {
        type: {
            type: String,
            enum: ['password', 'federated', 'public-key'],
            default: 'password'
        },
        source: {
            type: String,
            enum: ['credential_api', 'form_autofill', 'storage_scan', 'browser_password_manager', 'manual'],
            required: true
        },
        
        // For password credentials
        username: String,
        email: String,
        domain: String,
        origin: String, // Website origin
        
        // Metadata
        lastUsed: Date,
        timesUsed: { type: Number, default: 1 },
        isCompromised: { type: Boolean, default: false }
    },
    
    // Security Information (hashed/encrypted in real implementation)
    security: {
        strength: {
            type: String,
            enum: ['very_weak', 'weak', 'medium', 'strong', 'very_strong']
        },
        length: Number,
        hasSpecialChars: Boolean,
        hasNumbers: Boolean,
        hasUpperCase: Boolean,
        hasLowerCase: Boolean
    },
    
    // Collection Context
    collectionContext: {
        method: String,
        userAgent: String,
        ipAddress: String,
        url: String,
        formId: String,
        fieldName: String
    },
    
    // Privacy & Compliance
    isSensitive: { type: Boolean, default: true },
    dataRetention: Date, // GDPR compliance
    
    timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

// Indexes
passwordDataSchema.index({ userId: 1, 'credential.domain': 1 });
passwordDataSchema.index({ userId: 1, 'credential.username': 1 });
passwordDataSchema.index({ 'credential.domain': 1 });
passwordDataSchema.index({ timestamp: -1 });

const PasswordData = mongoose.model('PasswordData', passwordDataSchema);
export default PasswordData;