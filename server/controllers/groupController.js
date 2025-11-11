// controllers/groupController.js
import Group from '../models/Group.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { sendSSEMessage, connections, onlineUsers } from './messageController.js';
import imagekit from "../configs/imageKit.js";
import fs from "fs";

// 🆕 Track group typing status
const groupTypingUsers = new Map();

// 🆕 Helper function to check if user is online with better logging
const isUserOnline = (userId) => {
    const isOnline = onlineUsers.has(userId.toString());
    console.log(`🔍 Checking if user ${userId} is online: ${isOnline}`);
    return isOnline;
};

// 🆕 Enhanced group message sending with detailed logging
export const sendGroupMessage = async (req, res) => {
    try {
        const userId = req.userId;
        const { group_id, text, reply_to } = req.body;
        const image = req.file;

        console.log('🎯 ========== SENDING GROUP MESSAGE ==========');
        console.log(`👤 From User: ${userId}`);
        console.log(`👥 To Group: ${group_id}`);
        console.log(`💬 Text: ${text}`);
        console.log(`📊 Current online users:`, Array.from(onlineUsers));
        console.log(`🔗 Active SSE connections:`, Array.from(connections.keys()));

        const group = await Group.findById(group_id);
        
        if (!group) {
            console.log('❌ Group not found');
            return res.json({ success: false, message: 'Group not found' });
        }

        // Check if user is a member
        if (!group.members.includes(userId)) {
            console.log('❌ User not a member of group');
            return res.json({ success: false, message: 'You are not a member of this group' });
        }

        let media_url = '';
        let message_type = image ? 'image' : 'text';

        // Handle image upload
        if (message_type === 'image' && image) {
            console.log('🖼️ Processing image upload...');
            try {
                const fileBuffer = fs.readFileSync(image.path);
                const response = await imagekit.upload({
                    file: fileBuffer,
                    fileName: image.originalname,
                });
                media_url = imagekit.url({
                    path: response.filePath,
                    transformation: [
                        {quality: 'auto'},
                        {format: 'webp'},
                        {width: '1280'}
                    ]
                });
                
                // Clean up temp file
                fs.unlinkSync(image.path);
                console.log('✅ Image uploaded successfully');
            } catch (uploadError) {
                console.log('❌ Image upload failed:', uploadError);
            }
        }

        const messageData = {
            from_user_id: userId,
            group_id: group_id,
            text: text,
            message_type: message_type,
            media_url: media_url
        };

        if (reply_to) {
            messageData.reply_to = reply_to;
        }

        console.log('💾 Saving message to database...');
        const message = await Message.create(messageData);

        // Update group last activity
        group.last_activity = new Date();
        await group.save();

        // Populate message for response
        const messageWithUserData = await Message.findById(message._id)
            .populate('from_user_id', 'full_name profile_picture email lastSeen')
            .populate('reply_to');

        console.log('✅ Message saved to database:', message._id);

        // 🆕 REAL-TIME: Send notification to all group members
        console.log('👥 Group members:', group.members.map(m => m.toString()));
        
        let notificationCount = 0;
        let failedNotifications = 0;

        // Send to all group members except sender
        for (const memberId of group.members) {
            const memberIdStr = memberId.toString();
            
            if (memberIdStr !== userId) {
                console.log(`📤 Attempting to send to member: ${memberIdStr}`);
                
                const notificationData = {
                    type: 'new_group_message',
                    message: messageWithUserData,
                    groupId: group_id,
                    groupName: group.name,
                    sound: 'receive',
                    notification: {
                        title: group.name,
                        body: message_type === 'text' ? (text || 'New message') : '📷 Image',
                        from: messageWithUserData.from_user_id?.full_name || 'Someone',
                        fromId: userId,
                        avatar: group.profile_picture || messageWithUserData.from_user_id?.profile_picture || '/default-avatar.png'
                    }
                };

                const messageSent = sendSSEMessage(memberIdStr, notificationData);
                
                if (messageSent) {
                    console.log(`✅ Notification sent to ${memberIdStr}`);
                    notificationCount++;
                    
                    // Mark as delivered
                    await Message.findByIdAndUpdate(message._id, {
                        $addToSet: { delivered_to: memberIdStr }
                    });
                } else {
                    console.log(`❌ Failed to send notification to ${memberIdStr}`);
                    failedNotifications++;
                }
            }
        }

        console.log(`📊 Notification Summary:`);
        console.log(`   ✅ Success: ${notificationCount}`);
        console.log(`   ❌ Failed: ${failedNotifications}`);
        console.log(`   👤 Total members: ${group.members.length - 1}`);

        res.json({ 
            success: true, 
            message: messageWithUserData,
            notificationStats: {
                sent: notificationCount,
                failed: failedNotifications,
                total: group.members.length - 1
            }
        });

    } catch (error) {
        console.error('❌ Error sending group message:', error);
        res.json({ success: false, message: error.message });
    }
};

