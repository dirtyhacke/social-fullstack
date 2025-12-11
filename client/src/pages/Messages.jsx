import React, { useState, useRef, useEffect } from 'react';
import { 
    MessageSquare, Bell, BellOff, ChevronRight, Users, 
    UserPlus, Search, MoreVertical, Phone, Video, Mail,
    CheckCircle, XCircle, Wifi, WifiOff, Clock
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200">
                <div className="p-6 border-b border-gray-100">
                    <h3 className="text-xl font-bold text-gray-900">Create New Group</h3>
                    <p className="text-gray-500 text-sm mt-1">Start a group chat with your connections</p>
                </div>
                
                <div className="p-6 space-y-4">
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
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                            rows={2}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                            maxLength={200}
                        />
                    </div>

                    {/* Member Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Add Members ({selectedMembers.length} selected)
                        </label>
                        <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-3">
                            {connections.length === 0 ? (
                                <p className="text-gray-400 text-sm text-center py-4">
                                    No connections available
                                </p>
                            ) : (
                                connections.map(connection => (
                                    <div
                                        key={connection._id}
                                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                                            selectedMembers.includes(connection._id)
                                                ? 'bg-blue-50 border border-blue-100'
                                                : 'hover:bg-gray-50'
                                        }`}
                                        onClick={() => toggleMemberSelection(connection._id)}
                                    >
                                        <img
                                            src={connection.profile_picture || '/default-avatar.png'}
                                            alt={connection.full_name}
                                            className="w-10 h-10 rounded-full object-cover border border-gray-200"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm text-gray-900 truncate">
                                                {connection.full_name}
                                            </p>
                                            <p className="text-xs text-gray-500 truncate">
                                                @{connection.username}
                                            </p>
                                        </div>
                                        <div className={`w-5 h-5 border-2 rounded-full flex items-center justify-center ${
                                            selectedMembers.includes(connection._id)
                                                ? 'bg-blue-500 border-blue-500'
                                                : 'border-gray-300'
                                        }`}>
                                            {selectedMembers.includes(connection._id) && (
                                                <CheckCircle className="w-3 h-3 text-white" />
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-gray-100 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors font-medium"
                        disabled={isLoading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreateGroup}
                        disabled={isLoading || !groupName.trim() || selectedMembers.length === 0}
                        className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                Create Group
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Chat Item Component
const ChatItem = ({ user, isOnline, lastMessage, unreadCount, isGroup, onClick, onOptionsClick }) => {
    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const diffInMinutes = Math.floor((now - date) / (1000 * 60));
        
        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m`;
        if (date.getDate() === now.getDate()) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    return (
        <div 
            onClick={onClick}
            className="flex items-center p-4 hover:bg-gray-50 rounded-xl transition-colors duration-200 cursor-pointer group"
        >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
                {isGroup ? (
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white font-bold">
                        {user.name?.charAt(0).toUpperCase() || 'G'}
                    </div>
                ) : (
                    <>
                        <img 
                            src={user.profile_picture || '/default-avatar.png'} 
                            alt={user.full_name}
                            className="w-12 h-12 rounded-xl object-cover border border-gray-200"
                        />
                        <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                            isOnline ? 'bg-green-500' : 'bg-gray-400'
                        }`} />
                    </>
                )}
            </div>
            
            {/* Chat Info */}
            <div className="flex-1 ml-4 min-w-0">
                <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900 truncate">
                        {isGroup ? user.name : user.full_name}
                    </h4>
                    <span className="text-xs text-gray-500">
                        {formatTime(lastMessage?.timestamp)}
                    </span>
                </div>
                <p className="text-sm text-gray-500 truncate mt-1">
                    {lastMessage?.text || 'Start a conversation...'}
                </p>
            </div>

            {/* Unread Badge & Options */}
            <div className="ml-3 flex flex-col items-end gap-2">
                {unreadCount > 0 && (
                    <span className="bg-blue-500 text-white text-xs font-medium px-2 py-1 rounded-full min-w-[20px] text-center">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        onOptionsClick(e);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-opacity"
                >
                    <MoreVertical className="w-4 h-4 text-gray-500" />
                </button>
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
    const [searchQuery, setSearchQuery] = useState('');
    const [isSseConnecting, setIsSseConnecting] = useState(false);
    const [isSseActive, setIsSseActive] = useState(false);
    const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
    const [activeTab, setActiveTab] = useState('chats'); // 'chats' or 'groups'
    const [userGroups, setUserGroups] = useState([]);

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

            const sseUrl = `https://pixo-toj7.onrender.com/api/messages/sse/${currentUserId}?token=${token}`;
            eventSourceRef.current = new EventSource(sseUrl);

            eventSourceRef.current.onopen = () => {
                console.log('SSE connection opened for Messages page');
                setIsSseConnecting(false);
                setIsSseActive(true);
            };

            eventSourceRef.current.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    if (data.type === 'new_message') {
                        // Show notification for new message
                        if ("Notification" in window && Notification.permission === "granted") {
                            new Notification('New Message', {
                                body: `${data.notification?.from || 'Someone'}: ${data.notification?.body || 'Sent a message'}`,
                                icon: '/favicon.ico'
                            });
                        }
                    } else if (data.type === 'connected') {
                        if (data.onlineUsers) {
                            setOnlineUsers(new Set(data.onlineUsers));
                        }
                    } else if (data.type === 'user_online') {
                        setOnlineUsers(prev => new Set(prev).add(data.userId));
                    } else if (data.type === 'user_offline') {
                        setOnlineUsers(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(data.userId);
                            return newSet;
                        });
                    } else if (data.type === 'group_updated') {
                        fetchUserGroups();
                    }
                } catch (error) {
                    console.error('Error parsing SSE data:', error);
                }
            };

            eventSourceRef.current.onerror = (error) => {
                console.error('SSE error:', error);
                setIsSseActive(false);
                setIsSseConnecting(false);
                
                setTimeout(() => {
                    if (user?.id) {
                        setupSSE();
                    }
                }, 5000);
            };

        } catch (error) {
            console.error('Error setting up SSE:', error);
            setIsSseConnecting(false);
            setIsSseActive(false);
        }
    }

    // Toggle notifications
    const toggleNotifications = async () => {
        if (!notificationsEnabled) {
            if ("Notification" in window) {
                const permission = await Notification.requestPermission();
                if (permission === "granted") {
                    setNotificationsEnabled(true);
                    setupSSE();
                    toast.success('Notifications enabled');
                } else {
                    toast.error('Notifications blocked');
                }
            } else {
                setupSSE();
                setNotificationsEnabled(true);
            }
        } else {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
            setOnlineUsers(new Set());
            setIsSseActive(false);
            setNotificationsEnabled(false);
            toast.success('Notifications disabled');
        }
    };

    // Handle chat navigation
    const handleChatClick = (userId) => {
        navigate(`/messages/${userId}`);
    };

    // Handle group chat click
    const handleGroupChatClick = (groupId) => {
        navigate(`/messages/group/${groupId}`);
    };

    // Filter chats based on search
    const filteredConnections = connections.filter(conn => 
        conn.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conn.username?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredGroups = userGroups.filter(group => 
        group.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Initial setup
    useEffect(() => {
        if (user?.id) {
            if ("Notification" in window && Notification.permission === "granted") {
                setNotificationsEnabled(true);
            }
            setupSSE();
            fetchUserGroups();
        }
    }, [user]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, []);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Fixed Header */}
            <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-4">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <MessageSquare className="w-6 h-6 text-blue-600" />
                        <h1 className="text-xl font-bold text-gray-900">Messages</h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={toggleNotifications}
                            className={`p-2 rounded-full transition-colors ${
                                notificationsEnabled && isSseActive
                                    ? 'text-green-600 bg-green-50'
                                    : 'text-gray-500 bg-gray-100'
                            }`}
                            title={notificationsEnabled ? "Turn off notifications" : "Turn on notifications"}
                        >
                            {notificationsEnabled && isSseActive ? (
                                <Bell className="w-5 h-5" />
                            ) : (
                                <BellOff className="w-5 h-5" />
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="pt-20 max-w-6xl mx-auto px-6 pb-8">
                {/* Stats Bar */}
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                            <Users className="w-5 h-5 text-blue-600" />
                            <span className="text-sm text-gray-700">
                                {connections.length} connections
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full" />
                            <span className="text-sm text-gray-700">
                                {Array.from(onlineUsers).filter(id => 
                                    connections.some(c => c._id === id)
                                ).length} online
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={() => setShowCreateGroupModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <UserPlus className="w-4 h-4" />
                        New Group
                    </button>
                </div>

                {/* Search Bar */}
                <div className="mb-6">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Search messages, people, or groups..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="mb-6 flex border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab('chats')}
                        className={`px-6 py-3 font-medium text-sm transition-colors ${
                            activeTab === 'chats'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Chats
                    </button>
                    <button
                        onClick={() => setActiveTab('groups')}
                        className={`px-6 py-3 font-medium text-sm transition-colors ${
                            activeTab === 'groups'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Groups
                    </button>
                </div>

                {/* Chats List */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    {activeTab === 'chats' ? (
                        filteredConnections.length > 0 ? (
                            filteredConnections.map(conn => (
                                <ChatItem
                                    key={conn._id}
                                    user={conn}
                                    isOnline={onlineUsers.has(conn._id)}
                                    lastMessage={{ text: 'Start a conversation...' }}
                                    unreadCount={0}
                                    isGroup={false}
                                    onClick={() => handleChatClick(conn._id)}
                                    onOptionsClick={(e) => {
                                        e.stopPropagation();
                                        // Handle options click
                                    }}
                                />
                            ))
                        ) : (
                            <div className="py-16 text-center">
                                <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500">No conversations yet</p>
                                <p className="text-sm text-gray-400 mt-2">
                                    Start chatting with your connections
                                </p>
                            </div>
                        )
                    ) : (
                        filteredGroups.length > 0 ? (
                            filteredGroups.map(group => (
                                <ChatItem
                                    key={group._id}
                                    user={{ name: group.name }}
                                    isOnline={true}
                                    lastMessage={{ text: group.description || 'Group chat' }}
                                    unreadCount={0}
                                    isGroup={true}
                                    onClick={() => handleGroupChatClick(group._id)}
                                    onOptionsClick={(e) => {
                                        e.stopPropagation();
                                        // Handle group options click
                                    }}
                                />
                            ))
                        ) : (
                            <div className="py-16 text-center">
                                <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500">No groups yet</p>
                                <p className="text-sm text-gray-400 mt-2">
                                    Create a group to start group conversations
                                </p>
                            </div>
                        )
                    )}
                </div>

                {/* Create Group Modal */}
                <CreateGroupModal
                    isOpen={showCreateGroupModal}
                    onClose={() => setShowCreateGroupModal(false)}
                    connections={connections}
                    onGroupCreated={fetchUserGroups}
                />
            </div>
        </div>
    );
};

export default Messages;