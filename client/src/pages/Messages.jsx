import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
    MessageSquare, Bell, BellOff, Users, 
    UserPlus, Search, MoreVertical, 
    CheckCircle, AlertCircle, X, ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useAuth, useUser } from '@clerk/clerk-react';
import api from '../api/axios';
import toast from 'react-hot-toast';

// --- Create Group Modal ---
const CreateGroupModal = ({ isOpen, onClose, connections, onGroupCreated }) => {
    const [groupName, setGroupName] = useState('');
    const [groupDescription, setGroupDescription] = useState('');
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const { getToken } = useAuth();

    // Reset state when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setGroupName('');
            setGroupDescription('');
            setSelectedMembers([]);
        }
    }, [isOpen]);

    const handleCreateGroup = async (e) => {
        e.preventDefault(); // STOP PAGE REFRESH
        
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
                onGroupCreated?.();
                onClose();
            }
        } catch (error) {
            console.error('Error creating group:', error);
            toast.error(error.response?.data?.message || 'Failed to create group');
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60] p-0 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg sm:text-xl font-bold text-gray-900">Create New Group</h3>
                        <p className="text-gray-500 text-xs sm:text-sm mt-0.5">Start a conversation</p>
                    </div>
                    <button 
                        onClick={onClose}
                        type="button"
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>
                
                <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
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
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm sm:text-base"
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
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none text-sm sm:text-base"
                            maxLength={200}
                        />
                    </div>

                    {/* Member Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Add Members ({selectedMembers.length})
                        </label>
                        <div className="space-y-2 max-h-40 sm:max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-2">
                            {connections.length === 0 ? (
                                <p className="text-gray-400 text-sm text-center py-4">
                                    No connections available
                                </p>
                            ) : (
                                connections.map(connection => (
                                    <div
                                        key={connection._id}
                                        onClick={() => toggleMemberSelection(connection._id)}
                                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                                            selectedMembers.includes(connection._id)
                                                ? 'bg-blue-50 border border-blue-100'
                                                : 'hover:bg-gray-50 border border-transparent'
                                        }`}
                                    >
                                        <div className="relative">
                                            <img
                                                src={connection.profile_picture || '/default-avatar.png'}
                                                alt={connection.full_name}
                                                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover bg-gray-200"
                                            />
                                            {selectedMembers.includes(connection._id) && (
                                                <div className="absolute -bottom-1 -right-1 bg-white rounded-full">
                                                    <CheckCircle className="w-4 h-4 text-blue-500 fill-white" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm text-gray-900 truncate">
                                                {connection.full_name}
                                            </p>
                                            <p className="text-xs text-gray-500 truncate">
                                                @{connection.username}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-4 sm:p-6 border-t border-gray-100 flex gap-3 bg-white">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors font-medium text-sm sm:text-base"
                        disabled={isLoading}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleCreateGroup}
                        disabled={isLoading || !groupName.trim() || selectedMembers.length === 0}
                        className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
                    >
                        {isLoading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Creating...
                            </>
                        ) : (
                            'Create Group'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Chat Item Component ---
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
            className="flex items-center p-3 sm:p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors duration-200 cursor-pointer group border-b border-gray-100 last:border-0"
        >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
                {isGroup ? (
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-sm">
                        {user.name?.charAt(0).toUpperCase() || 'G'}
                    </div>
                ) : (
                    <div className="relative">
                        <img 
                            src={user.profile_picture || '/default-avatar.png'} 
                            alt={user.full_name}
                            className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover border border-gray-200 bg-gray-50"
                        />
                        {isOnline && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />
                        )}
                    </div>
                )}
            </div>
            
            {/* Chat Info */}
            <div className="flex-1 ml-3 sm:ml-4 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                    <h4 className="font-semibold text-gray-900 truncate text-base">
                        {isGroup ? user.name : user.full_name}
                    </h4>
                    <span className="text-xs text-gray-400 font-medium whitespace-nowrap ml-2">
                        {formatTime(lastMessage?.timestamp)}
                    </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm truncate max-w-[85%] ${unreadCount > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                        {isGroup && lastMessage?.senderName && (
                            <span className="text-gray-900 mr-1">{lastMessage.senderName}:</span>
                        )}
                        {lastMessage?.text || (isGroup ? 'No messages yet' : 'Start a conversation')}
                    </p>
                    {unreadCount > 0 && (
                        <span className="bg-blue-600 text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 sm:py-1 rounded-full min-w-[20px] text-center shadow-sm">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </div>
            </div>

            {/* Options (Hidden on Mobile usually, visible on desktop hover) */}
            <button 
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onOptionsClick(e);
                }}
                className="ml-2 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all hidden sm:block opacity-0 group-hover:opacity-100"
            >
                <MoreVertical className="w-4 h-4" />
            </button>
            
            <ChevronRight className="w-4 h-4 text-gray-300 sm:hidden ml-2" />
        </div>
    );
};

