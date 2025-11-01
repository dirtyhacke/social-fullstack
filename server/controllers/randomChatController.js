import fs from "fs";
import ChatSession from '../models/ChatSession.js';
import OnlineUser from '../models/OnlineUser.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import imagekit from "../configs/imageKit.js";

// ShareChat-style matching system
const waitingUsers = new Map();
const activeChats = new Map();

// Join random chat - ShareChat Style
export const joinRandomChat = async (req, res) => {
    try {
        const userId = req.userId;
        console.log('🔍 User searching for chat:', userId);

        // Remove from any existing chats first
        endUserSession(userId);

        // Add to waiting users
        waitingUsers.set(userId, {
            user: userId,
            joinedAt: Date.now(),
            lastActive: Date.now()
        });

        // Update database
        await OnlineUser.findOneAndUpdate(
            { user: userId },
            { 
                user: userId,
                is_searching: true,
                last_active: new Date()
            },
            { upsert: true, new: true }
        );

        // Try to find immediate match
        const match = findQuickMatch(userId);
        
        if (match) {
            console.log('🎯 Quick match found:', userId, 'with', match.user);
            
            // Create chat session
            const chatSession = await ChatSession.create({
                user1: userId,
                user2: match.user,
                status: 'matched',
                matched_at: new Date()
            });

            // Remove both from waiting
            waitingUsers.delete(userId);
            waitingUsers.delete(match.user);

            // Add to active chats
            activeChats.set(userId, { sessionId: chatSession._id, partner: match.user });
            activeChats.set(match.user, { sessionId: chatSession._id, partner: userId });

            // Update database
            await OnlineUser.updateMany(
                { user: { $in: [userId, match.user] } },
                { is_searching: false, last_active: new Date() }
            );

            // Get matched user details
            const matchedUser = await User.findById(match.user).select('username full_name profile_picture bio');

            // Send real-time match notification
            sendMatchNotification(userId, matchedUser, chatSession._id);
            sendMatchNotification(match.user, await User.findById(userId).select('username full_name profile_picture bio'), chatSession._id);

            res.json({ 
                success: true, 
                matchedUser,
                sessionId: chatSession._id,
                message: `Connected with ${matchedUser.full_name}!`
            });
        } else {
            console.log('⏳ Waiting for match. Online users:', waitingUsers.size);
            
            res.json({ 
                success: true, 
                status: 'searching',
                message: 'Looking for someone to chat with...',
                onlineCount: waitingUsers.size
            });
        }

    } catch (error) {
        console.log('❌ Error in joinRandomChat:', error);
        res.json({ success: false, message: error.message });
    }
}

// ShareChat-style quick matching
const findQuickMatch = (userId) => {
    const availableUsers = Array.from(waitingUsers.entries())
        .filter(([id, data]) => id !== userId)
        .map(([id, data]) => ({ user: id, ...data }));

    if (availableUsers.length === 0) {
        return null;
    }

    const randomIndex = Math.floor(Math.random() * availableUsers.length);
    return availableUsers[randomIndex];
}

// Send match notification via SSE
const sendMatchNotification = (userId, matchedUser, sessionId) => {
    if (global.connections && global.connections.has(userId)) {
        const connection = global.connections.get(userId);
        connection.write(`data: ${JSON.stringify({
            type: 'match_found',
            matchedUser: matchedUser,
            sessionId: sessionId
        })}\n\n`);
        console.log('📤 Match notification sent to:', userId);
    }
}

// Background matching every 2 seconds
setInterval(async () => {
    try {
        if (waitingUsers.size >= 2) {
            const users = Array.from(waitingUsers.keys());
            const shuffledUsers = users.sort(() => Math.random() - 0.5);
            
            for (let i = 0; i < shuffledUsers.length - 1; i += 2) {
                const user1 = shuffledUsers[i];
                const user2 = shuffledUsers[i + 1];

                if (waitingUsers.has(user1) && waitingUsers.has(user2)) {
                    console.log('🔄 Background match:', user1, user2);
                    
                    const chatSession = await ChatSession.create({
                        user1: user1,
                        user2: user2,
                        status: 'matched',
                        matched_at: new Date()
                    });

                    waitingUsers.delete(user1);
                    waitingUsers.delete(user2);

                    activeChats.set(user1, { sessionId: chatSession._id, partner: user2 });
                    activeChats.set(user2, { sessionId: chatSession._id, partner: user1 });

                    await OnlineUser.updateMany(
                        { user: { $in: [user1, user2] } },
                        { is_searching: false, last_active: new Date() }
                    );

                    // Send real-time notifications
                    sendMatchNotification(user1, await User.findById(user2).select('username full_name profile_picture bio'), chatSession._id);
                    sendMatchNotification(user2, await User.findById(user1).select('username full_name profile_picture bio'), chatSession._id);
                }
            }
        }
    } catch (error) {
        console.log('❌ Error in background matcher:', error);
    }
}, 2000);