// 🆕 Enhanced group messages retrieval
export const getGroupMessages = async (req, res) => {
    try {
        const userId = req.userId;
        const { group_id } = req.body;

        console.log(`📨 Fetching messages for group: ${group_id} by user: ${userId}`);

        const group = await Group.findById(group_id);
        
        if (!group) {
            return res.json({ success: false, message: 'Group not found' });
        }

        // Check if user is a member
        if (!group.members.includes(userId)) {
            return res.json({ success: false, message: 'You are not a member of this group' });
        }

        const messages = await Message.find({
            group_id: group_id
        })
        .populate('from_user_id', 'full_name profile_picture email lastSeen')
        .populate('reply_to')
        .sort({ createdAt: -1 })
        .limit(100);

        console.log(`📄 Found ${messages.length} messages for group ${group_id}`);

        // Mark messages as seen by current user
        const unseenMessages = messages.filter(msg => 
            msg.from_user_id._id.toString() !== userId && 
            !msg.seen_by.includes(userId)
        );

        if (unseenMessages.length > 0) {
            const unseenMessageIds = unseenMessages.map(msg => msg._id);
            
            await Message.updateMany(
                { _id: { $in: unseenMessageIds } },
                { $addToSet: { seen_by: userId } }
            );

            console.log(`👀 Marked ${unseenMessages.length} messages as seen by user ${userId}`);
        }

        res.json({ 
            success: true, 
            messages: messages.reverse(),
            groupInfo: {
                name: group.name,
                members: group.members.length,
                onlineMembers: group.members.filter(m => isUserOnline(m.toString())).length,
                isAdmin: group.admins.includes(userId)
            }
        });

    } catch (error) {
        console.error('❌ Error fetching group messages:', error);
        res.json({ success: false, message: error.message });
    }
};

// 🆕 Enhanced create group with real-time notifications
export const createGroup = async (req, res) => {
    try {
        const userId = req.userId;
        const { name, description, memberIds, is_public } = req.body;

        console.log('🆕 Creating group with data:', { name, description, memberIds, userId });

        if (!name || !name.trim()) {
            return res.json({ success: false, message: 'Group name is required' });
        }

        const uniqueMemberIds = [...new Set([userId, ...(memberIds || [])])];

        const group = await Group.create({
            name: name.trim(),
            description: description?.trim(),
            created_by: userId,
            admins: [userId],
            members: uniqueMemberIds,
            is_public: is_public || false,
            last_activity: new Date()
        });

        console.log('✅ Group created successfully:', group._id);

        const populatedGroup = await Group.findById(group._id)
            .populate('created_by', 'full_name profile_picture')
            .populate('admins', 'full_name profile_picture')
            .populate('members', 'full_name profile_picture username');

        // Send system message
        await Message.create({
            from_user_id: userId,
            group_id: group._id,
            text: `Group "${name}" was created by ${populatedGroup.created_by.full_name}`,
            message_type: 'system',
            is_system_message: true
        });

        // Notify all members about the new group
        uniqueMemberIds.forEach(memberId => {
            if (memberId.toString() !== userId) {
                sendSSEMessage(memberId.toString(), {
                    type: 'group_created',
                    group: populatedGroup,
                    createdBy: userId,
                    timestamp: new Date().toISOString()
                });
            }
        });

        res.json({ 
            success: true, 
            group: populatedGroup,
            message: 'Group created successfully'
        });

    } catch (error) {
        console.error('❌ Error creating group:', error);
        res.json({ success: false, message: error.message });
    }
};

