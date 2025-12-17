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

app.use(express.json());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'https://pixo-black.vercel.app/',
    credentials: true
}));
app.use(clerkMiddleware());

// Helper to get user ID from token
const getUserIdFromToken = (token) => {
    try {
        if (!token) return null;
        // Clerk JWT structure
        const decoded = jwt.decode(token);
        return decoded?.sub || decoded?.userId || null;
    } catch (error) {
        console.error('Token decode error:', error);
        return null;
    }
};

// WebRTC Signaling WebSocket Server
wss.on('connection', async (socket, req) => {
    console.log('🔗 New WebRTC signaling connection');
    
    // Extract token from query or headers
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    
    if (!token) {
        console.log('❌ No token provided');
        socket.close(1008, 'Authentication required');
        return;
    }
    
    const userId = getUserIdFromToken(token);
    
    if (!userId) {
        console.log('❌ Invalid token');
        socket.close(1008, 'Invalid authentication');
        return;
    }
    
    console.log(`✅ WebRTC user connected: ${userId}`);
    
    // Store connection
    const connectionId = `${userId}_${Date.now()}`;
    webRTCConnections.set(connectionId, {
        socket,
        userId,
        lastSeen: Date.now()
    });
    userToConnection.set(userId, connectionId);
    
    // Send welcome message
    socket.send(JSON.stringify({
        type: 'connected',
        userId,
        timestamp: new Date().toISOString(),
        message: 'WebRTC signaling connected'
    }));
    
    // Handle incoming messages
    socket.on('message', async (data) => {
        try {
            const message = JSON.parse(data.toString());
            await handleWebRTCMessage(userId, message, socket);
        } catch (error) {
            console.error('❌ Error processing message:', error);
        }
    });
    
    // Handle disconnection
    socket.on('close', () => {
        console.log(`🔌 WebRTC disconnected: ${userId}`);
        webRTCConnections.delete(connectionId);
        userToConnection.delete(userId);
        
        // Clean up user's active calls
        for (const [callId, call] of activeCalls.entries()) {
            if (call.callerId === userId || call.calleeId === userId) {
                const otherUserId = call.callerId === userId ? call.calleeId : call.callerId;
                const otherConnId = userToConnection.get(otherUserId);
                const otherConn = webRTCConnections.get(otherConnId);
                
                if (otherConn?.socket.readyState === 1) {
                    otherConn.socket.send(JSON.stringify({
                        type: 'call-ended',
                        callId,
                        endedBy: userId,
                        reason: 'user-disconnected',
                        timestamp: new Date().toISOString()
                    }));
                }
                
                activeCalls.delete(callId);
            }
        }
    });
    
    // Handle errors
    socket.on('error', (error) => {
        console.error(`⚠️ WebSocket error for ${userId}:`, error);
    });
    
    // Keep alive
    socket.on('pong', () => {
        const conn = webRTCConnections.get(connectionId);
        if (conn) conn.lastSeen = Date.now();
    });
});

// Handle WebRTC messages
async function handleWebRTCMessage(senderId, message, socket) {
    console.log(`📨 ${senderId} -> ${message.type}`, message.callId ? `(Call: ${message.callId})` : '');
    
    switch (message.type) {
        case 'call-offer':
            await handleCallOffer(senderId, message);
            break;
        case 'call-answer':
            await handleCallAnswer(senderId, message);
            break;
        case 'ice-candidate':
            await handleICECandidate(senderId, message);
            break;
        case 'call-reject':
            await handleCallReject(senderId, message);
            break;
        case 'end-call':
            await handleEndCall(senderId, message);
            break;
        case 'ping':
            socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            break;
        default:
            console.log('❓ Unknown message type:', message.type);
    }
}

async function handleCallOffer(callerId, message) {
    const { targetUserId, callType, offer, callId } = message;
    
    // Create call record
    const newCallId = callId || `call_${callerId}_${targetUserId}_${Date.now()}`;
    activeCalls.set(newCallId, {
        callerId,
        calleeId: targetUserId,
        callType,
        status: 'ringing',
        createdAt: new Date().toISOString()
    });
    
    // Find target connection
    const targetConnId = userToConnection.get(targetUserId);
    const targetConn = webRTCConnections.get(targetConnId);
    
    if (!targetConn || targetConn.socket.readyState !== 1) {
        // Target offline
        const callerConnId = userToConnection.get(callerId);
        const callerConn = webRTCConnections.get(callerConnId);
        
        if (callerConn?.socket.readyState === 1) {
            callerConn.socket.send(JSON.stringify({
                type: 'user-offline',
                targetUserId,
                timestamp: new Date().toISOString()
            }));
        }
        
        activeCalls.delete(newCallId);
        return;
    }
    
    // Send offer to target
    targetConn.socket.send(JSON.stringify({
        type: 'incoming-call',
        callerId,
        callType,
        offer,
        callId: newCallId,
        timestamp: new Date().toISOString()
    }));
    
    // Notify caller
    const callerConnId = userToConnection.get(callerId);
    const callerConn = webRTCConnections.get(callerConnId);
    
    if (callerConn?.socket.readyState === 1) {
        callerConn.socket.send(JSON.stringify({
            type: 'offer-sent',
            targetUserId,
            callId: newCallId,
            timestamp: new Date().toISOString()
        }));
    }
}

