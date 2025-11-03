import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, RefreshCw, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import toast from 'react-hot-toast';

const ChatBot = () => {
    const [messages, setMessages] = useState([
        {
            id: 1,
            text: "Hello! I'm your AI assistant. How can I help you today?",
            isBot: true,
            timestamp: new Date()
        }
    ]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [apiStatus, setApiStatus] = useState('checking'); // checking, online, mock, offline
    const messagesEndRef = useRef(null);
    const { getToken } = useAuth();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Check API status on component mount
    useEffect(() => {
        checkApiStatus();
    }, []);

    // --- API and Status Logic ---

    const checkApiStatus = async () => {
        try {
            setApiStatus('checking');
            const token = await getToken();
            // Use a fallback for VITE_BACKEND_URL in case of undefined environment
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://social-server-nine.vercel.app';
            
            const response = await fetch(`${backendUrl}/api/ai/status`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await response.json();
            
            if (data.success && data.online) {
                setApiStatus(data.status || 'online'); // 'online' or 'mock'
            } else {
                setApiStatus('offline');
            }
        } catch (error) {
            console.error('API status check failed:', error);
            setApiStatus('offline');
        }
    };

    const sendMessage = async () => {
        if (!inputMessage.trim() || isLoading) return;

        const userMessage = {
            id: Date.now(),
            text: inputMessage,
            isBot: false,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputMessage('');
        setIsLoading(true);

        try {
            const token = await getToken();
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://social-server-nine.vercel.app';
            
            const response = await fetch(`${backendUrl}/api/ai/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: userMessage.text,
                    conversation_history: messages.slice(-10)
                })
            });

            const data = await response.json();

            if (data.success) {
                const botMessage = {
                    id: Date.now() + 1,
                    text: data.response,
                    isBot: true,
                    timestamp: new Date(),
                    isMock: data.isMock
                };
                setMessages(prev => [...prev, botMessage]);
                
                // Update status based on response
                if (data.isMock) {
                    setApiStatus('mock');
                } else {
                    setApiStatus('online');
                }
            } else {
                throw new Error(data.message || 'Failed to get response');
            }
        } catch (error) {
            console.error('Chat bot error:', error);
            
            const errorMessage = {
                id: Date.now() + 1,
                text: "I'm having trouble connecting right now. Please try again in a moment.",
                isBot: true,
                timestamp: new Date(),
                isError: true
            };
            setMessages(prev => [...prev, errorMessage]);
            setApiStatus('offline');
            
            toast.error('Failed to send message');
        } finally {
            setIsLoading(false);
        }
    };
    
    // --- Utility Functions ---

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const retryConnection = () => {
        checkApiStatus();
        toast.success('Checking connection status...');
    };

    const getStatusInfo = () => {
        switch (apiStatus) {
            case 'online':
                return {
                    icon: <Wifi className="w-4 h-4" />,
                    text: 'Online',
                    color: 'text-green-600',
                    bgColor: 'bg-green-100',
                    message: 'Connected to DeepSeek AI'
                };
            case 'mock':
                return {
                    icon: <AlertCircle className="w-4 h-4" />,
                    text: 'Demo Mode',
                    color: 'text-yellow-600',
                    bgColor: 'bg-yellow-100',
                    message: 'Using demo responses - Configure API key for real AI'
                };
            case 'offline':
                return {
                    icon: <WifiOff className="w-4 h-4" />,
                    text: 'Offline',
                    color: 'text-red-600',
                    bgColor: 'bg-red-100',
                    message: 'Service unavailable'
                };
            default:
                return {
                    icon: <RefreshCw className="w-4 h-4 animate-spin" />,
                    text: 'Checking...',
                    color: 'text-blue-600',
                    bgColor: 'bg-blue-100',
                    message: 'Checking connection...'
                };
        }
    };

    const statusInfo = getStatusInfo();

    // --- Message Bubble Component ---
    const MessageBubble = ({ message }) => (
        <div
            key={message.id}
            className={`flex ${message.isBot ? 'justify-start' : 'justify-end'} gap-3 max-w-full`}
        >
            {message.isBot && (
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-md ${
                    message.isError 
                        ? 'bg-red-500'
                        : message.isMock
                        ? 'bg-yellow-500'
                        : 'bg-gradient-to-r from-purple-500 to-indigo-600'
                }`}>
                    <Bot className="w-4 h-4 text-white" />
                </div>
            )}
            
            <div className={`flex flex-col max-w-[80%] sm:max-w-[65%] ${!message.isBot && 'items-end'}`}>
                <div
                    // Enhanced Bubble Styling: larger radius, softer shadow, no hard borders
                    className={`rounded-2xl p-3 shadow-lg whitespace-pre-wrap transition-colors duration-150 ${
                        message.isBot
                            ? message.isError
                                ? 'bg-red-50 text-red-800 rounded-tl-lg'
                                : message.isMock
                                ? 'bg-yellow-50 text-yellow-800 rounded-tl-lg'
                                : 'bg-white text-gray-800 shadow-md rounded-tl-lg'
                            : 'bg-indigo-600 text-white rounded-br-lg'
                    }`}
                >
                    <p className="text-sm">{message.text}</p>
                </div>
                <p className="text-xs mt-1 mr-2 text-gray-500">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {message.isMock && ' • Demo'}
                </p>
            </div>

            {!message.isBot && (
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-md">
                    <User className="w-4 h-4 text-white" />
                </div>
            )}
        </div>
    );

    return (
        // Wrapper for full height chat interface (using h-[100dvh] for mobile safety)
        <div className="flex flex-col h-[100dvh] bg-gradient-to-br from-gray-50 to-indigo-50">
            <div className="max-w-4xl mx-auto flex flex-col h-full w-full bg-white shadow-2xl sm:rounded-xl overflow-hidden">
                
                {/* Sticky Header */}
                <div className="sticky top-0 bg-white border-b border-gray-100 shadow-sm z-10 p-4 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-gradient-to-r from-purple-500 to-indigo-600 p-2 rounded-full shadow-lg">
                                <Bot className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-800">PIXO AI Chat</h1>
                                <p className="text-sm text-gray-500">
                                    Your intelligent assistant
                                </p>
                            </div>
                        </div>
                        
                        {/* Status Indicator */}
                        <button 
                            onClick={retryConnection}
                            className={`flex items-center gap-2 px-3 py-1 rounded-full ${statusInfo.bgColor} ${statusInfo.color} text-sm font-medium transition-colors duration-150 hover:shadow-md`}
                            disabled={apiStatus === 'checking'}
                        >
                            {statusInfo.icon}
                            {statusInfo.text}
                        </button>
                    </div>
                    {statusInfo.message && (
                        <p className={`text-xs mt-2 text-center ${statusInfo.color}`}>
                            {statusInfo.message}
                        </p>
                    )}
                </div>

                {/* Messages Container (Scrollable Area) */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/70">
                    {messages.map((message) => (
                        <MessageBubble key={message.id} message={message} />
                    ))}
                    
                    {/* Typing Indicator */}
                    {isLoading && (
                        <div className="flex justify-start gap-3">
                            <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-md">
                                <Bot className="w-4 h-4 text-white" />
                            </div>
                            <div className="bg-white rounded-2xl rounded-tl-lg p-3 shadow-md">
                                <div className="flex space-x-2">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <div ref={messagesEndRef} />
                </div>

                {/* Sticky Input Area */}
                <div className="sticky bottom-0 bg-white p-4 shadow-xl z-10 flex-shrink-0">
                    <div className="flex gap-3 items-end">
                        <textarea
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder={
                                apiStatus === 'offline' 
                                    ? "AI service is offline..."
                                    : "Ask me anything..."
                            }
                            // Removed border, relying on shadow-inner and ring for focus
                            className="flex-1 bg-gray-50 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner disabled:bg-gray-100 disabled:cursor-not-allowed max-h-32 min-h-[3rem] transition-shadow duration-200"
                            rows="1"
                            disabled={isLoading || apiStatus === 'offline'}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={!inputMessage.trim() || isLoading || apiStatus === 'offline'}
                            className="h-12 w-12 flex-shrink-0 bg-gradient-to-r from-indigo-600 to-purple-700 text-white rounded-xl hover:from-indigo-700 hover:to-purple-800 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </div>
                    <p className="text-xs text-gray-400 text-center mt-2">
                        {apiStatus === 'offline' && 'AI service is currently unavailable'}
                        {apiStatus !== 'offline' && 'Press Enter to send, Shift+Enter for new line'}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ChatBot;
