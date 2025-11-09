import express from 'express';
import { 
    getChatMessages, 
    sendMessage, 
    sseController,
    getUserRecentMessages,
    getUserLastSeen,
    getUsersLastSeen
} from '../controllers/messageController.js';
import { upload } from '../configs/multer.js';
import { protect } from '../middlewares/auth.js';

const messageRouter = express.Router();

console.log('✅ Message router loaded');

// SSE endpoint with logging
messageRouter.get('/sse/:userId', (req, res, next) => {
    console.log('🚀 /api/messages/sse route hit for user:', req.params.userId);
    console.log('📋 Full URL:', req.originalUrl);
    sseController(req, res, next);
});

// Send message
messageRouter.post('/send', upload.single('image'), protect, sendMessage);

// Get chat messages with specific user
messageRouter.post('/get', protect, getChatMessages);

// Recent messages endpoint
messageRouter.get('/recent', protect, getUserRecentMessages);

// Last seen endpoints
messageRouter.get('/last-seen/:userId', protect, getUserLastSeen);
messageRouter.post('/last-seen/batch', protect, getUsersLastSeen);

export default messageRouter;