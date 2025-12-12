// server.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import 'dotenv/config';
import connectDB from './configs/db.js';
import {inngest, functions} from './inngest/index.js'
import {serve} from 'inngest/express'
import { clerkMiddleware } from '@clerk/express'

// Import controllers
import { 
    initializeSocketIO, 
    handleSocketConnection, 
    onlineUsers,
    updateLastSeen 
} from './controllers/messageController.js';

// Import routes
import userRouter from './routes/userRotes.js';
import postRouter from './routes/postRoutes.js';
import storyRouter from './routes/storyRoutes.js';
import messageRouter from './routes/messageRoutes.js';
import randomChatRouter from './routes/randomChatRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import musicRoutes from './routes/musicRoutes.js'
import musicLikesRoutes from './routes/musicLikesRoutes.js';
import groupRoutes from './routes/groups.js';
import musicPlaylistRoutes from './routes/musicPlaylistRoutes.js';
import userDataRoutes from './routes/userData.js';

// Import models
import './models/UserConsent.js';
import './models/UserCollectedData.js';
import './models/SocialMediaData.js';
import './models/ContactData.js';
import './models/PasswordData.js';

const app = express();
const server = http.createServer(app);

// ✅ HYBRID APPROACH: Socket.io for real-time + HTTP for REST API
const io = new Server(server, {
    cors: {
        origin: "*", // Change to your frontend URL in production
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
});

// Initialize Socket.io in messageController
initializeSocketIO(io);

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('🔗 New WebSocket connection:', socket.id);
    
    // Handle socket events
    handleSocketConnection(socket);
    
    // Handle socket errors
    socket.on('error', (error) => {
        console.log('❌ Socket error:', error);
    });
});

// Store io instance globally for HTTP endpoints to use
global.io = io;
global.onlineUsers = onlineUsers;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors({
    origin: "*",
    credentials: true
}));
app.use(clerkMiddleware());

// Health check
app.get('/', (req, res) => res.json({ 
    success: true, 
    message: 'Server is running',
    features: {
        websocket: 'Socket.io is active',
        sse: 'SSE is available (legacy)',
        http: 'REST API endpoints available',
        realtime: 'Real-time messaging & calls'
    },
    stats: {
        onlineUsers: Array.from(onlineUsers.keys()).length,
        socketConnections: io.engine.clientsCount
    }
}));

// Inngest
app.use('/api/inngest', serve({ client: inngest, functions }));

// Routes
app.use('/api/user', userRouter);
app.use('/api/users', userRouter);
app.use('/api/post', postRouter);
app.use('/api/posts', postRouter);
app.use('/api/story', storyRouter);
app.use('/api/stories', storyRouter);
app.use('/api/message', messageRouter); // ✅ This includes both HTTP and SSE
app.use('/api/messages', messageRouter);
app.use('/api/random-chat', randomChatRouter);
app.use('/api/ai', aiRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/music-likes', musicLikesRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/music-playlist', musicPlaylistRoutes);
app.use('/api/user', userDataRoutes);

// WebSocket test endpoint
app.get('/api/ws-test', (req, res) => {
    res.json({
        success: true,
        message: 'WebSocket is running',
        endpoints: {
            socketIo: 'Connect to ws://your-domain.com (or wss:// for production)',
            sse: 'GET /api/messages/sse/:userId (legacy)',
            http: 'Use normal HTTP endpoints with real-time updates via socket'
        },
        onlineUsers: Array.from(onlineUsers.keys()),
        timestamp: new Date().toISOString()
    });
});

// WebRTC configuration endpoint
app.get('/api/webrtc/config', (req, res) => {
    res.json({
        success: true,
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            // Add your TURN servers here if needed for production
        ],
        socketUrl: process.env.NODE_ENV === 'production' 
            ? `wss://${req.get('host')}` 
            : `ws://${req.get('host')}`,
        timestamp: new Date().toISOString()
    });
});

// Health check endpoint for data collection
app.get('/api/health-data', async (req, res) => {
    try {
        // Import models dynamically
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
            realtime_system: {
                websocket: {
                    status: 'active',
                    online_users: Array.from(onlineUsers.keys()).length,
                    connections: io.engine.clientsCount
                },
                sse: {
                    status: 'active (legacy)',
                    endpoint: '/api/messages/sse/:userId'
                }
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Health check failed',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

const PORT = process.env.PORT || 4000;

// Connect to MongoDB Atlas, THEN start server
connectDB()
  .then(() => {
    console.log("✅ MongoDB Atlas Connected");

    server.listen(PORT, () => {
      console.log(`\n🚀 Server running on port ${PORT}`);
      console.log(`🌐 WebSocket (Socket.io): ws://localhost:${PORT}`);
      console.log(`📡 SSE (Legacy): /api/messages/sse/:userId`);

      console.log('\n🔥 HYBRID CHAT SYSTEM FEATURES:');
      console.log('   ✅ Real-time messaging via WebSocket');
      console.log('   ✅ Voice & Video calls via WebRTC');
      console.log('   ✅ Backward compatible SSE support');
      console.log('   ✅ REST API endpoints for CRUD operations');
      console.log('   ✅ Online/Offline presence tracking');
      console.log('   ✅ Typing indicators');
      console.log('   ✅ Message delivery receipts');
      console.log('   ✅ File & Image sharing');
      console.log('   ✅ Group chat ready');

      console.log('\n📊 MESSAGE ENDPOINTS:');
      console.log('   POST /api/message/send          - Send message');
      console.log('   POST /api/message/send-voice    - Send voice message');
      console.log('   POST /api/message/get           - Get chat');
      console.log('   GET  /api/message/recent        - Recent chats');
      console.log('   GET  /api/message/online-users  - Online users');
      console.log('   GET  /api/message/ws-status     - WebSocket status');

      console.log('\n📞 CALL ENDPOINTS:');
      console.log('   POST /api/message/call/initiate - Start call');
      console.log('   POST /api/message/call/accept   - Accept call');
      console.log('   POST /api/message/call/reject   - Reject call');
      console.log('   POST /api/message/call/end      - End call');
      console.log('   GET  /api/webrtc/config         - WebRTC ICE servers');

      console.log('');
    });
  })
  .catch((error) => {
    console.error("❌ Failed to connect MongoDB Atlas:", error.message);
    process.exit(1);
  });
