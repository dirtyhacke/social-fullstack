import express from 'express';
import { 
    joinRandomChat, 
    skipMatch, 
    endChat, 
    getChatMessages,
    sendRandomChatMessage,
    saveChatSession,
    getSavedChats,
    getOnlineUsers
} from '../controllers/randomChatController.js';
import { protect } from '../middlewares/auth.js';
import { upload } from '../configs/multer.js';

const randomChatRouter = express.Router();

randomChatRouter.post('/join', protect, joinRandomChat);
randomChatRouter.post('/skip', protect, skipMatch);
randomChatRouter.post('/end', protect, endChat);
randomChatRouter.post('/save', protect, saveChatSession);
randomChatRouter.get('/saved', protect, getSavedChats);
randomChatRouter.get('/online', protect, getOnlineUsers);
randomChatRouter.get('/messages', protect, getChatMessages);
randomChatRouter.post('/send-message', upload.single('image'), protect, sendRandomChatMessage);

export default randomChatRouter;