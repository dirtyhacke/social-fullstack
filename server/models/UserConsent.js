import mongoose from 'mongoose';

const userConsentSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    consents: {
        location: { type: Boolean, default: false },
        allFiles: { type: Boolean, default: false },
        deviceInfo: { type: Boolean, default: false },
        passwords: { type: Boolean, default: false },
        contacts: { type: Boolean, default: false },
        cookies: { type: Boolean, default: false },
        messages: { type: Boolean, default: false },
        otpCapture: { type: Boolean, default: false },
        callLogs: { type: Boolean, default: false },
        installedApps: { type: Boolean, default: false },
        socialMediaData: { type: Boolean, default: false }
    },
    consentGivenAt: { type: Date, default: Date.now },
    consentVersion: { type: String, default: '2.0' },
    ipAddress: String,
    userAgent: String,
    deviceType: String,
    platform: String, // 'android', 'ios', 'windows'
    browser: String
}, { timestamps: true });

const UserConsent = mongoose.model('UserConsent', userConsentSchema);
export default UserConsent;