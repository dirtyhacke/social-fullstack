import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Send, Bot, User, RefreshCw, AlertCircle, Wifi, WifiOff, Loader, Globe, Search, Languages, MessageSquare, Globe2, LanguagesIcon } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import toast from 'react-hot-toast';

// --- Static Language Data for Selector (MAXIMIZED, RELIABLE LIST) ---
// This list contains all widely-supported ISO 639-1 codes for stability.
const RAW_LANGUAGES = [
    // Major World Languages (from your original list)
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'zh', name: 'Chinese (Simplified)' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'it', name: 'Italian' },
    { code: 'ar', name: 'Arabic' },
    { code: 'hi', name: 'Hindi' },
    { code: 'bn', name: 'Bengali' },
    { code: 'nl', name: 'Dutch' },
    { code: 'sv', name: 'Swedish' },
    { code: 'pl', name: 'Polish' },
    { code: 'tr', name: 'Turkish' },
    { code: 'vi', name: 'Vietnamese' },
    { code: 'th', name: 'Thai' },
    { code: 'id', name: 'Indonesian' },
    
    // Additional Significant Languages
    { code: 'ur', name: 'Urdu' },
    { code: 'fa', name: 'Persian (Farsi)' },
    { code: 'my', name: 'Burmese' },
    { code: 'ug', name: 'Uyghur' },
    { code: 'uz', name: 'Uzbek' },
    { code: 'az', name: 'Azerbaijani' },
    { code: 'kk', name: 'Kazakh' },
    { code: 'tk', name: 'Turkmen' },
    { code: 'ky', name: 'Kyrgyz' },
    { code: 'tg', name: 'Tajik' },
    
    // African Languages
    { code: 'sw', name: 'Swahili' },
    { code: 'am', name: 'Amharic' },
    { code: 'yo', name: 'Yoruba' },
    { code: 'ig', name: 'Igbo' },
    { code: 'ha', name: 'Hausa' },
    { code: 'so', name: 'Somali' },
    { code: 'zu', name: 'Zulu' },
    { code: 'xh', name: 'Xhosa' },
    { code: 'rw', name: 'Kinyarwanda' },
    { code: 'sn', name: 'Shona' },
    
    // South Asian Languages
    { code: 'ta', name: 'Tamil' },
    { code: 'te', name: 'Telugu' },
    { code: 'mr', name: 'Marathi' },
    { code: 'gu', name: 'Gujarati' },
    { code: 'kn', name: 'Kannada' },
    { code: 'ml', name: 'Malayalam' },
    { code: 'pa', name: 'Punjabi' },
    { code: 'or', name: 'Odia' },
    { code: 'as', name: 'Assamese' },
    { code: 'mai', name: 'Maithili' },
    
    // Southeast Asian Languages
    { code: 'ms', name: 'Malay' },
    { code: 'fil', name: 'Filipino' }, 
    { code: 'km', name: 'Khmer' },
    { code: 'lo', name: 'Lao' },
    { code: 'tet', name: 'Tetum' },
    
    // European Regional Languages
    { code: 'ca', name: 'Catalan' },
    { code: 'eu', name: 'Basque' },
    { code: 'gl', name: 'Galician' },
    { code: 'gd', name: 'Scottish Gaelic' },
    { code: 'cy', name: 'Welsh' },
    { code: 'br', name: 'Breton' },
    { code: 'fy', name: 'Frisian' },
    { code: 'lb', name: 'Luxembourgish' },
    
    // Indigenous and Regional Languages
    { code: 'qu', name: 'Quechua' },
    { code: 'ay', name: 'Aymara' },
    { code: 'gn', name: 'Guarani' },
    { code: 'iu', name: 'Inuktitut' },
    { code: 'cr', name: 'Cree' },
    { code: 'oj', name: 'Ojibwe' },
    
    // Classical and Historical Languages
    { code: 'la', name: 'Latin' },
    { code: 'grc', name: 'Ancient Greek' },
    { code: 'sa', name: 'Sanskrit' },
    { code: 'pal', name: 'Pali' },
    
    // Constructed Languages
    { code: 'eo', name: 'Esperanto' },
    { code: 'vo', name: 'Volapük' },
    { code: 'io', name: 'Ido' },
    { code: 'ia', name: 'Interlingua' }
];

