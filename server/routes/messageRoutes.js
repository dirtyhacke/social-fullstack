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
    deleteMessage
} from '../controllers/messageController.js';
import { protect } from '../middlewares/auth.js';
import { imageUpload, audioUpload } from '../configs/multer.js';

const messageRouter = express.Router();

console.log('✅ Message router loaded');

// SSE endpoint with logging
messageRouter.get('/sse/:userId', (req, res, next) => {
    console.log('🚀 /api/messages/sse route hit for user:', req.params.userId);
    console.log('📋 Full URL:', req.originalUrl);
    sseController(req, res, next);
});

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

// Clear entire chat with a user
messageRouter.delete('/clear-chat/:userId', protect, clearChat);

// Delete single message
messageRouter.delete('/delete/:messageId', protect, deleteMessage);

export default messageRouter;