// --- Main Messages Component ---
const Messages = () => {
    const { connections } = useSelector((state) => state.connections);
    const navigate = useNavigate();
    const { user } = useUser();
    const { getToken } = useAuth();
    const eventSourceRef = useRef(null);
    
    // State
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
    const [activeTab, setActiveTab] = useState('chats'); // 'chats' or 'groups'
    const [userGroups, setUserGroups] = useState([]);
    const [loadingGroups, setLoadingGroups] = useState(false);

    // Fetch user's groups
    const fetchUserGroups = useCallback(async () => {
        try {
            setLoadingGroups(true);
            const token = await getToken();
            const response = await api.get('/api/groups/my-groups', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                setUserGroups(response.data.groups || []);
            }
        } catch (error) {
            console.error('Error fetching user groups:', error);
        } finally {
            setLoadingGroups(false);
        }
    }, [getToken]);

    // Setup SSE
    useEffect(() => {
        if (!user?.id) return;

        let eventSource = null;

        const connectSSE = async () => {
            try {
                const token = await getToken();
                const sseUrl = `https://pixo-toj7.onrender.com/api/messages/sse/${user.id}?token=${token}`;
                
                eventSource = new EventSource(sseUrl);
                eventSourceRef.current = eventSource;

                eventSource.onopen = () => {
                    console.log('SSE connection established');
                };

                eventSource.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        
                        if (data.type === 'new_message') {
                            if (notificationsEnabled && "Notification" in window) {
                                new Notification('New Message', {
                                    body: `${data.notification?.from || 'Someone'}: ${data.notification?.body || 'Sent a message'}`,
                                    icon: '/favicon.ico'
                                });
                            }
                        } else if (data.type === 'connected' && data.onlineUsers) {
                            setOnlineUsers(new Set(data.onlineUsers));
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

                eventSource.onerror = (error) => {
                    console.error('SSE connection error:', error);
                    eventSource.close();
                };

            } catch (error) {
                console.error('Error setting up SSE:', error);
            }
        };

        connectSSE();

        return () => {
            if (eventSource) {
                eventSource.close();
            }
        };
    }, [user, getToken, fetchUserGroups, notificationsEnabled]);

    // Initial Load
    useEffect(() => {
        fetchUserGroups();
        if ("Notification" in window && Notification.permission === "granted") {
            setNotificationsEnabled(true);
        }
    }, [fetchUserGroups]);

    // Filter Logic
    const filteredConnections = connections.filter(conn => 
        conn.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conn.username?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredGroups = userGroups.filter(group => 
        group.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const toggleNotifications = async () => {
        if (!notificationsEnabled) {
            const permission = await Notification.requestPermission();
            if (permission === "granted") {
                setNotificationsEnabled(true);
                toast.success('Notifications enabled');
            }
        } else {
            setNotificationsEnabled(false);
            toast.success('Notifications disabled');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
            {/* Header */}
            <div className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 px-4 md:px-6 py-3 md:py-4">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <MessageSquare className="w-6 h-6 text-blue-600" />
                        <h1 className="text-xl font-bold text-gray-900">Messages</h1>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={toggleNotifications}
                            className={`p-2 rounded-full transition-colors ${
                                notificationsEnabled ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-100'
                            }`}
                        >
                            {notificationsEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
                        </button>
                        
                        {/* Mobile Add Group Button */}
                        <button
                            type="button"
                            onClick={() => setShowCreateGroupModal(true)}
                            className="md:hidden p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-md"
                        >
                            <UserPlus className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="pt-20 max-w-6xl mx-auto px-4 md:px-6">
                
                {/* Desktop Top Bar */}
                <div className="hidden md:flex items-center justify-between mb-6">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 px-3 py-1 bg-white border border-gray-200 rounded-full">
                            <Users className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium text-gray-700">
                                {connections.length} connections
                            </span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1 bg-white border border-gray-200 rounded-full">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            <span className="text-sm font-medium text-gray-700">
                                {Array.from(onlineUsers).filter(id => connections.some(c => c._id === id)).length} online
                            </span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setShowCreateGroupModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-sm hover:shadow-md font-medium"
                    >
                        <UserPlus className="w-4 h-4" />
                        <span>New Group</span>
                    </button>
                </div>

                {/* Search & Tabs Container */}
                <div className="sticky top-[60px] md:top-[80px] z-30 bg-gray-50 pt-2 pb-4 space-y-4">
                    {/* Search Bar */}
                    <div className="relative shadow-sm">
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Search messages..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                    </div>

                    {/* Tabs */}
                    <div className="flex p-1 bg-white rounded-xl border border-gray-200 shadow-sm">
                        <button
                            type="button"
                            onClick={() => setActiveTab('chats')}
                            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                                activeTab === 'chats'
                                    ? 'bg-blue-50 text-blue-600 shadow-sm'
                                    : 'text-gray-500 hover:bg-gray-50'
                            }`}
                        >
                            Direct Messages
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('groups')}
                            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                                activeTab === 'groups'
                                    ? 'bg-blue-50 text-blue-600 shadow-sm'
                                    : 'text-gray-500 hover:bg-gray-50'
                            }`}
                        >
                            Groups
                        </button>
                    </div>
                </div>

                {/* List Container */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm min-h-[300px]">
                    {activeTab === 'chats' ? (
                        filteredConnections.length > 0 ? (
                            <div className="divide-y divide-gray-100">
                                {filteredConnections.map(conn => (
                                    <ChatItem
                                        key={conn._id}
                                        user={conn}
                                        isOnline={onlineUsers.has(conn._id)}
                                        lastMessage={null}
                                        unreadCount={0}
                                        isGroup={false}
                                        onClick={() => navigate(`/messages/${conn._id}`)}
                                        onOptionsClick={() => {}}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 px-4">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                    <MessageSquare className="w-8 h-8 text-gray-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">No chats yet</h3>
                                <p className="text-gray-500 text-center mt-1 max-w-xs">
                                    {searchQuery ? 'No results found.' : 'Connect with people to start chatting!'}
                                </p>
                            </div>
                        )
                    ) : (
                        // Groups Tab
                        loadingGroups ? (
                            <div className="flex justify-center items-center py-20">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            </div>
                        ) : filteredGroups.length > 0 ? (
                            <div className="divide-y divide-gray-100">
                                {filteredGroups.map(group => (
                                    <ChatItem
                                        key={group._id}
                                        user={group}
                                        isOnline={true}
                                        lastMessage={{ 
                                            text: group.description || 'Tap to view group',
                                            senderName: ''
                                        }}
                                        unreadCount={0}
                                        isGroup={true}
                                        onClick={() => navigate(`/messages/group/${group._id}`)}
                                        onOptionsClick={() => {}}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 px-4">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                    <Users className="w-8 h-8 text-gray-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">No groups found</h3>
                                <p className="text-gray-500 text-center mt-1 max-w-xs">
                                    Create a group to chat with multiple people at once.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setShowCreateGroupModal(true)}
                                    className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                                >
                                    Create First Group
                                </button>
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