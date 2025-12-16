// controllers/messageController.js
import fs from "fs";
import imagekit from "../configs/imageKit.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { compressAudio, estimateDuration } from "../utils/audioCompressor.js";

// Store SSE connections
export const connections = new Map();

// Track online users globally
export const onlineUsers = new Set();

// Track typing status
const typingUsers = new Map();

// 🆕 Track active calls
const activeCalls = new Map();

// 🆕 Track WebRTC offers/answers
const webrtcOffers = new Map();
const webrtcAnswers = new Map();

// Update user's last seen timestamp
export const updateLastSeen = async (userId) => {
    try {
        await User.findByIdAndUpdate(userId, { 
            lastSeen: new Date() 
        });
        console.log(`🕒 Updated last seen for user: ${userId}`);
    } catch (error) {
        console.log('❌ Error updating last seen:', error);
    }
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
                console.log(`📢 Broadcasted ${status} status for user ${userId} to ${connectionUserId}`);
            } catch (error) {
                console.log(`❌ Error broadcasting to ${connectionUserId}:`, error);
                connections.delete(connectionUserId);
                onlineUsers.delete(connectionUserId);
            }
        }
    });
};

// SSE setup function
export const setupSSE = (req, res) => {
    const userId = req.params.userId;
    
    console.log('🔗 SSE connected for user:', userId);
    console.log('📊 Current online users before:', Array.from(onlineUsers));
    
    // Set headers for SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
    });

    // Add user to online users and update last seen
    onlineUsers.add(userId);
    updateLastSeen(userId);
    
    console.log('📊 Current online users after:', Array.from(onlineUsers));
    
    // Notify all connections that this user came online
    broadcastUserStatus(userId, 'online');

    // Send initial connection message with online users
    res.write(`data: ${JSON.stringify({ 
        type: 'connected', 
        message: 'SSE Connected',
        onlineUsers: Array.from(onlineUsers),
        userId: userId
    })}\n\n`);

    // Store the connection
    connections.set(userId, res);

    // Remove connection when client disconnects
    req.on('close', () => {
        console.log('🔌 SSE disconnected for user:', userId);
        console.log('📊 Online users before disconnect:', Array.from(onlineUsers));
        
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
        
        console.log('📊 Online users after disconnect:', Array.from(onlineUsers));
        
        // Update last seen when user disconnects
        updateLastSeen(userId);
        
        // Notify all connections that this user went offline
        broadcastUserStatus(userId, 'offline');
        res.end();
    });

    // Handle errors
    req.on('error', (error) => {
        console.log('❌ SSE connection error for user:', userId, error);
        connections.delete(userId);
        onlineUsers.delete(userId);
        typingUsers.delete(userId);
    });

    // Heartbeat to keep connection alive and update last seen
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

// Get user's last seen information
export const getUserLastSeen = async (req, res) => {
    try {
        const { userId } = req.params;
        
        const user = await User.findById(userId).select('lastSeen full_name');
        
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }

        res.json({ 
            success: true, 
            lastSeen: user.lastSeen,
            full_name: user.full_name,
            isOnline: onlineUsers.has(userId)
        });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
};

