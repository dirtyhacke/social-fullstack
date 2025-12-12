// routes/messageRoutes.js
import express from 'express';
import { 
    getChatMessages, 
    sendMessage, 
    sseController,
    getUserRecentMessages,
    getUserLastSeen,
    getUsersLastSeen,
    sendVoiceMessage,
    handleTyping,
    markMessageAsSeen,
    clearChat, 
    deleteMessage,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    // NEW: Socket.io status endpoints
    getOnlineUsers,
    getSocketStatus
} from '../controllers/messageController.js';
import { protect } from '../middlewares/auth.js';
import { imageUpload, audioUpload } from '../configs/multer.js';

const messageRouter = express.Router();

console.log('✅ Message router loaded with hybrid endpoints (HTTP + WebSocket)');

// ==================== SSE (Legacy - Keep for backward compatibility) ====================
messageRouter.get('/sse/:userId', (req, res, next) => {
    console.log('🚀 SSE route hit for user:', req.params.userId);
    console.log('📋 Note: Consider migrating to WebSocket for better performance');
    sseController(req, res, next);
});

// ==================== HTTP ENDPOINTS (Keep your existing flow) ====================

// Send text/image message
messageRouter.post('/send', protect, imageUpload, sendMessage);

// Send voice message
messageRouter.post('/send-voice', protect, audioUpload, sendVoiceMessage);

// Get chat messages with specific user
messageRouter.post('/get', protect, getChatMessages);

// Recent messages endpoint
messageRouter.get('/recent', protect, getUserRecentMessages);

// Last seen endpoints
messageRouter.get('/last-seen/:userId', protect, getUserLastSeen);
messageRouter.post('/last-seen/batch', protect, getUsersLastSeen);

// Typing indicator endpoint
messageRouter.post('/typing', protect, handleTyping);

// Mark message as seen endpoint
messageRouter.post('/mark-seen', protect, markMessageAsSeen);

// Clear chat
messageRouter.delete('/clear-chat/:userId', protect, clearChat);

// Delete single message
messageRouter.delete('/delete/:messageId', protect, deleteMessage);

// ==================== CALL ENDPOINTS (HTTP Signaling) ====================
messageRouter.post('/call/initiate', protect, initiateCall);
messageRouter.post('/call/accept', protect, acceptCall);
messageRouter.post('/call/reject', protect, rejectCall);
messageRouter.post('/call/end', protect, endCall);

// ==================== WEBSOCKET STATUS ENDPOINTS ====================
// Get all online users
messageRouter.get('/online-users', protect, getOnlineUsers);

// Get WebSocket connection status
messageRouter.get('/ws-status', protect, getSocketStatus);

// Get user's WebSocket connection info
messageRouter.get('/ws-info/:userId', protect, async (req, res) => {
    const { onlineUsers } = await import('../controllers/messageController.js');
    const isOnline = onlineUsers.has(req.params.userId);
    
    res.json({
        success: true,
        userId: req.params.userId,
        isOnline: isOnline,
        socketId: isOnline ? onlineUsers.get(req.params.userId) : null,
        timestamp: new Date().toISOString()
    });
});

export default messageRouter;