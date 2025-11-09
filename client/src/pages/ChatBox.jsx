import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { 
    ImageIcon, SendHorizonal, ArrowLeft, MessageSquare, Smile, X, 
    Globe, Search, Languages as LanguagesIcon, MessageSquare as MessageSquareIcon, Loader,
    Circle, Clock // Added icons for status
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react'; 
import api from '../api/axios';
import { addMessage, fetchMessages, resetMessages } from '../features/messages/messagesSlice';
import toast from 'react-hot-toast';

// --- I. Translation Constants and Logic ---
const GOOGLE_API_URL = 'https://translate.googleapis.com/translate_a/single';
const SOURCE_LANG_CODE = 'en'; // Assuming all bot/other users are in English for translation purposes

// Static Language Data (A subset for brevity and stability)
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

/**
 * Translates text using the Unofficial Google Translate API endpoint.
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
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`Translation service returned status ${response.status}.`);
        }
        
        const data = await response.json();

        if (Array.isArray(data) && Array.isArray(data[0])) {
            const translatedSegments = data[0].map(segment => segment[0]);
            return translatedSegments.join('');
        } else {
            throw new Error('Invalid response format from API.');
        }

    } catch (error) {
        console.error("Failed to translate text:", error);
        return `Translation failed: ${error.message}`;
    }
};

// --- II. Main Component ---

const ChatBox = () => {
    const { messages } = useSelector((state) => state.messages);
    const { connections } = useSelector((state) => state.connections);
    const { userId } = useParams();
    const { getToken } = useAuth();
    const { user: currentUser } = useUser(); 
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const [text, setText] = useState('');
    const [image, setImage] = useState(null);
    const [user, setUser] = useState(null); 
    const [isConnectionsListVisible, setIsConnectionsListVisible] = useState(false);
    
    // EMOJI/STICKER STATE AND REFS
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [activeTab, setActiveTab] = useState('emojis'); 
    const [emojis, setEmojis] = useState([]);
    const [stickers, setStickers] = useState([]);
    
    // 🎯 TRANSLATION STATE
    const [targetLanguage, setTargetLanguage] = useState('en'); 
    const [languageSearchTerm, setLanguageSearchTerm] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    
    // 🕒 LAST SEEN STATE
    const [lastSeen, setLastSeen] = useState(null);
    const [isUserOnline, setIsUserOnline] = useState(false);
    const [connectionsWithStatus, setConnectionsWithStatus] = useState([]);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null); 
    const pickerRef = useRef(null); 
    const emojiButtonRef = useRef(null); 
    const dropdownRef = useRef(null);
    const eventSourceRef = useRef(null);

    // --- Data Fetching and Logic ---

    // Effect to fetch Emojis and Stickers
    useEffect(() => {
        // 1. Fetch Emojis (standard emoji list)
        fetch("https://cdn.jsdelivr.net/npm/emoji.json@13.1.0/emoji.json")
          .then(res => res.json())
          .then(data => {
            const emojiChars = data.map(e => e.char);
            setEmojis(emojiChars);
          })
          .catch(error => console.error("Error fetching emojis:", error));
    
        // 2. Fetch Stickers (Using reliable Noto Emoji data file for URLs)
        fetch("https://raw.githubusercontent.com/googlefonts/noto-emoji/main/emoji_13.1_data.json")
          .then(res => res.json())
          .then(data => {
            const stickerUrls = Object.values(data).map(item => 
              `https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u${item.unicode.toLowerCase()}.png`
            );
            setStickers(stickerUrls);
          })
          .catch(error => console.error("Error fetching stickers:", error));
    }, []);

    // Logic for closing the picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
          // Check for Emoji Picker
          if (
            pickerRef.current && 
            !pickerRef.current.contains(event.target) &&
            emojiButtonRef.current && 
            !emojiButtonRef.current.contains(event.target)
          ) {
            setShowEmojiPicker(false);
          }

          // Check for Language Dropdown
          if (
            dropdownRef.current && 
            !dropdownRef.current.contains(event.target)
          ) {
            setIsDropdownOpen(false);
          }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
          document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Format last seen time
    const formatLastSeen = (lastSeenDate) => {
        if (!lastSeenDate) return 'Never';
        
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

    // Fetch user's last seen information
    const fetchUserLastSeen = async (targetUserId = userId) => {
        try {
            const token = await getToken();
            const response = await api.get(`/api/messages/last-seen/${targetUserId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (response.data.success) {
                if (targetUserId === userId) {
                    setLastSeen(response.data.lastSeen);
                    setIsUserOnline(response.data.isOnline);
                }
                return response.data;
            }
        } catch (error) {
            console.error('Error fetching last seen:', error);
        }
        return null;
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
            return null;
        }
    };

    // Update connections with last seen data
    const updateConnectionsWithStatus = async () => {
        if (connections.length > 0) {
            const userIds = connections.map(conn => conn._id);
            const lastSeenData = await fetchUsersLastSeen(userIds);
            
            if (lastSeenData?.success) {
                const updatedConnections = connections.map(conn => ({
                    ...conn,
                    lastSeen: lastSeenData.lastSeenData[conn._id]?.lastSeen,
                    isOnline: lastSeenData.lastSeenData[conn._id]?.isOnline
                }));
                setConnectionsWithStatus(updatedConnections);
            } else {
                setConnectionsWithStatus(connections);
            }
        }
    };

    // Setup SSE for real-time online status updates
    const setupSSE = useCallback(async () => {
        if (!currentUser?.id) return;

        try {
            const token = await getToken();
            
            // Close existing connection if any
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }

            eventSourceRef.current = new EventSource(`https://social-server-nine.vercel.app/api/messages/sse/${currentUser.id}?token=${token}`);

            eventSourceRef.current.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    if (data.type === 'user_online' && data.userId === userId) {
                        setIsUserOnline(true);
                        setLastSeen(new Date());
                        // Update connections list
                        updateConnectionsWithStatus();
                    } else if (data.type === 'user_offline' && data.userId === userId) {
                        setIsUserOnline(false);
                        setLastSeen(new Date());
                        // Update connections list
                        updateConnectionsWithStatus();
                    } else if (data.type === 'user_online' || data.type === 'user_offline') {
                        // Update connections list for any user status change
                        updateConnectionsWithStatus();
                    }
                } catch (error) {
                    console.error('Error parsing SSE data:', error);
                }
            };

            eventSourceRef.current.onerror = (error) => {
                console.error('SSE error:', error);
                // Attempt reconnection after 5 seconds
                setTimeout(() => {
                    if (currentUser?.id) {
                        setupSSE();
                    }
                }, 5000);
            };

        } catch (error) {
            console.error('Error setting up SSE:', error);
        }
    }, [currentUser?.id, userId, getToken]);

    const fetchUserMessages = async () => {
        try {
            const token = await getToken();
            dispatch(fetchMessages({ token, userId }));
        } catch (error) {
            console.error("Error fetching messages:", error);
        }
    };

    const sendMessage = async () => {
        try {
            // Note: Since you use placeholder for stickers, we check if text is empty after trimming.
            if (!text.trim() && !image) return;

            const token = await getToken();
            const formData = new FormData();
            formData.append('to_user_id', userId);
            
            // Check for sticker placeholder in text
            if (text.includes('[STICKER]')) {
                formData.append('text', text.trim());
            } else {
                formData.append('text', text.trim());
            }
            
            image && formData.append('image', image);

            // Reset picker state after sending a message
            setShowEmojiPicker(false);
            
            const { data } = await api.post('/api/messages/send', formData, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data.success) {
                setText('');
                setImage(null);
                dispatch(addMessage(data.message));
                
                inputRef.current?.focus(); 
            } else {
                throw new Error(data.message || 'Failed to send message.');
            }
        } catch (error) {
            toast.error(error.message);
        }
    };
    
    const handleTextChange = useCallback((e) => {
        const newValue = e.target.value;
        setText(newValue);
        
        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
                const cursorPosition = newValue.length;
                inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
            }
        }, 0); 
    }, []);

    // Function to handle emoji/sticker selection and insertion
    const handleEmojiSelect = (item) => {
        let newValue = '';
        if (item.startsWith('http')) {
            // For stickers, insert a placeholder (or the full URL if you want)
            newValue = text + ' [STICKER] ';
        } else {
            // For emojis, insert the character
            newValue = text + item;
        }
        
        setText(newValue);

        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
                const cursorPosition = newValue.length;
                inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
            }
        }, 0);
    };
    
    // --- Translation Handlers ---
    const handleSelectLanguage = (code) => {
        setTargetLanguage(code);
        setIsDropdownOpen(false);
        setLanguageSearchTerm('');
    };

    const filteredLanguages = useMemo(() => {
        if (!languageSearchTerm) return LANGUAGES;
        const lowerCaseSearch = languageSearchTerm.toLowerCase();
        return LANGUAGES.filter(lang => 
            lang.name.toLowerCase().includes(lowerCaseSearch) || 
            lang.code.toLowerCase().includes(lowerCaseSearch)
        );
    }, [languageSearchTerm]);
    
    const currentLangName = LANGUAGES.find(l => l.code === targetLanguage)?.name || 'English';

    // --- Effects ---

    useEffect(() => {
        fetchUserMessages();
        setIsConnectionsListVisible(false);
        fetchUserLastSeen();
        updateConnectionsWithStatus();

        return () => {
            dispatch(resetMessages());
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    useEffect(() => {
        if (connections.length > 0) {
            const connectedUser = connections.find(connection => connection._id === userId);
            setUser(connectedUser);
            // Initialize connections with status
            if (connectionsWithStatus.length === 0) {
                updateConnectionsWithStatus();
            }
        }
    }, [connections, userId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Setup SSE when component mounts
    useEffect(() => {
        setupSSE();
    }, [setupSSE]);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            setImage(file);
        } else {
            setImage(null);
            if (file) toast.error('Please select a valid image file.');
        }
    };

    // --- Sub-Components ---

    const ConnectionsList = () => (
        <div className='w-full md:w-80 border-r border-gray-200 bg-white h-full overflow-y-auto flex-shrink-0'>
            <div className='p-4 border-b border-gray-100 sticky top-0 bg-white z-5'>
                <h2 className='text-xl font-bold text-slate-800'>Connections</h2>
            </div>
            
            {(connectionsWithStatus.length > 0 ? connectionsWithStatus : connections).length === 0 ? (
                <div className="text-center p-8 text-gray-500">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">No connections found.</p>
                </div>
            ) : (
                (connectionsWithStatus.length > 0 ? connectionsWithStatus : connections).map((connection) => {
                    const isSelected = connection._id === userId;
                    const isOnline = connection.isOnline;
                    const lastSeen = connection.lastSeen;
                    
                    return (
                        <div
                            key={connection._id}
                            onClick={() => navigate(`/messages/${connection._id}`)}
                            className={`flex items-center p-3 sm:p-4 border-b border-gray-100 transition-all cursor-pointer ${
                                isSelected ? 'bg-indigo-50 border-l-4 border-indigo-600' : 'hover:bg-gray-50 border-l-4 border-white'
                            }`}
                        >
                            <div className="relative">
                                <img
                                    src={connection.profile_picture || '/default-avatar.png'}
                                    alt={connection.full_name}
                                    className='size-12 rounded-full object-cover flex-shrink-0'
                                    onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                />
                                {/* Online Status Indicator */}
                                <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                                    isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                                }`} />
                            </div>
                            <div className='ml-3 overflow-hidden flex-1'>
                                <p className='font-semibold text-slate-800 truncate'>{connection.full_name}</p>
                                <p className='text-xs text-gray-500 truncate'>@{connection.username}</p>
                                <p className='text-xs text-gray-400 mt-1 truncate'>
                                    {isOnline ? (
                                        <span className="text-green-600 font-medium flex items-center gap-1">
                                            <Circle className="w-2 h-2 fill-green-500" />
                                            Online
                                        </span>
                                    ) : lastSeen ? (
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-2.5 h-2.5" />
                                            Last seen {formatLastSeen(lastSeen)}
                                        </span>
                                    ) : (
                                        'Never seen'
                                    )}
                                </p>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
    
    // --- Message Component (Updated to handle translation) ---
    const MessageBubble = ({ message, isSent }) => {
        const [translatedText, setTranslatedText] = useState(null);
        const [isTranslating, setIsTranslating] = useState(false);
        // 'original' for English text, 'translated' for target language text
        const [viewMode, setViewMode] = useState('original'); 

        // Effect to handle translation when targetLanguage or message changes
        useEffect(() => {
            // Only translate incoming messages (not sent by the current user)
            if (!isSent) {
                const translateMessage = async () => {
                    if (targetLanguage === 'en' || !message.text) {
                        setTranslatedText(null);
                        setViewMode('original'); // Always show original (English) if target is English
                        return;
                    }
                    
                    setTranslatedText(null); 
                    setViewMode('translated'); // Default to translated view when a new translation starts
                    
                    setIsTranslating(true);
                    try {
                        const translated = await realTranslate(message.text, targetLanguage);
                        setTranslatedText(translated);
                        if (translated.startsWith('Translation failed:')) {
                            setViewMode('original');
                            toast.error('Translation failed. Showing original text.');
                        }
                    } catch (error) {
                        setTranslatedText("Translation failed.");
                        setViewMode('original');
                    } finally {
                        setIsTranslating(false);
                    }
                };
                
                translateMessage();
            } else {
                // For sent messages, reset and always show original text
                setTranslatedText(null);
                setViewMode('original');
            }
        }, [isSent, message.text, targetLanguage]);
        
        // Determine the text to display based on viewMode
        const getDisplayText = () => {
            if (isTranslating) {
                return 'Translating...';
            }
            
            // If translation failed or it's a sent message or viewMode is 'original'
            if (isSent || viewMode === 'original' || targetLanguage === 'en' || !translatedText || translatedText.startsWith('Translation failed:')) {
                return message.text;
            }
            
            // If viewMode is 'translated' and we have a valid translation
            return translatedText;
        };

        const displayText = getDisplayText();
        const translationReady = translatedText && !translatedText.startsWith('Translation failed:') && targetLanguage !== 'en';
        
        const time = message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...';

        return (
            <div key={message._id} className={`flex w-full ${isSent ? 'justify-end' : 'justify-start'}`}>
                <div className='max-w-[80%] md:max-w-[60%]'>
                    <div className={`flex flex-col mb-1 ${isSent ? 'items-end' : 'items-start'}`}>
                        <div className={`p-3 text-sm rounded-xl shadow-md transition-all ${isSent 
                            ? 'bg-indigo-600 text-white rounded-br-none' 
                            : 'bg-white text-slate-800 rounded-tl-none border border-gray-200'
                        }`}>
                            
                            {/* Image Content */}
                            {message.message_type === 'image' && message.media_url && (
                                <img 
                                    src={message.media_url} 
                                    className='w-full max-w-xs md:max-w-sm rounded-lg mb-2 object-cover cursor-pointer' 
                                    alt="Shared media"
                                    onClick={() => window.open(message.media_url, '_blank')} 
                                />
                            )}
                            
                            {/* Text Content */}
                            {message.text && (
                                <p className='whitespace-pre-wrap'>
                                    {isTranslating ? 
                                        <Loader className="w-4 h-4 animate-spin inline mr-2" /> : 
                                        displayText
                                    }
                                </p>
                            )}
                            
                            {/* Translation Toggle Buttons (Only for INCOMING messages with valid translation) */}
                            {!isSent && translationReady && (
                                <div className="flex space-x-2 mt-3 pt-3 border-t border-gray-100">
                                    <button
                                        onClick={() => setViewMode('translated')}
                                        className={`flex items-center text-xs font-semibold px-2 py-1 rounded-lg transition-colors ${
                                            viewMode === 'translated' 
                                                ? 'bg-indigo-500 text-white shadow-md' 
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                        title={`View message in ${currentLangName}`}
                                    >
                                        <LanguagesIcon className="w-3.5 h-3.5 mr-1" />
                                        View Translation
                                    </button>
                                    <button
                                        onClick={() => setViewMode('original')}
                                        className={`flex items-center text-xs font-semibold px-2 py-1 rounded-lg transition-colors ${
                                            viewMode === 'original' 
                                                ? 'bg-indigo-500 text-white shadow-md' 
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                        title="View message in English"
                                    >
                                        <MessageSquareIcon className="w-3.5 h-3.5 mr-1" />
                                        View Original
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        {/* Time Stamp */}
                        <p className={`text-xs mt-1 ${isSent ? 'text-gray-500' : 'text-gray-500 mr-2'}`}>
                            {time}
                        </p>
                    </div>
                </div>
            </div>
        );
    };

    const ChatContent = () => {
        if (!user) {
            return (
                <div className='flex items-center justify-center flex-1 bg-gray-100'>
                    <div className="text-center">
                        <h3 className="text-2xl font-bold text-gray-700 mb-4">Select a Connection</h3>
                        <p className="text-gray-500">Choose a user from the list to start chatting.</p>
                    </div>
                </div>
            );
        }
        
        return (
            <div className='flex flex-col flex-1 h-full'>
                {/* --- Chat Header --- */}
                <div className='sticky top-0 z-10 flex items-center justify-between p-3 sm:p-4 bg-white shadow-md border-b border-gray-100 flex-shrink-0'>
                    
                    {/* User Info */}
                    <div className='flex items-center gap-3'>
                        <button 
                            onClick={() => setIsConnectionsListVisible(true)} 
                            className='p-2 rounded-full hover:bg-gray-100 transition-colors md:hidden' 
                            title="Back to Connections"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-700"/>
                        </button>
                        <div className="relative">
                            <img 
                                src={user.profile_picture || '/default-avatar.png'} 
                                alt={user.full_name} 
                                className="size-10 rounded-full object-cover border-2 border-indigo-300"
                                onError={(e) => { e.target.src = '/default-avatar.png' }}
                            />
                            {/* Online Status Indicator */}
                            <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                                isUserOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                            }`} />
                        </div>
                        <div>
                            <p className="font-semibold text-lg text-slate-800">{user.full_name}</p>
                            <p className="text-xs text-gray-500 -mt-0.5 flex items-center gap-1">
                                {isUserOnline ? (
                                    <span className="text-green-600 font-medium flex items-center gap-1">
                                        <Circle className="w-2 h-2 fill-green-500" />
                                        Online
                                    </span>
                                ) : lastSeen ? (
                                    <span className="text-gray-500 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        Last seen {formatLastSeen(lastSeen)}
                                    </span>
                                ) : (
                                    <span className="text-gray-500">Offline</span>
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Language Selector */}
                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100/80 border border-gray-200 text-gray-600 text-sm font-medium transition-colors hover:bg-gray-200/80"
                            title="Select Target Translation Language"
                        >
                            <LanguagesIcon className="w-4 h-4 text-indigo-500" />
                            <span className="hidden sm:inline">Translate to:</span>
                            <span className="truncate max-w-[80px] font-bold text-slate-800">{currentLangName}</span>
                        </button>
                                
                        {isDropdownOpen && (
                            <div className="absolute right-0 top-12 md:top-full mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-2xl z-20 overflow-hidden">
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
                                            No languages found.
                                        </li>
                                    )}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>

                {/* --- Message Area --- */}
                <div className='flex-1 p-4 overflow-y-scroll space-y-4 bg-gray-100'>
                    <div className='max-w-4xl mx-auto py-2'>
                        {messages.toSorted((a,b)=> new Date(a.createdAt) - new Date(b.createdAt)).map((message)=>{
                            
                            const senderId = message.from_user_id?._id || message.from_user_id;
                            const currentClerkId = currentUser?.id;

                            // A message is "sent" if the sender is the current user.
                            const isSent = senderId === currentClerkId; 

                            return (
                                <MessageBubble 
                                    key={message._id} 
                                    message={message} 
                                    isSent={isSent} 
                                />
                            )
                        })}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* --- Message Input --- */}
                <div className='sticky bottom-0 z-10 bg-white p-4 shadow-xl flex-shrink-0'>
                    
                    {/* 🎯 EMOJI PICKER PANEL */}
                    {showEmojiPicker && (
                        <div 
                            ref={pickerRef}
                            className='absolute bottom-full left-1/2 -translate-x-1/2 w-full max-w-xl p-2'
                        >
                            <div className='bg-white border border-gray-200 rounded-xl shadow-2xl h-80 flex flex-col'>
                                
                                {/* Picker Header with Close Button and Tabs */}
                                <div className='flex justify-between items-center p-3 border-b border-gray-100'>
                                    
                                    {/* Tabs */}
                                    <div className='flex gap-4'>
                                        <button 
                                            onClick={() => setActiveTab('emojis')}
                                            className={`font-semibold text-sm pb-1 transition ${activeTab === 'emojis' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            Emojis ({emojis.length})
                                        </button>
                                        <button 
                                            onClick={() => setActiveTab('stickers')}
                                            className={`font-semibold text-sm pb-1 transition ${activeTab === 'stickers' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            Stickers ({stickers.length})
                                        </button>
                                    </div>

                                    {/* Close Button */}
                                    <button 
                                        onClick={() => setShowEmojiPicker(false)}
                                        className='p-1 rounded-full hover:bg-red-100 text-gray-500 hover:text-red-600 transition'
                                        title="Close Picker"
                                    >
                                        <X className='size-5'/>
                                    </button>
                                </div>

                                {/* Content Grid */}
                                <div className='p-4 flex-1 overflow-y-auto'>
                                    {activeTab === 'emojis' && (
                                        <div className='grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 gap-1'>
                                            {emojis.length === 0 ? (
                                                <p className='col-span-12 text-center text-gray-500 py-4'>Loading Emojis...</p>
                                            ) : (
                                                emojis.map((emoji, index) => (
                                                    <button 
                                                        key={index}
                                                        onClick={() => handleEmojiSelect(emoji)} 
                                                        className='text-2xl hover:bg-gray-100 p-1 rounded transition flex items-center justify-center'
                                                        title={emoji}
                                                    >
                                                        {emoji}
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}

                                    {activeTab === 'stickers' && (
                                        <div className='grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3'>
                                            {stickers.length === 0 ? (
                                                <p className='col-span-6 text-center text-gray-500 py-4'>Loading Stickers...</p>
                                            ) : (
                                                stickers.map((stickerUrl, index) => (
                                                    <button 
                                                        key={index}
                                                        onClick={() => handleEmojiSelect(stickerUrl)} 
                                                        className='p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition flex items-center justify-center h-20 w-full'
                                                        title="Sticker"
                                                    >
                                                        {stickerUrl && (
                                                            <img 
                                                                src={stickerUrl} 
                                                                alt={`Sticker ${index + 1}`} 
                                                                className="max-h-full max-w-full object-contain"
                                                                onError={(e) => { e.target.style.display = 'none'; }}
                                                            />
                                                        )}
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Image Preview Area */}
                    {image && (
                        <div className='flex items-center justify-between p-2 mb-2 bg-indigo-50 rounded-lg max-w-xl mx-auto'>
                            <div className='flex items-center gap-3'>
                                <img src={URL.createObjectURL(image)} alt="Preview" className='h-10 w-10 object-cover rounded'/>
                                <p className='text-sm text-indigo-800 truncate'>{image.name}</p>
                            </div>
                            <button onClick={() => setImage(null)} className='text-red-500 hover:text-red-700 font-bold text-lg leading-none'>&times;</button>
                        </div>
                    )}

                    {/* Input Row */}
                    <div className='flex items-center gap-3 p-1.5 bg-white w-full max-w-xl mx-auto border border-gray-300 rounded-full shadow-lg'>
                      
                      {/* EMOJI/STICKER BUTTON */}
                      <button
                          ref={emojiButtonRef}
                          onClick={() => setShowEmojiPicker(prev => !prev)}
                          className={`flex-shrink-0 size-10 flex items-center justify-center rounded-full transition ml-1 ${showEmojiPicker ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:text-indigo-500'}`}
                          title="Select Emoji or Sticker"
                      >
                          <Smile className='size-5'/>
                      </button>

                      <input 
                          type="text" 
                          ref={inputRef} 
                          className='flex-1 py-2 px-3 outline-none text-slate-700 placeholder:text-gray-400' 
                          placeholder='Type a message...'
                          onKeyDown={e=>e.key === 'Enter' && sendMessage()} 
                          onChange={handleTextChange} 
                          value={text} 
                          onFocus={() => setShowEmojiPicker(false)} // Close picker when focusing input
                      />

                      <label htmlFor="image" className='flex-shrink-0'>
                        <div className='p-2 cursor-pointer rounded-full hover:bg-gray-100 transition-colors' title="Add Image">
                          {
                            image 
                            ? <img src={URL.createObjectURL(image)} alt="" className='h-6 w-6 rounded object-cover'/> 
                            : <ImageIcon className='size-5 text-indigo-500'/>
                          }
                        </div>
                        <input 
                            type="file" 
                            id='image' 
                            accept="image/*" 
                            hidden 
                            onChange={handleImageChange}
                            onClick={(e) => e.target.value = null}
                        />
                      </label>

                      <button 
                          onClick={sendMessage} 
                          disabled={!text.trim() && !image}
                          className={`flex-shrink-0 cursor-pointer text-white p-3 rounded-full transition-all ${!text.trim() && !image 
                              ? 'bg-gray-400' 
                              : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95'
                          } mr-1`}
                          title="Send"
                      >
                        <SendHorizonal size={18}/>
                      </button>
                    </div>
                </div>
            </div>
        );
    };

    // --- Main Render (Two-Side Layout) ---

    return (
        <div className='flex h-screen overflow-hidden bg-white'>
            
            {/* 1. Connections List (Left Pane) - Always visible on desktop, toggle on mobile */}
            <div className={`h-full ${isConnectionsListVisible ? 'w-full absolute inset-0 md:relative md:w-80' : 'hidden md:block md:w-80'}`}>
                <ConnectionsList />
            </div>

            {/* 2. Chat Area (Right Pane) - Always visible on desktop, toggle on mobile */}
            <div className={`h-full ${isConnectionsListVisible ? 'hidden md:flex flex-1' : 'flex flex-1'}`}>
                <ChatContent />
            </div>

        </div>
    );
};

export default ChatBox;