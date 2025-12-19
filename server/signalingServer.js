// File: server/signalingServer.js
import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';

const YOUR_JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here_change_in_production';

// In-memory stores for user and room mapping
const users = new Map(); // Map<socketId, {userId, socket}>
const userToSocket = new Map(); // Map<userId, socketId>
const rooms = new Map(); // Map<roomId, Set<socketId>>

// Create HTTP server
const server = createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'online',
            timestamp: Date.now(),
            stats: {
                connectedUsers: users.size,
                activeRooms: rooms.size,
                totalRooms: rooms.size
            }
        }));
    } else {
        res.writeHead(404);
        res.end();
    }
});

// Create WebSocket server attached to HTTP server
const wss = new WebSocketServer({ 
    server, // Don't specify port here when using server
    path: '/signaling' // Optional: specify WebSocket path
});

wss.on('connection', (socket, req) => {
    console.log('✅ New WebSocket connection:', req.url);

    // Extract token from query string
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
        console.log('❌ No token provided');
        socket.close(1008, 'No authentication token');
        return;
    }

    let userId;
    try {
        const decoded = jwt.verify(token, YOUR_JWT_SECRET);
        userId = decoded.sub || decoded.userId;
        console.log(`✅ User authenticated: ${userId}`);
    } catch (err) {
        console.log('❌ Invalid token:', err.message);
        socket.close(1008, 'Authentication failed');
        return;
    }

    // Store user connection
    const socketId = `${userId}_${Date.now()}`;
    users.set(socketId, { userId, socket });
    userToSocket.set(userId, socketId);

    // Send welcome message
    socket.send(JSON.stringify({
        type: 'welcome',
        userId,
        socketId,
        message: 'Connected to WebRTC signaling server',
        timestamp: Date.now()
    }));

    // Set up message handler
    socket.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            console.log(`📨 Message from ${userId}:`, message.type);
            handleSignalingMessage(socketId, userId, message);
        } catch (error) {
            console.error('❌ Error parsing message:', error);
            socket.send(JSON.stringify({
                type: 'error',
                message: 'Invalid message format'
            }));
        }
    });

    // Handle disconnection
    socket.on('close', () => {
        console.log(`❌ User ${userId} disconnected`);
        users.delete(socketId);
        userToSocket.delete(userId);
        
        // Clean up user from all rooms
        rooms.forEach((participants, roomId) => {
            if (participants.delete(socketId)) {
                console.log(`🚪 User ${userId} removed from room ${roomId}`);
                if (participants.size === 0) {
                    rooms.delete(roomId);
                    console.log(`🗑️ Room ${roomId} deleted (empty)`);
                }
            }
        });
    });

    socket.on('error', (error) => {
        console.error(`❌ WebSocket error for user ${userId}:`, error);
    });

    // Send ping every 30 seconds to keep connection alive
    const pingInterval = setInterval(() => {
        if (socket.readyState === 1) { // WebSocket.OPEN
            socket.send(JSON.stringify({
                type: 'ping',
                timestamp: Date.now()
            }));
        } else {
            clearInterval(pingInterval);
        }
    }, 30000);

    socket.on('close', () => {
        clearInterval(pingInterval);
    });
});

