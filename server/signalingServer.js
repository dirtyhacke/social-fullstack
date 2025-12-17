// File: server/signalingServer.js
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const YOUR_JWT_SECRET = process.env.JWT_SECRET; // Use your existing secret

// In-memory stores for user and room mapping
const users = new Map(); // Map<socketId, {userId, socket}>
const userToSocket = new Map(); // Map<userId, socketId>
const rooms = new Map(); // Map<roomId, Set<socketId>>

const wss = new WebSocket.Server({ port: 8080 }); // Run on port 8080

wss.on('connection', (socket, req) => {
    console.log('New signaling connection');

    // Extract token from query string for authentication
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    let userId;
    try {
        const decoded = jwt.verify(token, YOUR_JWT_SECRET);
        userId = decoded.sub || decoded.userId;
        console.log(`User authenticated: ${userId}`);
    } catch (err) {
        console.log('Invalid token, closing connection');
        socket.close(1008, 'Authentication failed');
        return;
    }

    // Store user connection
    const socketId = `${userId}_${Date.now()}`;
    users.set(socketId, { userId, socket });
    userToSocket.set(userId, socketId);

    socket.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            handleSignalingMessage(socketId, userId, message);
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    socket.on('close', () => {
        console.log(`User ${userId} disconnected from signaling`);
        users.delete(socketId);
        userToSocket.delete(userId);
        // Clean up user from all rooms
        rooms.forEach((participants, roomId) => {
            if (participants.delete(socketId) && participants.size === 0) {
                rooms.delete(roomId);
            }
        });
    });

    socket.on('error', (error) => {
        console.error(`WebSocket error for user ${userId}:`, error);
    });
});

function handleSignalingMessage(senderSocketId, senderUserId, message) {
    const senderData = users.get(senderSocketId);
    if (!senderData) return;

    switch (message.type) {
        case 'call-offer':
        case 'call-answer':
        case 'ice-candidate':
            // These messages need to be sent to a specific target user
            const targetUserId = message.targetUserId;
            const targetSocketId = userToSocket.get(targetUserId);

            if (targetSocketId) {
                const targetData = users.get(targetSocketId);
                if (targetData && targetData.socket.readyState === WebSocket.OPEN) {
                    // Forward the message, adding sender info
                    const forwardMessage = {
                        ...message,
                        senderUserId: senderUserId
                    };
                    targetData.socket.send(JSON.stringify(forwardMessage));
                    console.log(`Forwarded ${message.type} from ${senderUserId} to ${targetUserId}`);
                } else {
                    console.log(`Target user ${targetUserId} not connected for signaling`);
                    // Notify caller that callee is unavailable
                    senderData.socket.send(JSON.stringify({
                        type: 'user-unavailable',
                        targetUserId: targetUserId
                    }));
                }
            } else {
                console.log(`Target user ${targetUserId} not found`);
                senderData.socket.send(JSON.stringify({
                    type: 'user-unavailable',
                    targetUserId: targetUserId
                }));
            }
            break;

        case 'join-room':
            const { roomId } = message;
            if (!rooms.has(roomId)) {
                rooms.set(roomId, new Set());
            }
            rooms.get(roomId).add(senderSocketId);
            console.log(`User ${senderUserId} joined room ${roomId}`);
            break;

        case 'leave-room':
            const { roomId: leaveRoomId } = message;
            if (rooms.has(leaveRoomId)) {
                rooms.get(leaveRoomId).delete(senderSocketId);
                if (rooms.get(leaveRoomId).size === 0) {
                    rooms.delete(leaveRoomId);
                }
            }
            break;

        default:
            console.log('Unknown message type:', message.type);
    }
}

console.log('WebRTC Signaling Server running on ws://localhost:8080');