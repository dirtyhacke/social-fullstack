// routes/groupRoutes.js
import express from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import {
    createGroup,
    getUserGroups,
    getGroupDetails,
    addGroupMembers,
    removeGroupMember,
    sendGroupMessage,
    getGroupMessages,
    handleGroupTyping,          // 🆕 Add new real-time functions
    getGroupOnlineMembers       // 🆕 Add new real-time functions
} from '../controllers/groupController.js';
import upload from '../configs/multer.js'; // 🆕 Add multer for file uploads

const router = express.Router();

// Group management routes
router.post('/create', authMiddleware, createGroup);
router.get('/my-groups', authMiddleware, getUserGroups);
router.get('/:groupId', authMiddleware, getGroupDetails);
router.post('/:groupId/members', authMiddleware, addGroupMembers);
router.delete('/:groupId/members/:memberId', authMiddleware, removeGroupMember);

// 🆕 Group real-time routes
router.get('/:groupId/online-members', authMiddleware, getGroupOnlineMembers);
router.post('/typing', authMiddleware, handleGroupTyping); // Group typing indicator

// Group messaging routes
router.post('/message/send', authMiddleware, upload.single('image'), sendGroupMessage); // 🆕 Add upload middleware
router.post('/message/get', authMiddleware, getGroupMessages);

export default router;