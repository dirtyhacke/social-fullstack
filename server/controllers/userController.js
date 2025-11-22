import imagekit from "../configs/imageKit.js"
import { inngest } from "../inngest/index.js"
import Connection from "../models/Connection.js"
import Post from "../models/Post.js"
import User from "../models/User.js"
import { clerkClient } from "@clerk/express";

// Get User Data using userId
export const getUserData = async (req, res) => {
    try {
        const { userId } = req.auth()
        const user = await User.findById(userId)
        if(!user){
            return res.json({success: false, message: "User not found"})
        }
        res.json({success: true, user})
    } catch (error) {
        console.log(error);
        res.json({success: false, message: error.message})
    }
}

// Update User Data
export const updateUserData = async (req, res) => {
    try {
        const { userId } = req.auth()
        let {username, bio, location, full_name } = req.body;

        const tempUser = await User.findById(userId)

        !username && (username = tempUser.username)

        if(tempUser.username !== username){
            const user = await User.findOne({username})
            if(user){
                // we will not change the username if it is already taken
                username = tempUser.username
            }
        }

        const updatedData = {
            username,
            bio,
            location,
            full_name
        }

        // ✅ FIX: Use memory storage properly (no file paths)
        const profile = req.files?.profile?.[0]
        const cover = req.files?.cover?.[0]

        console.log('📁 Profile file:', profile ? `Exists (${profile.mimetype}, ${profile.size} bytes)` : 'Not provided');
        console.log('📁 Cover file:', cover ? `Exists (${cover.mimetype}, ${cover.size} bytes)` : 'Not provided');

        if(profile){
            // ✅ FIX: Use buffer instead of file path for memory storage
            if (!profile.buffer) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid profile picture upload - no file data'
                });
            }
            
            // Convert buffer to base64 for ImageKit
            const fileBase64 = profile.buffer.toString('base64');
            
            const response = await imagekit.upload({
                file: fileBase64, // Use base64 string
                fileName: profile.originalname,
            })

            const url = imagekit.url({
                path: response.filePath,
                transformation: [
                    {quality: 'auto'},
                    { format: 'webp' },
                    { width: '512' }
                ]
            })
            updatedData.profile_picture = url;

            // Update Clerk profile picture
            try {
                const blob = await fetch(url).then(res => res.blob());
                await clerkClient.users.updateUserProfileImage(userId, { file: blob });
                console.log('✅ Clerk profile picture updated');
            } catch (clerkError) {
                console.log('⚠️ Could not update Clerk profile picture:', clerkError.message);
            }
        }

        if(cover){
            // ✅ FIX: Use buffer instead of file path for memory storage
            if (!cover.buffer) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid cover photo upload - no file data'
                });
            }
            
            // Convert buffer to base64 for ImageKit
            const fileBase64 = cover.buffer.toString('base64');
            
            const response = await imagekit.upload({
                file: fileBase64, // Use base64 string
                fileName: cover.originalname,
            })

            const url = imagekit.url({
                path: response.filePath,
                transformation: [
                    {quality: 'auto'},
                    { format: 'webp' },
                    { width: '1280' }
                ]
            })
            updatedData.cover_photo = url;
            console.log('✅ Cover photo uploaded');
        }

        const user = await User.findByIdAndUpdate(userId, updatedData, {new : true})

        res.json({success: true, user, message: 'Profile updated successfully'})

    } catch (error) {
        console.log(error);
        res.status(500).json({success: false, message: error.message})
    }
}

// Update User Settings
export const updateUserSettings = async (req, res) => {
    try {
        const { userId } = req.auth()
        const { profilePrivacy, messageSetting, allowedMessagingUsers } = req.body;

        const updatedData = {
            settings: {
                profilePrivacy,
                messageSetting,
                allowedMessagingUsers: allowedMessagingUsers || []
            }
        }

        const user = await User.findByIdAndUpdate(
            userId, 
            updatedData, 
            { new: true }
        )

        res.json({
            success: true, 
            user, 
            message: 'Settings updated successfully'
        })

    } catch (error) {
        console.log(error);
        res.status(500).json({success: false, message: error.message})
    }
}

// Find Users using username, email, location, name
export const discoverUsers = async (req, res) => {
    try {
        const { userId } = req.auth()
        const { input } = req.body;

        const allUsers = await User.find(
            {
                $or: [
                    {username: new RegExp(input, 'i')},
                    {email: new RegExp(input, 'i')},
                    {full_name: new RegExp(input, 'i')},
                    {location: new RegExp(input, 'i')},
                ]
            }
        )
        const filteredUsers = allUsers.filter(user=> user._id !== userId);

        res.json({success: true, users: filteredUsers})
        
    } catch (error) {
        console.log(error);
        res.json({success: false, message: error.message})
    }
}

// Follow User
export const followUser = async (req, res) => {
    try {
        const { userId } = req.auth()
        const { id } = req.body;

        const user = await User.findById(userId)

        if(user.following.includes(id)){
            return res.json({ success: false, message: 'You are already following this user'})
        }

        user.following.push(id);
        await user.save()

        const toUser = await User.findById(id)
        toUser.followers.push(userId)
        await toUser.save()

        res.json({success: true, message: 'Now you are following this user'})
        
    } catch (error) {
        console.log(error);
        res.json({success: false, message: error.message})
    }
}

// Unfollow User
export const unfollowUser = async (req, res) => {
    try {
        const { userId } = req.auth()
        const { id } = req.body;

        const user = await User.findById(userId)
        user.following = user.following.filter(user=> user !== id);
        await user.save()

        const toUser = await User.findById(id)
        toUser.followers = toUser.followers.filter(user=> user !== userId);
        await toUser.save()
        
        res.json({success: true, message: 'You are no longer following this user'})
        
    } catch (error) {
        console.log(error);
        res.json({success: false, message: error.message})
    }
}