function handleSignalingMessage(senderSocketId, senderUserId, message) {
    const senderData = users.get(senderSocketId);
    if (!senderData) {
        console.log('❌ Sender data not found');
        return;
    }

    console.log(`📤 Processing ${message.type} from ${senderUserId} to ${message.targetUserId || 'broadcast'}`);

    switch (message.type) {
        case 'call-offer':
        case 'call-answer':
        case 'ice-candidate':
        case 'end-call':
        case 'call-reject':
            // Forward to specific target user
            const targetUserId = message.targetUserId;
            if (!targetUserId) {
                console.log('❌ No targetUserId in message');
                senderData.socket.send(JSON.stringify({
                    type: 'error',
                    message: 'Missing targetUserId'
                }));
                return;
            }

            const targetSocketId = userToSocket.get(targetUserId);
            
            if (targetSocketId) {
                const targetData = users.get(targetSocketId);
                if (targetData && targetData.socket.readyState === 1) { // WebSocket.OPEN
                    // Forward the message
                    const forwardMessage = {
                        ...message,
                        senderUserId: senderUserId,
                        timestamp: Date.now()
                    };
                    
                    targetData.socket.send(JSON.stringify(forwardMessage));
                    console.log(`✅ Forwarded ${message.type} from ${senderUserId} to ${targetUserId}`);
                    
                    // Send confirmation to sender
                    if (message.type === 'call-offer') {
                        senderData.socket.send(JSON.stringify({
                            type: 'offer-sent',
                            targetUserId: targetUserId,
                            callId: message.callId,
                            timestamp: Date.now()
                        }));
                    }
                } else {
                    console.log(`❌ Target user ${targetUserId} socket not open`);
                    senderData.socket.send(JSON.stringify({
                        type: 'user-unavailable',
                        targetUserId: targetUserId,
                        reason: 'User is not connected'
                    }));
                }
            } else {
                console.log(`❌ Target user ${targetUserId} not found in connections`);
                senderData.socket.send(JSON.stringify({
                    type: 'user-unavailable',
                    targetUserId: targetUserId,
                    reason: 'User is offline'
                }));
            }
            break;

        case 'join-room':
            const { roomId } = message;
            if (!roomId) {
                senderData.socket.send(JSON.stringify({
                    type: 'error',
                    message: 'Missing roomId'
                }));
                return;
            }
            
            if (!rooms.has(roomId)) {
                rooms.set(roomId, new Set());
            }
            rooms.get(roomId).add(senderSocketId);
            
            console.log(`🚪 User ${senderUserId} joined room ${roomId}`);
            
            senderData.socket.send(JSON.stringify({
                type: 'room-joined',
                roomId,
                participants: Array.from(rooms.get(roomId)).map(sid => users.get(sid)?.userId).filter(Boolean)
            }));
            break;

        case 'leave-room':
            const { roomId: leaveRoomId } = message;
            if (rooms.has(leaveRoomId)) {
                rooms.get(leaveRoomId).delete(senderSocketId);
                console.log(`🚪 User ${senderUserId} left room ${leaveRoomId}`);
                
                if (rooms.get(leaveRoomId).size === 0) {
                    rooms.delete(leaveRoomId);
                    console.log(`🗑️ Room ${leaveRoomId} deleted (empty)`);
                }
                
                senderData.socket.send(JSON.stringify({
                    type: 'room-left',
                    roomId: leaveRoomId
                }));
            }
            break;

        case 'ping':
            // Respond to ping
            senderData.socket.send(JSON.stringify({
                type: 'pong',
                timestamp: Date.now(),
                originalTimestamp: message.timestamp
            }));
            break;

        case 'get-users':
            // Return list of connected users
            const connectedUsers = Array.from(users.values()).map(u => ({
                userId: u.userId,
                connected: true
            }));
            
            senderData.socket.send(JSON.stringify({
                type: 'users-list',
                users: connectedUsers,
                count: connectedUsers.length,
                timestamp: Date.now()
            }));
            break;

        default:
            console.log(`❓ Unknown message type: ${message.type}`);
            senderData.socket.send(JSON.stringify({
                type: 'error',
                message: `Unknown message type: ${message.type}`
            }));
    }
}

// Start server on port 8080
const PORT = 8080;
server.listen(PORT, () => {
    console.log(`✅ WebRTC Signaling Server running:`);
    console.log(`   🌐 WebSocket: ws://localhost:${PORT}/signaling`);
    console.log(`   📊 Health: http://localhost:${PORT}/health`);
    console.log(`   🔑 Auth: Add ?token=YOUR_JWT_TOKEN to WebSocket URL`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down signaling server...');
    
    // Close all WebSocket connections
    wss.clients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.close(1000, 'Server shutdown');
        }
    });
    
    // Close HTTP server
    server.close(() => {
        console.log('✅ Signaling server stopped');
        process.exit(0);
    });
    
    // Force exit after 5 seconds
    setTimeout(() => {
        console.log('⚠️  Forcing shutdown...');
        process.exit(1);
    }, 5000);
});

// Export for testing if needed
export { wss, server, users, rooms, handleSignalingMessage };