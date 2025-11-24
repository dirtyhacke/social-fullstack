import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Shuffle, Send, Save, RotateCcw, Loader, MessageSquare, Users, Ghost } from 'lucide-react';
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

    // --- SSE Logic (Omitted for brevity, unchanged) ---
    useEffect(() => { /* ... (Your SSE Logic) ... */
        if (!userId) return;
        const es = new EventSource(`https://pixo-toj7.onrender.com/api/sse/${userId}`);
        es.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'random_chat_message') {
                    setMessages(prev => [...prev, data.data]);
                    toast.success('New message!', { duration: 1000 });
                }
                if (data.type === 'match_found') {
                    setMatchedUser(data.matchedUser);
                    setSessionId(data.sessionId);
                    setIsSearching(false);
                    toast.success('👻 Ghost connected!');
                }
                if (data.type === 'partner_left') {
                    toast.error('👻 Ghost disappeared...');
                    resetChat();
                }
            } catch (error) { console.log('❌ Error parsing SSE message:', error); }
        };
        return () => { es.close(); };
    }, [userId]);

    // Load messages when chat starts (Omitted for brevity, unchanged)
    useEffect(() => { /* ... (Your existing logic) ... */
        if (chatStarted && sessionId) {
            // loadMessages function body
        }
    }, [chatStarted, sessionId]);

    // Fetch online count periodically (Omitted for brevity, unchanged)
    useEffect(() => { /* ... (Your existing logic) ... */
        // getOnlineStats function body
        const intervalId = setInterval(() => { /* getOnlineStats function body */ }, 10000); 
        return () => clearInterval(intervalId);
    }, []);

    
    const loadMessages = async () => { /* ... (Your existing logic) ... */
        if (!sessionId) return;
        try {
            const token = await getToken();
            const { data } = await api.get(`/api/random-chat/messages?sessionId=${sessionId}`, { headers: { Authorization: `Bearer ${token}` } });
            if (data.success) { setMessages(data.messages); }
        } catch (error) { console.log('Error loading messages:', error); }
    };

    const getOnlineStats = async () => { /* ... (Your existing logic) ... */
        try {
            const token = await getToken();
            const { data } = await api.get('/api/random-chat/online', { headers: { Authorization: `Bearer ${token}` } });
            if (data.success) { setOnlineCount(data.onlineCount); }
        } catch (error) { console.log('Error getting online stats:', error); }
    };

    const resetChat = () => { /* ... (Your existing logic) ... */
        setMatchedUser(null);
        setChatStarted(false);
        setMessages([]);
        setSessionId(null);
        setIsSearching(false);
    };

    const startRandomChat = async () => { /* ... (Your existing logic) ... */
        try {
            setIsSearching(true);
            resetChat();
            const token = await getToken();
            const { data } = await api.post('/api/random-chat/join', {}, { headers: { Authorization: `Bearer ${token}` } });
            if (data.success) {
                if (data.matchedUser) {
                    setMatchedUser(data.matchedUser);
                    setSessionId(data.sessionId);
                    setIsSearching(false);
                    toast.success('👻 Ghost connected!');
                } else {
                    getOnlineStats();
                    toast.loading('Summoning a ghost...', { duration: 3000 });
                }
            } else {
                toast.error('Error finding ghost');
                setIsSearching(false);
            }
        } catch (error) {
            toast.error('Error finding ghost');
            setIsSearching(false);
        }
    };

    const skipMatch = async () => { /* ... (Your existing logic) ... */
        try {
            setIsSearching(true);
            toast.loading('Summoning another ghost...');
            const token = await getToken();
            const { data } = await api.post('/api/random-chat/skip', { sessionId }, { headers: { Authorization: `Bearer ${token}` } });
            if (data.success) {
                if (data.matchedUser) {
                    setMatchedUser(data.matchedUser);
                    setSessionId(data.sessionId);
                    setChatStarted(false); 
                    setMessages([]);
                    setIsSearching(false);
                    toast.success('👻 New ghost appeared!');
                } else {
                    setMatchedUser(null);
                    setChatStarted(false);
                    setMessages([]);
                    setSessionId(null);
                    getOnlineStats(); 
                }
            }
        } catch (error) {
            toast.error('Error skipping ghost');
            setIsSearching(false);
        }
    };

    const startChat = () => { /* ... (Your existing logic) ... */
        setChatStarted(true);
        toast.success('Chat started with ghost! 👻');
    };

    const handleSendMessage = async () => { /* ... (Your existing logic) ... */
        if (!message.trim()) return;
        try {
            const token = await getToken();
            const { data } = await api.post('/api/random-chat/send-message', { to_user_id: matchedUser._id, text: message, sessionId }, { headers: { Authorization: `Bearer ${token}` } });
            if (data.success) {
                setMessages(prev => [...prev, data.message]); 
                setMessage('');
            }
        } catch (error) { toast.error('Error sending message'); }
    };

    const saveChat = async () => { /* ... (Your existing logic) ... */
        try {
            const token = await getToken();
            const { data } = await api.post('/api/random-chat/save', { sessionId }, { headers: { Authorization: `Bearer ${token}` } });
            if (data.success) { toast.success('Ghost chat saved! 📁'); }
        } catch (error) { toast.error('Error saving chat'); }
    };

    const endChat = async () => { /* ... (Your existing logic) ... */
        try {
            const token = await getToken();
            await api.post('/api/random-chat/end', { sessionId }, { headers: { Authorization: `Bearer ${token}` } });
            resetChat();
            toast.success('Ghost vanished...');
        } catch (error) { toast.error('Error ending chat'); }
    };


    // --- UI Structure ---

    return (
        // Use h-[100dvh] for reliable viewport height on mobile
        <div className='flex flex-col h-[100dvh] bg-gradient-to-br from-gray-900 to-purple-900'>
            {/* Main Chat Panel - fills screen on mobile, constrained on desktop */}
            <div className='max-w-3xl w-full mx-auto flex flex-col flex-1 bg-gray-800 shadow-2xl 
                            sm:rounded-xl sm:my-8 overflow-hidden'> 
                
                {/* Global Header / Title */}
                <div className='p-4 border-b border-gray-700 bg-gray-900 flex-shrink-0'>
                    <div className='flex items-center justify-between'>
                         <h1 className='text-xl font-bold text-white flex items-center gap-2'>
                            <Ghost className='w-5 h-5 text-purple-400' />
                            Ghost Chat
                        </h1>
                         <button
                            onClick={() => navigate('/')}
                            className='text-gray-400 hover:text-white transition p-1 rounded-full hover:bg-gray-700'
                            title='Close Chat'
                        >
                            <X className='w-6 h-6' />
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className='flex-1 overflow-hidden relative'>
                    
                    {/* State: Searching or No Match */}
                    {!matchedUser && !isSearching && (
                        <div className='flex flex-col items-center justify-center h-full p-8 text-center bg-gray-900'>
                            <Ghost className='w-16 h-16 text-purple-400 mb-4' />
                            <p className='text-xl font-semibold text-white mb-2'>Ready to chat with a ghost?</p>
                            <p className='text-gray-400 mb-6'>Complete anonymity. No profiles. Just pure conversation.</p>
                            <button
                                onClick={startRandomChat}
                                disabled={isSearching}
                                className='py-3 px-8 bg-purple-600 hover:bg-purple-700 text-white rounded-full font-bold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg hover:shadow-xl'
                            >
                                <Shuffle className='w-5 h-5' />
                                Summon Ghost
                            </button>
                            {/* Prominent Online Status Display */}
                            <div className='mt-8 p-3 bg-gray-700 rounded-full inline-flex items-center shadow-inner'>
                                <Users className='w-4 h-4 text-purple-400 mr-2' />
                                <p className='text-sm font-medium text-gray-300'>
                                    <span className='font-extrabold text-white'>{onlineCount}</span> ghosts wandering
                                </p>
                            </div>
                        </div>
                    )}

                    {/* State: Searching */}
                    {isSearching && !matchedUser && (
                        <div className='flex flex-col items-center justify-center h-full p-8 text-center bg-gray-900'>
                             <Loader className='w-10 h-10 text-purple-400 animate-spin mb-4' />
                             <p className='text-xl font-semibold text-white mb-2'>Summoning a ghost...</p>
                             <p className='text-md text-gray-400'>Searching the spirit world for someone to chat with</p>
                             {/* Prominent Online Status Display */}
                             <div className='mt-8 p-3 bg-gray-700 rounded-full inline-flex items-center shadow-inner'>
                                <Users className='w-4 h-4 text-purple-400 mr-2' />
                                <p className='text-sm font-medium text-gray-300'>
                                    <span className='font-extrabold text-white'>{onlineCount}</span> ghosts wandering
                                </p>
                            </div>
                        </div>
                    )}
                    
                    {/* State: Matched, Chat Not Started */}
                    {matchedUser && !chatStarted && (
                        <div className='flex flex-col items-center justify-center h-full p-8 text-center bg-gray-900'>
                            <div className='mb-6 p-6 bg-gray-800 rounded-xl border border-purple-500 shadow-xl w-full max-w-sm'>
                                <div className='w-24 h-24 rounded-full border-4 border-purple-500 bg-gray-700 flex items-center justify-center mx-auto mb-3'>
                                    <Ghost className='w-12 h-12 text-purple-400' />
                                </div>
                                <h3 className='font-bold text-2xl text-white'>@Ghost</h3>
                                <p className='text-sm text-gray-400'>Anonymous User</p>
                                <p className='text-purple-400 font-medium mt-3 text-lg'>
                                    👻 **Ghost Found!**
                                </p>
                                <p className='text-xs text-gray-500 mt-2'>Complete anonymity guaranteed</p>
                            </div>
                            
                            <div className='flex gap-3 w-full max-w-sm'>
                                <button
                                    onClick={startChat}
                                    className='flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition flex items-center justify-center gap-2 shadow-md'
                                >
                                    <MessageCircle className='w-5 h-5' />
                                    Start Chat
                                </button>
                                <button
                                    onClick={skipMatch}
                                    className='w-24 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition flex items-center justify-center gap-2 shadow-md'
                                >
                                    <RotateCcw className='w-4 h-4' />
                                    Skip
                                </button>
                            </div>
                        </div>
                    )}

                    {/* State: Chat Started */}
                    {matchedUser && chatStarted && (
                        <>
                            {/* Sticky Chat Header - Ghost Profile and Actions */}
                            <div className='sticky top-0 bg-gray-800 border-b border-gray-700 p-3 shadow-sm z-10 flex-shrink-0'>
                                <div className='flex items-center justify-between'>
                                    <div className='flex items-center gap-3'>
                                        <div className='w-10 h-10 rounded-full border-2 border-purple-500 bg-gray-700 flex items-center justify-center'>
                                            <Ghost className='w-5 h-5 text-purple-400' />
                                        </div>
                                        <div className='text-left'>
                                            <h3 className='font-bold text-white'>@Ghost</h3>
                                            {/* Pulsing Active Status */}
                                            <div className='flex items-center gap-1 mt-0.5'>
                                                <span className="relative flex h-2 w-2">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                                                </span>
                                                <p className='text-xs font-medium text-gray-400'>Active Now</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className='flex gap-1'>
                                        <button
                                            onClick={saveChat}
                                            className='text-blue-400 hover:bg-gray-700 transition p-2 rounded-full'
                                            title='Save Chat'
                                        >
                                            <Save className='w-5 h-5' />
                                        </button>
                                        <button
                                            onClick={skipMatch}
                                            className='bg-red-600 hover:bg-red-700 text-white rounded-full px-3 py-1.5 text-sm font-medium transition flex items-center gap-1 shadow-md'
                                            title='Summon New Ghost'
                                        >
                                            <RotateCcw className='w-4 h-4' />
                                        </button>
                                        <button
                                            onClick={endChat}
                                            className='text-gray-400 hover:bg-gray-700 transition p-2 rounded-full'
                                            title='End Chat'
                                        >
                                            <X className='w-5 h-5' />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Scrollable Messages Area */}
                            <div className='flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900'>
                                {messages.length === 0 ? (
                                    <div className='h-full flex items-center justify-center flex-col text-center'>
                                        <MessageSquare className='w-10 h-10 text-gray-600 mb-2' />
                                        <p className='text-gray-500 text-sm'>
                                            You are now connected with a ghost. Say something to start the conversation!
                                        </p>
                                    </div>
                                ) : (
                                    messages.map((msg, index) => (
                                        <div key={index} className={`flex ${
                                            msg.from_user_id === userId ? 'justify-end' : 'justify-start'
                                        }`}>
                                            <div className={`max-w-[80%] rounded-2xl p-3 shadow-lg ${
                                                msg.from_user_id === userId
                                                    ? 'bg-purple-600 text-white rounded-br-md'
                                                    : 'bg-gray-700 text-white rounded-bl-md'
                                            }`}>
                                                <p className='text-sm whitespace-pre-wrap'>{msg.text}</p>
                                                <p className={`text-xs mt-1 ${
                                                    msg.from_user_id === userId
                                                        ? 'text-purple-200'
                                                        : 'text-gray-400'
                                                }`}>
                                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                            
                            {/* Sticky Message Input */}
                            <div className='sticky bottom-0 border-t border-gray-700 bg-gray-800 p-4 shadow-lg flex-shrink-0'>
                                <div className='flex gap-2'>
                                    <input
                                        type="text"
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                        placeholder="Message the ghost..."
                                        className='flex-1 border border-gray-600 bg-gray-700 text-white rounded-xl px-4 py-3 text-base focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-900 placeholder-gray-400'
                                    />
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={!message.trim()}
                                        className='bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-4 py-3 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1 shadow-md font-bold'
                                    >
                                        <Send className='w-5 h-5' />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RandomChat;