async function handleCallAnswer(calleeId, message) {
    const { callerId, answer, callId } = message;
    
    const call = activeCalls.get(callId);
    if (!call) return;
    
    call.status = 'connected';
    call.connectedAt = new Date().toISOString();
    
    // Send answer to caller
    const callerConnId = userToConnection.get(callerId);
    const callerConn = webRTCConnections.get(callerConnId);
    
    if (callerConn?.socket.readyState === 1) {
        callerConn.socket.send(JSON.stringify({
            type: 'call-answer',
            calleeId,
            answer,
            callId,
            timestamp: new Date().toISOString()
        }));
    }
}

async function handleICECandidate(senderId, message) {
    const { targetUserId, candidate, callId } = message;
    
    const targetConnId = userToConnection.get(targetUserId);
    const targetConn = webRTCConnections.get(targetConnId);
    
    if (targetConn?.socket.readyState === 1) {
        targetConn.socket.send(JSON.stringify({
            type: 'ice-candidate',
            senderId,
            candidate,
            callId,
            timestamp: new Date().toISOString()
        }));
    }
}

async function handleCallReject(rejecterId, message) {
    const { callerId, callId, reason } = message;
    
    const call = activeCalls.get(callId);
    if (!call) return;
    
    // Notify caller
    const callerConnId = userToConnection.get(callerId);
    const callerConn = webRTCConnections.get(callerConnId);
    
    if (callerConn?.socket.readyState === 1) {
        callerConn.socket.send(JSON.stringify({
            type: 'call-rejected',
            rejecterId,
            callId,
            reason: reason || 'User rejected the call',
            timestamp: new Date().toISOString()
        }));
    }
    
    activeCalls.delete(callId);
}

async function handleEndCall(enderId, message) {
    const { callId, targetUserId } = message;
    
    const call = activeCalls.get(callId);
    if (!call) return;
    
    // Notify other participant
    const otherUserId = call.callerId === enderId ? call.calleeId : call.callerId;
    const otherConnId = userToConnection.get(otherUserId);
    const otherConn = webRTCConnections.get(otherConnId);
    
    if (otherConn?.socket.readyState === 1) {
        otherConn.socket.send(JSON.stringify({
            type: 'call-ended',
            callId,
            endedBy: enderId,
            timestamp: new Date().toISOString()
        }));
    }
    
    activeCalls.delete(callId);
}

// Cleanup stale connections
setInterval(() => {
    const now = Date.now();
    const TIMEOUT = 5 * 60 * 1000; // 5 minutes
    
    for (const [connId, conn] of webRTCConnections.entries()) {
        if (now - conn.lastSeen > TIMEOUT) {
            console.log(`🧹 Cleaning stale connection: ${conn.userId}`);
            try {
                conn.socket.close();
            } catch (error) {
                console.error('Error closing connection:', error);
            }
            webRTCConnections.delete(connId);
            userToConnection.delete(conn.userId);
        }
    }
}, 60000); // Every minute

// WebRTC Health endpoint
app.get('/api/webrtc/health', (req, res) => {
    res.json({
        success: true,
        webrtc: {
            status: 'running',
            active_connections: webRTCConnections.size,
            active_calls: activeCalls.size,
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        }
    });
});

// Existing routes (keep all your routes as before)
app.get('/', (req, res) => res.send('Server is running'));
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
    res.json({ success: true, message: 'Server is working!' });
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
            webrtc: {
                active_connections: webRTCConnections.size,
                active_calls: activeCalls.size
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

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log('✅ WebRTC Signaling: ws://localhost:' + PORT + '/api/webrtc-signaling');
    console.log('✅ SSE endpoint: /api/messages/sse/:userId');
    console.log('✅ WebRTC Health: GET /api/webrtc/health');
    console.log('🎵 Music API: /api/music');
    console.log('📊 Data Collection: GET /api/health-data');
    console.log('\n🔧 WebRTC Features:');
    console.log('   • 1-on-1 Voice & Video Calls');
    console.log('   • ICE Candidate Relay');
    console.log('   • Automatic Cleanup');
    console.log('   • Real-time Connection Tracking');
});