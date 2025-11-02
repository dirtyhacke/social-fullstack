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

    const checkApiStatus = async () => {
        try {
            setApiStatus('checking');
            const token = await getToken();
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
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
            
            const response = await fetch(`${backendUrl}/api/ai/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: inputMessage,
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

    return (
        <div className="max-w-4xl mx-auto p-4 h-screen flex flex-col">
            {/* Header */}
            <div className="bg-white rounded-lg shadow-sm border p-4 mb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-r from-purple-500 to-indigo-600 p-2 rounded-full">
                            <Bot className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-gray-800">PIXO Chat Bot</h1>
                            <p className="text-sm text-gray-600">
                                {apiStatus === 'online' ? 'Powered by Team PIXO' : 'AI Assistant'}
                            </p>
                        </div>
                    </div>
                    
                    {/* Status Indicator */}
                    <button 
                        onClick={retryConnection}
                        className={`flex items-center gap-2 px-3 py-1 rounded-full ${statusInfo.bgColor} ${statusInfo.color} transition-colors hover:opacity-80`}
                    >
                        {statusInfo.icon}
                        <span className="text-sm font-medium">{statusInfo.text}</span>
                    </button>
                </div>
                {statusInfo.message && (
                    <p className={`text-xs mt-2 ${statusInfo.color}`}>
                        {statusInfo.message}
                    </p>
                )}
            </div>

            {/* Messages Container */}
            <div className="flex-1 bg-gray-50 rounded-lg border overflow-hidden flex flex-col">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((message) => (
                        <div
                            key={message.id}
                            className={`flex ${message.isBot ? 'justify-start' : 'justify-end'} gap-3`}
                        >
                            {message.isBot && (
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                    message.isError 
                                        ? 'bg-red-500'
                                        : message.isMock
                                        ? 'bg-yellow-500'
                                        : 'bg-gradient-to-r from-purple-500 to-indigo-600'
                                }`}>
                                    <Bot className="w-4 h-4 text-white" />
                                </div>
                            )}
                            
                            <div
                                className={`max-w-[70%] rounded-2xl p-4 ${
                                    message.isBot
                                        ? message.isError
                                            ? 'bg-red-50 border border-red-200 text-red-800 rounded-tl-none'
                                            : message.isMock
                                            ? 'bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-tl-none'
                                            : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
                                        : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-tr-none'
                                }`}
                            >
                                <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                                <p className={`text-xs mt-2 ${
                                    message.isBot 
                                        ? message.isError 
                                            ? 'text-red-600'
                                            : message.isMock
                                            ? 'text-yellow-600'
                                            : 'text-gray-500'
                                        : 'text-indigo-100'
                                }`}>
                                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    {message.isMock && ' • Demo'}
                                </p>
                            </div>

                            {!message.isBot && (
                                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-full flex items-center justify-center flex-shrink-0">
                                    <User className="w-4 h-4 text-white" />
                                </div>
                            )}
                        </div>
                    ))}
                    
                    {isLoading && (
                        <div className="flex justify-start gap-3">
                            <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                                <Bot className="w-4 h-4 text-white" />
                            </div>
                            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-none p-4">
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

                {/* Input Area */}
                <div className="border-t bg-white p-4">
                    <div className="flex gap-2">
                        <textarea
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder={
                                apiStatus === 'offline' 
                                    ? "Service is offline. Please try again later..."
                                    : "Type your message here..."
                            }
                            className="flex-1 border border-gray-300 rounded-lg px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                            rows="1"
                            disabled={isLoading || apiStatus === 'offline'}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={!inputMessage.trim() || isLoading || apiStatus === 'offline'}
                            className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-3 rounded-lg hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                        >
                            <Send className="w-4 h-4" />
                            Send
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 text-center mt-2">
                        {apiStatus === 'offline' && 'AI service is currently unavailable'}
                        {apiStatus !== 'offline' && 'Press Enter to send, Shift+Enter for new line'}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ChatBot;