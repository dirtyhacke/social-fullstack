import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Shuffle, Send, Save, RotateCcw } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const RandomChat = () => {
    const [isSearching, setIsSearching] = useState(false);
    const [matchedUser, setMatchedUser] = useState(null);
    const [chatStarted, setChatStarted] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [onlineCount, setOnlineCount] = useState(0);
    const messagesEndRef = useRef(null);
    const { getToken, userId } = useAuth();
    const navigate = useNavigate();

    // Scroll to bottom of messages
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // SSE for real-time updates - FIXED
    useEffect(() => {
        if (!userId) return;

        console.log('🔗 Setting up SSE connection for user:', userId);
        
        const es = new EventSource(`https://social-server-nine.vercel.app/api/sse/${userId}`);
        
        es.onopen = () => {
            console.log('✅ SSE connection opened');
        };
        
        es.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('📩 SSE message received:', data);
                
                if (data.type === 'random_chat_message') {
                    setMessages(prev => [...prev, data.data]);
                    toast.success('New message!', { duration: 1000 });
                }
                
                if (data.type === 'match_found') {
                    setMatchedUser(data.matchedUser);
                    setSessionId(data.sessionId);
                    setIsSearching(false);
                    toast.success(`Connected with ${data.matchedUser.full_name}!`);
                }
                
                if (data.type === 'partner_left') {
                    toast.error('Your chat partner has left');
                    resetChat();
                }
                
                if (data.type === 'connected') {
                    console.log('✅ SSE connected successfully');
                }
                
            } catch (error) {
                console.log('❌ Error parsing SSE message:', error);
            }
        };

        es.onerror = (error) => {
            console.log('❌ SSE error:', error);
        };

        return () => {
            console.log('🔌 Closing SSE connection');
            es.close();
        };
    }, [userId]);

    // Load messages when chat starts
    useEffect(() => {
        if (chatStarted && sessionId) {
            loadMessages();
        }
    }, [chatStarted, sessionId]);

    const loadMessages = async () => {
        if (!sessionId) return;
        
        try {
            const token = await getToken();
            const { data } = await api.get(`/api/random-chat/messages?sessionId=${sessionId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data.success) {
                setMessages(data.messages);
            }
        } catch (error) {
            console.log('Error loading messages:', error);
        }
    };

    const getOnlineStats = async () => {
        try {
            const token = await getToken();
            const { data } = await api.get('/api/random-chat/online', {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (data.success) {
                setOnlineCount(data.onlineCount);
            }
        } catch (error) {
            console.log('Error getting online stats:', error);
        }
    };

    const resetChat = () => {
        setMatchedUser(null);
        setChatStarted(false);
        setMessages([]);
        setSessionId(null);
        setIsSearching(false);
    };

    const startRandomChat = async () => {
        try {
            setIsSearching(true);
            resetChat();
            
            const token = await getToken();
            const { data } = await api.post('/api/random-chat/join', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data.success) {
                if (data.matchedUser) {
                    setMatchedUser(data.matchedUser);
                    setSessionId(data.sessionId);
                    setIsSearching(false);
                    toast.success(`🎯 Connected with ${data.matchedUser.full_name}!`);
                } else {
                    getOnlineStats();
                    toast.loading('Looking for someone to chat with...', { duration: 3000 });
                }
            } else {
                toast.error('Error finding chat partner');
                setIsSearching(false);
            }
        } catch (error) {
            toast.error('Error finding chat partner');
            setIsSearching(false);
        }
    };

    const skipMatch = async () => {
        try {
            setIsSearching(true);
            toast.loading('Finding someone new...');
            
            const token = await getToken();
            const { data } = await api.post('/api/random-chat/skip', { sessionId }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data.success) {
                if (data.matchedUser) {
                    setMatchedUser(data.matchedUser);
                    setSessionId(data.sessionId);
                    setChatStarted(false);
                    setMessages([]);
                    setIsSearching(false);
                    toast.success(`🔄 Connected with ${data.matchedUser.full_name}!`);
                } else {
                    getOnlineStats();
                }
            }
        } catch (error) {
            toast.error('Error skipping match');
            setIsSearching(false);
        }
    };

    const startChat = () => {
        setChatStarted(true);
        toast.success('Chat started! Say hello 👋');
    };

    const sendMessage = async () => {
        if (!message.trim()) return;

        try {
            const token = await getToken();
            const { data } = await api.post('/api/random-chat/send-message', {
                to_user_id: matchedUser._id,
                text: message,
                sessionId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data.success) {
                setMessages(prev => [...prev, data.message]);
                setMessage('');
            }
        } catch (error) {
            toast.error('Error sending message');
        }
    };

    const saveChat = async () => {
        try {
            const token = await getToken();
            const { data } = await api.post('/api/random-chat/save', { sessionId }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data.success) {
                toast.success('Chat saved! 📁');
            }
        } catch (error) {
            toast.error('Error saving chat');
        }
    };

    const endChat = async () => {
        try {
            const token = await getToken();
            await api.post('/api/random-chat/end', { sessionId }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            resetChat();
            toast.success('Chat ended');
        } catch (error) {
            toast.error('Error ending chat');
        }
    };

    return (
        <div className='min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center p-4'>
            <div className='bg-white rounded-2xl shadow-xl p-6 max-w-md w-full'>
                <div className='text-center mb-6'>
                    <div className='w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4'>
                        <Shuffle className='w-8 h-8 text-white' />
                    </div>
                    <h1 className='text-2xl font-bold text-gray-800 mb-2'>Random Chat</h1>
                    <p className='text-gray-600'>Chat with random people instantly</p>
                    
                    {isSearching && (
                        <div className='mt-2 text-sm text-purple-600'>
                            <p>👥 {onlineCount} people online</p>
                            <p className='text-xs'>Looking for someone to chat with...</p>
                        </div>
                    )}
                </div>

                {!matchedUser ? (
                    <div className='text-center'>
                        <button
                            onClick={startRandomChat}
                            disabled={isSearching}
                            className='w-full py-4 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white rounded-xl font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3'
                        >
                            {isSearching ? (
                                <>
                                    <div className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin' />
                                    Finding Someone...
                                </>
                            ) : (
                                <>
                                    <Shuffle className='w-5 h-5' />
                                    Start Random Chat
                                </>
                            )}
                        </button>
                    </div>
                ) : !chatStarted ? (
                    <div className='text-center'>
                        <div className='mb-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200'>
                            <div className='flex items-center justify-center gap-3 mb-3'>
                                <img 
                                    src={matchedUser.profile_picture || '/default-avatar.png'} 
                                    alt={matchedUser.full_name}
                                    className='w-16 h-16 rounded-full border-2 border-purple-300 object-cover'
                                    onError={(e) => {
                                        e.target.src = '/default-avatar.png';
                                    }}
                                />
                                <div className='text-left'>
                                    <h3 className='font-semibold text-gray-800'>{matchedUser.full_name}</h3>
                                    <p className='text-sm text-gray-600'>@{matchedUser.username}</p>
                                    {matchedUser.bio && (
                                        <p className='text-xs text-gray-500 mt-1'>{matchedUser.bio}</p>
                                    )}
                                </div>
                            </div>
                            <p className='text-purple-700 text-sm font-medium'>
                                🎉 Connected with {matchedUser.full_name}!
                            </p>
                        </div>
                        
                        <div className='flex gap-3'>
                            <button
                                onClick={startChat}
                                className='flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition flex items-center justify-center gap-2'
                            >
                                <MessageCircle className='w-4 h-4' />
                                Start Chat
                            </button>
                            <button
                                onClick={skipMatch}
                                className='flex-1 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg font-semibold transition flex items-center justify-center gap-2'
                            >
                                <RotateCcw className='w-4 h-4' />
                                Next
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className='text-center'>
                        <div className='flex items-center justify-between mb-4'>
                            <div className='flex items-center gap-3'>
                                <img 
                                    src={matchedUser.profile_picture || '/default-avatar.png'} 
                                    alt={matchedUser.full_name}
                                    className='w-10 h-10 rounded-full border-2 border-purple-300 object-cover'
                                    onError={(e) => {
                                        e.target.src = '/default-avatar.png';
                                    }}
                                />
                                <div className='text-left'>
                                    <h3 className='font-semibold text-gray-800 text-sm'>{matchedUser.full_name}</h3>
                                    <p className='text-xs text-green-500'>● Online</p>
                                </div>
                            </div>
                            <div className='flex gap-2'>
                                <button
                                    onClick={skipMatch}
                                    className='bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg px-3 py-2 text-sm font-medium transition flex items-center gap-1'
                                >
                                    <RotateCcw className='w-4 h-4' />
                                    Next
                                </button>
                                <button
                                    onClick={saveChat}
                                    className='text-blue-500 hover:text-blue-700 transition p-2'
                                    title='Save Chat'
                                >
                                    <Save className='w-5 h-5' />
                                </button>
                                <button
                                    onClick={endChat}
                                    className='text-gray-400 hover:text-gray-600 transition p-2'
                                >
                                    <X className='w-5 h-5' />
                                </button>
                            </div>
                        </div>
                        
                        {/* Chat Messages */}
                        <div className='bg-gray-50 rounded-lg p-4 h-60 mb-4 overflow-y-auto'>
                            {messages.length === 0 ? (
                                <div className='h-full flex items-center justify-center flex-col'>
                                    <MessageCircle className='w-8 h-8 text-gray-400 mb-2' />
                                    <p className='text-gray-500 text-sm'>
                                        No messages yet. Say hello to start the conversation!
                                    </p>
                                </div>
                            ) : (
                                <div className='space-y-2'>
                                    {messages.map((msg, index) => (
                                        <div key={index} className={`text-left ${
                                            msg.from_user_id._id === matchedUser._id 
                                                ? 'bg-white p-3 rounded-lg border shadow-sm' 
                                                : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white p-3 rounded-lg ml-4 shadow-sm'
                                        }`}>
                                            <p className='text-sm'>{msg.text}</p>
                                            <p className={`text-xs mt-1 ${
                                                msg.from_user_id._id === matchedUser._id 
                                                    ? 'text-gray-500' 
                                                    : 'text-purple-100'
                                            }`}>
                                                {new Date(msg.createdAt).toLocaleTimeString()}
                                            </p>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </div>
                            )}
                        </div>
                        
                        {/* Message Input */}
                        <div className='flex gap-2'>
                            <input
                                type="text"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                                placeholder="Type a message..."
                                className='flex-1 border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200'
                            />
                            <button
                                onClick={sendMessage}
                                disabled={!message.trim()}
                                className='bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg px-4 py-3 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1'
                            >
                                <Send className='w-4 h-4' />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RandomChat;