// Skip and find new person
export const skipMatch = async (req, res) => {
    try {
        const userId = req.userId;
        const { sessionId } = req.body;

        console.log('⏭️ User skipping and finding new person:', userId);

        await endUserSession(userId);

        if (sessionId) {
            await ChatSession.findByIdAndUpdate(sessionId, {
                status: 'skipped',
                ended_at: new Date(),
                skipped_by: userId
            });
        }

        const match = findQuickMatch(userId);
        
        if (match) {
            console.log('🎯 New match found after skip:', userId, 'with', match.user);
            
            const chatSession = await ChatSession.create({
                user1: userId,
                user2: match.user,
                status: 'matched',
                matched_at: new Date()
            });

            waitingUsers.delete(userId);
            waitingUsers.delete(match.user);

            activeChats.set(userId, { sessionId: chatSession._id, partner: match.user });
            activeChats.set(match.user, { sessionId: chatSession._id, partner: userId });

            await OnlineUser.updateMany(
                { user: { $in: [userId, match.user] } },
                { is_searching: false, last_active: new Date() }
            );

            const matchedUser = await User.findById(match.user).select('username full_name profile_picture bio');

            // Send real-time notifications
            sendMatchNotification(userId, matchedUser, chatSession._id);
            sendMatchNotification(match.user, await User.findById(userId).select('username full_name profile_picture bio'), chatSession._id);

            res.json({ 
                success: true, 
                matchedUser,
                sessionId: chatSession._id,
                message: `Connected with ${matchedUser.full_name}!`
            });
        } else {
            waitingUsers.set(userId, {
                user: userId,
                joinedAt: Date.now(),
                lastActive: Date.now()
            });

            res.json({ 
                success: true, 
                status: 'searching',
                message: 'Looking for someone new...',
                onlineCount: waitingUsers.size
            });
        }

    } catch (error) {
        console.log('Error in skipMatch:', error);
        res.json({ success: false, message: error.message });
    }
}

// End user session completely
const endUserSession = async (userId) => {
    waitingUsers.delete(userId);
    
    const userChat = activeChats.get(userId);
    if (userChat) {
        activeChats.delete(userId);
        
        // Notify partner that user left
        if (global.connections && global.connections.has(userChat.partner)) {
            const connection = global.connections.get(userChat.partner);
            connection.write(`data: ${JSON.stringify({
                type: 'partner_left',
                message: 'Your chat partner has left the conversation'
            })}\n\n`);
        }
        activeChats.delete(userChat.partner);
    }
}

// End chat session
export const endChat = async (req, res) => {
    try {
        const userId = req.userId;
        const { sessionId } = req.body;

        await endUserSession(userId);

        if (sessionId) {
            await ChatSession.findByIdAndUpdate(sessionId, {
                status: 'ended',
                ended_at: new Date()
            });
        }

        await OnlineUser.findOneAndDelete({ user: userId });

        res.json({ success: true, message: 'Chat ended' });

    } catch (error) {
        console.log('Error in endChat:', error);
        res.json({ success: false, message: error.message });
    }
}