// Get multiple users' last seen status
export const getUsersLastSeen = async (req, res) => {
    try {
        const { userIds } = req.body;
        
        if (!Array.isArray(userIds)) {
            return res.json({ success: false, message: 'User IDs must be an array' });
        }

        const users = await User.find({ _id: { $in: userIds } }).select('lastSeen full_name _id');
        
        const lastSeenData = {};
        users.forEach(user => {
            lastSeenData[user._id] = {
                lastSeen: user.lastSeen,
                full_name: user.full_name,
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

// 🆕 IMPROVED: Send message to specific user via SSE with better logging
export const sendSSEMessage = (userId, data) => {
    console.log(`🔍 Looking for SSE connection for user: ${userId}`);
    
    const connection = connections.get(userId);
    if (connection) {
        try {
            const messageString = `data: ${JSON.stringify(data)}\n\n`;
            console.log(`📤 Sending SSE message to user: ${userId}`, data.type);
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
    console.log(`❌ No SSE connection found for user: ${userId}`);
    return false;
};

// Controller function for the SSE endpoint
export const sseController = (req, res) => {
    console.log('🚀 SSE Controller called for user:', req.params.userId);
    setupSSE(req, res);
};

// 🆕 Get user name helper function
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

// 🆕 IMPROVED: Call Functions with WebRTC signaling
export const initiateCall = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { to_user_id, call_type } = req.body; // 'video' or 'voice'

        console.log(`📞 Call initiated from ${userId} to ${to_user_id} (${call_type})`);

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

        // Send call notification to recipient via SSE
        const callSent = sendSSEMessage(to_user_id, {
            type: 'call_incoming',
            callId: callData.callId,
            callType: call_type,
            fromUserId: userId,
            fromUserName: callerInfo.name,
            fromUserAvatar: callerInfo.avatar,
            timestamp: new Date().toISOString()
        });

        if (!callSent) {
            activeCalls.delete(userId);
            activeCalls.delete(to_user_id);
            return res.json({ 
                success: false, 
                message: 'Failed to send call notification. User might be offline.' 
            });
        }

        // Send confirmation to caller
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
                
                // Notify both users
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
        }, 30000); // 30 seconds timeout

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

// 🆕 WebRTC signaling endpoints
export const sendWebRTCOffer = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { to_user_id, offer, call_type } = req.body;

        console.log(`📡 WebRTC Offer from ${userId} to ${to_user_id}`);

        // Check if recipient is online
        if (!onlineUsers.has(to_user_id)) {
            return res.json({ 
                success: false, 
                message: 'User is offline.' 
            });
        }

        // Store offer temporarily
        webrtcOffers.set(`${userId}_${to_user_id}`, {
            offer,
            call_type,
            timestamp: new Date().toISOString()
        });

        // Send offer to recipient via SSE
        const offerSent = sendSSEMessage(to_user_id, {
            type: 'webrtc_offer',
            offer: offer,
            fromUserId: userId,
            callType: call_type,
            timestamp: new Date().toISOString()
        });

        if (!offerSent) {
            webrtcOffers.delete(`${userId}_${to_user_id}`);
            return res.json({ 
                success: false, 
                message: 'Failed to send offer. User might be offline.' 
            });
        }

        res.json({ 
            success: true, 
            message: 'WebRTC offer sent successfully' 
        });

    } catch (error) {
        console.log('❌ Error sending WebRTC offer:', error);
        res.json({ success: false, message: error.message });
    }
};

export const sendWebRTCAnswer = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { to_user_id, answer } = req.body;

        console.log(`📡 WebRTC Answer from ${userId} to ${to_user_id}`);

        // Store answer temporarily
        webrtcAnswers.set(`${to_user_id}_${userId}`, {
            answer,
            timestamp: new Date().toISOString()
        });

        // Send answer to caller via SSE
        const answerSent = sendSSEMessage(to_user_id, {
            type: 'webrtc_answer',
            answer: answer,
            fromUserId: userId,
            timestamp: new Date().toISOString()
        });

        if (!answerSent) {
            webrtcAnswers.delete(`${to_user_id}_${userId}`);
            return res.json({ 
                success: false, 
                message: 'Failed to send answer. User might be offline.' 
            });
        }

        res.json({ 
            success: true, 
            message: 'WebRTC answer sent successfully' 
        });

    } catch (error) {
        console.log('❌ Error sending WebRTC answer:', error);
        res.json({ success: false, message: error.message });
    }
};

export const sendWebRTCCandidate = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { to_user_id, candidate } = req.body;

        console.log(`📡 WebRTC ICE Candidate from ${userId} to ${to_user_id}`);

        // Send ICE candidate to peer via SSE
        const candidateSent = sendSSEMessage(to_user_id, {
            type: 'webrtc_candidate',
            candidate: candidate,
            fromUserId: userId,
            timestamp: new Date().toISOString()
        });

        if (!candidateSent) {
            return res.json({ 
                success: false, 
                message: 'Failed to send ICE candidate. User might be offline.' 
            });
        }

        res.json({ 
            success: true, 
            message: 'WebRTC ICE candidate sent successfully' 
        });

    } catch (error) {
        console.log('❌ Error sending WebRTC ICE candidate:', error);
        res.json({ success: false, message: error.message });
    }
};

// 🆕 Get pending WebRTC data
export const getWebRTCData = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { from_user_id } = req.params;

        const offerKey = `${from_user_id}_${userId}`;
        const answerKey = `${userId}_${from_user_id}`;

        const pendingOffer = webrtcOffers.get(offerKey);
        const pendingAnswer = webrtcAnswers.get(answerKey);

        res.json({
            success: true,
            pendingOffer,
            pendingAnswer
        });

    } catch (error) {
        console.log('❌ Error getting WebRTC data:', error);
        res.json({ success: false, message: error.message });
    }
};

