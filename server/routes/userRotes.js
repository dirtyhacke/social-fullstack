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
    canMessageUser,
    getUsersByIds,
    getUserSettings,
    sendFollowRequest,
    cancelFollowRequest,
    getFollowRequests,
    acceptFollowRequest,
    rejectFollowRequest
} from '../controllers/userController.js';
import { protect } from '../middlewares/auth.js';
import { upload } from '../configs/multer.js';

const userRouter = express.Router();

// User data routes
userRouter.get('/data', protect, getUserData)
userRouter.post('/update', upload.fields([{name: 'profile', maxCount: 1}, {name: 'cover', maxCount: 1}]), protect, updateUserData)

// Settings routes
userRouter.get('/settings', protect, getUserSettings)
userRouter.put('/settings', protect, updateUserSettings)

// User discovery and connections
userRouter.post('/discover', protect, discoverUsers)
userRouter.post('/follow', protect, followUser)
userRouter.post('/unfollow', protect, unfollowUser)
userRouter.post('/connect', protect, sendConnectionRequest)
userRouter.post('/accept', protect, acceptConnectionRequest)
userRouter.get('/connections', protect, getUserConnections)

// Follow Request System
userRouter.post('/follow-request', protect, sendFollowRequest)
userRouter.post('/cancel-follow-request', protect, cancelFollowRequest)
userRouter.get('/follow-requests', protect, getFollowRequests)
userRouter.post('/accept-follow-request', protect, acceptFollowRequest)
userRouter.post('/reject-follow-request', protect, rejectFollowRequest)

// User profiles and messaging
userRouter.post('/profiles', protect, getUserProfiles)
userRouter.post('/can-message', protect, canMessageUser)
userRouter.post('/get-users-by-ids', protect, getUsersByIds)

export default userRouter