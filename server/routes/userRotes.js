import express from 'express';
import { 
    acceptConnectionRequest, 
    discoverUsers, 
    followUser, 
    getUserConnections, 
    getUserData, 
    getUserProfiles, 
    sendConnectionRequest, 
    unfollowUser, 
    updateUserData,
    updateUserSettings,
    canMessageUser
} from '../controllers/userController.js';
import { protect } from '../middlewares/auth.js';
import { upload } from '../configs/multer.js';

const userRouter = express.Router();

userRouter.get('/data', protect, getUserData)
userRouter.post('/update', upload.fields([{name: 'profile', maxCount: 1}, {name: 'cover', maxCount: 1}]), protect, updateUserData)
userRouter.put('/settings', protect, updateUserSettings) // ✅ ADDED: Settings route
userRouter.post('/discover', protect, discoverUsers)
userRouter.post('/follow', protect, followUser)
userRouter.post('/unfollow', protect, unfollowUser)
userRouter.post('/connect', protect, sendConnectionRequest)
userRouter.post('/accept', protect, acceptConnectionRequest)
userRouter.get('/connections', protect, getUserConnections)
userRouter.post('/profiles', protect, getUserProfiles) // ✅ ADDED: protect middleware
userRouter.post('/can-message', protect, canMessageUser) // ✅ ADDED: Check message permissions

export default userRouter