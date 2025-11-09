import fs from "fs";
import imagekit from "../configs/imageKit.js";
import Message from "../models/Message.js";
import User from "../models/User.js"; // Import User model

// Store SSE connections
export const connections = new Map();

// Track online users globally
const onlineUsers = new Set();

// Update user's last seen timestamp
export const updateLastSeen = async (userId) => {
  try {
    await User.findByIdAndUpdate(userId, { 
      lastSeen: new Date() 
    });
    console.log(`🕒 Updated last seen for user: ${userId}`);
  } catch (error) {
    console.log('❌ Error updating last seen:', error);
  }
};

// Broadcast user status to all connected clients
const broadcastUserStatus = (userId, status) => {
  const message = {
    type: status === 'online' ? 'user_online' : 'user_offline',
    userId: userId,
    timestamp: new Date().toISOString()
  };

  connections.forEach((connection, connectionUserId) => {
    if (connectionUserId !== userId) {
      try {
        connection.write(`data: ${JSON.stringify(message)}\n\n`);
        console.log(`📢 Broadcasted ${status} status for user ${userId} to ${connectionUserId}`);
      } catch (error) {
        console.log(`❌ Error broadcasting to ${connectionUserId}:`, error);
        connections.delete(connectionUserId);
        onlineUsers.delete(connectionUserId);
      }
    }
  });
};

// SSE setup function
export const setupSSE = (req, res) => {
  const userId = req.params.userId;
  
  console.log('🔗 SSE connected for user:', userId);
  
  // Set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Add user to online users and update last seen
  onlineUsers.add(userId);
  updateLastSeen(userId); // Update to current time when user comes online
  
  // Notify all connections that this user came online
  broadcastUserStatus(userId, 'online');

  // Send initial connection message with online users
  res.write(`data: ${JSON.stringify({ 
    type: 'connected', 
    message: 'SSE Connected',
    onlineUsers: Array.from(onlineUsers)
  })}\n\n`);

  // Store the connection
  connections.set(userId, res);

  // Remove connection when client disconnects
  req.on('close', () => {
    console.log('🔌 SSE disconnected for user:', userId);
    connections.delete(userId);
    onlineUsers.delete(userId);
    
    // Update last seen when user disconnects
    updateLastSeen(userId);
    
    // Notify all connections that this user went offline
    broadcastUserStatus(userId, 'offline');
    res.end();
  });

  // Heartbeat to keep connection alive and update last seen
  const heartbeat = setInterval(() => {
    if (connections.has(userId)) {
      try {
        res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
        // Update last seen on heartbeat to track active users
        updateLastSeen(userId);
      } catch (error) {
        console.log('❌ Heartbeat failed, cleaning up connection for user:', userId);
        clearInterval(heartbeat);
        connections.delete(userId);
        onlineUsers.delete(userId);
        updateLastSeen(userId);
        broadcastUserStatus(userId, 'offline');
      }
    } else {
      clearInterval(heartbeat);
    }
  }, 30000);
};

