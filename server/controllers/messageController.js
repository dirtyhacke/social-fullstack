import fs from "fs";
import imagekit from "../configs/imageKit.js";
import Message from "../models/Message.js";

// Store SSE connections
export const connections = new Map();

// SSE setup function
export const setupSSE = (req, res) => {
    const userId = req.params.userId;
    
    console.log('🔗 SSE connected for user:', userId);
    
    // Set headers for SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
    });

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', message: 'SSE Connected' })}\n\n`);

    // Store the connection
    connections.set(userId, res);

    // Remove connection when client disconnects
    req.on('close', () => {
        console.log('🔌 SSE disconnected for user:', userId);
        connections.delete(userId);
        res.end();
    });

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
        if (connections.has(userId)) {
            res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
        } else {
            clearInterval(heartbeat);
        }
    }, 30000);
};

// Send message to specific user via SSE
export const sendSSEMessage = (userId, data) => {
    const connection = connections.get(userId);
    if (connection) {
        connection.write(`data: ${JSON.stringify(data)}\n\n`);
        console.log('📤 SSE message sent to user:', userId);
        return true;
    }
    console.log('❌ No SSE connection for user:', userId);
    return false;
};

// Controller function for the SSE endpoint
export const sseController = (req, res) => {
    console.log('🚀 SSE Controller called for user:', req.params.userId);
    setupSSE(req, res);
};

// Send Message
export const sendMessage = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { to_user_id, text } = req.body;
        const image = req.file;

        let media_url = '';
        let message_type = image ? 'image' : 'text';

        if(message_type === 'image'){
            const fileBuffer =  fs.readFileSync(image.path);
            const response = await imagekit.upload({
                file: fileBuffer,
                fileName: image.originalname,
            });
            media_url = imagekit.url({
                path: response.filePath,
                transformation: [
                    {quality: 'auto'},
                    {format: 'webp'},
                    {width: '1280'}
                ]
            })
        }

        const message = await Message.create({
            from_user_id: userId,
            to_user_id,
            text,
            message_type,
            media_url
        })

        // Populate user data for the response
        const messageWithUserData = await Message.findById(message._id)
            .populate('from_user_id', 'full_name profile_picture email')
            .populate('to_user_id', 'full_name profile_picture email');

        res.json({ success: true, message: messageWithUserData });

        // ✅ Send real-time notification to recipient via SSE
        if (sendSSEMessage(to_user_id, {
            type: 'new_message',
            message: messageWithUserData,
            notification: {
                title: 'New Message',
                body: message_type === 'text' ? (text || 'New message') : '📷 Image',
                from: messageWithUserData.from_user_id?.full_name || 'Someone',
                fromId: userId,
                avatar: messageWithUserData.from_user_id?.profile_picture || '/default-avatar.png'
            }
        })) {
            console.log('✅ SSE notification sent to:', to_user_id);
        }

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}

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
        .populate('from_user_id', 'full_name profile_picture email')
        .populate('to_user_id', 'full_name profile_picture email')
        .sort({created_at: -1});

        // Mark messages as seen
        await Message.updateMany(
            {from_user_id: to_user_id, to_user_id: userId, seen: false}, 
            {seen: true}
        );

        res.json({ success: true, messages });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}

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
        .populate('from_user_id', 'full_name profile_picture email')
        .populate('to_user_id', 'full_name profile_picture email')
        .sort({ created_at: -1 });

        console.log('📨 Total messages found:', allMessages.length);

        // Group by conversation partner and get latest message
        const conversationMap = new Map();

        allMessages.forEach(message => {
            // Determine the other user in conversation
            const otherUserId = message.from_user_id._id.toString() === userId 
                ? message.to_user_id._id.toString() 
                : message.from_user_id._id.toString();
            
            const otherUser = message.from_user_id._id.toString() === userId 
                ? message.to_user_id 
                : message.from_user_id;

            // If we haven't seen this conversation yet, add it
            if (!conversationMap.has(otherUserId)) {
                conversationMap.set(otherUserId, {
                    user: {
                        _id: otherUser._id,
                        full_name: otherUser.full_name,
                        profile_picture: otherUser.profile_picture,
                        email: otherUser.email
                    },
                    lastMessage: {
                        _id: message._id,
                        text: message.text,
                        message_type: message.message_type,
                        createdAt: message.created_at,
                        created_at: message.created_at
                    },
                    unreadCount: 0
                });
            }

            // Count unread messages (only messages TO current user that are unread)
            if (message.to_user_id._id.toString() === userId && !message.seen) {
                const conversation = conversationMap.get(otherUserId);
                conversation.unreadCount += 1;
            }
        });

        // Convert map to array and sort by latest message
        const conversations = Array.from(conversationMap.values())
            .sort((a, b) => new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at));

        console.log('✅ Processed conversations:', conversations.length);

        res.json({ 
            success: true, 
            conversations 
        });
    } catch (error) {
        console.log('❌ Error in getUserRecentMessages:', error);
        res.json({ success: false, message: error.message });
    }
}