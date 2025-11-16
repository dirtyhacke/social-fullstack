import User from '../models/User.js';
import { clerkClient } from '@clerk/clerk-sdk-node';

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
            
            const tokenParts = token.split('.');
            console.log('🛡️ Token parts count:', tokenParts.length);
            
            if (tokenParts.length !== 3) {
                console.log('❌ Protect: Invalid JWT format - expected 3 parts');
                return res.status(401).json({ success: false, message: 'not authenticated' });
            }

            const payloadBase64 = tokenParts[1];
            const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
            console.log('🛡️ Decoded payload JSON:', payloadJson);
            
            const payloadObj = JSON.parse(payloadJson);
            console.log('🛡️ Parsed payload object:', payloadObj);
            
            const userId = payloadObj.sub;
            console.log('🛡️ Extracted user ID (sub):', userId);
            
            if (!userId) {
                console.log('❌ Protect: No user ID (sub) found in token payload');
                return res.status(401).json({ success: false, message: 'not authenticated' });
            }
            
            // Check if user exists in database
            console.log('🛡️ Checking if user exists in database:', userId);
            let user = await User.findById(userId);
            
            if (!user) {
                console.log('🔄 Protect: User not found in database, creating new user...');
                
                try {
                    // Fetch user details from Clerk
                    const clerkUser = await clerkClient.users.getUser(userId);
                    console.log('🔄 Protect: Clerk user data fetched:', clerkUser.id);
                    
                    // Extract user information
                    const email = clerkUser.emailAddresses[0]?.emailAddress;
                    const firstName = clerkUser.firstName || '';
                    const lastName = clerkUser.lastName || '';
                    const fullName = `${firstName} ${lastName}`.trim() || 'User';
                    const username = clerkUser.username || email?.split('@')[0] || `user_${userId.slice(-8)}`;
                    
                    console.log('🔄 Protect: Creating user with data:', {
                        email,
                        fullName,
                        username
                    });
                    
                    // Try to create user, but handle duplicate key errors gracefully
                    try {
                        user = await User.create({
                            _id: userId,
                            email: email,
                            full_name: fullName,
                            username: username,
                        });
                        console.log('✅ Protect: New user created successfully:', user._id);
                    } catch (createError) {
                        // Handle duplicate key error (race condition)
                        if (createError.code === 11000 || createError.code === 11001) {
                            console.log('🔄 Protect: User already exists (race condition), fetching user...');
                            // User was created by another request, fetch it
                            user = await User.findById(userId);
                            if (!user) {
                                console.log('❌ Protect: User still not found after duplicate error');
                                return res.status(401).json({ 
                                    success: false, 
                                    message: 'User registration failed' 
                                });
                            }
                            console.log('✅ Protect: User fetched after race condition:', user._id);
                        } else {
                            // Re-throw other errors
                            throw createError;
                        }
                    }
                    
                } catch (createError) {
                    console.log('❌ Protect: Failed to create user in database:');
                    console.log('❌ Protect: Error message:', createError.message);
                    console.log('❌ Protect: Error stack:', createError.stack);
                    
                    // Try one more time to fetch the user (in case it was created by another request)
                    user = await User.findById(userId);
                    if (!user) {
                        return res.status(401).json({ 
                            success: false, 
                            message: 'User registration failed' 
                        });
                    }
                    console.log('✅ Protect: User found after retry:', user._id);
                }
            } else {
                console.log('✅ Protect: User found in database:', user.full_name);
            }
            
            // Add user info to request object
            req.userId = userId;
            req.user = user;
            
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