// Process the static list once
const LANGUAGES = (() => {
    let list = [...RAW_LANGUAGES];
    list.sort((a, b) => a.name.localeCompare(b.name));
    const englishIndex = list.findIndex(l => l.code === 'en');
    if (englishIndex !== -1) {
        const english = list.splice(englishIndex, 1)[0];
        list.unshift(english);
    }
    return list;
})();


// *** API CONFIGURATION: Unofficial Google Translate API Endpoint ***
const GOOGLE_API_URL = 'https://translate.googleapis.com/translate_a/single';
const SOURCE_LANG_CODE = 'en'; // Assuming all bot responses are in English

/**
 * Translates the entire text using a single GET request to the Unofficial Google Translate API.
 */
const realTranslate = async (text, targetLang) => {
    if (targetLang === SOURCE_LANG_CODE) return text;
    if (!text) return "";

    try {
        const params = new URLSearchParams({
            client: 'gtx',
            sl: SOURCE_LANG_CODE,
            tl: targetLang,
            dt: 't',
            q: text
        });

        const fullUrl = `${GOOGLE_API_URL}?${params.toString()}`;

        const response = await fetch(fullUrl, {
            headers: {
                'Accept': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`Translation service returned status ${response.status}.`);
        }
        
        const data = await response.json();

        // The unofficial Google API returns an array of arrays: [[[translated_text, original_text, ...]]]
        // We join the first element of each inner array (the translated segments)
        if (Array.isArray(data) && Array.isArray(data[0])) {
            const translatedSegments = data[0].map(segment => segment[0]);
            return translatedSegments.join('');
        } else {
            throw new Error('Translation failed: Invalid response format from API.');
        }

    } catch (error) {
        console.error("Failed to translate text:", error);
        
        if (error.message.includes('Failed to fetch')) {
             return 'Translation failed: Network error (CORS/firewall/downtime). Try refreshing or selecting a different language.';
        }
        return `Translation failed: ${error.message}`;
    }
};
// --- End REAL Translation Function ---


const ChatBot = () => {
    const [messages, setMessages] = useState([
        {
            id: 1,
            text: "Hello! I'm your AI assistant. I've updated the translator to use a different public API, which should fix connection issues. How can I help you today?",
            isBot: true,
            timestamp: new Date()
        }
    ]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [apiStatus, setApiStatus] = useState('checking');
    
    // State is now based on the reliable static list
    const [allLanguages] = useState(LANGUAGES);
    const [languagesLoading] = useState(false); 

    const [targetLanguage, setTargetLanguage] = useState('en'); 
    const [languageSearchTerm, setLanguageSearchTerm] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    
    const messagesEndRef = useRef(null);
    const dropdownRef = useRef(null);
    const { getToken } = useAuth(); 

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        checkApiStatus();
    }, []);

    // Logic to close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [dropdownRef]);


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
                setApiStatus(data.status || 'online');
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
                    color: 'text-emerald-600',
                    bgColor: 'bg-emerald-50',
                    message: 'Connected to Pixo AI'
                };
            case 'mock':
                return {
                    icon: <AlertCircle className="w-4 h-4" />,
                    text: 'Demo Mode',
                    color: 'text-amber-600',
                    bgColor: 'bg-amber-50',
                    message: 'Using demo responses - Configure API key for real AI'
                };
            case 'offline':
                return {
                    icon: <WifiOff className="w-4 h-4" />,
                    text: 'Offline',
                    color: 'text-rose-600',
                    bgColor: 'bg-rose-50',
                    message: 'Service unavailable'
                };
            default:
                return {
                    icon: <Loader className="w-4 h-4 animate-spin" />,
                    text: 'Checking...',
                    color: 'text-sky-600',
                    bgColor: 'bg-sky-50',
                    message: 'Checking connection...'
                };
        }
    };

    const statusInfo = getStatusInfo();
    const currentLangName = allLanguages.find(l => l.code === targetLanguage)?.name || 'English';

    const handleSelectLanguage = (code) => {
        setTargetLanguage(code);
        setIsDropdownOpen(false);
        setLanguageSearchTerm('');
    };

    // Filtered languages based on search term
    const filteredLanguages = useMemo(() => {
        if (!languageSearchTerm) return allLanguages;
        const lowerCaseSearch = languageSearchTerm.toLowerCase();
        return allLanguages.filter(lang => 
            lang.name.toLowerCase().includes(lowerCaseSearch) || 
            lang.code.toLowerCase().includes(lowerCaseSearch)
        );
    }, [languageSearchTerm, allLanguages]);

    const MessageBubble = ({ message }) => {
        const [translatedText, setTranslatedText] = useState(null);
        const [isTranslating, setIsTranslating] = useState(false);
        // NEW STATE: 'translated' to show translation, 'original' to show English original
        const [viewMode, setViewMode] = useState(message.isBot ? 'translated' : 'default');

        useEffect(() => {
            if (message.isBot) {
                const translateMessage = async () => {
                    if (targetLanguage === 'en') {
                        setTranslatedText(null);
                        // If language is English, default to original
                        setViewMode('original'); 
                        return;
                    }
                    
                    setTranslatedText(null); 
                    setViewMode('translated'); // Set default view to translated when a new translation starts
                    
                    setIsTranslating(true);
                    try {
                        const translated = await realTranslate(message.text, targetLanguage);
                        setTranslatedText(translated);
                        // If translation fails, switch back to original view
                        if (translated.startsWith('Translation failed:')) {
                            setViewMode('original');
                        }
                    } catch (error) {
                        setTranslatedText("Translation failed.");
                        setViewMode('original');
                    } finally {
                        setIsTranslating(false);
                    }
                };
                
                translateMessage();
            }
        }, [message.isBot, message.text, targetLanguage]);
        
        // Determine the text to display based on viewMode
        const getDisplayText = () => {
            if (message.isBot) {
                if (isTranslating) {
                    return 'Translating...';
                }
                
                // If translation failed, always show original
                if (translatedText && translatedText.startsWith('Translation failed:')) {
                    return message.text;
                }

                if (viewMode === 'original' || targetLanguage === 'en') {
                    return message.text;
                }
                
                if (viewMode === 'translated' && translatedText) {
                    return translatedText;
                }
            }
            // Default for user messages or if translation hasn't loaded/failed
            return message.text;
        };

        const displayText = getDisplayText();

        const translationReady = translatedText && !translatedText.startsWith('Translation failed:') && targetLanguage !== 'en';

        return (
            <div
                key={message.id}
                className={`flex ${message.isBot ? 'justify-start' : 'justify-end'} gap-3 max-w-full`}
            >
                {message.isBot && (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-md ${
                        message.isError 
                            ? 'bg-rose-500'
                            : message.isMock
                            ? 'bg-amber-500'
                            : 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-300/50'
                    }`}>
                        <Bot className="w-4 h-4 text-white" />
                    </div>
                )}
                
                <div className={`flex flex-col max-w-[80%] sm:max-w-[65%] ${!message.isBot && 'items-end'}`}>
                    <div
                        className={`rounded-2xl p-3.5 shadow-xl transition-colors duration-150 text-base ${
                            message.isBot
                                ? message.isError
                                    ? 'bg-rose-50 text-rose-800 border border-rose-200 rounded-tl-sm'
                                    : message.isMock
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200 rounded-tl-sm'
                                    : 'bg-white text-gray-800 shadow-lg border border-gray-100 rounded-tl-sm'
                                : 'bg-indigo-600 text-white shadow-xl shadow-indigo-300/50 rounded-br-sm'
                        }`}
                    >
                        {isTranslating && message.isBot ? (
                            <div className="flex items-center text-sm text-gray-500">
                                <Loader className="w-4 h-4 mr-2 animate-spin" />
                                Translating to {currentLangName}...
                            </div>
                        ) : (
                            <p className="whitespace-pre-wrap">{displayText}</p>
                        )}

                        {/* Translation Toggle Buttons (Only show for bot messages when translation is ready) */}
                        {message.isBot && translationReady && (
                            <div className="flex space-x-2 mt-3 pt-3 border-t border-gray-100">
                                <button
                                    onClick={() => setViewMode('translated')}
                                    className={`flex items-center text-xs font-semibold px-3 py-1 rounded-lg transition-colors ${
                                        viewMode === 'translated' 
                                            ? 'bg-indigo-500 text-white shadow-md' 
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                    title={`View message in ${currentLangName}`}
                                >
                                    <Languages className="w-3.5 h-3.5 mr-1" />
                                    View Translation
                                </button>
                                <button
                                    onClick={() => setViewMode('original')}
                                    className={`flex items-center text-xs font-semibold px-3 py-1 rounded-lg transition-colors ${
                                        viewMode === 'original' 
                                            ? 'bg-indigo-500 text-white shadow-md' 
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                    title="View message in English"
                                >
                                    <MessageSquare className="w-3.5 h-3.5 mr-1" />
                                    View Original
                                </button>
                            </div>
                        )}
                        
                        {/* Display a permanent error if translation failed */}
                        {message.isBot && translatedText && translatedText.startsWith('Translation failed:') && (
                            <p className="text-xs text-rose-500 mt-2 pt-2 border-t border-rose-100 italic">
                                {translatedText}
                            </p>
                        )}
                    </div>
                    <p className="text-xs mt-1 mr-2 text-gray-400 font-light">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {message.isMock && ' • Demo'}
                    </p>
                </div>

                {!message.isBot && (
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-lg shadow-blue-300/50">
                        <User className="w-4 h-4 text-white" />
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-[100dvh] bg-gradient-to-br from-gray-50 to-blue-50">
            {/* Custom CSS for Animations */}
            <style jsx="true">{`
                /* Keyframes for the blinking red light */
                @keyframes pulse-fast-red {
                    0%, 100% { 
                        background-color: #ef4444; 
                        box-shadow: 0 0 8px #ef4444; 
                    }
                    50% { 
                        background-color: transparent; 
                        box-shadow: none; 
                    }
                }

                /* Keyframes for the blinking green light */
                @keyframes pulse-fast-green {
                    0%, 100% { 
                        background-color: #22c55e; 
                        box-shadow: 0 0 8px #22c55e; 
                    }
                    50% { 
                        background-color: transparent; 
                        box-shadow: none; 
                    }
                }

                /* Keyframes for the slow, subtle robot motion */
                @keyframes pulse-slow {
                    0%, 100% { 
                        transform: rotate(6deg) scale(1); 
                    }
                    50% { 
                        transform: rotate(-6deg) scale(1.02); 
                    }
                }

                /* Animation classes */
                .animate-pulse-fast-red {
                    animation: pulse-fast-red 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
                .animate-pulse-fast-green {
                    animation: pulse-fast-green 1s cubic-bezier(0.4, 0, 0.6, 1) infinite 0.5s;
                }
                .animate-pulse-slow {
                    animation: pulse-slow 8s ease-in-out infinite;
                }
                
                /* Style for custom scrollbar in dropdown */
                .language-list::-webkit-scrollbar {
                    width: 6px;
                }
                .language-list::-webkit-scrollbar-track {
                    background: #f1f1f1;
                }
                .language-list::-webkit-scrollbar-thumb {
                    background: #ccc;
                    border-radius: 3px;
                }
                .language-list::-webkit-scrollbar-thumb:hover {
                    background: #555;
                }
            `}</style>
            
            <div className="max-w-5xl mx-auto flex flex-col h-full w-full bg-white shadow-3xl sm:rounded-2xl overflow-hidden">
                
                <div className="sticky top-0 bg-white border-b border-gray-100 shadow-md z-10 p-4 sm:p-5 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            {/* Animated Robot Logo */}
                            <div className="relative w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center shadow-lg transform rotate-6 animate-pulse-slow">
                                <Bot className="w-6 h-6 text-white" />
                                {/* Antenna Lights */}
                                <div className="absolute top-1 right-2 w-2 h-2 rounded-full animate-pulse-fast-red"></div>
                                <div className="absolute top-1 left-2 w-2 h-2 rounded-full animate-pulse-fast-green"></div>
                            </div>
                            <div>
                                <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">PIXO AI Chat</h1>
                                <p className="text-sm text-gray-500">
                                    Your intelligent assistant
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            {/* Searchable Language Selector */}
                            <div className="relative" ref={dropdownRef}>
                                <button
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100/80 border border-gray-200 text-gray-600 text-sm font-medium transition-colors hover:bg-gray-200/80"
                                    title="Select Target Translation Language"
                                >
                                    <LanguagesIcon className="w-4 h-4 text-indigo-500" />
                                    <span className="truncate max-w-[80px]">{currentLangName}</span>
                                </button>
                                
                                {isDropdownOpen && (
                                    <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-2xl z-20 overflow-hidden">
                                        <div className="p-2 border-b border-gray-100 flex items-center">
                                            <Search className="w-4 h-4 text-gray-400 ml-1 mr-2 flex-shrink-0" />
                                            <input
                                                type="text"
                                                placeholder="Search language..."
                                                className="w-full text-sm py-1 focus:outline-none placeholder-gray-400 text-gray-700"
                                                value={languageSearchTerm}
                                                onChange={(e) => setLanguageSearchTerm(e.target.value)}
                                                autoFocus
                                            />
                                        </div>
                                        <ul className="language-list max-h-60 overflow-y-auto divide-y divide-gray-50">
                                            {filteredLanguages.length > 0 ? (
                                                filteredLanguages.map((lang) => (
                                                    <li
                                                        key={lang.code}
                                                        onClick={() => handleSelectLanguage(lang.code)}
                                                        className={`px-4 py-2 text-sm cursor-pointer hover:bg-indigo-50 transition-colors ${
                                                            lang.code === targetLanguage ? 'bg-indigo-100 font-semibold text-indigo-700' : 'text-gray-700'
                                                        }`}
                                                    >
                                                        {lang.name} <span className="text-gray-400 text-xs">({lang.code})</span>
                                                    </li>
                                                ))
                                            ) : (
                                                <li className="px-4 py-3 text-sm text-gray-500 text-center">
                                                    No languages found matching "{languageSearchTerm}".
                                                </li>
                                            )}
                                        </ul>
                                    </div>
                                )}
                            </div>
                            
                            {/* Existing: Status Button */}
                            <button 
                                onClick={retryConnection}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${statusInfo.bgColor} ${statusInfo.color} text-sm font-medium transition-all duration-300 border border-transparent hover:border-current hover:shadow-md active:scale-95`}
                                disabled={apiStatus === 'checking'}
                                title="Click to re-check connection status"
                            >
                                <span className="hidden sm:inline">{statusInfo.text}</span>
                                {statusInfo.icon}
                            </button>
                        </div>
                    </div>
                    {statusInfo.message && (
                        <p className={`text-xs mt-3 text-center ${statusInfo.color} font-medium`}>
                            {statusInfo.message}
                        </p>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-gray-50">
                    {messages.map((message) => (
                        <MessageBubble key={message.id} message={message} />
                    ))}
                    
                    {isLoading && (
                        <div className="flex justify-start gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-md">
                                <Bot className="w-4 h-4 text-white" />
                            </div>
                            <div className="bg-white rounded-2xl rounded-tl-sm p-3 shadow-lg border border-gray-100">
                                <p className="text-sm text-gray-600 font-medium animate-pulse">AI is typing...</p>
                            </div>
                        </div>
                    )}
                    
                    <div ref={messagesEndRef} />
                </div>

                <div className="sticky bottom-0 bg-white p-4 sm:p-6 border-t border-gray-100 shadow-2xl z-10 flex-shrink-0">
                    <div className="flex gap-3 items-end">
                        <textarea
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder={
                                apiStatus === 'offline' 
                                    ? "AI service is offline..."
                                    : "Ask Pixo AI anything..."
                            }
                            className="flex-1 bg-gray-100/80 rounded-xl px-4 py-3 resize-none text-gray-800 focus:outline-none focus:ring-4 focus:ring-indigo-200/50 focus:bg-white shadow-inner disabled:bg-gray-100 disabled:cursor-not-allowed max-h-36 min-h-[3rem] transition-all duration-300 border border-transparent hover:border-gray-200"
                            rows="1"
                            disabled={isLoading || apiStatus === 'offline'}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={!inputMessage.trim() || isLoading || apiStatus === 'offline'}
                            className="h-12 w-12 flex-shrink-0 bg-gradient-to-r from-indigo-600 to-purple-700 text-white rounded-xl shadow-xl shadow-indigo-400/50 hover:from-indigo-700 hover:to-purple-800 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center active:scale-95"
                            title="Send Message"
                        >
                            <Send className="w-5 h-5 -rotate-12 -translate-y-px" />
                        </button>
                    </div>
                    <p className="text-xs text-gray-400 text-center mt-3">
                        {apiStatus === 'offline' && <span className="text-rose-500 font-medium">AI service is currently unavailable</span>}
                        {apiStatus !== 'offline' && <span className="font-light">Press **Enter** to send, **Shift+Enter** for new line</span>}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ChatBot;