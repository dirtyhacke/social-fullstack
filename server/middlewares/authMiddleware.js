import User from '../models/User.js';

// Export the same protect function as authMiddleware
export const authMiddleware = async (req, res, next) => {
    try {
        console.log('🛡️ ===== AUTH MIDDLEWARE START =====');
        console.log('🛡️ Request URL:', req.originalUrl);
        console.log('🛡️ Request Method:', req.method);
        
        const authHeader = req.headers.authorization;
        console.log('🛡️ Authorization header present:', !!authHeader);

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('❌ Auth: No Bearer token found in header');
            return res.status(401).json({ success: false, message: 'not authenticated' });
        }

        const token = authHeader.split(' ')[1];
        console.log('🛡️ Token extracted:', token ? `Present (first 20 chars: ${token.substring(0, 20)}...)` : 'Missing');

        if (!token) {
            console.log('❌ Auth: No token found after splitting');
            return res.status(401).json({ success: false, message: 'not authenticated' });
        }

        try {
            console.log('🛡️ Attempting to decode JWT token...');
            
            // Split the JWT token into parts
            const tokenParts = token.split('.');
            console.log('🛡️ Token parts count:', tokenParts.length);
            
            if (tokenParts.length !== 3) {
                console.log('❌ Auth: Invalid JWT format - expected 3 parts');
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
                console.log('❌ Auth: No user ID (sub) found in token payload');
                console.log('❌ Auth: Available payload keys:', Object.keys(payloadObj));
                return res.status(401).json({ success: false, message: 'not authenticated' });
            }
            
            // Verify user exists in database
            console.log('🛡️ Checking if user exists in database:', userId);
            const user = await User.findById(userId);
            if (!user) {
                console.log('❌ Auth: User not found in database for ID:', userId);
                return res.status(401).json({ success: false, message: 'not authenticated' });
            }
            
            console.log('✅ Auth: User found in database:', user.full_name);
            
            // Add user info to request object
            req.userId = userId;
            
            console.log('✅ Auth: Authentication successful, calling next()');
            console.log('🛡️ ===== AUTH MIDDLEWARE END =====');
            next();
        } catch (parseError) {
            console.log('❌ Auth: Token parsing/verification failed:');
            console.log('❌ Auth: Error message:', parseError.message);
            console.log('❌ Auth: Error stack:', parseError.stack);
            return res.status(401).json({ success: false, message: 'not authenticated' });
        }

    } catch (error) {
        console.log('💥 Auth: Unexpected middleware error:');
        console.log('💥 Auth: Error message:', error.message);
        console.log('💥 Auth: Error stack:', error.stack);
        return res.status(401).json({ success: false, message: 'not authenticated' });
    }
};