// Send Connection Request
export const sendConnectionRequest = async (req, res) => {
    try {
        const {userId} = req.auth()
        const { id } = req.body;

        // Check if user has sent more than 20 connection requests in the last 24 hours
        const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000)
        const connectionRequests = await Connection.find({from_user_id: userId, created_at: { $gt: last24Hours }})
        if(connectionRequests.length >= 20){
            return res.json({success: false, message: 'You have sent more than 20 connection requests in the last 24 hours'})
        }

        // Check if users are already conected
        const connection = await Connection.findOne({
            $or: [
                {from_user_id: userId, to_user_id: id},
                {from_user_id: id, to_user_id: userId},
            ]
        })

        if(!connection){
           const newConnection = await Connection.create({
                from_user_id: userId,
                to_user_id: id
            })

            // ✅ Handle Inngest errors gracefully
            try {
                await inngest.send({
                    name: 'app/connection-request',
                    data: {connectionId: newConnection._id}
                })
            } catch (inngestError) {
                console.log('⚠️ Inngest error (connection still created):', inngestError.message);
            }

            return res.json({success: true, message: 'Connection request sent successfully'})
        }else if(connection && connection.status === 'accepted'){
            return res.json({success: false, message: 'You are already connected with this user'})
        }

        return res.json({success: false, message: 'Connection request pending'})

    } catch (error) {
        console.log(error);
        res.json({success: false, message: error.message})
    }
}

// Get User Connections
export const getUserConnections = async (req, res) => {
    try {
        const {userId} = req.auth()
        const user = await User.findById(userId).populate('connections followers following')

        const connections = user.connections
        const followers = user.followers
        const following = user.following

        const pendingConnections = (await Connection.find({to_user_id: userId, status: 'pending'}).populate('from_user_id')).map(connection=>connection.from_user_id)

        res.json({success: true, connections, followers, following, pendingConnections})

    } catch (error) {
        console.log(error);
        res.json({success: false, message: error.message})
    }
}

// Accept Connection Request
export const acceptConnectionRequest = async (req, res) => {
    try {
        const {userId} = req.auth()
        const { id } = req.body;

        const connection = await Connection.findOne({from_user_id: id, to_user_id: userId})

        if(!connection){
            return res.json({ success: false, message: 'Connection not found' });
        }

        const user = await User.findById(userId);
        user.connections.push(id);
        await user.save()

        const toUser = await User.findById(id);
        toUser.connections.push(userId);
        await toUser.save()

        connection.status = 'accepted';
        await connection.save()

        res.json({ success: true, message: 'Connection accepted successfully' });

    } catch (error) {
        console.log(error);
        res.json({success: false, message: error.message})
    }
}

// Get User Profiles with Privacy Check
export const getUserProfiles = async (req, res) =>{
    try {
        const { profileId } = req.body;
        const { userId } = req.auth()
        
        const profile = await User.findById(profileId)
        if(!profile){
            return res.json({ success: false, message: "Profile not found" });
        }

        // Check if profile is private and user is not follower
        if (profile.settings?.profilePrivacy === 'private') {
            const isFollower = profile.followers.includes(userId);
            const isOwner = userId === profileId;
            
            if (!isFollower && !isOwner) {
                // Return limited profile info for private accounts
                return res.json({
                    success: true,
                    profile: {
                        _id: profile._id,
                        full_name: profile.full_name,
                        username: profile.username,
                        settings: profile.settings,
                        // Don't return sensitive info
                        profile_picture: '',
                        cover_photo: '',
                        bio: 'This account is private',
                        followers: [],
                        following: [],
                        connections: []
                    },
                    posts: [] // No posts for non-followers
                })
            }
        }

        const posts = await Post.find({user: profileId}).populate('user')

        res.json({success: true, profile, posts})
    } catch (error) {
        console.log(error);
        res.json({success: false, message: error.message})
    }
}

// Check if user can message another user
export const canMessageUser = async (req, res) => {
    try {
        const { userId } = req.auth()
        const { targetUserId } = req.body;

        const targetUser = await User.findById(targetUserId)
        if (!targetUser) {
            return res.json({ success: false, message: "User not found" })
        }

        const canMessage = checkMessagePermission(targetUser, userId)
        
        res.json({ 
            success: true, 
            canMessage: canMessage.allowed,
            reason: canMessage.reason
        })

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message })
    }
}

// Helper function to check message permissions
export const checkMessagePermission = (targetUser, currentUserId) => {
    const settings = targetUser.settings || {}
    
    // User can always message themselves
    if (targetUser._id === currentUserId) {
        return { allowed: true, reason: 'Can message yourself' }
    }
    
    switch (settings.messageSetting) {
        case 'anyone':
            return { allowed: true, reason: 'User accepts messages from anyone' }
            
        case 'private':
            // Check if current user is followed by target user
            const isFollowed = targetUser.following.includes(currentUserId)
            if (isFollowed) {
                return { allowed: true, reason: 'User follows you' }
            } else {
                return { 
                    allowed: false, 
                    reason: 'User only accepts messages from people they follow' 
                }
            }
            
        case 'custom':
            // Check if current user is in allowed list
            const isAllowed = settings.allowedMessagingUsers?.includes(currentUserId)
            if (isAllowed) {
                return { allowed: true, reason: 'You are in user\'s allowed messaging list' }
            } else {
                return { 
                    allowed: false, 
                    reason: 'User has restricted messaging to specific users only' 
                }
            }
            
        default:
            return { allowed: true, reason: 'Default setting - anyone can message' }
    }
}