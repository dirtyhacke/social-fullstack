// controllers/messageController.js - COMPLETE HYBRID VERSION
import fs from "fs";
import imagekit from "../configs/imageKit.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { compressAudio } from "../utils/audioCompressor.js";

// ==================== HYBRID SYSTEM ====================
// Supports both WebSocket (primary) and SSE (legacy)

// For WebSocket
let io = null;
export const onlineUsers = new Map(); // userId -> socketId

// For SSE (legacy)
export const connections = new Map(); // userId -> response object
const typingUsers = new Map();
const activeCalls = new Map();
const peerConnections = new Map();

// ==================== WEBSOCKET FUNCTIONS ====================

export const initializeSocketIO = (socketIO) => {
    io = socketIO;
    console.log('✅ Socket.io initialized in messageController');
};

// Handle socket connection
export const handleSocketConnection = (socket) => {
    console.log('🔗 New socket connection:', socket.id);

    // User authentication
    socket.on('authenticate', async (userId) => {
        try {
            socket.userId = userId;
            onlineUsers.set(userId, socket.id);
            
            console.log(`✅ User ${userId} authenticated, socket: ${socket.id}`);
            
            // Update last seen
            await updateLastSeen(userId);
            
            // Notify all users about this user coming online
            socket.broadcast.emit('user_online', {
                userId: userId,
                timestamp: new Date().toISOString()
            });
            
            // Send current online users to the newly connected user
            const onlineUsersList = Array.from(onlineUsers.keys());
            socket.emit('online_users', {
                users: onlineUsersList,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.log('❌ Authentication error:', error);
        }
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
        const userId = socket.userId;
        if (userId) {
            console.log(`🔌 User ${userId} disconnected`);
            
            // End any active calls
            endCallOnDisconnect(userId);
            
            // Remove from online users
            onlineUsers.delete(userId);
            
            // Notify all users
            socket.broadcast.emit('user_offline', {
                userId: userId,
                timestamp: new Date().toISOString()
            });
            
            // Update last seen
            await updateLastSeen(userId);
        }
    });

    // ==================== CHAT MESSAGING ====================

    // Send message via WebSocket
    socket.on('send_message', async (data) => {
        try {
            const { toUserId, text, messageType = 'text', mediaUrl, replyTo } = data;
            const fromUserId = socket.userId;

            if (!toUserId) {
                socket.emit('error', { message: 'Recipient ID is required' });
                return;
            }

            if (!text && !mediaUrl) {
                socket.emit('error', { message: 'Message content is required' });
                return;
            }

            // Create message in database
            const messageData = {
                from_user_id: fromUserId,
                to_user_id: toUserId,
                text: text || '',
                message_type: messageType,
                media_url: mediaUrl || undefined,
                delivered: false,
                seen: false
            };

            if (replyTo) {
                messageData.reply_to = replyTo;
            }

            const message = await Message.create(messageData);

            // Populate user data
            const populatedMessage = await Message.findById(message._id)
                .populate('from_user_id', 'full_name profile_picture email lastSeen')
                .populate('to_user_id', 'full_name profile_picture email lastSeen')
                .populate('reply_to');

            // Mark as delivered if recipient is online
            const isRecipientOnline = onlineUsers.has(toUserId);
            if (isRecipientOnline) {
                await Message.findByIdAndUpdate(message._id, { delivered: true });
                populatedMessage.delivered = true;
            }

            // Send to recipient via WebSocket
            const recipientSocketId = onlineUsers.get(toUserId);
            if (recipientSocketId && io.sockets.sockets.get(recipientSocketId)) {
                io.to(recipientSocketId).emit('new_message', {
                    message: populatedMessage,
                    notification: {
                        title: 'New Message',
                        body: messageType === 'text' ? (text || 'New message') : 
                              messageType === 'image' ? '📷 Image' : '🎤 Voice message',
                        from: populatedMessage.from_user_id?.full_name,
                        fromId: fromUserId
                    }
                });
            }

            // Also send via SSE for backward compatibility
            sendSSEMessage(toUserId, {
                type: 'new_message',
                message: populatedMessage,
                sound: 'receive',
                notification: {
                    title: 'New Message',
                    body: messageType === 'text' ? (text || 'New message') : '📷 Image',
                    from: populatedMessage.from_user_id?.full_name || 'Someone',
                    fromId: fromUserId,
                    avatar: populatedMessage.from_user_id?.profile_picture || '/default-avatar.png',
                    isRecipientOnline: isRecipientOnline
                }
            });

            // Send confirmation to sender
            socket.emit('message_sent', {
                message: populatedMessage,
                delivered: isRecipientOnline
            });

            // If recipient is online, send delivered notification
            if (isRecipientOnline) {
                socket.emit('message_delivered', {
                    messageId: message._id,
                    toUserId: toUserId,
                    status: 'delivered',
                    timestamp: new Date().toISOString()
                });
                
                // Also via SSE
                sendSSEMessage(fromUserId, {
                    type: 'message_delivered',
                    messageId: message._id,
                    to_user_id: toUserId,
                    status: 'delivered',
                    timestamp: new Date().toISOString()
                });
            }

        } catch (error) {
            console.log('❌ Error sending message via WebSocket:', error);
            socket.emit('error', { message: error.message });
        }
    });

    // Typing indicator via WebSocket
    socket.on('typing', (data) => {
        const { toUserId, isTyping } = data;
        const fromUserId = socket.userId;

        if (!toUserId) return;

        // Clear existing timer
        if (typingUsers.has(fromUserId)) {
            clearTimeout(typingUsers.get(fromUserId).timer);
            typingUsers.delete(fromUserId);
        }

        if (isTyping) {
            // Send typing start via WebSocket
            const recipientSocketId = onlineUsers.get(toUserId);
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('typing_start', {
                    fromUserId: fromUserId,
                    sound: 'typing',
                    timestamp: new Date().toISOString()
                });
            }

            // Also send via SSE
            sendSSEMessage(toUserId, {
                type: 'typing_start',
                fromUserId: fromUserId,
                sound: 'typing',
                timestamp: new Date().toISOString()
            });

            // Set timer to automatically stop typing
            const timer = setTimeout(() => {
                typingUsers.delete(fromUserId);
                if (recipientSocketId) {
                    io.to(recipientSocketId).emit('typing_stop', {
                        fromUserId: fromUserId,
                        timestamp: new Date().toISOString()
                    });
                }
                
                // Also send via SSE
                sendSSEMessage(toUserId, {
                    type: 'typing_stop',
                    fromUserId: fromUserId,
                    timestamp: new Date().toISOString()
                });
            }, 3000);

            typingUsers.set(fromUserId, { toUserId, timer });

        } else {
            // Send typing stop
            const recipientSocketId = onlineUsers.get(toUserId);
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('typing_stop', {
                    fromUserId: fromUserId,
                    timestamp: new Date().toISOString()
                });
            }
            
            // Also send via SSE
            sendSSEMessage(toUserId, {
                type: 'typing_stop',
                fromUserId: fromUserId,
                timestamp: new Date().toISOString()
            });
        }
    });

    // Mark message as seen via WebSocket
    socket.on('mark_seen', async (data) => {
        try {
            const { messageId } = data;
            const userId = socket.userId;

            const message = await Message.findById(messageId);

            if (!message) {
                socket.emit('error', { message: 'Message not found' });
                return;
            }

            // Only mark if user is recipient
            if (message.to_user_id.toString() !== userId) {
                socket.emit('error', { message: 'Not authorized' });
                return;
            }

            // Update seen status
            await Message.findByIdAndUpdate(messageId, {
                seen: true,
                $addToSet: { seen_by: userId }
            });

            // Notify sender via WebSocket
            const senderSocketId = onlineUsers.get(message.from_user_id.toString());
            if (senderSocketId) {
                io.to(senderSocketId).emit('message_seen', {
                    messageId: messageId,
                    seenBy: userId,
                    timestamp: new Date().toISOString()
                });
            }

            // Also via SSE
            sendSSEMessage(message.from_user_id.toString(), {
                type: 'message_seen',
                messageId: messageId,
                seenBy: userId,
                timestamp: new Date().toISOString()
            });

            socket.emit('seen_confirmed', { messageId });

        } catch (error) {
            console.log('❌ Error marking message as seen:', error);
            socket.emit('error', { message: error.message });
        }
    });

    // ==================== WEBRTC CALLING ====================

    // Initiate call via WebSocket
    socket.on('initiate_call', async (data) => {
        try {
            const { toUserId, callType = 'audio' } = data;
            const fromUserId = socket.userId;

            console.log(`📞 Call initiated via WebSocket: ${fromUserId} -> ${toUserId} (${callType})`);

            // Check if recipient is online
            if (!onlineUsers.has(toUserId)) {
                socket.emit('call_error', {
                    message: 'User is offline',
                    callType: callType
                });
                return;
            }

            // Check if already in call
            if (peerConnections.has(fromUserId) || peerConnections.has(toUserId)) {
                socket.emit('call_error', {
                    message: 'User is busy in another call',
                    callType: callType
                });
                return;
            }

            // Generate call ID
            const callId = `call_${Date.now()}_${fromUserId}`;

            // Create call data
            const callData = {
                callId,
                fromUserId,
                toUserId,
                callType,
                status: 'ringing',
                startTime: new Date(),
                participants: [fromUserId]
            };

            activeCalls.set(callId, callData);

            // Get caller info
            const callerInfo = await getUserName(fromUserId);

            // Send call invitation to recipient via WebSocket
            const recipientSocketId = onlineUsers.get(toUserId);
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('call_incoming', {
                    callId,
                    fromUserId,
                    fromUserName: callerInfo.name,
                    fromUserAvatar: callerInfo.avatar,
                    callType,
                    timestamp: new Date().toISOString()
                });
            }

            // Also via SSE
            sendSSEMessage(toUserId, {
                type: 'call_incoming',
                callId: callData.callId,
                callType: callType,
                fromUserId: fromUserId,
                fromUserName: callerInfo.name,
                fromUserAvatar: callerInfo.avatar,
                timestamp: new Date().toISOString()
            });

            // Send confirmation to caller
            socket.emit('call_initiated', {
                callId,
                toUserId,
                callType,
                timestamp: new Date().toISOString()
            });

            // Also via SSE
            sendSSEMessage(fromUserId, {
                type: 'call_initiated',
                callId: callData.callId,
                toUserId: toUserId,
                callType: callType,
                timestamp: new Date().toISOString()
            });

            // Set call timeout (30 seconds)
            callData.timeout = setTimeout(() => {
                if (activeCalls.has(callId) && activeCalls.get(callId).status === 'ringing') {
                    console.log(`⏰ Call timeout: ${callId}`);
                    
                    // Clean up
                    activeCalls.delete(callId);
                    
                    // Notify users via WebSocket
                    socket.emit('call_timeout', { callId });
                    if (recipientSocketId) {
                        io.to(recipientSocketId).emit('call_ended', {
                            callId,
                            reason: 'No answer',
                            timestamp: new Date().toISOString()
                        });
                    }
                    
                    // Also via SSE
                    sendSSEMessage(fromUserId, {
                        type: 'call_rejected',
                        callId: callData.callId,
                        reason: 'No answer',
                        timestamp: new Date().toISOString()
                    });

                    sendSSEMessage(toUserId, {
                        type: 'call_ended',
                        callId: callData.callId,
                        reason: 'No answer',
                        timestamp: new Date().toISOString()
                    });
                }
            }, 30000);

            activeCalls.set(callId, callData);

        } catch (error) {
            console.log('❌ Error initiating call via WebSocket:', error);
            socket.emit('call_error', { message: error.message });
        }
    });

    // Accept call via WebSocket
    socket.on('accept_call', async (data) => {
        try {
            const { callId } = data;
            const userId = socket.userId;

            const callData = activeCalls.get(callId);
            if (!callData) {
                socket.emit('call_error', { message: 'Call not found' });
                return;
            }

            // Clear timeout
            if (callData.timeout) {
                clearTimeout(callData.timeout);
            }

            // Update call status
            callData.status = 'connecting';
            callData.participants.push(userId);
            activeCalls.set(callId, callData);

            // Get user info
            const accepterInfo = await getUserName(userId);

            // Notify caller via WebSocket
            const callerSocketId = onlineUsers.get(callData.fromUserId);
            if (callerSocketId) {
                io.to(callerSocketId).emit('call_accepted', {
                    callId,
                    acceptedBy: userId,
                    acceptedByName: accepterInfo.name,
                    timestamp: new Date().toISOString()
                });
            }

            // Also via SSE
            sendSSEMessage(callData.fromUserId, {
                type: 'call_accepted',
                callId: callId,
                acceptedBy: userId,
                acceptedByName: accepterInfo.name,
                timestamp: new Date().toISOString()
            });

            // Notify recipient (self)
            socket.emit('call_connecting', {
                callId,
                withUserId: callData.fromUserId,
                withUserName: await getUserName(callData.fromUserId).then(info => info.name),
                callType: callData.callType,
                timestamp: new Date().toISOString()
            });

            // Also via SSE
            sendSSEMessage(userId, {
                type: 'call_connected',
                callId: callId,
                withUserId: callData.fromUserId,
                withUserName: await getUserName(callData.fromUserId).then(info => info.name),
                callType: callData.callType,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.log('❌ Error accepting call via WebSocket:', error);
            socket.emit('call_error', { message: error.message });
        }
    });

    // Reject call via WebSocket
    socket.on('reject_call', (data) => {
        try {
            const { callId, reason = 'Rejected' } = data;
            const userId = socket.userId;

            const callData = activeCalls.get(callId);
            if (!callData) return;

            // Clear timeout
            if (callData.timeout) {
                clearTimeout(callData.timeout);
            }

            // Get user info
            getUserName(userId).then(rejecterInfo => {
                // Notify caller via WebSocket
                const callerSocketId = onlineUsers.get(callData.fromUserId);
                if (callerSocketId) {
                    io.to(callerSocketId).emit('call_rejected', {
                        callId,
                        rejectedBy: userId,
                        rejectedByName: rejecterInfo.name,
                        reason,
                        timestamp: new Date().toISOString()
                    });
                }

                // Also via SSE
                sendSSEMessage(callData.fromUserId, {
                    type: 'call_rejected',
                    callId: callId,
                    rejectedBy: userId,
                    rejectedByName: rejecterInfo.name,
                    timestamp: new Date().toISOString()
                });
            });

            // Clean up
            activeCalls.delete(callId);

        } catch (error) {
            console.log('❌ Error rejecting call via WebSocket:', error);
        }
    });

    // End call via WebSocket
    socket.on('end_call', (data) => {
        try {
            const { callId, reason = 'Call ended' } = data;
            const userId = socket.userId;

            const callData = activeCalls.get(callId);
            if (!callData) return;

            // Clear timeout if call was still ringing
            if (callData.timeout) {
                clearTimeout(callData.timeout);
            }

            const otherUserId = callData.fromUserId === userId ? callData.toUserId : callData.fromUserId;

            // Remove call from active calls
            activeCalls.delete(callId);
            peerConnections.delete(userId);
            if (otherUserId) peerConnections.delete(otherUserId);

            // Calculate call duration
            const endTime = new Date();
            const duration = callData.answerTime 
                ? Math.floor((endTime - callData.answerTime) / 1000)
                : 0;

            // Notify other participant via WebSocket
            const otherSocketId = onlineUsers.get(otherUserId);
            if (otherSocketId) {
                getUserName(userId).then(enderInfo => {
                    io.to(otherSocketId).emit('call_ended', {
                        callId,
                        endedBy: userId,
                        endedByName: enderInfo.name,
                        duration: duration,
                        timestamp: new Date().toISOString()
                    });
                });
            }

            // Also via SSE
            getUserName(userId).then(enderInfo => {
                sendSSEMessage(otherUserId, {
                    type: 'call_ended',
                    callId: callId,
                    endedBy: userId,
                    endedByName: enderInfo.name,
                    duration: duration,
                    timestamp: new Date().toISOString()
                });
            });

            socket.emit('call_ended_confirm', {
                callId,
                duration,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.log('❌ Error ending call via WebSocket:', error);
        }
    });

    // WebRTC signaling
    socket.on('webrtc_offer', (data) => {
        const { callId, toUserId, offer } = data;
        const fromUserId = socket.userId;

        const recipientSocketId = onlineUsers.get(toUserId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('webrtc_offer', {
                callId,
                fromUserId,
                offer,
                timestamp: new Date().toISOString()
            });
        }
    });

    socket.on('webrtc_answer', (data) => {
        const { callId, toUserId, answer } = data;
        const fromUserId = socket.userId;

        const recipientSocketId = onlineUsers.get(toUserId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('webrtc_answer', {
                callId,
                fromUserId,
                answer,
                timestamp: new Date().toISOString()
            });
        }
    });

    socket.on('webrtc_ice_candidate', (data) => {
        const { callId, toUserId, candidate } = data;
        const fromUserId = socket.userId;

        const recipientSocketId = onlineUsers.get(toUserId);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('webrtc_ice_candidate', {
                callId,
                fromUserId,
                candidate,
                timestamp: new Date().toISOString()
            });
        }
    });

    // Handle call disconnect
    const endCallOnDisconnect = (userId) => {
        // Find active calls for this user
        for (const [callId, callData] of activeCalls.entries()) {
            if (callData.participants.includes(userId)) {
                // Notify other participant via WebSocket
                const otherUserId = callData.fromUserId === userId ? 
                    callData.toUserId : callData.fromUserId;
                const otherSocketId = onlineUsers.get(otherUserId);

                if (otherSocketId) {
                    io.to(otherSocketId).emit('call_ended', {
                        callId,
                        endedBy: userId,
                        reason: 'User disconnected',
                        timestamp: new Date().toISOString()
                    });
                }

                // Also via SSE
                sendSSEMessage(otherUserId, {
                    type: 'call_ended',
                    callId: callId,
                    endedBy: userId,
                    reason: 'User disconnected',
                    timestamp: new Date().toISOString()
                });

                // Clean up
                activeCalls.delete(callId);
                peerConnections.delete(userId);
                if (otherUserId) peerConnections.delete(otherUserId);
                break;
            }
        }
    };
};

// ==================== SSE FUNCTIONS (Legacy) ====================

// SSE setup function (legacy)
export const setupSSE = (req, res) => {
    const userId = req.params.userId;
    
    console.log('🔗 SSE connected (legacy) for user:', userId);
    
    // Set headers for SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
    });

    // Add user to online users and update last seen
    onlineUsers.set(userId, `sse_${Date.now()}`);
    updateLastSeen(userId);
    
    // Notify all connections that this user came online
    broadcastUserStatus(userId, 'online');

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ 
        type: 'connected', 
        message: 'SSE Connected',
        onlineUsers: Array.from(onlineUsers.keys()),
        userId: userId
    })}\n\n`);

    // Store the connection
    connections.set(userId, res);

    // Remove connection when client disconnects
    req.on('close', () => {
        console.log('🔌 SSE disconnected for user:', userId);
        
        // End any active calls for this user
        const userCall = activeCalls.get(userId);
        if (userCall) {
            const otherUserId = userCall.fromUserId === userId ? userCall.toUserId : userCall.fromUserId;
            activeCalls.delete(userId);
            activeCalls.delete(otherUserId);
            
            // Notify other user that call ended due to disconnect
            sendSSEMessage(otherUserId, {
                type: 'call_ended',
                callId: userCall.callId,
                endedBy: userId,
                reason: 'User disconnected',
                timestamp: new Date().toISOString()
            });
        }
        
        connections.delete(userId);
        onlineUsers.delete(userId);
        typingUsers.delete(userId);
        
        // Update last seen when user disconnects
        updateLastSeen(userId);
        
        // Notify all connections that this user went offline
        broadcastUserStatus(userId, 'offline');
        res.end();
    });

    // Heartbeat
    const heartbeat = setInterval(() => {
        if (connections.has(userId)) {
            try {
                res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
                updateLastSeen(userId);
            } catch (error) {
                console.log('❌ Heartbeat failed, cleaning up connection for user:', userId);
                clearInterval(heartbeat);
                connections.delete(userId);
                onlineUsers.delete(userId);
                typingUsers.delete(userId);
                updateLastSeen(userId);
                broadcastUserStatus(userId, 'offline');
            }
        } else {
            clearInterval(heartbeat);
        }
    }, 30000);
};

// Send SSE message (legacy)
export const sendSSEMessage = (userId, data) => {
    const connection = connections.get(userId);
    if (connection) {
        try {
            const messageString = `data: ${JSON.stringify(data)}\n\n`;
            connection.write(messageString);
            return true;
        } catch (error) {
            console.log(`❌ Error sending SSE message to ${userId}:`, error);
            connections.delete(userId);
            onlineUsers.delete(userId);
            typingUsers.delete(userId);
            updateLastSeen(userId);
            return false;
        }
    }
    return false;
};

// Broadcast user status to all connected clients
const broadcastUserStatus = (userId, status) => {
    const message = {
        type: status === 'online' ? 'user_online' : 'user_offline',
        userId: userId,
        timestamp: new Date().toISOString()
    };

    connections.forEach((connection, connectionUserId) => {
        if (connectionUserId !== userId) {
            try {
                connection.write(`data: ${JSON.stringify(message)}\n\n`);
            } catch (error) {
                console.log(`❌ Error broadcasting to ${connectionUserId}:`, error);
                connections.delete(connectionUserId);
                onlineUsers.delete(connectionUserId);
            }
        }
    });
};

// Controller function for the SSE endpoint
export const sseController = (req, res) => {
    setupSSE(req, res);
};

// ==================== SHARED FUNCTIONS ====================

// Update user's last seen
export const updateLastSeen = async (userId) => {
    try {
        await User.findByIdAndUpdate(userId, { 
            lastSeen: new Date() 
        });
    } catch (error) {
        console.log('❌ Error updating last seen:', error);
    }
};

// Get user info
const getUserName = async (userId) => {
    try {
        const user = await User.findById(userId).select('full_name profile_picture');
        return {
            name: user?.full_name || 'User',
            avatar: user?.profile_picture || '/default-avatar.png'
        };
    } catch (error) {
        return {
            name: 'User',
            avatar: '/default-avatar.png'
        };
    }
};

// Get user info for API
const getUserInfo = async (userId) => {
    try {
        const user = await User.findById(userId).select('full_name profile_picture email lastSeen');
        return {
            _id: user._id,
            full_name: user.full_name,
            profile_picture: user.profile_picture,
            email: user.email,
            lastSeen: user.lastSeen,
            isOnline: onlineUsers.has(userId)
        };
    } catch (error) {
        return {
            _id: userId,
            full_name: 'User',
            profile_picture: '/default-avatar.png',
            isOnline: false
        };
    }
};

// ==================== HTTP API CONTROLLERS ====================

// Send Message (HTTP endpoint)
export const sendMessage = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { to_user_id, text, reply_to } = req.body;
        const image = req.file;

        console.log('📨 Send message request received');
        console.log('👤 From user:', userId);
        console.log('👥 To user:', to_user_id);
        console.log('📝 Text:', text);
        console.log('🖼️ Image file present:', !!image);
        console.log('🔁 Reply to:', reply_to);

        if (!to_user_id) {
            return res.status(400).json({
                success: false,
                message: 'Recipient user ID is required'
            });
        }

        if (!text && !image) {
            return res.status(400).json({
                success: false,
                message: 'Message text or image is required'
            });
        }

        let media_url = '';
        let message_type = image ? 'image' : 'text';

        // Handle image upload
        if (image) {
            try {
                console.log('🖼️ Processing image upload...');
                
                if (!image.buffer) {
                    throw new Error('Image buffer is missing');
                }

                const response = await imagekit.upload({
                    file: image.buffer,
                    fileName: image.originalname || `image-${Date.now()}.jpg`,
                    folder: '/chat-images',
                    useUniqueFileName: true
                });

                media_url = response.url;
                console.log('✅ Image uploaded to ImageKit:', media_url);

            } catch (uploadError) {
                console.log('❌ Image upload failed:', uploadError);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to upload image: ' + uploadError.message
                });
            }
        }

        // Create message data
        const messageData = {
            from_user_id: userId,
            to_user_id,
            text: text || '',
            message_type,
            media_url: media_url || undefined,
            delivered: false,
            seen: false
        };

        // Add reply reference if provided
        if (reply_to) {
            messageData.reply_to = reply_to;
        }

        console.log('💾 Saving message to database:', messageData);

        // Create message in database
        const message = await Message.create(messageData);

        // Populate user data for the response
        const messageWithUserData = await Message.findById(message._id)
            .populate('from_user_id', 'full_name profile_picture email lastSeen')
            .populate('to_user_id', 'full_name profile_picture email lastSeen')
            .populate('reply_to');

        // Mark as delivered if recipient is online
        const isRecipientOnline = onlineUsers.has(to_user_id);
        if (isRecipientOnline) {
            await Message.findByIdAndUpdate(message._id, { delivered: true });
            messageWithUserData.delivered = true;
        }

        console.log('✅ Message saved successfully:', messageWithUserData._id);

        res.json({ 
            success: true, 
            message: messageWithUserData 
        });

        console.log(`📱 Recipient ${to_user_id} is ${isRecipientOnline ? 'online' : 'offline'}`);

        // Send real-time notification via WebSocket if available
        const recipientSocketId = onlineUsers.get(to_user_id);
        if (recipientSocketId && io) {
            io.to(recipientSocketId).emit('new_message', {
                message: messageWithUserData,
                notification: {
                    title: 'New Message',
                    body: message_type === 'text' ? (text || 'New message') : '📷 Image',
                    from: messageWithUserData.from_user_id?.full_name || 'Someone',
                    fromId: userId,
                    avatar: messageWithUserData.from_user_id?.profile_picture || '/default-avatar.png',
                    isRecipientOnline: isRecipientOnline
                }
            });
            console.log('✅ WebSocket notification sent to:', to_user_id);
        }

        // Also send via SSE for backward compatibility
        sendSSEMessage(to_user_id, {
            type: 'new_message',
            message: messageWithUserData,
            sound: 'receive',
            notification: {
                title: 'New Message',
                body: message_type === 'text' ? (text || 'New message') : '📷 Image',
                from: messageWithUserData.from_user_id?.full_name || 'Someone',
                fromId: userId,
                avatar: messageWithUserData.from_user_id?.profile_picture || '/default-avatar.png',
                isRecipientOnline: isRecipientOnline
            }
        });

        // Notify sender that message was delivered
        if (isRecipientOnline) {
            // Via WebSocket
            const senderSocketId = onlineUsers.get(userId);
            if (senderSocketId && io) {
                io.to(senderSocketId).emit('message_delivered', {
                    messageId: message._id,
                    to_user_id: to_user_id,
                    status: 'delivered',
                    timestamp: new Date().toISOString()
                });
            }
            
            // Also via SSE
            sendSSEMessage(userId, {
                type: 'message_delivered',
                messageId: message._id,
                to_user_id: to_user_id,
                status: 'delivered',
                timestamp: new Date().toISOString()
            });
        }

    } catch (error) {
        console.log('❌ Error in sendMessage:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// Send Voice Message (HTTP endpoint)
export const sendVoiceMessage = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { to_user_id, duration, reply_to } = req.body;
        const audioFile = req.file;

        if (!audioFile) {
            return res.json({ success: false, message: 'No audio file provided' });
        }

        console.log('🎤 Processing voice message...');
        
        let media_url = '';
        let actualDuration = parseInt(duration) || 0;

        try {
            // Compress audio using our utility
            const compressedAudio = await compressAudio(audioFile.buffer);
            
            // Upload compressed audio to ImageKit
            const response = await imagekit.upload({
                file: compressedAudio,
                fileName: `voice_${Date.now()}.mp3`,
                folder: '/voice-messages',
                useUniqueFileName: true
            });

            media_url = response.url;
            console.log('✅ Voice message uploaded to ImageKit:', media_url);
            
        } catch (compressionError) {
            console.log('⚠️ Audio compression failed, uploading original:', compressionError);
            
            // Fallback: upload original audio to ImageKit
            const response = await imagekit.upload({
                file: audioFile.buffer,
                fileName: `voice_${Date.now()}.webm`,
                folder: '/voice-messages',
                useUniqueFileName: true
            });

            media_url = response.url;
        }

        const messageData = {
            from_user_id: userId,
            to_user_id,
            message_type: 'audio',
            media_url,
            duration: actualDuration,
            delivered: false,
            seen: false
        };

        if (reply_to) {
            messageData.reply_to = reply_to;
        }

        const message = await Message.create(messageData);

        // Populate user data
        const messageWithUserData = await Message.findById(message._id)
            .populate('from_user_id', 'full_name profile_picture email lastSeen')
            .populate('to_user_id', 'full_name profile_picture email lastSeen')
            .populate('reply_to');

        // Mark as delivered if recipient is online
        const isRecipientOnline = onlineUsers.has(to_user_id);
        if (isRecipientOnline) {
            await Message.findByIdAndUpdate(message._id, { delivered: true });
            messageWithUserData.delivered = true;
        }

        res.json({ 
            success: true, 
            message: messageWithUserData 
        });

        // Send real-time notification via WebSocket
        const recipientSocketId = onlineUsers.get(to_user_id);
        if (recipientSocketId && io) {
            io.to(recipientSocketId).emit('new_message', {
                message: messageWithUserData,
                notification: {
                    title: 'Voice Message',
                    body: `🎤 ${actualDuration}s voice message`,
                    from: messageWithUserData.from_user_id?.full_name || 'Someone',
                    fromId: userId,
                    avatar: messageWithUserData.from_user_id?.profile_picture || '/default-avatar.png',
                    isRecipientOnline: isRecipientOnline
                }
            });
            console.log('✅ Voice message WebSocket notification sent to:', to_user_id);
        }

        // Also send via SSE
        sendSSEMessage(to_user_id, {
            type: 'new_message',
            message: messageWithUserData,
            sound: 'receive',
            notification: {
                title: 'Voice Message',
                body: `🎤 ${actualDuration}s voice message`,
                from: messageWithUserData.from_user_id?.full_name || 'Someone',
                fromId: userId,
                avatar: messageWithUserData.from_user_id?.profile_picture || '/default-avatar.png',
                isRecipientOnline: isRecipientOnline
            }
        });

        // Notify sender about delivery
        if (isRecipientOnline) {
            // Via WebSocket
            const senderSocketId = onlineUsers.get(userId);
            if (senderSocketId && io) {
                io.to(senderSocketId).emit('message_delivered', {
                    messageId: message._id,
                    to_user_id: to_user_id,
                    status: 'delivered',
                    timestamp: new Date().toISOString()
                });
            }
            
            // Also via SSE
            sendSSEMessage(userId, {
                type: 'message_delivered',
                messageId: message._id,
                to_user_id: to_user_id,
                status: 'delivered',
                timestamp: new Date().toISOString()
            });
        }

    } catch (error) {
        console.log('❌ Error sending voice message:', error);
        res.json({ success: false, message: error.message });
    }
};

// Get Chat Messages (HTTP endpoint)
export const getChatMessages = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { to_user_id } = req.body;

        const messages = await Message.find({
            $or: [
                {from_user_id: userId, to_user_id},
                {from_user_id: to_user_id, to_user_id: userId},
            ]
        })
        .populate('from_user_id', 'full_name profile_picture email lastSeen')
        .populate('to_user_id', 'full_name profile_picture email lastSeen')
        .populate('reply_to')
        .sort({created_at: -1});

        // Mark messages as seen
        await Message.updateMany(
            {from_user_id: to_user_id, to_user_id: userId, seen: false}, 
            { 
                seen: true,
                $addToSet: { seen_by: userId }
            }
        );

        // Notify the other user that messages were seen via WebSocket
        const unreadMessages = await Message.find({
            from_user_id: to_user_id, 
            to_user_id: userId, 
            seen: false
        });

        unreadMessages.forEach(message => {
            const otherSocketId = onlineUsers.get(to_user_id);
            if (otherSocketId && io) {
                io.to(otherSocketId).emit('message_seen', {
                    messageId: message._id,
                    seenBy: userId,
                    timestamp: new Date().toISOString()
                });
            }
            
            // Also via SSE
            sendSSEMessage(to_user_id, {
                type: 'message_seen',
                messageId: message._id,
                seenBy: userId,
                timestamp: new Date().toISOString()
            });
        });

        // Check if the other user is online and get their last seen
        const isOtherUserOnline = onlineUsers.has(to_user_id);
        const otherUser = await User.findById(to_user_id).select('lastSeen');

        res.json({ 
            success: true, 
            messages,
            isOtherUserOnline,
            lastSeen: otherUser?.lastSeen
        });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Get User Recent Messages (HTTP endpoint)
export const getUserRecentMessages = async (req, res) => {
    try {
        const { userId } = req.auth();
        
        console.log('🔍 Fetching recent messages for user:', userId);
        
        // Get all messages where user is involved (both sent and received)
        const allMessages = await Message.find({
            $or: [
                { from_user_id: userId },
                { to_user_id: userId }
            ]
        })
        .populate('from_user_id', 'full_name profile_picture email lastSeen')
        .populate('to_user_id', 'full_name profile_picture email lastSeen')
        .populate('reply_to')
        .sort({ created_at: -1 });

        console.log('📨 Total messages found:', allMessages.length);

        // Group by conversation partner and get latest message
        const conversationMap = new Map();

        allMessages.forEach(message => {
            if (!message.from_user_id || !message.to_user_id) {
                console.log('⚠️ Skipping message with missing user data:', message._id);
                return;
            }

            const fromUserIdStr = message.from_user_id._id.toString();
            const toUserIdStr = message.to_user_id._id.toString();
            
            const otherUserId = fromUserIdStr === userId 
                ? toUserIdStr 
                : fromUserIdStr;
            
            const otherUser = fromUserIdStr === userId 
                ? message.to_user_id 
                : message.from_user_id;

            if (!otherUser) {
                console.log('⚠️ Skipping message with invalid other user:', message._id);
                return;
            }

            if (!conversationMap.has(otherUserId)) {
                conversationMap.set(otherUserId, {
                    user: {
                        _id: otherUser._id,
                        full_name: otherUser.full_name,
                        profile_picture: otherUser.profile_picture,
                        email: otherUser.email,
                        lastSeen: otherUser.lastSeen,
                        isOnline: onlineUsers.has(otherUserId)
                    },
                    lastMessage: {
                        _id: message._id,
                        text: message.text,
                        message_type: message.message_type,
                        createdAt: message.created_at,
                        created_at: message.created_at,
                        seen: message.seen,
                        delivered: message.delivered,
                        seen_by: message.seen_by
                    },
                    unreadCount: 0
                });
            }

            // Count unread messages (only messages TO current user that are unread)
            if (toUserIdStr === userId && !message.seen) {
                const conversation = conversationMap.get(otherUserId);
                if (conversation) {
                    conversation.unreadCount += 1;
                }
            }
        });

        // Convert map to array and sort by latest message
        const conversations = Array.from(conversationMap.values())
            .sort((a, b) => new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at));

        console.log('✅ Processed conversations:', conversations.length);

        res.json({ 
            success: true, 
            conversations,
            totalOnline: conversations.filter(conv => conv.user.isOnline).length
        });
    } catch (error) {
        console.log('❌ Error in getUserRecentMessages:', error);
        res.json({ success: false, message: error.message });
    }
};

// Get User Last Seen (HTTP endpoint)
export const getUserLastSeen = async (req, res) => {
    try {
        const { userId } = req.params;
        
        const user = await User.findById(userId).select('lastSeen full_name profile_picture');
        
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }

        res.json({ 
            success: true, 
            lastSeen: user.lastSeen,
            full_name: user.full_name,
            profile_picture: user.profile_picture,
            isOnline: onlineUsers.has(userId)
        });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Get Multiple Users Last Seen (HTTP endpoint)
export const getUsersLastSeen = async (req, res) => {
    try {
        const { userIds } = req.body;
        
        if (!Array.isArray(userIds)) {
            return res.json({ success: false, message: 'User IDs must be an array' });
        }

        const users = await User.find({ _id: { $in: userIds } }).select('lastSeen full_name _id profile_picture');
        
        const lastSeenData = {};
        users.forEach(user => {
            lastSeenData[user._id] = {
                lastSeen: user.lastSeen,
                full_name: user.full_name,
                profile_picture: user.profile_picture,
                isOnline: onlineUsers.has(user._id.toString())
            };
        });

        res.json({ 
            success: true, 
            lastSeenData 
        });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Handle Typing (HTTP endpoint)
export const handleTyping = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { to_user_id, is_typing } = req.body;

        if (is_typing) {
            typingUsers.set(userId, to_user_id);
            
            // Send typing start event via WebSocket
            const recipientSocketId = onlineUsers.get(to_user_id);
            if (recipientSocketId && io) {
                io.to(recipientSocketId).emit('typing_start', {
                    fromUserId: userId,
                    sound: 'typing',
                    timestamp: new Date().toISOString()
                });
            }
            
            // Also send via SSE
            sendSSEMessage(to_user_id, {
                type: 'typing_start',
                fromUserId: userId,
                sound: 'typing',
                timestamp: new Date().toISOString()
            });

            // Set timeout to stop typing after 3 seconds
            setTimeout(() => {
                if (typingUsers.get(userId) === to_user_id) {
                    typingUsers.delete(userId);
                    
                    // Via WebSocket
                    if (recipientSocketId && io) {
                        io.to(recipientSocketId).emit('typing_stop', {
                            fromUserId: userId,
                            timestamp: new Date().toISOString()
                        });
                    }
                    
                    // Also via SSE
                    sendSSEMessage(to_user_id, {
                        type: 'typing_stop',
                        fromUserId: userId,
                        timestamp: new Date().toISOString()
                    });
                }
            }, 3000);

        } else {
            typingUsers.delete(userId);
            
            // Send typing stop event via WebSocket
            const recipientSocketId = onlineUsers.get(to_user_id);
            if (recipientSocketId && io) {
                io.to(recipientSocketId).emit('typing_stop', {
                    fromUserId: userId,
                    timestamp: new Date().toISOString()
                });
            }
            
            // Also send via SSE
            sendSSEMessage(to_user_id, {
                type: 'typing_stop',
                fromUserId: userId,
                timestamp: new Date().toISOString()
            });
        }

        res.json({ success: true });

    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Mark Message as Seen (HTTP endpoint)
export const markMessageAsSeen = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { message_id } = req.body;

        const message = await Message.findById(message_id);

        if (!message) {
            return res.json({ success: false, message: 'Message not found' });
        }

        // Only mark as seen if the current user is the recipient
        if (message.to_user_id.toString() !== userId) {
            return res.json({ success: false, message: 'Not authorized' });
        }

        // Update seen status and add to seen_by array
        await Message.findByIdAndUpdate(message_id, {
            seen: true,
            $addToSet: { seen_by: userId }
        });

        // Notify sender via WebSocket
        const senderSocketId = onlineUsers.get(message.from_user_id.toString());
        if (senderSocketId && io) {
            io.to(senderSocketId).emit('message_seen', {
                messageId: message_id,
                seenBy: userId,
                timestamp: new Date().toISOString()
            });
        }
        
        // Also via SSE
        sendSSEMessage(message.from_user_id.toString(), {
            type: 'message_seen',
            messageId: message_id,
            seenBy: userId,
            timestamp: new Date().toISOString()
        });

        res.json({ success: true });

    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Clear Chat (HTTP endpoint)
export const clearChat = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { userId: otherUserId } = req.params;

        // Delete all messages between the two users
        await Message.deleteMany({
            $or: [
                { from_user_id: userId, to_user_id: otherUserId },
                { from_user_id: otherUserId, to_user_id: userId }
            ]
        });

        res.json({ 
            success: true, 
            message: 'Chat cleared successfully' 
        });

        // Notify the other user via WebSocket
        const otherSocketId = onlineUsers.get(otherUserId);
        if (otherSocketId && io) {
            io.to(otherSocketId).emit('chat_cleared', {
                clearedBy: userId,
                timestamp: new Date().toISOString()
            });
        }
        
        // Also via SSE
        sendSSEMessage(otherUserId, {
            type: 'chat_cleared',
            clearedBy: userId,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.log('❌ Error clearing chat:', error);
        res.json({ success: false, message: error.message });
    }
};

// Delete Single Message (HTTP endpoint)
export const deleteMessage = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { messageId } = req.params;

        const message = await Message.findById(messageId);

        if (!message) {
            return res.json({ success: false, message: 'Message not found' });
        }

        // Only allow deletion of own messages
        if (message.from_user_id.toString() !== userId) {
            return res.json({ success: false, message: 'Not authorized to delete this message' });
        }

        await Message.findByIdAndDelete(messageId);

        res.json({ 
            success: true, 
            message: 'Message deleted successfully' 
        });

        // Notify the recipient via WebSocket
        const recipientSocketId = onlineUsers.get(message.to_user_id.toString());
        if (recipientSocketId && io) {
            io.to(recipientSocketId).emit('message_deleted', {
                messageId: messageId,
                deletedBy: userId,
                timestamp: new Date().toISOString()
            });
        }
        
        // Also via SSE
        sendSSEMessage(message.to_user_id.toString(), {
            type: 'message_deleted',
            messageId: messageId,
            deletedBy: userId,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.log('❌ Error deleting message:', error);
        res.json({ success: false, message: error.message });
    }
};

// ==================== CALL ENDPOINTS (HTTP) ====================

// Initiate Call (HTTP endpoint)
export const initiateCall = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { to_user_id, call_type } = req.body;

        console.log(`📞 Call initiated via HTTP from ${userId} to ${to_user_id} (${call_type})`);

        // Check if recipient is online
        const isRecipientOnline = onlineUsers.has(to_user_id);
        console.log(`✅ Recipient ${to_user_id} is ${isRecipientOnline ? 'online' : 'offline'}`);

        if (!isRecipientOnline) {
            return res.json({ 
                success: false, 
                message: 'User is offline. Cannot start call.' 
            });
        }

        // Check if recipient is already in a call
        if (activeCalls.has(to_user_id)) {
            return res.json({ 
                success: false, 
                message: 'User is currently in another call.' 
            });
        }

        // Check if caller is already in a call
        if (activeCalls.has(userId)) {
            return res.json({ 
                success: false, 
                message: 'You are already in a call.' 
            });
        }

        // Get user info for notification
        const callerInfo = await getUserName(userId);

        // Create call session
        const callData = {
            callId: `call_${Date.now()}_${userId}`,
            fromUserId: userId,
            toUserId: to_user_id,
            callType: call_type,
            status: 'ringing',
            startTime: new Date(),
            participants: [userId]
        };

        // Store call data
        activeCalls.set(userId, callData);
        activeCalls.set(to_user_id, callData);

        console.log(`📞 Sending call notification to recipient: ${to_user_id}`);

        // Send call notification via WebSocket
        const recipientSocketId = onlineUsers.get(to_user_id);
        if (recipientSocketId && io) {
            io.to(recipientSocketId).emit('call_incoming', {
                callId: callData.callId,
                callType: call_type,
                fromUserId: userId,
                fromUserName: callerInfo.name,
                fromUserAvatar: callerInfo.avatar,
                timestamp: new Date().toISOString()
            });
        }
        
        // Also via SSE
        const callSent = sendSSEMessage(to_user_id, {
            type: 'call_incoming',
            callId: callData.callId,
            callType: call_type,
            fromUserId: userId,
            fromUserName: callerInfo.name,
            fromUserAvatar: callerInfo.avatar,
            timestamp: new Date().toISOString()
        });

        if (!callSent && !recipientSocketId) {
            activeCalls.delete(userId);
            activeCalls.delete(to_user_id);
            return res.json({ 
                success: false, 
                message: 'Failed to send call notification. User might be offline.' 
            });
        }

        // Send confirmation to caller via WebSocket
        const senderSocketId = onlineUsers.get(userId);
        if (senderSocketId && io) {
            io.to(senderSocketId).emit('call_initiated', {
                callId: callData.callId,
                toUserId: to_user_id,
                callType: call_type,
                timestamp: new Date().toISOString()
            });
        }
        
        // Also via SSE
        sendSSEMessage(userId, {
            type: 'call_initiated',
            callId: callData.callId,
            toUserId: to_user_id,
            callType: call_type,
            timestamp: new Date().toISOString()
        });

        // Set timeout to automatically reject if not answered
        const timeoutId = setTimeout(async () => {
            if (activeCalls.has(userId) && activeCalls.get(userId).status === 'ringing') {
                console.log(`⏰ Call timeout - auto rejecting call ${callData.callId}`);
                
                // Remove call from active calls
                activeCalls.delete(userId);
                activeCalls.delete(to_user_id);
                
                // Notify both users via WebSocket
                if (senderSocketId && io) {
                    io.to(senderSocketId).emit('call_rejected', {
                        callId: callData.callId,
                        reason: 'No answer',
                        timestamp: new Date().toISOString()
                    });
                }
                
                if (recipientSocketId && io) {
                    io.to(recipientSocketId).emit('call_ended', {
                        callId: callData.callId,
                        reason: 'No answer',
                        timestamp: new Date().toISOString()
                    });
                }
                
                // Also via SSE
                sendSSEMessage(userId, {
                    type: 'call_rejected',
                    callId: callData.callId,
                    reason: 'No answer',
                    timestamp: new Date().toISOString()
                });

                sendSSEMessage(to_user_id, {
                    type: 'call_ended',
                    callId: callData.callId,
                    reason: 'No answer',
                    timestamp: new Date().toISOString()
                });
            }
        }, 30000);

        // Store timeout ID in call data
        callData.timeoutId = timeoutId;

        res.json({ 
            success: true, 
            callId: callData.callId,
            message: 'Call initiated successfully'
        });

    } catch (error) {
        console.log('❌ Error initiating call:', error);
        res.json({ success: false, message: error.message });
    }
};

// Accept Call (HTTP endpoint)
export const acceptCall = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { call_id } = req.body;

        console.log(`✅ Call accepted via HTTP by ${userId} for call ${call_id}`);

        const callData = activeCalls.get(userId);
        if (!callData || callData.callId !== call_id) {
            return res.json({ 
                success: false, 
                message: 'Call not found or expired' 
            });
        }

        // Clear the auto-reject timeout
        if (callData.timeoutId) {
            clearTimeout(callData.timeoutId);
        }

        // Update call status
        callData.status = 'connected';
        callData.answerTime = new Date();
        callData.participants.push(userId);

        // Update both entries in activeCalls
        activeCalls.set(userId, callData);
        activeCalls.set(callData.fromUserId, callData);

        // Get user info for notification
        const accepterInfo = await getUserName(userId);

        console.log(`📞 Notifying caller ${callData.fromUserId} that call was accepted`);

        // Notify caller via WebSocket
        const callerSocketId = onlineUsers.get(callData.fromUserId);
        if (callerSocketId && io) {
            io.to(callerSocketId).emit('call_accepted', {
                callId: call_id,
                acceptedBy: userId,
                acceptedByName: accepterInfo.name,
                timestamp: new Date().toISOString()
            });
        }
        
        // Also via SSE
        sendSSEMessage(callData.fromUserId, {
            type: 'call_accepted',
            callId: call_id,
            acceptedBy: userId,
            acceptedByName: accepterInfo.name,
            timestamp: new Date().toISOString()
        });

        // Notify recipient that call is connected via WebSocket
        const recipientSocketId = onlineUsers.get(userId);
        if (recipientSocketId && io) {
            io.to(recipientSocketId).emit('call_connected', {
                callId: call_id,
                withUserId: callData.fromUserId,
                withUserName: await getUserName(callData.fromUserId).then(info => info.name),
                callType: callData.callType,
                timestamp: new Date().toISOString()
            });
        }
        
        // Also via SSE
        sendSSEMessage(userId, {
            type: 'call_connected',
            callId: call_id,
            withUserId: callData.fromUserId,
            withUserName: await getUserName(callData.fromUserId).then(info => info.name),
            callType: callData.callType,
            timestamp: new Date().toISOString()
        });

        res.json({ 
            success: true, 
            callId: call_id,
            message: 'Call accepted successfully'
        });

    } catch (error) {
        console.log('❌ Error accepting call:', error);
        res.json({ success: false, message: error.message });
    }
};

// Reject Call (HTTP endpoint)
export const rejectCall = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { call_id } = req.body;

        console.log(`❌ Call rejected via HTTP by ${userId} for call ${call_id}`);

        const callData = activeCalls.get(userId);
        if (!callData || callData.callId !== call_id) {
            return res.json({ 
                success: false, 
                message: 'Call not found or expired' 
            });
        }

        // Clear the auto-reject timeout
        if (callData.timeoutId) {
            clearTimeout(callData.timeoutId);
        }

        const callerId = callData.fromUserId;

        // Remove call from active calls
        activeCalls.delete(userId);
        activeCalls.delete(callerId);

        // Get user info for notification
        const rejecterInfo = await getUserName(userId);

        // Notify caller via WebSocket
        const callerSocketId = onlineUsers.get(callerId);
        if (callerSocketId && io) {
            io.to(callerSocketId).emit('call_rejected', {
                callId: call_id,
                rejectedBy: userId,
                rejectedByName: rejecterInfo.name,
                timestamp: new Date().toISOString()
            });
        }
        
        // Also via SSE
        sendSSEMessage(callerId, {
            type: 'call_rejected',
            callId: call_id,
            rejectedBy: userId,
            rejectedByName: rejecterInfo.name,
            timestamp: new Date().toISOString()
        });

        res.json({ 
            success: true, 
            message: 'Call rejected successfully'
        });

    } catch (error) {
        console.log('❌ Error rejecting call:', error);
        res.json({ success: false, message: error.message });
    }
};

// End Call (HTTP endpoint)
export const endCall = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { call_id } = req.body;

        console.log(`📞 Call ended via HTTP by ${userId} for call ${call_id}`);

        const callData = activeCalls.get(userId);
        if (!callData || callData.callId !== call_id) {
            return res.json({ 
                success: false, 
                message: 'Call not found or already ended' 
            });
        }

        // Clear the auto-reject timeout if call was still ringing
        if (callData.timeoutId) {
            clearTimeout(callData.timeoutId);
        }

        const otherUserId = callData.fromUserId === userId ? callData.toUserId : callData.fromUserId;

        // Remove call from active calls
        activeCalls.delete(userId);
        activeCalls.delete(otherUserId);

        // Calculate call duration
        const endTime = new Date();
        const duration = callData.answerTime 
            ? Math.floor((endTime - callData.answerTime) / 1000)
            : 0;

        // Get user info for notification
        const enderInfo = await getUserName(userId);

        // Notify other participant via WebSocket
        const otherSocketId = onlineUsers.get(otherUserId);
        if (otherSocketId && io) {
            io.to(otherSocketId).emit('call_ended', {
                callId: call_id,
                endedBy: userId,
                endedByName: enderInfo.name,
                duration: duration,
                timestamp: new Date().toISOString()
            });
        }
        
        // Also via SSE
        sendSSEMessage(otherUserId, {
            type: 'call_ended',
            callId: call_id,
            endedBy: userId,
            endedByName: enderInfo.name,
            duration: duration,
            timestamp: new Date().toISOString()
        });

        res.json({ 
            success: true, 
            duration: duration,
            message: 'Call ended successfully'
        });

    } catch (error) {
        console.log('❌ Error ending call:', error);
        res.json({ success: false, message: error.message });
    }
};

// ==================== WEBSOCKET STATUS ENDPOINTS ====================

// Get online users
export const getOnlineUsers = async (req, res) => {
    try {
        const onlineUserIds = Array.from(onlineUsers.keys());
        const users = await User.find({ 
            _id: { $in: onlineUserIds } 
        }).select('full_name profile_picture email lastSeen _id');

        res.json({ 
            success: true, 
            users: users.map(user => ({
                ...user.toObject(),
                isOnline: true,
                socketId: onlineUsers.get(user._id.toString())
            })),
            total: users.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Get socket status
export const getSocketStatus = async (req, res) => {
    try {
        const { userId } = req.auth();
        
        res.json({
            success: true,
            userId: userId,
            isOnline: onlineUsers.has(userId),
            socketId: onlineUsers.get(userId),
            totalOnline: Array.from(onlineUsers.keys()).length,
            websocketAvailable: io !== null,
            sseAvailable: true,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};