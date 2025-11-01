import User from '../models/User.js';

export const protect = async (req, res, next) => {
    try {
        console.log('🛡️ ===== PROTECT MIDDLEWARE START =====');
        console.log('🛡️ Request URL:', req.originalUrl);
        console.log('🛡️ Request Method:', req.method);
        
        const authHeader = req.headers.authorization;
        console.log('🛡️ Authorization header present:', !!authHeader);

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('❌ Protect: No Bearer token found in header');
            return res.status(401).json({ success: false, message: 'not authenticated' });
        }

        const token = authHeader.split(' ')[1];
        console.log('🛡️ Token extracted:', token ? `Present (first 20 chars: ${token.substring(0, 20)}...)` : 'Missing');

        if (!token) {
            console.log('❌ Protect: No token found after splitting');
            return res.status(401).json({ success: false, message: 'not authenticated' });
        }

        try {
            console.log('🛡️ Attempting to decode JWT token...');
            
            // Split the JWT token into parts
            const tokenParts = token.split('.');
            console.log('🛡️ Token parts count:', tokenParts.length);
            
            if (tokenParts.length !== 3) {
                console.log('❌ Protect: Invalid JWT format - expected 3 parts');
                return res.status(401).json({ success: false, message: 'not authenticated' });
            }

            // Decode the payload (second part)
            const payloadBase64 = tokenParts[1];
            
            // Base64 decode the payload
            const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
            console.log('🛡️ Decoded payload JSON:', payloadJson);
            
            const payloadObj = JSON.parse(payloadJson);
            console.log('🛡️ Parsed payload object:', payloadObj);
            
            const userId = payloadObj.sub;
            console.log('🛡️ Extracted user ID (sub):', userId);
            
            if (!userId) {
                console.log('❌ Protect: No user ID (sub) found in token payload');
                console.log('❌ Protect: Available payload keys:', Object.keys(payloadObj));
                return res.status(401).json({ success: false, message: 'not authenticated' });
            }
            
            // Verify user exists in database
            console.log('🛡️ Checking if user exists in database:', userId);
            const user = await User.findById(userId);
            if (!user) {
                console.log('❌ Protect: User not found in database for ID:', userId);
                return res.status(401).json({ success: false, message: 'not authenticated' });
            }
            
            console.log('✅ Protect: User found in database:', user.full_name);
            
            // Add user info to request object
            req.userId = userId;
            
            console.log('✅ Protect: Authentication successful, calling next()');
            console.log('🛡️ ===== PROTECT MIDDLEWARE END =====');
            next();
        } catch (parseError) {
            console.log('❌ Protect: Token parsing/verification failed:');
            console.log('❌ Protect: Error message:', parseError.message);
            console.log('❌ Protect: Error stack:', parseError.stack);
            return res.status(401).json({ success: false, message: 'not authenticated' });
        }

    } catch (error) {
        console.log('💥 Protect: Unexpected middleware error:');
        console.log('💥 Protect: Error message:', error.message);
        console.log('💥 Protect: Error stack:', error.stack);
        return res.status(401).json({ success: false, message: 'not authenticated' });
    }
};