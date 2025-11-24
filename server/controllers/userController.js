import imagekit from "../configs/imageKit.js"
import { inngest } from "../inngest/index.js"
import Connection from "../models/Connection.js"
import FollowRequest from "../models/FollowRequest.js"
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

// Update User Settings - IMPROVED VERSION
export const updateUserSettings = async (req, res) => {
    try {
        const { userId } = req.auth()
        const { profilePrivacy, messageSetting, allowedMessagingUsers } = req.body;

        console.log('⚙️ Updating user settings:', { profilePrivacy, messageSetting, allowedMessagingUsers });

        // Validate input
        if (!profilePrivacy || !messageSetting) {
            return res.status(400).json({
                success: false,
                message: 'Profile privacy and message setting are required'
            });
        }

        const updatedData = {
            settings: {
                profilePrivacy: profilePrivacy,
                messageSetting: messageSetting,
                allowedMessagingUsers: Array.isArray(allowedMessagingUsers) ? allowedMessagingUsers : []
            }
        }

        console.log('📝 Settings update data:', updatedData);

        const user = await User.findByIdAndUpdate(
            userId, 
            { $set: updatedData }, 
            { new: true, runValidators: true }
        )

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        console.log('✅ Settings updated successfully for user:', userId);
        console.log('🔍 New settings:', user.settings);

        res.json({
            success: true, 
            user: {
                _id: user._id,
                username: user.username,
                full_name: user.full_name,
                profile_picture: user.profile_picture,
                settings: user.settings
            }, 
            message: 'Settings updated successfully'
        })

    } catch (error) {
        console.log('💥 Error in updateUserSettings:', error);
        res.status(500).json({
            success: false, 
            message: error.message
        })
    }
}

// Get users by IDs for settings
export const getUsersByIds = async (req, res) => {
    try {
        const { userIds } = req.body;
        
        if (!userIds || !Array.isArray(userIds)) {
            return res.json({ 
                success: false, 
                message: "User IDs array is required" 
            });
        }

        console.log('🔍 Fetching users by IDs:', userIds);

        const users = await User.find({ 
            _id: { $in: userIds } 
        }).select('_id username full_name profile_picture');

        res.json({ 
            success: true, 
            users: users || [] 
        });
    } catch (error) {
        console.log('💥 Error in getUsersByIds:', error);
        res.json({ 
            success: false, 
            message: error.message 
        });
    }
}

// Find Users using username, email, location, name - UPDATED VERSION
export const discoverUsers = async (req, res) => {
    try {
        const { userId } = req.auth()
        const { input } = req.body;

        console.log('🔍 Discover users request:', { userId, input });

        let allUsers = [];

        if (!input || input.trim().length === 0) {
            // If no input, return all users (excluding current user)
            console.log('🔍 No search input - returning all users');
            allUsers = await User.find({ 
                _id: { $ne: userId } // Exclude current user
            }).select('_id username full_name profile_picture email location bio');
        } else if (input.trim().length < 2) {
            return res.json({ 
                success: false, 
                message: "Search input must be at least 2 characters long" 
            });
        } else {
            // Search with input
            console.log('🔍 Searching users with input:', input);
            allUsers = await User.find({
                $or: [
                    { username: new RegExp(input, 'i') },
                    { email: new RegExp(input, 'i') },
                    { full_name: new RegExp(input, 'i') },
                    { location: new RegExp(input, 'i') },
                    { bio: new RegExp(input, 'i') }
                ]
            }).select('_id username full_name profile_picture email location bio');
        }

        // Filter out current user (double check)
        const filteredUsers = allUsers.filter(user => user._id.toString() !== userId.toString());

        console.log('✅ Users found:', filteredUsers.length);
        console.log('👥 Sample users:', filteredUsers.slice(0, 3));

        res.json({
            success: true, 
            users: filteredUsers,
            message: `Found ${filteredUsers.length} users`
        })
        
    } catch (error) {
        console.log('💥 Error in discoverUsers:', error);
        res.status(500).json({
            success: false, 
            message: error.message
        })
    }
}