// Get online users count
export const getOnlineUsers = async (req, res) => {
    try {
        const onlineCount = waitingUsers.size;
        
        res.json({ 
            success: true, 
            onlineCount,
            waitingUsers: Array.from(waitingUsers.keys()),
            activeChats: Array.from(activeChats.keys())
        });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}

// Real-time message sending with SSE - FIXED
export const sendRandomChatMessage = async (req, res) => {
    try {
        const userId = req.userId;
        const { to_user_id, text, sessionId } = req.body;
        const image = req.file;

        console.log('💬 Sending message from:', userId, 'to:', to_user_id);

        let media_url = '';
        let message_type = image ? 'image' : 'text';

        if (message_type === 'image') {
            const fileBuffer = fs.readFileSync(image.path);
            const response = await imagekit.upload({
                file: fileBuffer,
                fileName: image.originalname,
            });
            media_url = imagekit.url({
                path: response.filePath,
                transformation: [
                    { quality: 'auto' },
                    { format: 'webp' },
                    { width: '1280' }
                ]
            });
        }

        // Save message to database
        const message = await Message.create({
            from_user_id: userId,
            to_user_id,
            text,
            message_type,
            media_url,
            session_id: sessionId
        });

        // Update session status
        await ChatSession.findByIdAndUpdate(sessionId, {
            status: 'chatting',
            last_message_at: new Date()
        });

        // Populate user data
        const messageWithUser = await Message.findById(message._id)
            .populate('from_user_id', 'username full_name profile_picture');

        console.log('✅ Message saved to database:', messageWithUser._id);

        // Send response first
        res.json({ success: true, message: messageWithUser });

        // REAL-TIME DELIVERY VIA SSE
        if (global.connections && global.connections.has(to_user_id)) {
            const connection = global.connections.get(to_user_id);
            const sseData = {
                type: 'random_chat_message',
                data: messageWithUser,
                sessionId: sessionId
            };
            
            console.log('📤 Sending real-time message to:', to_user_id);
            connection.write(`data: ${JSON.stringify(sseData)}\n\n`);
        } else {
            console.log('❌ No SSE connection found for user:', to_user_id);
        }

    } catch (error) {
        console.log('Error in sendRandomChatMessage:', error);
        res.json({ success: false, message: error.message });
    }
}

// Get chat messages with pagination
export const getChatMessages = async (req, res) => {
    try {
        const { sessionId, page = 1, limit = 50 } = req.query;
        const session = await ChatSession.findById(sessionId);

        if (!session) {
            return res.json({ success: false, message: 'Chat session not found' });
        }

        const messages = await Message.find({
            $or: [
                { from_user_id: session.user1, to_user_id: session.user2 },
                { from_user_id: session.user2, to_user_id: session.user1 }
            ]
        })
        .populate('from_user_id', 'username full_name profile_picture')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

        await Message.updateMany(
            { 
                to_user_id: req.userId, 
                seen: false,
                $or: [
                    { from_user_id: session.user1 },
                    { from_user_id: session.user2 }
                ]
            }, 
            { seen: true }
        );

        res.json({ 
            success: true, 
            messages: messages.reverse(),
            hasMore: messages.length === limit
        });

    } catch (error) {
        console.log('Error in getChatMessages:', error);
        res.json({ success: false, message: error.message });
    }
}

// Save chat session
export const saveChatSession = async (req, res) => {
    try {
        const { sessionId } = req.body;
        
        const session = await ChatSession.findByIdAndUpdate(sessionId, {
            status: 'saved'
        }, { new: true });

        res.json({ 
            success: true, 
            message: 'Chat saved successfully',
            session 
        });

    } catch (error) {
        console.log('Error in saveChatSession:', error);
        res.json({ success: false, message: error.message });
    }
}

// Get saved chats
export const getSavedChats = async (req, res) => {
    try {
        const userId = req.userId;

        const savedChats = await ChatSession.find({
            $or: [{ user1: userId }, { user2: userId }],
            status: 'saved'
        })
        .populate('user1', 'username full_name profile_picture')
        .populate('user2', 'username full_name profile_picture')
        .sort({ updatedAt: -1 });

        res.json({ success: true, savedChats });

    } catch (error) {
        console.log('Error in getSavedChats:', error);
        res.json({ success: false, message: error.message });
    }
}

// Cleanup inactive users every minute
setInterval(async () => {
    try {
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        
        for (const [userId, data] of waitingUsers.entries()) {
            if (data.lastActive < fiveMinutesAgo) {
                waitingUsers.delete(userId);
                console.log('🧹 Cleaned up inactive user:', userId);
            }
        }

        await OnlineUser.deleteMany({
            last_active: { $lt: new Date(fiveMinutesAgo) }
        });

    } catch (error) {
        console.log('Error in cleanup:', error);
    }
}, 60000);