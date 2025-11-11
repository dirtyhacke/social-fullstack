import React, { useState, useRef, useEffect } from 'react';
import { 
    Eye, MessageSquare, Bell, BellOff, ArrowRight, Wifi, WifiOff, 
    Clock, UserCheck, Users, XCircle, ChevronRight, BookOpen, 
    UserPlus, Pin, PinOff, Users as GroupIcon 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useAuth, useUser } from '@clerk/clerk-react';
import api from '../api/axios';
import toast from 'react-hot-toast';

// Create Group Modal Component
const CreateGroupModal = ({ isOpen, onClose, connections, onGroupCreated }) => {
    const [groupName, setGroupName] = useState('');
    const [groupDescription, setGroupDescription] = useState('');
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const { getToken } = useAuth();

    const handleCreateGroup = async () => {
        if (!groupName.trim()) {
            toast.error('Please enter a group name');
            return;
        }

        if (selectedMembers.length === 0) {
            toast.error('Please select at least one member');
            return;
        }

        try {
            setIsLoading(true);
            const token = await getToken();
            
            const response = await api.post('/api/groups/create', {
                name: groupName,
                description: groupDescription,
                memberIds: selectedMembers,
                is_public: false
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                toast.success('Group created successfully!');
                setGroupName('');
                setGroupDescription('');
                setSelectedMembers([]);
                onGroupCreated?.();
                onClose();
            } else {
                throw new Error(response.data.message);
            }
        } catch (error) {
            console.error('Error creating group:', error);
            toast.error(error.response?.data?.message || error.message || 'Failed to create group');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleMemberSelection = (memberId) => {
        setSelectedMembers(prev => 
            prev.includes(memberId) 
                ? prev.filter(id => id !== memberId)
                : [...prev, memberId]
        );
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                    <h3 className="text-xl font-bold text-gray-900">Create New Group</h3>
                    <p className="text-gray-600 text-sm mt-1">Start a group chat with your connections</p>
                </div>
                
                <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
                    {/* Group Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Group Name *
                        </label>
                        <input
                            type="text"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="Enter group name..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            maxLength={100}
                        />
                    </div>

                    {/* Group Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Description (Optional)
                        </label>
                        <textarea
                            value={groupDescription}
                            onChange={(e) => setGroupDescription(e.target.value)}
                            placeholder="What's this group about?"
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            maxLength={500}
                        />
                    </div>

                    {/* Member Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Add Members ({selectedMembers.length} selected)
                        </label>
                        <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
                            {connections.length === 0 ? (
                                <p className="text-gray-500 text-sm text-center py-4">
                                    No connections available. Connect with users first.
                                </p>
                            ) : (
                                connections.map(connection => (
                                    <div
                                        key={connection._id}
                                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                                            selectedMembers.includes(connection._id)
                                                ? 'bg-blue-50 border border-blue-200'
                                                : 'hover:bg-gray-50'
                                        }`}
                                        onClick={() => toggleMemberSelection(connection._id)}
                                    >
                                        <img
                                            src={connection.profile_picture || '/default-avatar.png'}
                                            alt={connection.full_name}
                                            className="w-8 h-8 rounded-full object-cover"
                                        />
                                        <div className="flex-1">
                                            <p className="font-medium text-sm text-gray-900">
                                                {connection.full_name}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                @{connection.username}
                                            </p>
                                        </div>
                                        <div className={`w-4 h-4 border-2 rounded ${
                                            selectedMembers.includes(connection._id)
                                                ? 'bg-blue-500 border-blue-500'
                                                : 'border-gray-300'
                                        }`}>
                                            {selectedMembers.includes(connection._id) && (
                                                <div className="w-full h-full bg-white rounded-sm" />
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-gray-200 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                        disabled={isLoading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreateGroup}
                        disabled={isLoading || !groupName.trim() || selectedMembers.length === 0}
                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <GroupIcon className="w-4 h-4" />
                                Create Group
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Group Chat Card Component
const GroupChatCard = ({ group, onClick }) => {
    const memberCount = group.members?.length || 0;
    const onlineCount = group.members?.filter(member => member.isOnline)?.length || 0;

    // Format last seen time
    const formatLastSeen = (lastSeenDate) => {
        if (!lastSeenDate) return 'Never seen';
        
        const now = new Date();
        const lastSeen = new Date(lastSeenDate);
        const diffInMinutes = Math.floor((now - lastSeen) / (1000 * 60));
        const diffInHours = Math.floor(diffInMinutes / 60);
        const diffInDays = Math.floor(diffInHours / 24);

        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        if (diffInHours < 24) return `${diffInHours}h ago`;
        if (diffInDays < 7) return `${diffInDays}d ago`;
        
        return lastSeen.toLocaleDateString();
    };

    return (
        <div 
            onClick={onClick}
            className="flex items-center p-4 bg-white shadow-lg rounded-2xl transition-all duration-300 border border-transparent hover:shadow-xl hover:border-purple-300/50 hover:scale-[1.01] cursor-pointer group"
        >
            {/* Group Avatar */}
            <div className="relative flex-shrink-0">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
                    {group.name.charAt(0).toUpperCase()}
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                    <GroupIcon className="w-3 h-3 text-white" />
                </div>
            </div>
            
            {/* Group Info */}
            <div className="flex-1 ml-4 overflow-hidden">
                <div className="flex items-center justify-between">
                    <p className="font-bold text-lg text-gray-900 truncate">
                        {group.name}
                    </p>
                </div>
                <p className="text-purple-500 text-sm font-medium">
                    {memberCount} {memberCount === 1 ? 'member' : 'members'}
                </p>
                
                {/* Group Status */}
                <p className="text-sm text-gray-600 mt-1 truncate">
                    <span className="text-green-600 font-medium flex items-center gap-1">
                        <Wifi className="w-3 h-3"/>
                        {onlineCount} online now
                    </span>
                </p>

                {/* Last Activity */}
                {group.last_activity && (
                    <p className="text-xs text-gray-500 mt-1">
                        Active {formatLastSeen(group.last_activity)}
                    </p>
                )}
            </div>

            {/* Action Button */}
            <ChevronRight className="w-6 h-6 text-purple-500 group-hover:translate-x-1 transition-transform duration-300 ml-4" />
        </div>
    );
};

// Connection Card Component
const ConnectionCard = ({ user, onPin, onViewProfile, onNavigate }) => {
    const isOnline = user.isOnline;
    const lastSeen = user.lastSeen;
    const isPinned = user.isPinned;

    // Format last seen time
    const formatLastSeen = (lastSeenDate) => {
        if (!lastSeenDate) return 'Never seen';
        
        const now = new Date();
        const lastSeen = new Date(lastSeenDate);
        const diffInMinutes = Math.floor((now - lastSeen) / (1000 * 60));
        const diffInHours = Math.floor(diffInMinutes / 60);
        const diffInDays = Math.floor(diffInHours / 24);

        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        if (diffInHours < 24) return `${diffInHours}h ago`;
        if (diffInDays < 7) return `${diffInDays}d ago`;
        
        return lastSeen.toLocaleDateString();
    };

    return (
        <div 
            onClick={onNavigate}
            className={`flex items-center p-4 bg-white shadow-lg rounded-2xl transition-all duration-300 border hover:shadow-xl hover:scale-[1.01] cursor-pointer group relative ${
                isPinned 
                    ? 'border-purple-300 bg-purple-50/30' 
                    : 'border-transparent hover:border-blue-300/50'
            }`}
        >
            
            {/* Pin Indicator */}
            {isPinned && (
                <div className="absolute -top-2 -left-2 bg-purple-500 text-white p-1 rounded-full shadow-lg">
                    <Pin className="w-3 h-3" />
                </div>
            )}
            
            {/* User Avatar with Status Badge */}
            <div className="relative flex-shrink-0">
                <img 
                    src={user.profile_picture || '/default-avatar.png'} 
                    alt={user.full_name}
                    className={`rounded-full size-16 object-cover border-2 shadow-md ${
                        isPinned ? 'border-purple-300' : 'border-white'
                    }`}
                    onError={(e) => { e.target.src = '/default-avatar.png' }}
                />
                <div 
                    className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 transition-colors duration-300 ${
                        isPinned ? 'border-purple-50' : 'border-white'
                    } ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}
                    title={isOnline ? 'Online' : 'Offline'}
                />
            </div>
            
            {/* User Info */}
            <div className='flex-1 ml-4 overflow-hidden'>
                <div className='flex items-center justify-between'>
                    <p className='font-bold text-lg text-gray-900 truncate flex items-center gap-2'>
                        {user.full_name}
                        {isPinned && (
                            <Pin className="w-4 h-4 text-purple-500" />
                        )}
                    </p>
                </div>
                <p className='text-blue-500 text-sm font-medium'>@{user.username}</p>
                
                {/* Detailed Status */}
                <p className='text-sm text-gray-600 mt-1 truncate'>
                    {isOnline ? (
                        <span className="text-green-600 font-medium flex items-center gap-1">
                            <Wifi className="w-3 h-3"/>
                            Online Now
                        </span>
                    ) : lastSeen ? (
                        <span className="text-gray-500 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-gray-400" />
                            Active {formatLastSeen(lastSeen)}
                        </span>
                    ) : (
                        <span className="text-gray-500 flex items-center gap-1">
                            <WifiOff className="w-3 h-3 text-gray-400" />
                            No recent activity
                        </span>
                    )}
                </p>
            </div>

            {/* Action Buttons */}
            <div className='ml-4 flex flex-col gap-2 items-end flex-shrink-0'>
                {/* Pin/Unpin Button */}
                <button 
                    onClick={(e) => onPin(user._id, user.full_name, e)}
                    className={`size-8 flex items-center justify-center rounded-full transition duration-200 shadow-sm ${
                        isPinned
                            ? 'bg-purple-100 hover:bg-purple-200 text-purple-600'
                            : 'bg-gray-100 hover:bg-blue-100 text-gray-600 hover:text-blue-600'
                    }`}
                    title={isPinned ? "Unpin chat" : "Pin chat to top"}
                >
                    {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                </button>
                
                {/* View Profile Button */}
                <button 
                    onClick={(e) => onViewProfile(user._id, e)}
                    className='size-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-blue-100 text-gray-600 hover:text-blue-600 transition duration-200 shadow-sm'
                    title="View Profile"
                >
                    <Eye className="w-4 h-4"/>
                </button>
                
                {/* Navigate to Chat Button */}
                <ChevronRight className="w-6 h-6 text-blue-500 group-hover:translate-x-1 transition-transform duration-300" />
            </div>
        </div>
    );
};

// Main Messages Component
const Messages = () => {
    const { connections } = useSelector((state) => state.connections);
    const navigate = useNavigate();
    const { user } = useUser();
    const { getToken } = useAuth();
    const eventSourceRef = useRef(null);
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState(new Set());
    const [connectionsWithStatus, setConnectionsWithStatus] = useState([]);
    const [isSseConnecting, setIsSseConnecting] = useState(false);
    const [isSseActive, setIsSseActive] = useState(false);
    const [isGuideVisible, setIsGuideVisible] = useState(false);
    const [pinnedChats, setPinnedChats] = useState([]);
    const [userGroups, setUserGroups] = useState([]);
    const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
    const [activeTab, setActiveTab] = useState('chats'); // 'chats' or 'groups'

    // Load pinned chats and user groups
    useEffect(() => {
        const savedPinnedChats = localStorage.getItem('pinnedChats');
        if (savedPinnedChats) {
            try {
                setPinnedChats(JSON.parse(savedPinnedChats));
            } catch (error) {
                console.error('Error loading pinned chats:', error);
                setPinnedChats([]);
            }
        }
        fetchUserGroups();
    }, []);

    // Fetch user's groups
    const fetchUserGroups = async () => {
        try {
            const token = await getToken();
            const response = await api.get('/api/groups/my-groups', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                setUserGroups(response.data.groups || []);
            }
        } catch (error) {
            console.error('Error fetching user groups:', error);
        }
    };

    // Format last seen time
    const formatLastSeen = (lastSeenDate) => {
        if (!lastSeenDate) return 'Never seen';
        
        const now = new Date();
        const lastSeen = new Date(lastSeenDate);
        const diffInMinutes = Math.floor((now - lastSeen) / (1000 * 60));
        const diffInHours = Math.floor(diffInMinutes / 60);
        const diffInDays = Math.floor(diffInHours / 24);

        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        if (diffInHours < 24) return `${diffInHours}h ago`;
        if (diffInDays < 7) return `${diffInDays}d ago`;
        
        return lastSeen.toLocaleDateString();
    };

    // Fetch multiple users' last seen status
    const fetchUsersLastSeen = async (userIds) => {
        try {
            const token = await getToken();
            const response = await api.post('/api/messages/last-seen/batch', 
                { userIds },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            return response.data;
        } catch (error) {
            console.error('Error fetching users last seen:', error);
            return { success: false, lastSeenData: {} }; 
        }
    };

    // Update connections with last seen data
    const updateConnectionsWithStatus = async (currentConnections, currentOnlineUsers) => {
        if (currentConnections.length > 0) {
            const userIds = currentConnections.map(conn => conn._id);
            const lastSeenData = await fetchUsersLastSeen(userIds);
            
            const updatedConnections = currentConnections.map(conn => {
                const isOnline = currentOnlineUsers.has(conn._id);
                const lastSeen = lastSeenData.success 
                    ? lastSeenData.lastSeenData[conn._id]?.lastSeen 
                    : undefined;

                return {
                    ...conn,
                    lastSeen: lastSeen,
                    isOnline: isOnline,
                    isPinned: pinnedChats.includes(conn._id)
                };
            });
            setConnectionsWithStatus(updatedConnections);
        } else {
            setConnectionsWithStatus([]);
        }
    };

    // Function to show system notification
    const showNotification = (data) => {
        try {
            const notification = data?.notification;
            const message = data?.message;
            
            const title = notification?.title || 'New Chat Message';
            const fromName = notification?.from || message?.from_user_id?.full_name || 'A Connection';
            const body = notification?.body || message?.text || 'Sent an image';
            const avatar = notification?.avatar || message?.from_user_id?.profile_picture || '/default-avatar.png';
            const fromId = notification?.fromId || message?.from_user_id?._id;

            if ("Notification" in window && Notification.permission === "granted") {
                const notif = new Notification(title, {
                    body: `${fromName}: ${body}`,
                    icon: avatar,
                    badge: '/favicon.ico',
                    tag: `chat-message-${fromId}`,
                    renotify: true
                });

                notif.onclick = () => {
                    window.focus();
                    if (fromId) {
                        navigate(`/messages/${fromId}`);
                    }
                    notif.close();
                };

                setTimeout(() => notif.close(), 5000);
            } else {
                toast.success(`New message from ${fromName}`, { icon: '💬' });
            }
        } catch (error) {
            console.log('❌ Error showing notification:', error);
            toast.success('New message received');
        }
    }

    // Setup SSE for real-time messages and online status
    const setupSSE = async () => {
        if (!user?.id || isSseConnecting || isSseActive) return;

        setIsSseConnecting(true);

        try {
            const token = await getToken();
            const currentUserId = user.id;

            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }

            const sseUrl = `https://social-server-nine.vercel.app/api/messages/sse/${currentUserId}?token=${token}`;
            eventSourceRef.current = new EventSource(sseUrl);

            eventSourceRef.current.onopen = () => {
                console.log('🔗 SSE connection opened for Messages page');
                setIsSseConnecting(false);
                setIsSseActive(true);
                toast.success('Real-time chat connection established', { icon: '✨' });
            };

            eventSourceRef.current.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    if (data.type === 'new_message') {
                        showNotification(data);
                        const fromName = data.notification?.from || data.message?.from_user_id?.full_name || 'Someone';
                        
                        // Only show toast if user is not on the current chat page
                        if (!window.location.pathname.includes(`/messages/${data.message?.from_user_id?._id}`)) {
                            toast.success(`New message from ${fromName}`, {
                                duration: 4000,
                                icon: '💬',
                                onClick: () => {
                                    const fromId = data.notification?.fromId || data.message?.from_user_id?._id;
                                    if (fromId) {
                                        navigate(`/messages/${fromId}`);
                                    }
                                }
                            });
                        }
                    } else if (data.type === 'connected') {
                        console.log('✅ SSE connected successfully in Messages');
                        if (data.onlineUsers) {
                            setOnlineUsers(new Set(data.onlineUsers));
                            updateConnectionsWithStatus(connections, new Set(data.onlineUsers)); 
                        }
                    } else if (data.type === 'user_online') {
                        setOnlineUsers(prev => {
                            const newSet = new Set(prev).add(data.userId);
                            updateConnectionsWithStatus(connections, newSet);
                            return newSet;
                        });
                        const connection = connections.find(conn => conn._id === data.userId);
                        if (connection) {
                            toast.success(`${connection.full_name} is now online`, {
                                duration: 3000,
                                icon: '🟢'
                            });
                        }
                    } else if (data.type === 'user_offline') {
                        setOnlineUsers(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(data.userId);
                            updateConnectionsWithStatus(connections, newSet);
                            return newSet;
                        });
                        const connection = connections.find(conn => conn._id === data.userId);
                        if (connection) {
                            toast.error(`${connection.full_name} went offline`, {
                                duration: 3000,
                                icon: '🔴'
                            });
                        }
                    } else if (data.type === 'group_updated') {
                        // Refresh groups when group is updated
                        fetchUserGroups();
                    } else if (data.type === 'new_group_message') {
                        // Handle group message notifications
                        showNotification(data);
                    }
                } catch (error) {
                    console.log('❌ Error parsing SSE data in Messages:', error);
                }
            };

            eventSourceRef.current.onerror = (error) => {
                console.log('❌ SSE error in Messages:', error);
                setIsSseActive(false);
                setIsSseConnecting(false);
                
                // Attempt reconnection after a delay
                setTimeout(() => {
                    if (user?.id) {
                        console.log('🔄 Attempting SSE reconnection...');
                        setupSSE();
                    }
                }, 5000);
            };

        } catch (error) {
            console.log('❌ Error setting up SSE in Messages:', error);
            setIsSseConnecting(false);
            setIsSseActive(false);
        }
    }

    // Toggle notifications (and implicitly, the SSE connection)
    const toggleNotifications = async () => {
        if (!notificationsEnabled) {
            // Enable notifications
            if ("Notification" in window) {
                const permission = await Notification.requestPermission();
                if (permission === "granted") {
                    setNotificationsEnabled(true);
                    setupSSE();
                    toast.success('System notifications granted and enabled');
                } else {
                    toast.error('Browser blocked notifications. Please allow them in settings.', { icon: <XCircle className='text-red-500'/> });
                }
            } else {
                // Still try to setup SSE for online status even without browser notification API
                setupSSE();
                setNotificationsEnabled(true);
            }
        } else {
            // Disable notifications & close SSE
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
            setOnlineUsers(new Set()); 
            setConnectionsWithStatus([]); 
            setIsSseActive(false);
            setNotificationsEnabled(false);
            toast.success('Real-time connection and notifications disabled', { icon: '👋' });
        }
    }

    // Toggle Pin for a chat
    const togglePinChat = (userId, userName, e) => {
        e.stopPropagation(); // Prevent navigation when clicking pin button
        
        setPinnedChats(prev => {
            const isCurrentlyPinned = prev.includes(userId);
            let newPinnedChats;
            
            if (isCurrentlyPinned) {
                newPinnedChats = prev.filter(id => id !== userId);
                toast.success(`Unpinned chat with ${userName}`, { icon: '📌' });
            } else {
                newPinnedChats = [userId, ...prev];
                toast.success(`Pinned chat with ${userName}`, { icon: '📌' });
            }
            
            // Update connections with new pinned status
            setConnectionsWithStatus(prevConnections => 
                prevConnections.map(conn => 
                    conn._id === userId 
                        ? { ...conn, isPinned: !isCurrentlyPinned }
                        : conn
                )
            );
            
            return newPinnedChats;
        });
    };

    // Handle view profile
    const handleViewProfile = (userId, e) => {
        e.stopPropagation();
        navigate(`/profile/${userId}`);
    };

    // Handle navigate to chat
    const handleNavigateToChat = (userId) => {
        navigate(`/messages/${userId}`);
    };

    // Handle group chat click
    const handleGroupChatClick = (groupId) => {
        navigate(`/messages/group/${groupId}`);
    };

    // Get online connections count
    const getOnlineConnectionsCount = () => {
        return connectionsWithStatus.filter(conn => conn.isOnline).length;
    };

    // Get offline connections count
    const getOfflineConnectionsCount = () => {
        return connectionsWithStatus.filter(conn => !conn.isOnline).length;
    };

    // Get pinned connections count
    const getPinnedConnectionsCount = () => {
        return pinnedChats.length;
    };

    // Sort connections: pinned first, then online, then offline
    const getSortedConnections = () => {
        return [...connectionsWithStatus].sort((a, b) => {
            // Pinned chats first
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            
            // Then online status
            if (a.isOnline && !b.isOnline) return -1;
            if (!a.isOnline && b.isOnline) return 1;
            
            // Then by name
            return a.full_name.localeCompare(b.full_name);
        });
    };

    // Initial setup and connection status updates
    useEffect(() => {
        if (user?.id) {
            if ("Notification" in window && Notification.permission === "granted") {
                setNotificationsEnabled(true);
            }
            setupSSE();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    // Update connections status when connections or onlineUsers change
    useEffect(() => {
        updateConnectionsWithStatus(connections, onlineUsers);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connections, onlineUsers, pinnedChats]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, []);

    const sortedConnections = getSortedConnections();
    const totalConnections = connections.length;
    const onlineCount = getOnlineConnectionsCount();
    const offlineCount = getOfflineConnectionsCount();
    const pinnedCount = getPinnedConnectionsCount();

    return (
        <div className='min-h-screen relative bg-gray-50/70'>
            <div className='max-w-6xl mx-auto p-4 sm:p-6'>
                
                {/* Title and Header */}
                <div className='mb-8 pb-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center'>
                    <div>
                        <h1 className='text-4xl font-extrabold text-gray-900 mb-1'>
                            <UserCheck className='inline-block w-8 h-8 text-blue-600 mr-2'/>
                            Messages <span className='text-blue-600'>& Groups</span>
                        </h1>
                        <p className='text-gray-500 ml-10'>
                            Chat with connections or create group conversations
                        </p>
                    </div>
                    
                    {/* Notification Toggle Button */}
                    <button
                        onClick={toggleNotifications}
                        className={`mt-4 sm:mt-0 flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-300 shadow-md text-sm font-medium ${
                            notificationsEnabled && isSseActive
                                ? 'bg-white text-green-700 border-green-300 hover:bg-green-50 shadow-green-100/50' 
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100 shadow-gray-100/50'
                        }`}
                        title={notificationsEnabled && isSseActive ? "Disable real-time connection and notifications" : "Enable real-time message notifications"}
                        disabled={isSseConnecting}
                    >
                        {isSseConnecting ? (
                            <Clock className="w-4 h-4 text-amber-500 animate-spin" />
                        ) : notificationsEnabled && isSseActive ? (
                            <Bell className="w-4 h-4 text-green-500" />
                        ) : (
                            <BellOff className="w-4 h-4 text-gray-500" />
                        )}
                        <span className="hidden sm:inline">
                            {isSseConnecting ? 'Connecting...' : notificationsEnabled && isSseActive ? 'Notifications ON' : 'Notifications OFF'}
                        </span>
                        <span className="inline sm:hidden">
                            {isSseConnecting ? 'Wait' : notificationsEnabled && isSseActive ? 'ON' : 'OFF'}
                        </span>
                    </button>
                </div>

                {/* Connection Status Panel */}
                {isSseActive && (
                    <div className="mb-6 p-4 bg-blue-50/50 border border-blue-200 rounded-xl shadow-inner transition-opacity duration-500">
                        <div className="flex justify-between items-center">
                            <p className="text-blue-700 text-sm font-semibold flex items-center gap-2">
                                <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                                Real-time Connection Active
                            </p>
                            <div className="text-sm text-blue-600 font-medium flex items-center gap-3">
                                <div className="flex items-center gap-1">
                                    <Users className='w-4 h-4'/>
                                    <span className='font-bold'>{totalConnections}</span> Connections
                                </div>
                                <div className="flex items-center gap-1 text-green-700">
                                    <Wifi className='w-4 h-4'/>
                                    <span className='font-bold'>{onlineCount}</span> Online
                                </div>
                                <div className="flex items-center gap-1 text-purple-600">
                                    <GroupIcon className='w-4 h-4'/>
                                    <span className='font-bold'>{userGroups.length}</span> Groups
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tab Navigation */}
                <div className="mb-6 bg-white rounded-xl shadow-md border border-gray-100 p-1">
                    <div className="flex">
                        <button
                            onClick={() => setActiveTab('chats')}
                            className={`flex-1 py-3 px-4 text-center font-medium rounded-lg transition-all duration-200 ${
                                activeTab === 'chats'
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                            }`}
                        >
                            <MessageSquare className="w-4 h-4 inline mr-2" />
                            Individual Chats
                        </button>
                        <button
                            onClick={() => setActiveTab('groups')}
                            className={`flex-1 py-3 px-4 text-center font-medium rounded-lg transition-all duration-200 ${
                                activeTab === 'groups'
                                    ? 'bg-purple-600 text-white shadow-md'
                                    : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50'
                            }`}
                        >
                            <GroupIcon className="w-4 h-4 inline mr-2" />
                            Group Chats
                        </button>
                    </div>
                </div>

                {/* Action Buttons Panel */}
                <div className="mb-6 p-3 bg-white rounded-xl shadow-md flex flex-col sm:flex-row items-center justify-between gap-3 border border-gray-100">
                    <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-gray-800">
                            {activeTab === 'chats' ? 'Individual Chats' : 'Group Chats'}
                        </h3>
                        <span className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded-full font-medium">
                            {activeTab === 'chats' ? connections.length : userGroups.length}
                        </span>
                    </div>
                    
                    <div className="flex gap-3">
                        {activeTab === 'groups' && (
                            <button
                                onClick={() => setShowCreateGroupModal(true)}
                                className='flex items-center gap-2 font-semibold text-white bg-purple-600 px-4 py-2 rounded-full hover:bg-purple-700 transition duration-200 shadow-lg shadow-purple-500/30'
                            >
                                <UserPlus className='w-5 h-5'/>
                                Create Group
                            </button>
                        )}
                        
                        <button
                            onClick={() => setIsGuideVisible(prev => !prev)}
                            className='flex-shrink-0 flex items-center gap-2 text-sm font-medium text-blue-600 bg-blue-50 px-4 py-2 rounded-full hover:bg-blue-100 transition duration-200 shadow-sm'
                        >
                            <BookOpen className='w-4 h-4'/>
                            {isGuideVisible ? 'Hide Guide' : 'View Guide'}
                            <ChevronRight className={`w-4 h-4 transition-transform ${isGuideVisible ? 'rotate-90' : 'rotate-0'}`} />
                        </button>
                    </div>
                </div>

                {/* Content based on active tab */}
                {activeTab === 'chats' ? (
                    /* Individual Chats - Your existing connections list */
                    <div className='mb-8'>
                        <h2 className='text-2xl font-semibold text-gray-800 mb-4'>
                            Your Active Chats ({connections.length})
                        </h2>
                        
                        {connections.length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-2xl shadow-lg border border-gray-100 transition-all duration-300">
                                <MessageSquare className="w-16 h-16 text-blue-300 mx-auto mb-4 opacity-75" />
                                <h3 className="text-2xl font-bold text-gray-800 mb-2">No Connections Yet</h3>
                                <p className="text-gray-500 max-w-md mx-auto">
                                    Connect with users on the main feed to see them appear here and start chatting instantly!
                                </p>
                            </div>
                        ) : (
                            <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
                                {sortedConnections.map((user) => (
                                    <ConnectionCard
                                        key={user._id}
                                        user={user}
                                        onPin={togglePinChat}
                                        onViewProfile={handleViewProfile}
                                        onNavigate={() => handleNavigateToChat(user._id)}
                                    />
                                ))} 
                            </div>
                        )}
                    </div>
                ) : (
                    /* Group Chats */
                    <div className='mb-8'>
                        <h2 className='text-2xl font-semibold text-gray-800 mb-4'>
                            Your Group Chats ({userGroups.length})
                        </h2>
                        
                        {userGroups.length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-2xl shadow-lg border border-gray-100 transition-all duration-300">
                                <GroupIcon className="w-16 h-16 text-purple-300 mx-auto mb-4 opacity-75" />
                                <h3 className="text-2xl font-bold text-gray-800 mb-2">No Groups Yet</h3>
                                <p className="text-gray-500 max-w-md mx-auto mb-6">
                                    Create your first group chat to start conversations with multiple people at once!
                                </p>
                                <button
                                    onClick={() => setShowCreateGroupModal(true)}
                                    className='inline-flex items-center gap-2 font-semibold text-white bg-purple-600 px-6 py-3 rounded-full hover:bg-purple-700 transition duration-200 shadow-lg shadow-purple-500/30'
                                >
                                    <UserPlus className='w-5 h-5'/>
                                    Create Your First Group
                                </button>
                            </div>
                        ) : (
                            <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
                                {userGroups.map((group) => (
                                    <GroupChatCard
                                        key={group._id}
                                        group={group}
                                        onClick={() => handleGroupChatClick(group._id)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Create Group Modal */}
                <CreateGroupModal
                    isOpen={showCreateGroupModal}
                    onClose={() => setShowCreateGroupModal(false)}
                    connections={connections}
                    onGroupCreated={fetchUserGroups}
                />

                {/* Chat Guide */}
                {isGuideVisible && (
                    <div className="mt-12 p-6 bg-white rounded-2xl shadow-xl border border-blue-100 transition-opacity duration-500">
                        <h4 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2 border-b pb-2 border-blue-100">
                            <MessageSquare className='w-5 h-5 text-blue-500'/> Chat & Group Guide
                        </h4>
                        <div className='mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center gap-6 text-sm text-gray-700'>
                            <span className="font-semibold text-gray-900 flex items-center gap-2">Status Key:</span>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                <span>**Online** (Active Now)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                <span>**Offline** (Last Seen)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Pin className="w-3 h-3 text-purple-500" />
                                <span>**Pinned** (Always on top)</span>
                            </div>
                        </div>
                        
                        <ul className="text-sm text-gray-600 space-y-3">
                            <li className="flex items-start gap-3">
                                <ArrowRight className='w-4 h-4 mt-1 text-blue-500 flex-shrink-0'/>
                                <span>
                                    Click on any **Connection Card** to jump directly into a secure chat window.
                                </span>
                            </li>
                            <li className="flex items-start gap-3">
                                <ArrowRight className='w-4 h-4 mt-1 text-blue-500 flex-shrink-0'/>
                                <span>
                                    Use the <strong>📌 Pin button</strong> to keep important chats at the top of your list for quick access.
                                </span>
                            </li>
                            <li className="flex items-start gap-3">
                                <ArrowRight className='w-4 h-4 mt-1 text-blue-500 flex-shrink-0'/>
                                <span>
                                    Switch to <strong>Group Chats</strong> to create and manage group conversations with multiple people.
                                </span>
                            </li>
                            <li className="flex items-start gap-3">
                                <ArrowRight className='w-4 h-4 mt-1 text-blue-500 flex-shrink-0'/>
                                <span>
                                    Toggle **Notifications ON** to activate the real-time connection and receive instant system alerts for new messages.
                                </span>
                            </li>
                            <li className="flex items-start gap-3">
                                <ArrowRight className='w-4 h-4 mt-1 text-blue-500 flex-shrink-0'/>
                                <span>
                                    The **Online Now** status (green dot) is powered by the **Live Connection**, indicating they are ready to chat instantly.
                                </span>
                            </li>
                            <li className="flex items-start gap-3">
                                <ArrowRight className='w-4 h-4 mt-1 text-blue-500 flex-shrink-0'/>
                                <span>
                                    **Last seen** information displays the user's last recorded activity when they are offline (red dot).
                                </span>
                            </li>
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Messages;