// 🆕 Accept Call
export const acceptCall = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { call_id } = req.body;

        console.log(`✅ Call accepted by ${userId} for call ${call_id}`);

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

        // Notify caller that call was accepted
        sendSSEMessage(callData.fromUserId, {
            type: 'call_accepted',
            callId: call_id,
            acceptedBy: userId,
            acceptedByName: accepterInfo.name,
            timestamp: new Date().toISOString()
        });

        // Notify both users that call is connected
        sendSSEMessage(userId, {
            type: 'call_connected',
            callId: call_id,
            withUserId: callData.fromUserId,
            withUserName: await getUserName(callData.fromUserId).then(info => info.name),
            callType: callData.callType,
            timestamp: new Date().toISOString()
        });

        sendSSEMessage(callData.fromUserId, {
            type: 'call_connected',
            callId: call_id,
            withUserId: userId,
            withUserName: accepterInfo.name,
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

// 🆕 Reject Call
export const rejectCall = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { call_id } = req.body;

        console.log(`❌ Call rejected by ${userId} for call ${call_id}`);

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

        // Notify caller that call was rejected
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

// 🆕 End Call
export const endCall = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { call_id, duration } = req.body;

        console.log(`📞 Call ended by ${userId} for call ${call_id}`);

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

        // Clean up WebRTC data
        webrtcOffers.delete(`${userId}_${otherUserId}`);
        webrtcOffers.delete(`${otherUserId}_${userId}`);
        webrtcAnswers.delete(`${userId}_${otherUserId}`);
        webrtcAnswers.delete(`${otherUserId}_${userId}`);

        // Get user info for notification
        const enderInfo = await getUserName(userId);

        // Notify other participant that call ended
        sendSSEMessage(otherUserId, {
            type: 'call_ended',
            callId: call_id,
            endedBy: userId,
            endedByName: enderInfo.name,
            duration: duration || 0,
            timestamp: new Date().toISOString()
        });

        res.json({ 
            success: true, 
            duration: duration || 0,
            message: 'Call ended successfully'
        });

    } catch (error) {
        console.log('❌ Error ending call:', error);
        res.json({ success: false, message: error.message });
    }
};

// Send Voice Message with ImageKit Upload
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
            duration: actualDuration
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

        // Send real-time notification
        if (sendSSEMessage(to_user_id, {
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
        })) {
            console.log('✅ Voice message notification sent to:', to_user_id);
        }

        // Notify sender about delivery
        if (isRecipientOnline) {
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

// Send Message (Keep your existing ImageKit logic)
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
            media_url: media_url || undefined
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

        // Send real-time notification to recipient via SSE
        if (sendSSEMessage(to_user_id, {
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
        })) {
            console.log('✅ SSE notification sent to:', to_user_id);
        }

        // Notify sender that message was delivered
        if (isRecipientOnline) {
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
}

// Typing Indicator
export const handleTyping = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { to_user_id, is_typing } = req.body;

        if (is_typing) {
            typingUsers.set(userId, to_user_id);
            
            // Send typing start event
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
                    sendSSEMessage(to_user_id, {
                        type: 'typing_stop',
                        fromUserId: userId,
                        timestamp: new Date().toISOString()
                    });
                }
            }, 3000);

        } else {
            typingUsers.delete(userId);
            
            // Send typing stop event
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

// Mark Message as Seen
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

        // Notify sender that message was seen
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

// Get Chat Messages
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

        // Notify the other user that messages were seen
        const unreadMessages = await Message.find({
            from_user_id: to_user_id, 
            to_user_id: userId, 
            seen: false
        });

        unreadMessages.forEach(message => {
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
}

// FIXED: getUserRecentMessages with proper null checks
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
            // ✅ FIX: Add null checks before accessing _id properties
            if (!message.from_user_id || !message.to_user_id) {
                console.log('⚠️ Skipping message with missing user data:', message._id);
                return; // Skip this message
            }

            // Determine the other user in conversation
            const fromUserIdStr = message.from_user_id._id.toString();
            const toUserIdStr = message.to_user_id._id.toString();
            
            const otherUserId = fromUserIdStr === userId 
                ? toUserIdStr 
                : fromUserIdStr;
            
            const otherUser = fromUserIdStr === userId 
                ? message.to_user_id 
                : message.from_user_id;

            // ✅ FIX: Additional null check for otherUser
            if (!otherUser) {
                console.log('⚠️ Skipping message with invalid other user:', message._id);
                return;
            }

            // If we haven't seen this conversation yet, add it
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
}

// Clear Chat
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

        // Notify the other user that chat was cleared
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

// Delete Single Message
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

        // Notify the recipient that message was deleted
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