// Get user's last seen information
export const getUserLastSeen = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId).select('lastSeen full_name');
    
    if (!user) {
      return res.json({ success: false, message: 'User not found' });
    }

    res.json({ 
      success: true, 
      lastSeen: user.lastSeen,
      full_name: user.full_name,
      isOnline: onlineUsers.has(userId)
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Get multiple users' last seen status
export const getUsersLastSeen = async (req, res) => {
  try {
    const { userIds } = req.body;
    
    if (!Array.isArray(userIds)) {
      return res.json({ success: false, message: 'User IDs must be an array' });
    }

    const users = await User.find({ _id: { $in: userIds } }).select('lastSeen full_name _id');
    
    const lastSeenData = {};
    users.forEach(user => {
      lastSeenData[user._id] = {
        lastSeen: user.lastSeen,
        full_name: user.full_name,
        isOnline: onlineUsers.has(user._id.toString())
      };
    });

    res.json({ 
      success: true, 
      lastSeenData 
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Send message to specific user via SSE
export const sendSSEMessage = (userId, data) => {
  const connection = connections.get(userId);
  if (connection) {
    try {
      connection.write(`data: ${JSON.stringify(data)}\n\n`);
      console.log('📤 SSE message sent to user:', userId);
      return true;
    } catch (error) {
      console.log('❌ Error sending SSE message, cleaning up connection for user:', userId);
      connections.delete(userId);
      onlineUsers.delete(userId);
      updateLastSeen(userId);
      return false;
    }
  }
  console.log('❌ No SSE connection for user:', userId);
  return false;
};

// Controller function for the SSE endpoint
export const sseController = (req, res) => {
  console.log('🚀 SSE Controller called for user:', req.params.userId);
  setupSSE(req, res);
};

// Send Message
export const sendMessage = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { to_user_id, text } = req.body;
    const image = req.file;

    let media_url = '';
    let message_type = image ? 'image' : 'text';

    if(message_type === 'image'){
      const fileBuffer =  fs.readFileSync(image.path);
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
      })
    }

    const message = await Message.create({
      from_user_id: userId,
      to_user_id,
      text,
      message_type,
      media_url
    })

    // Populate user data for the response
    const messageWithUserData = await Message.findById(message._id)
      .populate('from_user_id', 'full_name profile_picture email lastSeen')
      .populate('to_user_id', 'full_name profile_picture email lastSeen');

    res.json({ success: true, message: messageWithUserData });

    // Check if recipient is online
    const isRecipientOnline = onlineUsers.has(to_user_id);
    console.log(`📱 Recipient ${to_user_id} is ${isRecipientOnline ? 'online' : 'offline'}`);

    // ✅ Send real-time notification to recipient via SSE
    if (sendSSEMessage(to_user_id, {
      type: 'new_message',
      message: messageWithUserData,
      notification: {
        title: 'New Message',
        body: message_type === 'text' ? (text || 'New message') : '📷 Image',
        from: messageWithUserData.from_user_id?.full_name || 'Someone',
        fromId: userId,
        avatar: messageWithUserData.from_user_id?.profile_picture || '/default-avatar.png',
        isRecipientOnline: isRecipientOnline
      }
    })) {
      console.log('✅ SSE notification sent to:', to_user_id);
    }

    // Also notify the sender that the message was delivered (optional)
    if (isRecipientOnline) {
      sendSSEMessage(userId, {
        type: 'message_delivered',
        messageId: message._id,
        to_user_id: to_user_id,
        status: 'delivered',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message });
  }
}

// Get Chat Messages
export const getChatMessages = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { to_user_id } = req.body;

    const messages = await Message.find({
      $or: [
        {from_user_id: userId, to_user_id},
        {from_user_id: to_user_id, to_user_id: userId},
      ]
    })
    .populate('from_user_id', 'full_name profile_picture email lastSeen')
    .populate('to_user_id', 'full_name profile_picture email lastSeen')
    .sort({created_at: -1});

    // Mark messages as seen
    await Message.updateMany(
      {from_user_id: to_user_id, to_user_id: userId, seen: false}, 
      {seen: true}
    );

    // Check if the other user is online and get their last seen
    const isOtherUserOnline = onlineUsers.has(to_user_id);
    const otherUser = await User.findById(to_user_id).select('lastSeen');

    res.json({ 
      success: true, 
      messages,
      isOtherUserOnline,
      lastSeen: otherUser?.lastSeen
    });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
}

export const getUserRecentMessages = async (req, res) => {
  try {
    const { userId } = req.auth();
    
    console.log('🔍 Fetching recent messages for user:', userId);
    
    // Get all messages where user is involved (both sent and received)
    const allMessages = await Message.find({
      $or: [
        { from_user_id: userId },
        { to_user_id: userId }
      ]
    })
    .populate('from_user_id', 'full_name profile_picture email lastSeen')
    .populate('to_user_id', 'full_name profile_picture email lastSeen')
    .sort({ created_at: -1 });

    console.log('📨 Total messages found:', allMessages.length);

    // Group by conversation partner and get latest message
    const conversationMap = new Map();

    allMessages.forEach(message => {
      // Determine the other user in conversation
      const otherUserId = message.from_user_id._id.toString() === userId 
        ? message.to_user_id._id.toString() 
        : message.from_user_id._id.toString();
      
      const otherUser = message.from_user_id._id.toString() === userId 
        ? message.to_user_id 
        : message.from_user_id;

      // If we haven't seen this conversation yet, add it
      if (!conversationMap.has(otherUserId)) {
        conversationMap.set(otherUserId, {
          user: {
            _id: otherUser._id,
            full_name: otherUser.full_name,
            profile_picture: otherUser.profile_picture,
            email: otherUser.email,
            lastSeen: otherUser.lastSeen,
            isOnline: onlineUsers.has(otherUserId)
          },
          lastMessage: {
            _id: message._id,
            text: message.text,
            message_type: message.message_type,
            createdAt: message.created_at,
            created_at: message.created_at,
            seen: message.seen
          },
          unreadCount: 0
        });
      }

      // Count unread messages (only messages TO current user that are unread)
      if (message.to_user_id._id.toString() === userId && !message.seen) {
        const conversation = conversationMap.get(otherUserId);
        conversation.unreadCount += 1;
      }
    });

    // Convert map to array and sort by latest message
    const conversations = Array.from(conversationMap.values())
      .sort((a, b) => new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at));

    console.log('✅ Processed conversations:', conversations.length);

    res.json({ 
      success: true, 
      conversations,
      totalOnline: Array.from(conversations).filter(conv => conv.user.isOnline).length
    });
  } catch (error) {
    console.log('❌ Error in getUserRecentMessages:', error);
    res.json({ success: false, message: error.message });
  }
}