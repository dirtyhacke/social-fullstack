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

// Send message to specific user via SSE with better logging
export const sendSSEMessage = (userId, data) => {
    console.log(`🔍 Looking for SSE connection for user: ${userId}`);
    console.log(`📊 Available connections:`, Array.from(connections.keys()));
    
    const connection = connections.get(userId);
    if (connection) {
        try {
            const messageString = `data: ${JSON.stringify(data)}\n\n`;
            console.log(`📤 Sending SSE message to user: ${userId}`, data);
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
    console.log(`📋 Current online users:`, Array.from(onlineUsers));
    return false;
};

// Controller function for the SSE endpoint
export const sseController = (req, res) => {
    console.log('🚀 SSE Controller called for user:', req.params.userId);
    console.log('🔑 User ID from params:', req.params.userId);
    setupSSE(req, res);
};

// Get user name helper function
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
// FIXED: Send Message with proper memory storage handling
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
                console.log('📁 Image details:', {
                    originalname: image.originalname,
                    mimetype: image.mimetype,
                    size: image.size,
                    buffer: image.buffer ? `Present (${image.buffer.length} bytes)` : 'Missing'
                });

                // Use image.buffer directly (memory storage)
                if (!image.buffer) {
                    throw new Error('Image buffer is missing');
                }

                const response = await imagekit.upload({
                    file: image.buffer, // Use buffer directly
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