// Keep your other existing functions but add better logging
export const getUserGroups = async (req, res) => {
    try {
        const userId = req.userId;

        const groups = await Group.find({ 
            members: userId 
        })
        .populate('created_by', 'full_name profile_picture')
        .populate('admins', 'full_name profile_picture')
        .populate('members', 'full_name profile_picture username')
        .sort({ last_activity: -1 });

        // Add online member count
        const groupsWithOnlineStats = groups.map(group => {
            const onlineCount = group.members.filter(member => 
                isUserOnline(member._id.toString())
            ).length;
            
            return {
                ...group.toObject(),
                onlineMembers: onlineCount
            };
        });

        res.json({ 
            success: true, 
            groups: groupsWithOnlineStats 
        });

    } catch (error) {
        console.error('❌ Error fetching user groups:', error);
        res.json({ success: false, message: error.message });
    }
};

export const getGroupDetails = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.userId;

        const group = await Group.findById(groupId)
            .populate('created_by', 'full_name profile_picture')
            .populate('admins', 'full_name profile_picture')
            .populate('members', 'full_name profile_picture username email');

        if (!group) {
            return res.json({ success: false, message: 'Group not found' });
        }

        const isMember = group.members.some(member => member._id.toString() === userId);
        if (!isMember) {
            return res.json({ success: false, message: 'You are not a member of this group' });
        }

        const membersWithOnlineStatus = group.members.map(member => ({
            ...member.toObject(),
            isOnline: isUserOnline(member._id.toString())
        }));

        res.json({ 
            success: true, 
            group: {
                ...group.toObject(),
                members: membersWithOnlineStatus,
                onlineMembers: membersWithOnlineStatus.filter(m => m.isOnline).length
            }
        });

    } catch (error) {
        console.error('❌ Error fetching group details:', error);
        res.json({ success: false, message: error.message });
    }
};

