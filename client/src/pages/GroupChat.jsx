import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';
import { 
    ArrowLeft, SendHorizonal, ImageIcon, Smile, Mic, Square, 
    Reply, CornerUpLeft, MoreVertical, Users, Phone, Video,
    Loader, Check, CheckCheck, Clock, Trash2, UserPlus, X
} from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

const GroupChat = () => {
    const { groupId } = useParams();
    const navigate = useNavigate();
    const { getToken } = useAuth();
    const { user: currentUser } = useUser();
    
    const [group, setGroup] = useState(null);
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [eventSource, setEventSource] = useState(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showAddMembers, setShowAddMembers] = useState(false);
    const [newMembers, setNewMembers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [showMessageMenu, setShowMessageMenu] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
    const [isSearching, setIsSearching] = useState(false);
    
    const messagesEndRef = useRef(null);
    const longPressTimer = useRef(null);
    const inputRef = useRef(null);
    const addMembersModalRef = useRef(null);

    // 🆕 FIXED: Enhanced SSE setup with better message handling
    const setupSSE = useCallback(async () => {
        if (!currentUser?.id) return;

        try {
            const token = await getToken();
            if (!token) return;

            if (eventSource) {
                eventSource.close();
            }

            const sseUrl = `https://pixo-toj7.onrender.com/api/sse/${currentUser.id}`;
            const newEventSource = new EventSource(sseUrl, {
                withCredentials: true
            });

            newEventSource.onopen = () => {
                console.log('✅ SSE connection opened for GroupChat');
            };

            newEventSource.onmessage = (event) => {
                try {
                    if (!event.data) return;

                    const data = JSON.parse(event.data);
                    console.log('📨 GroupChat SSE received:', data);
                    
                    switch (data.type) {
                        case 'new_group_message':
                            if (data.message && data.message.group_id === groupId) {
                                console.log('✅ New message for current group:', data.message);
                                
                                // 🆕 FIXED: Simple and reliable message addition
                                setMessages(prev => {
                                    // Check if message already exists
                                    const messageExists = prev.some(msg => 
                                        msg._id === data.message._id || 
                                        (msg.isOptimistic && msg.text === data.message.text)
                                    );
                                    
                                    if (!messageExists) {
                                        console.log('➕ Adding new message to chat');
                                        return [...prev, data.message];
                                    } else {
                                        console.log('⚠️ Message already exists, skipping');
                                        return prev;
                                    }
                                });
                                
                                scrollToBottom();
                                
                                // Play sound for new messages from others
                                if (data.message.from_user_id?._id !== currentUser.id && 
                                    data.message.from_user_id !== currentUser.id) {
                                    playNotificationSound();
                                }
                            }
                            break;
                            
                        case 'group_updated':
                            if (data.groupId === groupId) {
                                console.log('🔄 Group updated, refreshing...');
                                fetchGroupDetails();
                            }
                            break;
                            
                        case 'connected':
                            console.log('✅ SSE Connected successfully');
                            break;
                            
                        case 'heartbeat':
                            // Connection is alive
                            break;
                            
                        default:
                            console.log('📨 Other SSE event:', data.type);
                    }
                } catch (error) {
                    console.error('❌ Error parsing SSE data in GroupChat:', error);
                    console.log('📨 Raw event data that failed:', event.data);
                }
            };

            newEventSource.onerror = (error) => {
                console.error('❌ SSE error in GroupChat:', error);
                console.log('🔌 SSE readyState:', newEventSource.readyState);
                
                // Attempt reconnection after delay
                setTimeout(() => {
                    console.log('🔄 Attempting SSE reconnection...');
                    if (currentUser?.id) {
                        setupSSE();
                    }
                }, 3000);
            };

            setEventSource(newEventSource);

        } catch (error) {
            console.error('❌ Error setting up SSE in GroupChat:', error);
            toast.error('Failed to connect to real-time chat');
        }
    }, [currentUser?.id, groupId, getToken]);

    // 🆕 FIXED: Simplified send message function
    const sendMessage = async () => {
        if (!text.trim()) return;

        const messageText = text.trim();
        setText('');

        try {
            setIsSending(true);
            const token = await getToken();
            
            if (!token) {
                toast.error('Authentication error');
                setText(messageText);
                return;
            }

            // 🆕 Create optimistic message
            const optimisticMessage = {
                _id: `temp-${Date.now()}`,
                text: messageText,
                group_id: groupId,
                from_user_id: {
                    _id: currentUser.id,
                    full_name: currentUser.fullName,
                    profile_picture: currentUser.imageUrl
                },
                message_type: 'text',
                createdAt: new Date().toISOString(),
                created_at: new Date().toISOString(),
                isOptimistic: true
            };
            
            console.log('➕ Adding optimistic message:', optimisticMessage);
            
            // Add optimistic message immediately
            setMessages(prev => [...prev, optimisticMessage]);
            scrollToBottom();

            console.log('📤 Sending group message to server:', { 
                group_id: groupId, 
                text: messageText
            });

            const response = await api.post('/api/groups/message/send', {
                group_id: groupId,
                text: messageText
            }, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('📨 Server response:', response.data);

            if (response.data.success) {
                console.log('✅ Message sent successfully to server');
                // The real message will come via SSE and will be added to the messages array
                // The optimistic message will remain until we receive the real one
            } else {
                throw new Error(response.data.message || 'Failed to send message');
            }
        } catch (error) {
            console.error('❌ Error sending message:', error);
            toast.error('Failed to send message: ' + (error.message || 'Network error'));
            
            // Remove optimistic message on error
            setMessages(prev => prev.filter(msg => !msg.isOptimistic || msg.text !== messageText));
            
            // Restore text if sending failed
            setText(messageText);
        } finally {
            setIsSending(false);
        }
    };

    // 🆕 FIXED: Auto-cleanup optimistic messages that never get replaced
    useEffect(() => {
        const cleanupOptimisticMessages = () => {
            setMessages(prev => {
                const hasOptimistic = prev.some(msg => msg.isOptimistic);
                if (hasOptimistic) {
                    console.log('🧹 Cleaning up old optimistic messages');
                    return prev.filter(msg => !msg.isOptimistic);
                }
                return prev;
            });
        };

        // Cleanup every 10 seconds to remove stuck optimistic messages
        const interval = setInterval(cleanupOptimisticMessages, 10000);
        return () => clearInterval(interval);
    }, []);

    // Search users for adding to group
    const searchUsers = async (query) => {
        if (!query.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        try {
            setIsSearching(true);
            const token = await getToken();
            
            console.log('🔍 Searching users with query:', query);
            
            const response = await api.get(`/api/users/search?q=${encodeURIComponent(query)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            console.log('📊 Search response:', response.data);

            if (response.data.success) {
                const existingMemberIds = group?.members?.map(member => 
                    typeof member === 'object' ? member._id : member
                ) || [];
                
                const filteredResults = response.data.users.filter(user => 
                    !existingMemberIds.includes(user._id) && 
                    user._id !== currentUser.id
                );
                
                console.log('✅ Filtered search results:', filteredResults);
                setSearchResults(filteredResults);
            } else {
                console.log('❌ Search failed:', response.data.message);
                setSearchResults([]);
            }
        } catch (error) {
            console.error('❌ Error searching users:', error);
            toast.error('Failed to search users');
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    // Add user to new members list
    const addToNewMembers = (user) => {
        console.log('➕ Adding user to new members:', user);
        if (!newMembers.find(member => member._id === user._id)) {
            setNewMembers(prev => [...prev, user]);
            toast.success(`Added ${user.full_name} to selection`);
        } else {
            toast.error(`${user.full_name} is already selected`);
        }
        setSearchQuery('');
        setSearchResults([]);
    };

    // Remove user from new members list
    const removeFromNewMembers = (userId) => {
        console.log('➖ Removing user from new members:', userId);
        setNewMembers(prev => prev.filter(member => member._id !== userId));
    };

    // Add members to group
    const addMembersToGroup = async () => {
        if (newMembers.length === 0) {
            toast.error('Please select at least one member to add');
            return;
        }

        try {
            const token = await getToken();
            const memberIds = newMembers.map(member => member._id);
            
            console.log('👥 Adding members to group:', {
                groupId,
                memberIds,
                newMembers
            });

            const response = await api.post(`/api/groups/${groupId}/members`, {
                memberIds: memberIds
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            console.log('📊 Add members response:', response.data);

            if (response.data.success) {
                toast.success(`Successfully added ${newMembers.length} member(s) to group`);
                setNewMembers([]);
                setShowAddMembers(false);
                setSearchQuery('');
                setSearchResults([]);
                fetchGroupDetails();
            } else {
                throw new Error(response.data.message);
            }
        } catch (error) {
            console.error('❌ Error adding members:', error);
            toast.error('Failed to add members: ' + (error.message || 'Please try again'));
        }
    };

    // Reset add members modal
    const resetAddMembersModal = () => {
        setNewMembers([]);
        setSearchQuery('');
        setSearchResults([]);
        setIsSearching(false);
        setShowAddMembers(false);
    };

    // Long press handler for messages
    const handleMessageLongPress = (message, event) => {
        if (message.isOptimistic) return;
        
        longPressTimer.current = setTimeout(() => {
            if (isOwnMessage(message)) {
                setSelectedMessage(message);
                setMenuPosition({ x: event.clientX, y: event.clientY });
                setShowMessageMenu(true);
            }
        }, 500);
    };

    const handleMessageTouchEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
        }
    };

    // Delete message function
    const deleteMessage = async (messageId) => {
        try {
            const token = await getToken();
            const response = await api.delete(`/api/messages/${messageId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                setMessages(prev => prev.filter(msg => msg._id !== messageId));
                toast.success('Message deleted');
            } else {
                throw new Error(response.data.message);
            }
        } catch (error) {
            console.error('Error deleting message:', error);
            toast.error('Failed to delete message');
        } finally {
            setShowMessageMenu(false);
            setSelectedMessage(null);
        }
    };

    // Emoji picker handler
    const addEmoji = (emoji) => {
        setText(prev => prev + emoji.native);
        setShowEmojiPicker(false);
        inputRef.current?.focus();
    };

    const playNotificationSound = () => {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
            console.log('🔔 Notification sound');
        }
    };

    // Fetch group details
    const fetchGroupDetails = async () => {
        try {
            setIsLoading(true);
            const token = await getToken();
            const response = await api.get(`/api/groups/${groupId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                setGroup(response.data.group);
                console.log('✅ Group details loaded:', response.data.group.name);
            } else {
                throw new Error(response.data.message);
            }
        } catch (error) {
            console.error('Error fetching group details:', error);
            toast.error('Failed to load group');
            navigate('/messages');
        } finally {
            setIsLoading(false);
        }
    };

    // 🆕 FIXED: Enhanced fetch group messages with better logging
    const fetchGroupMessages = async () => {
        try {
            const token = await getToken();
            console.log('📨 Fetching group messages for group:', groupId);
            
            const response = await api.post('/api/groups/message/get', {
                group_id: groupId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            console.log('📊 Messages response:', response.data);

            if (response.data.success) {
                console.log(`✅ Loaded ${response.data.messages?.length || 0} messages`);
                setMessages(response.data.messages || []);
                scrollToBottom();
            } else {
                console.log('❌ Failed to load messages:', response.data.message);
            }
        } catch (error) {
            console.error('❌ Error fetching group messages:', error);
            toast.error('Failed to load messages');
        }
    };

    // Search users when query changes
    useEffect(() => {
        if (searchQuery.trim() && group) {
            const timeoutId = setTimeout(() => {
                searchUsers(searchQuery);
            }, 500);
            
            return () => clearTimeout(timeoutId);
        } else {
            setSearchResults([]);
            setIsSearching(false);
        }
    }, [searchQuery, group]);

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ 
                behavior: "smooth",
                block: "end"
            });
        }, 100);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // Format time
    const formatTime = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString([], { 
            hour: '2-digit', minute: '2-digit' 
        });
    };

    // Check if message is from current user
    const isOwnMessage = (message) => {
        return message.from_user_id?._id === currentUser?.id || 
               message.from_user_id === currentUser?.id;
    };

    // Check if user is admin
    const isAdmin = () => {
        return group?.admins?.some(admin => 
            admin._id === currentUser?.id || admin === currentUser?.id
        );
    };

    // 🆕 FIXED: Enhanced useEffect with better dependency tracking
    useEffect(() => {
        if (groupId && currentUser?.id) {
            console.log('🚀 Initializing GroupChat...');
            fetchGroupDetails();
            fetchGroupMessages();
            setupSSE();
        }

        return () => {
            if (eventSource) {
                console.log('🔌 Cleaning up SSE connection');
                eventSource.close();
            }
        };
    }, [groupId, currentUser?.id]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // 🆕 Debug: Log messages state changes
    useEffect(() => {
        console.log('💬 Messages state updated:', {
            total: messages.length,
            optimistic: messages.filter(msg => msg.isOptimistic).length,
            real: messages.filter(msg => !msg.isOptimistic).length,
            messages: messages.map(msg => ({
                id: msg._id,
                text: msg.text,
                isOptimistic: msg.isOptimistic
            }))
        });
    }, [messages]);

    // Close menus when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showMessageMenu && !event.target.closest('.message-context-menu')) {
                setShowMessageMenu(false);
            }
            
            if (showEmojiPicker && !event.target.closest('.emoji-picker-container')) {
                setShowEmojiPicker(false);
            }
            
            if (showAddMembers && addMembersModalRef.current && 
                !addMembersModalRef.current.contains(event.target)) {
                resetAddMembersModal();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showMessageMenu, showEmojiPicker, showAddMembers]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader className="w-8 h-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Loading group...</span>
            </div>
        );
    }

    if (!group) {
        return (
            <div className="flex items-center justify-center h-screen">
                <p className="text-gray-500">Group not found</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            {/* Group Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => navigate('/messages')}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    
                    <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                            {group.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2 className="font-semibold text-gray-900">{group.name}</h2>
                            <p className="text-sm text-gray-500">
                                {group.members?.length || 0} members • {group.onlineMembers || 0} online
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center space-x-2">
                    {isAdmin() && (
                        <button 
                            onClick={() => setShowAddMembers(true)}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            title="Add Members"
                        >
                            <UserPlus className="w-5 h-5 text-gray-600" />
                        </button>
                    )}
                    <button 
                        onClick={() => navigate(`/messages/group/${groupId}/members`)}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        title="Group Members"
                    >
                        <Users className="w-5 h-5 text-gray-600" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <MoreVertical className="w-5 h-5 text-gray-600" />
                    </button>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                            <Users className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-lg font-medium">No messages yet</p>
                        <p className="text-sm">Start the conversation by sending a message!</p>
                    </div>
                ) : (
                    messages.map((message) => (
                        <div
                            key={message._id}
                            className={`flex ${isOwnMessage(message) ? 'justify-end' : 'justify-start'}`}
                        >
                            <div 
                                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl relative ${
                                    isOwnMessage(message) 
                                        ? 'bg-blue-600 text-white rounded-br-none' 
                                        : 'bg-white text-gray-900 border border-gray-200 rounded-bl-none shadow-sm'
                                } ${message.isOptimistic ? 'opacity-70 animate-pulse' : ''} ${
                                    selectedMessage?._id === message._id ? 'ring-2 ring-blue-400' : ''
                                }`}
                                onMouseDown={(e) => handleMessageLongPress(message, e)}
                                onMouseUp={handleMessageTouchEnd}
                                onMouseLeave={handleMessageTouchEnd}
                                onTouchStart={(e) => handleMessageLongPress(message, e)}
                                onTouchEnd={handleMessageTouchEnd}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    if (isOwnMessage(message)) {
                                        handleMessageLongPress(message, e);
                                    }
                                }}
                            >
                                {/* Sender name for others' messages */}
                                {!isOwnMessage(message) && message.from_user_id && (
                                    <p className="text-xs font-medium text-purple-600 mb-1">
                                        {typeof message.from_user_id === 'object' 
                                            ? message.from_user_id.full_name 
                                            : 'User'}
                                    </p>
                                )}
                                
                                {/* Message text */}
                                <p className="text-sm whitespace-pre-wrap break-words">
                                    {message.text}
                                    {message.isOptimistic && (
                                        <span className="text-xs opacity-70 ml-1">(sending...)</span>
                                    )}
                                </p>
                                
                                {/* Message status and time */}
                                <div className={`flex items-center justify-end mt-1 space-x-1 ${
                                    isOwnMessage(message) ? 'text-blue-200' : 'text-gray-500'
                                }`}>
                                    <span className="text-xs">
                                        {formatTime(message.createdAt || message.created_at)}
                                    </span>
                                    {isOwnMessage(message) && (
                                        message.isOptimistic ? (
                                            <Loader className="w-3 h-3 animate-spin" />
                                        ) : (
                                            <CheckCheck className="w-3 h-3" />
                                        )
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Message Context Menu */}
            {showMessageMenu && selectedMessage && (
                <div 
                    className="fixed bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 message-context-menu"
                    style={{
                        left: `${menuPosition.x}px`,
                        top: `${menuPosition.y}px`,
                        transform: 'translate(-50%, -100%)'
                    }}
                >
                    <button
                        onClick={() => deleteMessage(selectedMessage._id)}
                        className="flex items-center space-x-2 px-4 py-2 text-red-600 hover:bg-red-50 w-full text-left"
                    >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete Message</span>
                    </button>
                </div>
            )}

            {/* Add Members Modal */}
            {showAddMembers && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div 
                        ref={addMembersModalRef}
                        className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-hidden"
                    >
                        <div className="flex items-center justify-between p-4 border-b">
                            <h3 className="font-semibold text-lg">Add Members to Group</h3>
                            <button 
                                onClick={resetAddMembersModal}
                                className="p-1 hover:bg-gray-100 rounded"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Search Users
                                </label>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Type to search users by name or username..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                {searchQuery && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        {isSearching ? 'Searching...' : 'Type at least 2 characters to search'}
                                    </p>
                                )}
                            </div>
                            
                            {searchResults.length > 0 && (
                                <div>
                                    <p className="text-sm font-medium text-gray-700 mb-2">Search Results:</p>
                                    <div className="max-h-48 overflow-y-auto border rounded-lg">
                                        {searchResults.map(user => (
                                            <div
                                                key={user._id}
                                                className="flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                                                onClick={() => addToNewMembers(user)}
                                            >
                                                <div className="flex items-center space-x-3">
                                                    <img 
                                                        src={user.profile_picture || '/default-avatar.png'} 
                                                        alt={user.full_name}
                                                        className="w-10 h-10 rounded-full"
                                                        onError={(e) => {
                                                            e.target.src = '/default-avatar.png';
                                                        }}
                                                    />
                                                    <div>
                                                        <p className="font-medium text-sm">{user.full_name}</p>
                                                        <p className="text-xs text-gray-500">@{user.username}</p>
                                                    </div>
                                                </div>
                                                <button className="text-blue-600 text-sm font-medium hover:text-blue-700">
                                                    Add
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {searchQuery && searchResults.length === 0 && !isSearching && (
                                <div className="text-center py-4 text-gray-500">
                                    <Users className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                                    <p>No users found matching "{searchQuery}"</p>
                                </div>
                            )}
                            
                            {newMembers.length > 0 && (
                                <div>
                                    <p className="text-sm font-medium text-gray-700 mb-2">
                                        Selected Members ({newMembers.length}):
                                    </p>
                                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                        {newMembers.map(member => (
                                            <div 
                                                key={member._id}
                                                className="flex items-center space-x-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                                            >
                                                <span>{member.full_name}</span>
                                                <button 
                                                    onClick={() => removeFromNewMembers(member._id)}
                                                    className="hover:text-blue-600 transition-colors"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex justify-end space-x-2 p-4 border-t bg-gray-50">
                            <button
                                onClick={resetAddMembersModal}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={addMembersToGroup}
                                disabled={newMembers.length === 0}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                            >
                                Add {newMembers.length} Member{newMembers.length !== 1 ? 's' : ''}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 p-4 relative emoji-picker-container">
                {showEmojiPicker && (
                    <div className="absolute bottom-full left-0 mb-2 z-10">
                        <Picker 
                            data={data}
                            onEmojiSelect={addEmoji}
                            theme="light"
                            previewPosition="none"
                            skinTonePosition="none"
                        />
                    </div>
                )}
                
                <div className="flex items-center space-x-2">
                    <button 
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <Smile className="w-5 h-5 text-gray-600" />
                    </button>
                    
                    <input
                        ref={inputRef}
                        type="text"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Type a message..."
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={isSending}
                    />
                    
                    <button
                        onClick={sendMessage}
                        disabled={!text.trim() || isSending}
                        className={`p-3 rounded-full transition-colors ${
                            !text.trim() || isSending
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                    >
                        {isSending ? (
                            <Loader className="w-5 h-5 animate-spin" />
                        ) : (
                            <SendHorizonal className="w-5 h-5" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GroupChat;