// Follow User (for public accounts)
export const followUser = async (req, res) => {
    try {
        const { userId } = req.auth()
        const { id } = req.body;

        if (userId === id) {
            return res.json({ 
                success: false, 
                message: 'You cannot follow yourself' 
            });
        }

        const user = await User.findById(userId)
        const targetUser = await User.findById(id)

        if (!user || !targetUser) {
            return res.json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        // Check if target account is private
        if (targetUser.settings?.profilePrivacy === 'private') {
            return res.status(400).json({
                success: false,
                message: 'This user has a private account. Please send a follow request instead.'
            });
        }

        if(user.following.includes(id)){
            return res.json({ 
                success: false, 
                message: 'You are already following this user'
            })
        }

        user.following.push(id);
        await user.save()

        targetUser.followers.push(userId)
        await targetUser.save()

        res.json({
            success: true, 
            message: 'Now you are following this user'
        })
        
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
        user.following = user.following.filter(userId => userId.toString() !== id);
        await user.save()

        const toUser = await User.findById(id)
        toUser.followers = toUser.followers.filter(followerId => followerId.toString() !== userId);
        await toUser.save()
        
        res.json({
            success: true, 
            message: 'You are no longer following this user'
        })
        
    } catch (error) {
        console.log(error);
        res.json({success: false, message: error.message})
    }
}

// Send follow request to private account
export const sendFollowRequest = async (req, res) => {
    try {
        const { userId } = req.auth()
        const { targetUserId } = req.body;

        if (!targetUserId) {
            return res.status(400).json({
                success: false,
                message: "Target user ID is required"
            });
        }

        if (userId === targetUserId) {
            return res.status(400).json({
                success: false,
                message: "You cannot send follow request to yourself"
            });
        }

        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Check if target account is private
        if (targetUser.settings?.profilePrivacy !== 'private') {
            return res.status(400).json({
                success: false,
                message: "This user has a public account. You can follow directly."
            });
        }

        // Check if already following
        const currentUser = await User.findById(userId);
        if (currentUser.following.includes(targetUserId)) {
            return res.status(400).json({
                success: false,
                message: "You are already following this user"
            });
        }

        // Check if follow request already exists
        const existingRequest = await FollowRequest.findOne({
            fromUserId: userId,
            toUserId: targetUserId,
            status: 'pending'
        });

        if (existingRequest) {
            return res.status(400).json({
                success: false,
                message: "Follow request already sent"
            });
        }

        // Create follow request
        const followRequest = await FollowRequest.create({
            fromUserId: userId,
            toUserId: targetUserId,
            status: 'pending'
        });

        console.log(`✅ Follow request sent from ${userId} to ${targetUserId}`);

        res.json({
            success: true,
            message: "Follow request sent successfully",
            requestId: followRequest._id
        });

    } catch (error) {
        console.log('💥 Error in sendFollowRequest:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

// Cancel follow request
export const cancelFollowRequest = async (req, res) => {
    try {
        const { userId } = req.auth()
        const { targetUserId } = req.body;

        if (!targetUserId) {
            return res.status(400).json({
                success: false,
                message: "Target user ID is required"
            });
        }

        const followRequest = await FollowRequest.findOneAndDelete({
            fromUserId: userId,
            toUserId: targetUserId,
            status: 'pending'
        });

        if (!followRequest) {
            return res.status(404).json({
                success: false,
                message: "No pending follow request found"
            });
        }

        console.log(`✅ Follow request cancelled from ${userId} to ${targetUserId}`);

        res.json({
            success: true,
            message: "Follow request cancelled successfully"
        });

    } catch (error) {
        console.log('💥 Error in cancelFollowRequest:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

// Get pending follow requests for profile owner
export const getFollowRequests = async (req, res) => {
    try {
        const { userId } = req.auth()

        const followRequests = await FollowRequest.find({
            toUserId: userId,
            status: 'pending'
        }).populate('fromUserId', '_id username full_name profile_picture');

        res.json({
            success: true,
            requests: followRequests
        });

    } catch (error) {
        console.log('💥 Error in getFollowRequests:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

// Accept follow request
export const acceptFollowRequest = async (req, res) => {
    try {
        const { userId } = req.auth()
        const { requestId } = req.body;

        if (!requestId) {
            return res.status(400).json({
                success: false,
                message: "Request ID is required"
            });
        }

        const followRequest = await FollowRequest.findOne({
            _id: requestId,
            toUserId: userId,
            status: 'pending'
        });

        if (!followRequest) {
            return res.status(404).json({
                success: false,
                message: "Follow request not found"
            });
        }

        // Update both users' follower/following lists
        const fromUser = await User.findById(followRequest.fromUserId);
        const toUser = await User.findById(userId);

        if (!fromUser.following.includes(userId)) {
            fromUser.following.push(userId);
            await fromUser.save();
        }

        if (!toUser.followers.includes(followRequest.fromUserId)) {
            toUser.followers.push(followRequest.fromUserId);
            await toUser.save();
        }

        // Update follow request status
        followRequest.status = 'accepted';
        await followRequest.save();

        console.log(`✅ Follow request accepted from ${followRequest.fromUserId} to ${userId}`);

        res.json({
            success: true,
            message: "Follow request accepted successfully"
        });

    } catch (error) {
        console.log('💥 Error in acceptFollowRequest:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

// Reject follow request
export const rejectFollowRequest = async (req, res) => {
    try {
        const { userId } = req.auth()
        const { requestId } = req.body;

        if (!requestId) {
            return res.status(400).json({
                success: false,
                message: "Request ID is required"
            });
        }

        const followRequest = await FollowRequest.findOneAndUpdate(
            {
                _id: requestId,
                toUserId: userId,
                status: 'pending'
            },
            {
                status: 'rejected'
            },
            { new: true }
        );

        if (!followRequest) {
            return res.status(404).json({
                success: false,
                message: "Follow request not found"
            });
        }

        console.log(`❌ Follow request rejected from ${followRequest.fromUserId} to ${userId}`);

        res.json({
            success: true,
            message: "Follow request rejected successfully"
        });

    } catch (error) {
        console.log('💥 Error in rejectFollowRequest:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

// Send Connection Request
export const sendConnectionRequest = async (req, res) => {
    try {
        const {userId} = req.auth()
        const { id } = req.body;

        if (userId === id) {
            return res.json({ 
                success: false, 
                message: 'You cannot send connection request to yourself' 
            });
        }

        // Check if user has sent more than 20 connection requests in the last 24 hours
        const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000)
        const connectionRequests = await Connection.find({
            from_user_id: userId, 
            created_at: { $gt: last24Hours }
        })
        
        if(connectionRequests.length >= 20){
            return res.json({
                success: false, 
                message: 'You have sent more than 20 connection requests in the last 24 hours'
            })
        }

        // Check if users are already connected
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

            return res.json({
                success: true, 
                message: 'Connection request sent successfully'
            })
        } else if(connection && connection.status === 'accepted'){
            return res.json({
                success: false, 
                message: 'You are already connected with this user'
            })
        }

        return res.json({
            success: false, 
            message: 'Connection request pending'
        })

    } catch (error) {
        console.log(error);
        res.json({success: false, message: error.message})
    }
}

// Get User Connections
export const getUserConnections = async (req, res) => {
    try {
        const {userId} = req.auth()
        const user = await User.findById(userId)
            .populate('connections', '_id username full_name profile_picture')
            .populate('followers', '_id username full_name profile_picture')
            .populate('following', '_id username full_name profile_picture')

        const connections = user.connections || []
        const followers = user.followers || []
        const following = user.following || []

        const pendingConnections = await Connection.find({
            to_user_id: userId, 
            status: 'pending'
        }).populate('from_user_id', '_id username full_name profile_picture')

        res.json({
            success: true, 
            connections, 
            followers, 
            following, 
            pendingConnections: pendingConnections.map(conn => conn.from_user_id)
        })

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

        const connection = await Connection.findOne({
            from_user_id: id, 
            to_user_id: userId,
            status: 'pending'
        })

        if(!connection){
            return res.json({ 
                success: false, 
                message: 'Connection request not found' 
            });
        }

        const user = await User.findById(userId);
        const toUser = await User.findById(id);
        
        if (!user.connections.includes(id)) {
            user.connections.push(id);
            await user.save()
        }

        if (!toUser.connections.includes(userId)) {
            toUser.connections.push(userId);
            await toUser.save()
        }

        connection.status = 'accepted';
        await connection.save()

        res.json({ 
            success: true, 
            message: 'Connection accepted successfully' 
        });

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
            return res.json({ 
                success: false, 
                message: "Profile not found" 
            });
        }

        // Check if profile is private and user is not follower
        if (profile.settings?.profilePrivacy === 'private') {
            const isFollower = profile.followers.includes(userId);
            const isOwner = userId === profileId;
            const isConnection = profile.connections.includes(userId);
            
            if (!isFollower && !isOwner && !isConnection) {
                // Return limited profile info for private accounts
                return res.json({
                    success: true,
                    profile: {
                        _id: profile._id,
                        full_name: profile.full_name,
                        username: profile.username,
                        settings: profile.settings,
                        profile_picture: profile.profile_picture,
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

        const posts = await Post.find({user: profileId})
            .populate('user', '_id username full_name profile_picture')
            .sort({ createdAt: -1 })

        res.json({
            success: true, 
            profile, 
            posts: posts || []
        })
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
            return res.json({ 
                success: false, 
                message: "User not found" 
            })
        }

        const canMessage = checkMessagePermission(targetUser, userId)
        
        res.json({ 
            success: true, 
            canMessage: canMessage.allowed,
            reason: canMessage.reason
        })

    } catch (error) {
        console.log(error);
        res.json({ 
            success: false, 
            message: error.message 
        })
    }
}

// Helper function to check message permissions
export const checkMessagePermission = (targetUser, currentUserId) => {
    const settings = targetUser.settings || {}
    
    // User can always message themselves
    if (targetUser._id.toString() === currentUserId.toString()) {
        return { 
            allowed: true, 
            reason: 'Can message yourself' 
        }
    }
    
    switch (settings.messageSetting) {
        case 'anyone':
            return { 
                allowed: true, 
                reason: 'User accepts messages from anyone' 
            }
            
        case 'private':
            // Check if current user is followed by target user
            const isFollowed = targetUser.following.includes(currentUserId)
            if (isFollowed) {
                return { 
                    allowed: true, 
                    reason: 'User follows you' 
                }
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
                return { 
                    allowed: true, 
                    reason: 'You are in user\'s allowed messaging list' 
                }
            } else {
                return { 
                    allowed: false, 
                    reason: 'User has restricted messaging to specific users only' 
                }
            }
            
        default:
            return { 
                allowed: true, 
                reason: 'Default setting - anyone can message' 
            }
    }
}

// Get user settings specifically
export const getUserSettings = async (req, res) => {
    try {
        const { userId } = req.auth()
        
        const user = await User.findById(userId).select('settings')
        
        if (!user) {
            return res.json({ 
                success: false, 
                message: "User not found" 
            })
        }

        res.json({
            success: true,
            settings: user.settings || {
                profilePrivacy: 'public',
                messageSetting: 'anyone',
                allowedMessagingUsers: []
            }
        })

    } catch (error) {
        console.log('💥 Error in getUserSettings:', error);
        res.json({ 
            success: false, 
            message: error.message 
        })
    }
}