export const addGroupMembers = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.userId;
        const { memberIds } = req.body;

        const group = await Group.findById(groupId);
        
        if (!group) {
            return res.json({ success: false, message: 'Group not found' });
        }

        const isAdmin = group.admins.includes(userId);
        if (!isAdmin) {
            return res.json({ success: false, message: 'Only admins can add members' });
        }

        const newMemberIds = memberIds.filter(id => !group.members.includes(id));
        
        if (newMemberIds.length === 0) {
            return res.json({ success: false, message: 'All users are already members' });
        }

        group.members.push(...newMemberIds);
        group.last_activity = new Date();
        await group.save();

        const newMembers = await User.find({ _id: { $in: newMemberIds } }, 'full_name profile_picture username');

        // Send system message
        await Message.create({
            from_user_id: userId,
            group_id: groupId,
            text: `${newMembers.map(m => m.full_name).join(', ')} ${newMembers.length > 1 ? 'were' : 'was'} added to the group`,
            message_type: 'system',
            is_system_message: true
        });

        // Notify all group members
        group.members.forEach(memberId => {
            if (memberId.toString() !== userId) {
                sendSSEMessage(memberId.toString(), {
                    type: 'group_updated',
                    groupId: groupId,
                    action: 'members_added',
                    addedMembers: newMembers,
                    updatedBy: userId,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Notify new members
        newMemberIds.forEach(newMemberId => {
            sendSSEMessage(newMemberId.toString(), {
                type: 'group_joined',
                group: group,
                addedBy: userId,
                timestamp: new Date().toISOString()
            });
        });

        const updatedGroup = await Group.findById(groupId)
            .populate('members', 'full_name profile_picture username');

        res.json({ 
            success: true, 
            group: updatedGroup,
            addedMembers: newMembers,
            message: 'Members added successfully'
        });

    } catch (error) {
        console.error('❌ Error adding group members:', error);
        res.json({ success: false, message: error.message });
    }
};

export const removeGroupMember = async (req, res) => {
    try {
        const { groupId, memberId } = req.params;
        const userId = req.userId;

        const group = await Group.findById(groupId);
        
        if (!group) {
            return res.json({ success: false, message: 'Group not found' });
        }

        const isAdmin = group.admins.includes(userId);
        const isSelfRemoval = userId === memberId;

        if (!isAdmin && !isSelfRemoval) {
            return res.json({ success: false, message: 'Only admins can remove other members' });
        }

        if (group.admins.includes(memberId) && group.admins.length === 1) {
            return res.json({ success: false, message: 'Cannot remove the last admin' });
        }

        group.members = group.members.filter(m => m.toString() !== memberId);
        group.admins = group.admins.filter(a => a.toString() !== memberId);
        group.last_activity = new Date();
        await group.save();

        const removedUser = await User.findById(memberId, 'full_name');

        await Message.create({
            from_user_id: userId,
            group_id: groupId,
            text: `${removedUser?.full_name} ${isSelfRemoval ? 'left' : 'was removed from'} the group`,
            message_type: 'system',
            is_system_message: true
        });

        group.members.forEach(memberId => {
            sendSSEMessage(memberId.toString(), {
                type: 'group_updated',
                groupId: groupId,
                action: 'member_removed',
                removedMember: removedUser,
                updatedBy: userId,
                timestamp: new Date().toISOString()
            });
        });

        res.json({ 
            success: true, 
            message: 'Member removed successfully'
        });

    } catch (error) {
        console.error('❌ Error removing group member:', error);
        res.json({ success: false, message: error.message });
    }
};

export const handleGroupTyping = async (req, res) => {
    try {
        const userId = req.userId;
        const { group_id, is_typing } = req.body;

        console.log(`⌨️ Group typing: user ${userId} in group ${group_id} - ${is_typing}`);

        const group = await Group.findById(group_id);
        
        if (!group) {
            return res.json({ success: false, message: 'Group not found' });
        }

        if (!group.members.includes(userId)) {
            return res.json({ success: false, message: 'You are not a member of this group' });
        }

        const user = await User.findById(userId).select('full_name profile_picture');

        if (is_typing) {
            groupTypingUsers.set(`${group_id}_${userId}`, {
                userId,
                groupId: group_id,
                userName: user.full_name,
                timestamp: new Date()
            });
            
            group.members.forEach(memberId => {
                if (memberId.toString() !== userId) {
                    sendSSEMessage(memberId.toString(), {
                        type: 'group_typing_start',
                        groupId: group_id,
                        fromUserId: userId,
                        fromUserName: user.full_name,
                        timestamp: new Date().toISOString()
                    });
                }
            });

            setTimeout(() => {
                if (groupTypingUsers.has(`${group_id}_${userId}`)) {
                    groupTypingUsers.delete(`${group_id}_${userId}`);
                    group.members.forEach(memberId => {
                        if (memberId.toString() !== userId) {
                            sendSSEMessage(memberId.toString(), {
                                type: 'group_typing_stop',
                                groupId: group_id,
                                fromUserId: userId,
                                timestamp: new Date().toISOString()
                            });
                        }
                    });
                }
            }, 3000);

        } else {
            groupTypingUsers.delete(`${group_id}_${userId}`);
            
            group.members.forEach(memberId => {
                if (memberId.toString() !== userId) {
                    sendSSEMessage(memberId.toString(), {
                        type: 'group_typing_stop',
                        groupId: group_id,
                        fromUserId: userId,
                        timestamp: new Date().toISOString()
                    });
                }
            });
        }

        res.json({ success: true });

    } catch (error) {
        console.error('❌ Error handling group typing:', error);
        res.json({ success: false, message: error.message });
    }
};

export const getGroupOnlineMembers = async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.userId;

        const group = await Group.findById(groupId);
        
        if (!group) {
            return res.json({ success: false, message: 'Group not found' });
        }

        if (!group.members.includes(userId)) {
            return res.json({ success: false, message: 'You are not a member of this group' });
        }

        const onlineMemberIds = group.members.filter(memberId => 
            isUserOnline(memberId.toString())
        );

        const onlineMembers = await User.find(
            { _id: { $in: onlineMemberIds } },
            'full_name profile_picture username lastSeen'
        );

        res.json({ 
            success: true, 
            onlineMembers,
            totalOnline: onlineMembers.length,
            totalMembers: group.members.length
        });

    } catch (error) {
        console.error('❌ Error fetching group online members:', error);
        res.json({ success: false, message: error.message });
    }
};