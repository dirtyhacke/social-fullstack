import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { 
    ImageIcon, SendHorizonal, ArrowLeft, MessageSquare, Smile, X, 
    Globe, Search, Languages as LanguagesIcon, MessageSquare as MessageSquareIcon, Loader,
    Circle, Clock, Mic, Square, Reply, CornerUpLeft, User, MoreVertical,
    Check, CheckCheck, Palette, Settings, Volume2, VolumeX, Trash2, AlertTriangle,
    MousePointer
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react'; 
import api from '../api/axios';
import { addMessage, fetchMessages, resetMessages } from '../features/messages/messagesSlice';
import toast from 'react-hot-toast';

// --- Constants and Configuration ---
const GOOGLE_API_URL = 'https://translate.googleapis.com/translate_a/single';
const SOURCE_LANG_CODE = 'en';

// Language Data
const RAW_LANGUAGES = [
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

// Chat Themes
const CHAT_THEMES = [
    { 
        id: 'default', 
        name: 'Default', 
        bgColor: 'bg-white', 
        textColor: 'text-gray-800', 
        bubbleSent: 'bg-indigo-600', 
        bubbleReceived: 'bg-white',
        inputBg: 'bg-white'
    },
    { 
        id: 'dark', 
        name: 'Dark', 
        bgColor: 'bg-gray-900', 
        textColor: 'text-white', 
        bubbleSent: 'bg-blue-600', 
        bubbleReceived: 'bg-gray-700',
        inputBg: 'bg-gray-800'
    },
    { 
        id: 'blue', 
        name: 'Ocean Blue', 
        bgColor: 'bg-blue-50', 
        textColor: 'text-gray-800', 
        bubbleSent: 'bg-blue-500', 
        bubbleReceived: 'bg-white',
        inputBg: 'bg-white'
    },
    { 
        id: 'green', 
        name: 'Forest Green', 
        bgColor: 'bg-green-50', 
        textColor: 'text-gray-800', 
        bubbleSent: 'bg-green-600', 
        bubbleReceived: 'bg-white',
        inputBg: 'bg-white'
    },
    { 
        id: 'purple', 
        name: 'Royal Purple', 
        bgColor: 'bg-purple-50', 
        textColor: 'text-gray-800', 
        bubbleSent: 'bg-purple-600', 
        bubbleReceived: 'bg-white',
        inputBg: 'bg-white'
    },
    { 
        id: 'pink', 
        name: 'Blush Pink', 
        bgColor: 'bg-pink-50', 
        textColor: 'text-gray-800', 
        bubbleSent: 'bg-pink-500', 
        bubbleReceived: 'bg-white',
        inputBg: 'bg-white'
    },
    { 
        id: 'orange', 
        name: 'Sunset Orange', 
        bgColor: 'bg-orange-50', 
        textColor: 'text-gray-800', 
        bubbleSent: 'bg-orange-500', 
        bubbleReceived: 'bg-white',
        inputBg: 'bg-white'
    },
    { 
        id: 'teal', 
        name: 'Mint Teal', 
        bgColor: 'bg-teal-50', 
        textColor: 'text-gray-800', 
        bubbleSent: 'bg-teal-500', 
        bubbleReceived: 'bg-white',
        inputBg: 'bg-white'
    },
    { 
        id: 'red', 
        name: 'Crimson Red', 
        bgColor: 'bg-red-50', 
        textColor: 'text-gray-800', 
        bubbleSent: 'bg-red-500', 
        bubbleReceived: 'bg-white',
        inputBg: 'bg-white'
    },
    { 
        id: 'yellow', 
        name: 'Sunshine Yellow', 
        bgColor: 'bg-yellow-50', 
        textColor: 'text-gray-800', 
        bubbleSent: 'bg-yellow-500', 
        bubbleReceived: 'bg-white',
        inputBg: 'bg-white'
    }
];

// Translation function
const realTranslate = async (text, targetLang) => {
    if (targetLang === SOURCE_LANG_CODE || !text) return text;

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

        if (!response.ok) throw new Error(`Translation service returned status ${response.status}.`);
        
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

// Enhanced Custom Hooks
const useChatSounds = () => {
    const [soundsEnabled, setSoundsEnabled] = useState(() => {
        return localStorage.getItem('chatSoundsEnabled') !== 'false';
    });

    const playSound = useCallback((soundType) => {
        if (!soundsEnabled) return;

        try {
            const sound = new Audio(`/sounds/${soundType}.mp3`);
            sound.volume = 0.3;
            sound.play().catch(() => {
                // Silent fail for audio autoplay restrictions
            });
        } catch (error) {
            console.log('Sound play failed:', error);
        }
    }, [soundsEnabled]);

    const toggleSounds = useCallback(() => {
        const newState = !soundsEnabled;
        setSoundsEnabled(newState);
        localStorage.setItem('chatSoundsEnabled', newState.toString());
        toast.success(`Sounds ${newState ? 'enabled' : 'disabled'}`);
    }, [soundsEnabled]);

    return { playSound, soundsEnabled, toggleSounds };
};

// Enhanced Swipe Hook with Visual Feedback
const useSwipe = (onSwipeLeft, onSwipeRight) => {
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);
    const [isSwiping, setIsSwiping] = useState(false);
    const [swipeDirection, setSwipeDirection] = useState(null);

    const minSwipeDistance = 50;

    const onTouchStart = (e) => {
        setTouchEnd(null);
        setTouchStart({
            x: e.targetTouches[0].clientX,
            y: e.targetTouches[0].clientY
        });
        setIsSwiping(true);
    };

    const onTouchMove = (e) => {
        if (!touchStart) return;
        
        const currentTouch = {
            x: e.targetTouches[0].clientX,
            y: e.targetTouches[0].clientY
        };
        setTouchEnd(currentTouch);

        // Visual feedback during swipe
        if (touchStart && currentTouch) {
            const distanceX = touchStart.x - currentTouch.x;
            if (Math.abs(distanceX) > 20) {
                setSwipeDirection(distanceX > 0 ? 'left' : 'right');
            }
        }
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) {
            setIsSwiping(false);
            setSwipeDirection(null);
            return;
        }
        
        const distanceX = touchStart.x - touchEnd.x;
        const isLeftSwipe = distanceX > minSwipeDistance;
        const isRightSwipe = distanceX < -minSwipeDistance;

        if (isLeftSwipe && onSwipeLeft) {
            onSwipeLeft();
        } else if (isRightSwipe && onSwipeRight) {
            onSwipeRight();
        }
        
        setIsSwiping(false);
        setSwipeDirection(null);
    };

    return {
        onTouchStart,
        onTouchMove,
        onTouchEnd,
        isSwiping,
        swipeDirection
    };
};

// Fixed Long Press Hook with Better State Management
const useLongPress = (onLongPress, onClick, { shouldPreventDefault = true, delay = 600 } = {}) => {
    const [longPressTriggered, setLongPressTriggered] = useState(false);
    const [isPressing, setIsPressing] = useState(false);
    const timeout = useRef();
    const target = useRef();

    const start = useCallback(
        (event) => {
            setIsPressing(true);
            setLongPressTriggered(false);
            if (shouldPreventDefault && event.target) {
                event.target.addEventListener("touchend", preventDefault, { passive: false });
                event.target.addEventListener("mouseup", preventDefault, { passive: false });
                target.current = event.target;
            }
            timeout.current = setTimeout(() => {
                onLongPress(event);
                setLongPressTriggered(true);
                setIsPressing(false);
            }, delay);
        },
        [onLongPress, delay, shouldPreventDefault]
    );

    const clear = useCallback(
        (event, shouldTriggerClick = true) => {
            timeout.current && clearTimeout(timeout.current);
            shouldTriggerClick && !longPressTriggered && onClick && onClick(event);
            setLongPressTriggered(false);
            setIsPressing(false);
            if (shouldPreventDefault && target.current) {
                target.current.removeEventListener("touchend", preventDefault);
                target.current.removeEventListener("mouseup", preventDefault);
            }
        },
        [shouldPreventDefault, longPressTriggered, onClick]
    );

    return {
        onMouseDown: (e) => start(e),
        onTouchStart: (e) => start(e),
        onMouseUp: (e) => clear(e),
        onMouseLeave: (e) => clear(e, false),
        onTouchEnd: (e) => clear(e),
        onTouchCancel: (e) => clear(e, false),
        isPressing,
        longPressTriggered
    };
};

const preventDefault = (e) => {
    if (!isTouchEvent(e)) return;
    if (e.preventDefault) e.preventDefault();
};

const isTouchEvent = (event) => {
    return "touches" in event;
};

// --- Main Component ---
const ChatBox = () => {
    const { messages } = useSelector((state) => state.messages);
    const { connections } = useSelector((state) => state.connections);
    const { userId } = useParams();
    const { getToken } = useAuth();
    const { user: currentUser } = useUser(); 
    const dispatch = useDispatch();
    const navigate = useNavigate();

    // State Management
    const [text, setText] = useState('');
    const [image, setImage] = useState(null);
    const [user, setUser] = useState(null); 
    const [isConnectionsListVisible, setIsConnectionsListVisible] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [activeTab, setActiveTab] = useState('emojis'); 
    const [emojis, setEmojis] = useState([]);
    const [stickers, setStickers] = useState([]);
    const [targetLanguage, setTargetLanguage] = useState('en'); 
    const [languageSearchTerm, setLanguageSearchTerm] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [lastSeen, setLastSeen] = useState(null);
    const [isUserOnline, setIsUserOnline] = useState(false);
    const [connectionsWithStatus, setConnectionsWithStatus] = useState([]);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [audioChunks, setAudioChunks] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const [replyingTo, setReplyingTo] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [selectedTheme, setSelectedTheme] = useState(() => {
        return localStorage.getItem('chatTheme') || 'default';
    });
    const [isLoading, setIsLoading] = useState(false);
    
    // Fixed State Management for Message Actions
    const [showMessageActions, setShowMessageActions] = useState(null);
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [showClearChatConfirm, setShowClearChatConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
    const [longPressActive, setLongPressActive] = useState(false);

    // Refs
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null); 
    const pickerRef = useRef(null); 
    const emojiButtonRef = useRef(null); 
    const dropdownRef = useRef(null);
    const settingsRef = useRef(null);
    const eventSourceRef = useRef(null);
    const recordingIntervalRef = useRef(null);
    const audioRef = useRef(null);
    const connectionsListRef = useRef(null);
    const messageActionsRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    // Custom Hooks
    const { playSound, soundsEnabled, toggleSounds } = useChatSounds();
    const currentTheme = CHAT_THEMES.find(theme => theme.id === selectedTheme) || CHAT_THEMES[0];

    // Fixed Format Last Seen with Date
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
        if (diffInDays === 1) return 'Yesterday';
        if (diffInDays < 7) return `${diffInDays}d ago`;
        if (diffInDays < 30) return `${Math.floor(diffInDays / 7)}w ago`;
        
        return lastSeen.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: diffInDays > 365 ? 'numeric' : undefined
        });
    };

    // Fixed Clear Chat Function
    const clearChat = async () => {
        try {
            setIsDeleting(true);
            const token = await getToken();
            
            if (!token) {
                toast.error('Authentication required');
                return;
            }

            const response = await api.delete(`/api/messages/clear-chat/${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                dispatch(resetMessages());
                setShowClearChatConfirm(false);
                toast.success('Chat cleared successfully');
                playSound('action');
            } else {
                throw new Error(response.data.message || 'Failed to clear chat');
            }
        } catch (error) {
            console.error('Error clearing chat:', error);
            toast.error(error.response?.data?.message || error.message || 'Failed to clear chat');
        } finally {
            setIsDeleting(false);
        }
    };

    // Fixed Delete Single Message Function
    const deleteMessage = async (messageId) => {
        if (!messageId) {
            toast.error('Invalid message');
            return;
        }

        try {
            setIsDeleting(true);
            const token = await getToken();
            
            if (!token) {
                toast.error('Authentication required');
                return;
            }

            const response = await api.delete(`/api/messages/delete/${messageId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                // Refetch messages to get updated list
                await fetchUserMessages();
                setShowMessageActions(null);
                setSelectedMessage(null);
                toast.success('Message deleted');
                playSound('action');
            } else {
                throw new Error(response.data.message || 'Failed to delete message');
            }
        } catch (error) {
            console.error('Error deleting message:', error);
            toast.error(error.response?.data?.message || error.message || 'Failed to delete message');
        } finally {
            setIsDeleting(false);
        }
    };

    // FIXED: Enhanced Handle Long Press on Message
    const handleLongPress = (message, event) => {
        if (!message || !message._id) return;
        
        const rect = event.currentTarget.getBoundingClientRect();
        setCursorPosition({
            x: rect.left + (rect.width / 2),
            y: rect.top
        });
        setSelectedMessage(message);
        setShowMessageActions(message._id);
        setLongPressActive(true);
        playSound('action');
    };

    // FIXED: Handle Click on Message (for normal click)
    const handleMessageClick = (message, event) => {
        if (longPressActive) {
            setLongPressActive(false);
            return;
        }
        console.log('Message clicked:', message);
    };

    // FIXED: Handle Swipe to Reply
    const handleSwipeToReply = (message) => {
        if (!message) return;
        handleReply(message);
        playSound('action');
    };

    // Apply Theme
    useEffect(() => {
        localStorage.setItem('chatTheme', selectedTheme);
    }, [selectedTheme]);

    // Handle Theme Change
    const handleThemeChange = (themeId) => {
        setSelectedTheme(themeId);
        setShowSettings(false);
        toast.success(`Theme changed to ${CHAT_THEMES.find(t => t.id === themeId)?.name}`);
    };

    // Message Status Handler
    const getMessageStatus = (message) => {
        if (!message || message.from_user_id?._id !== currentUser?.id) return null;
        
        if (message.seen_by && message.seen_by.includes(userId)) {
            return 'seen';
        } else if (message.delivered) {
            return 'delivered';
        } else {
            return 'sent';
        }
    };

    // Render Message Status Icon
    const renderMessageStatus = (message) => {
        const status = getMessageStatus(message);
        
        switch (status) {
            case 'seen':
                return <CheckCheck className="w-3 h-3 text-blue-500" />;
            case 'delivered':
                return <CheckCheck className="w-3 h-3 text-gray-400" />;
            case 'sent':
                return <Check className="w-3 h-3 text-gray-400" />;
            default:
                return null;
        }
    };

    // FIXED: Close message actions when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (messageActionsRef.current && !messageActionsRef.current.contains(event.target)) {
                setShowMessageActions(null);
                setSelectedMessage(null);
                setLongPressActive(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("touchstart", handleClickOutside);
        
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("touchstart", handleClickOutside);
        };
    }, []);

    // Voice Message Functionality
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 22050
                } 
            });
            const recorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            const chunks = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunks.push(e.data);
                }
            };

            recorder.onstop = async () => {
                const audioBlob = new Blob(chunks, { type: 'audio/webm' });
                await sendVoiceMessage(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            recorder.start(1000);
            setMediaRecorder(recorder);
            setAudioChunks(chunks);
            setIsRecording(true);
            setRecordingTime(0);

            recordingIntervalRef.current = setInterval(() => {
                setRecordingTime(prev => {
                    if (prev >= 120) {
                        stopRecording();
                        return 120;
                    }
                    return prev + 1;
                });
            }, 1000);

            playSound('recording_start');

        } catch (error) {
            console.error('Error starting recording:', error);
            toast.error('Microphone access denied or not available');
        }
    };

    const stopRecording = () => {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            setIsRecording(false);
            clearInterval(recordingIntervalRef.current);
            setRecordingTime(0);
            playSound('recording_stop');
        }
    };

    // FIXED: Enhanced sendVoiceMessage function
    const sendVoiceMessage = async (audioBlob) => {
        try {
            const token = await getToken();
            if (!token) {
                toast.error('Authentication required');
                return;
            }

            const formData = new FormData();
            formData.append('to_user_id', userId);
            formData.append('audio', audioBlob, `voice-${Date.now()}.webm`);
            formData.append('duration', recordingTime.toString());
            
            if (replyingTo) {
                formData.append('reply_to', replyingTo._id);
            }

            setIsLoading(true);
            
            const { data } = await api.post('/api/messages/send-voice', formData, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                }
            });

            if (data.success) {
                dispatch(addMessage(data.message));
                setReplyingTo(null);
                playSound('send');
                toast.success('Voice message sent');
            } else {
                throw new Error(data.message || 'Failed to send voice message');
            }
        } catch (error) {
            console.error('Error sending voice message:', error);
            toast.error(error.response?.data?.message || error.message || 'Failed to send voice message');
        } finally {
            setIsLoading(false);
        }
    };

    // FIXED: Enhanced Typing Indicator
    const handleTyping = useCallback(() => {
        // Clear existing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Send typing start event
        sendTypingEvent(true);
        
        // Set timeout to stop typing after 2 seconds of inactivity
        typingTimeoutRef.current = setTimeout(() => {
            sendTypingEvent(false);
        }, 2000);
    }, [userId]);

    const sendTypingEvent = async (isTyping) => {
        try {
            const token = await getToken();
            await api.post('/api/messages/typing', {
                to_user_id: userId,
                is_typing: isTyping
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (error) {
            console.error('Error sending typing event:', error);
        }
    };

    // FIXED: Reply/Mention Functionality
    const handleReply = (message) => {
        if (!message) return;
        setReplyingTo(message);
        inputRef.current?.focus();
        playSound('action');
    };

    const cancelReply = () => {
        setReplyingTo(null);
    };

    // Data Fetching Functions
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

    // FIXED: Enhanced SSE Setup
    const setupSSE = useCallback(async () => {
        if (!currentUser?.id) return;

        try {
            const token = await getToken();
            
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }

            const sseUrl = `https://pixo-toj7.onrender.com/api/messages/sse/${currentUser.id}?token=${token}`;
            
            eventSourceRef.current = new EventSource(sseUrl);

            eventSourceRef.current.onopen = () => {
                console.log('✅ SSE connection established for user:', currentUser.id);
            };

            eventSourceRef.current.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    switch (data.type) {
                        case 'user_online':
                            if (data.userId === userId) {
                                setIsUserOnline(true);
                                setLastSeen(new Date());
                            }
                            updateConnectionsWithStatus();
                            break;
                            
                        case 'user_offline':
                            if (data.userId === userId) {
                                setIsUserOnline(false);
                                setLastSeen(new Date());
                            }
                            updateConnectionsWithStatus();
                            break;
                            
                        case 'typing_start':
                            if (data.fromUserId === userId) {
                                setIsTyping(true);
                            }
                            break;
                            
                        case 'typing_stop':
                            if (data.fromUserId === userId) {
                                setIsTyping(false);
                            }
                            break;
                            
                        case 'new_message':
                            if (data.message) {
                                dispatch(addMessage(data.message));
                                if (data.sound) {
                                    playSound(data.sound);
                                }
                            }
                            break;
                            
                        case 'message_deleted':
                            if (data.messageId) {
                                fetchUserMessages();
                            }
                            break;
                    }
                } catch (error) {
                    console.error('Error parsing SSE data:', error);
                }
            };

            eventSourceRef.current.onerror = (error) => {
                console.error('SSE connection error:', error);
                setTimeout(() => {
                    if (currentUser?.id) {
                        setupSSE();
                    }
                }, 5000);
            };

        } catch (error) {
            console.error('Error setting up SSE:', error);
            setTimeout(() => setupSSE(), 5000);
        }
    }, [currentUser?.id, userId, getToken, dispatch, playSound]);

    const fetchUserMessages = async () => {
        try {
            setIsLoading(true);
            const token = await getToken();
            await dispatch(fetchMessages({ token, userId })).unwrap();
        } catch (error) {
            console.error("Error fetching messages:", error);
            toast.error('Failed to load messages');
        } finally {
            setIsLoading(false);
        }
    };

    // FIXED: Enhanced image change handler
    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                toast.error('Please select a valid image file (JPEG, PNG, GIF, etc.)');
                return;
            }

            const maxSize = 5 * 1024 * 1024;
            if (file.size > maxSize) {
                toast.error('Image size should be less than 5MB');
                return;
            }

            const imageFile = new File([file], file.name, {
                type: file.type,
                lastModified: file.lastModified
            });
            
            setImage(imageFile);
            toast.success('Image added - click send to share');
            
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    };

    // FIXED: Enhanced sendMessage function
    const sendMessage = async (e) => {
        if (e && e.preventDefault) {
            e.preventDefault();
        }
        
        try {
            if (!text.trim() && !image) {
                toast.error('Please enter a message or select an image');
                return;
            }

            const token = await getToken();
            if (!token) {
                toast.error('Authentication required');
                return;
            }

            const formData = new FormData();
            formData.append('to_user_id', userId);
            
            if (text.trim()) {
                formData.append('text', text.trim());
            }
            
            if (image) {
                if (image instanceof File) {
                    formData.append('image', image, image.name);
                } else {
                    toast.error('Invalid image file');
                    return;
                }
            }
            
            if (replyingTo) {
                formData.append('reply_to', replyingTo._id);
            }

            setShowEmojiPicker(false);
            setIsLoading(true);

            const { data } = await api.post('/api/messages/send', formData, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data',
                }
            });

            if (data.success) {
                setText('');
                setImage(null);
                setReplyingTo(null);
                dispatch(addMessage(data.message));
                inputRef.current?.focus();
                sendTypingEvent(false);
                playSound('send');
                toast.success('Message sent successfully');
            } else {
                throw new Error(data.message || 'Failed to send message.');
            }
        } catch (error) {
            console.error('❌ Error sending message:', error);
            if (error.response?.status === 413) {
                toast.error('Image file too large. Please select a smaller image.');
            } else if (error.response?.data?.message) {
                toast.error(error.response.data.message);
            } else {
                toast.error(error.message || 'Failed to send message');
            }
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleTextChange = useCallback((e) => {
        const newValue = e.target.value;
        setText(newValue);
        handleTyping();
        
        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
                const cursorPosition = newValue.length;
                inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
            }
        }, 0);
    }, [handleTyping]);

    const handleEmojiSelect = (item) => {
        let newValue = '';
        if (item.startsWith('http')) {
            newValue = text + ' [STICKER] ';
        } else {
            newValue = text + item;
        }
        
        setText(newValue);
        handleTyping();

        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
                const cursorPosition = newValue.length;
                inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
            }
        }, 0);
    };
    
    // Translation Handlers
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

    // Effects
    useEffect(() => {
        setUser(null);
        setReplyingTo(null);
        setIsTyping(false);
        setShowEmojiPicker(false);
        setShowMessageActions(null);
        setSelectedMessage(null);
        setLongPressActive(false);
        
        fetchUserMessages();
        setIsConnectionsListVisible(false);
        fetchUserLastSeen();
        updateConnectionsWithStatus();

        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, [userId]);

    useEffect(() => {
        if (connections.length > 0) {
            const connectedUser = connections.find(connection => connection._id === userId);
            setUser(connectedUser);
            if (connectionsWithStatus.length === 0) {
                updateConnectionsWithStatus();
            }
        }
    }, [connections, userId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ 
            behavior: "smooth",
            block: "end"
        });
    }, [messages]);

    useEffect(() => {
        setupSSE();
        
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
            if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
            }
        };
    }, [setupSSE]);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            // Emoji Picker
            if (
                pickerRef.current && 
                !pickerRef.current.contains(event.target) &&
                emojiButtonRef.current && 
                !emojiButtonRef.current.contains(event.target)
            ) {
                setShowEmojiPicker(false);
            }

            // Language Dropdown
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }

            // Settings Dropdown
            if (settingsRef.current && !settingsRef.current.contains(event.target)) {
                setShowSettings(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("touchstart", handleClickOutside);
        
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("touchstart", handleClickOutside);
        };
    }, []);

    // Load emojis and stickers
    useEffect(() => {
        // Emojis
        fetch("https://cdn.jsdelivr.net/npm/emoji.json@13.1.0/emoji.json")
          .then(res => res.json())
          .then(data => {
            const emojiChars = data.map(e => e.char);
            setEmojis(emojiChars);
          })
          .catch(error => console.error("Error fetching emojis:", error));

        // Stickers
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

    // Settings Dropdown Component
    const SettingsDropdown = () => (
        <div 
            ref={settingsRef}
            className="absolute right-2 top-14 w-64 bg-white border border-gray-200 rounded-xl shadow-2xl z-30 overflow-hidden"
        >
            <div className="p-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Chat Settings
                </h3>
            </div>
            
            <div className="p-4">
                {/* Sound Toggle */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        {soundsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                        Chat Sounds
                    </div>
                    <button
                        onClick={toggleSounds}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            soundsEnabled ? 'bg-indigo-600' : 'bg-gray-300'
                        }`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                soundsEnabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                        />
                    </button>
                </div>

                {/* Theme Selection */}
                <div className="flex items-center gap-2 mb-3 text-sm font-medium text-gray-700">
                    <Palette className="w-4 h-4" />
                    Chat Theme
                </div>
                <div className="grid grid-cols-5 gap-2">
                    {CHAT_THEMES.map(theme => (
                        <button
                            key={theme.id}
                            onClick={() => handleThemeChange(theme.id)}
                            className={`h-8 rounded-lg border-2 transition-all ${
                                selectedTheme === theme.id 
                                    ? 'border-indigo-500 ring-2 ring-indigo-200' 
                                    : 'border-gray-200 hover:border-gray-300'
                            } ${theme.bgColor}`}
                            title={theme.name}
                        >
                            <div className={`w-2 h-2 rounded-full mx-auto ${theme.bubbleSent.replace('bg-', 'bg-')}`}></div>
                        </button>
                    ))}
                </div>
                
                {/* Clear Chat Option */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                    <button
                        onClick={() => {
                            setShowSettings(false);
                            setShowClearChatConfirm(true);
                        }}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-red-50 hover:bg-red-100 rounded-lg transition-colors text-red-700 font-medium"
                    >
                        <Trash2 className="w-4 h-4" />
                        Clear Chat
                    </button>
                </div>
            </div>
        </div>
    );

    // FIXED: Message Actions Component
    const MessageActions = ({ message, position }) => {
        const isOwnMessage = message.from_user_id?._id === currentUser?.id;

        return (
            <div 
                ref={messageActionsRef}
                className="absolute bg-white border border-gray-200 rounded-lg shadow-2xl z-40 py-2 min-w-32"
                style={{
                    top: position.y - 60,
                    left: Math.max(10, position.x - 80)
                }}
            >
                {/* Reply Button */}
                <button
                    onClick={() => {
                        handleReply(message);
                        setShowMessageActions(null);
                        setLongPressActive(false);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                    <Reply className="w-4 h-4" />
                    Reply
                </button>

                {/* Delete Button (Only for own messages) */}
                {isOwnMessage && (
                    <button
                        onClick={() => {
                            deleteMessage(message._id);
                            setShowMessageActions(null);
                            setLongPressActive(false);
                        }}
                        disabled={isDeleting}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                        <Trash2 className="w-4 h-4" />
                        {isDeleting ? 'Deleting...' : 'Delete'}
                    </button>
                )}
            </div>
        );
    };

    // Clear Chat Confirmation Modal
    const ClearChatConfirmation = () => (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-red-100 rounded-full">
                        <AlertTriangle className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-lg text-gray-900">Clear Chat</h3>
                        <p className="text-gray-600 text-sm mt-1">
                            Are you sure you want to clear this chat? This action cannot be undone.
                        </p>
                    </div>
                </div>
                
                <div className="flex gap-3 mt-6">
                    <button
                        onClick={() => setShowClearChatConfirm(false)}
                        className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                        disabled={isDeleting}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={clearChat}
                        disabled={isDeleting}
                        className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isDeleting ? (
                            <>
                                <Loader className="w-4 h-4 animate-spin" />
                                Clearing...
                            </>
                        ) : (
                            <>
                                <Trash2 className="w-4 h-4" />
                                Clear Chat
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );

    // FIXED: Enhanced Message Bubble Component
    const MessageBubble = ({ message, isSent }) => {
        const [translatedText, setTranslatedText] = useState(null);
        const [isTranslating, setIsTranslating] = useState(false);
        const [viewMode, setViewMode] = useState('original');
        const [showActions, setShowActions] = useState(false);

        // FIXED: Enhanced swipe for reply
        const swipeHandlers = useSwipe(
            () => !isSent && handleSwipeToReply(message),
            () => {}
        );

        // FIXED: Enhanced long press
        const longPressHandlers = useLongPress(
            (event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                setCursorPosition({
                    x: rect.left + (rect.width / 2),
                    y: rect.top
                });
                handleLongPress(message, event);
            },
            () => {
                if (!longPressHandlers.longPressTriggered) {
                    handleMessageClick(message);
                }
            }
        );

        const repliedMessage = messages.find(m => m._id === message.reply_to);

        useEffect(() => {
            if (!isSent) {
                const translateMessage = async () => {
                    if (targetLanguage === 'en' || !message.text) {
                        setTranslatedText(null);
                        setViewMode('original');
                        return;
                    }
                    
                    setTranslatedText(null);
                    setViewMode('translated');
                    
                    setIsTranslating(true);
                    try {
                        const translated = await realTranslate(message.text, targetLanguage);
                        setTranslatedText(translated);
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
            } else {
                setTranslatedText(null);
                setViewMode('original');
            }
        }, [isSent, message.text, targetLanguage]);
        
        const getDisplayText = () => {
            if (isTranslating) return 'Translating...';
            if (isSent || viewMode === 'original' || targetLanguage === 'en' || !translatedText || translatedText.startsWith('Translation failed:')) {
                return message.text;
            }
            return translatedText;
        };

        const displayText = getDisplayText();
        const translationReady = translatedText && !translatedText.startsWith('Translation failed:') && targetLanguage !== 'en';
        
        const time = message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...';

        return (
            <div 
                key={message._id} 
                className={`flex w-full ${isSent ? 'justify-end' : 'justify-start'} mb-3`}
                onMouseEnter={() => setShowActions(true)}
                onMouseLeave={() => setShowActions(false)}
            >
                <div className='max-w-[85%] md:max-w-[70%]'>
                    <div className={`flex flex-col ${isSent ? 'items-end' : 'items-start'}`}>
                        
                        {/* FIXED: Reply Preview */}
                        {repliedMessage && (
                            <div className={`flex items-center gap-2 mb-1 text-xs text-gray-500 max-w-full ${
                                isSent ? 'flex-row-reverse' : 'flex-row'
                            }`}>
                                <Reply className="w-3 h-3 flex-shrink-0" />
                                <div className="flex items-center gap-1 truncate flex-shrink-0">
                                    <User className="w-3 h-3 flex-shrink-0" />
                                    <span className="font-medium truncate flex-shrink-0">
                                        {repliedMessage.from_user_id?.full_name || 'User'}
                                    </span>
                                </div>
                                <span className="truncate flex-1 text-left">
                                    {repliedMessage.text ? 
                                        (repliedMessage.text.length > 30 ? 
                                            repliedMessage.text.substring(0, 30) + '...' : 
                                            repliedMessage.text
                                        ) : 
                                        'Media message'
                                    }
                                </span>
                            </div>
                        )}
                        
                        <div 
                            className={`p-3 text-sm rounded-xl shadow-md transition-all relative group message-bubble ${
                                isSent 
                                ? `${currentTheme.bubbleSent} text-white rounded-br-none` 
                                : `${currentTheme.bubbleReceived} ${currentTheme.textColor} rounded-tl-none border border-gray-200`
                            } ${longPressHandlers.isPressing ? 'bg-opacity-80 transform scale-95' : ''} ${
                                swipeHandlers.isSwiping ? 'transform translate-x-2' : ''
                            }`}
                            {...(!isSent ? {
                                ...swipeHandlers,
                                ...longPressHandlers
                            } : longPressHandlers)}
                            style={{
                                cursor: isSent ? 'context-menu' : 'grab',
                                transition: 'all 0.2s ease',
                                userSelect: 'none'
                            }}
                        >
                            
                            {/* Swipe Indicator for Reply */}
                            {swipeHandlers.swipeDirection === 'left' && !isSent && (
                                <div className="absolute -left-6 top-1/2 transform -translate-y-1/2 text-indigo-500">
                                    <Reply className="w-4 h-4" />
                                </div>
                            )}
                            
                            {/* FIXED: Message Actions */}
                            {showActions && (
                                <button
                                    onClick={() => {
                                        handleReply(message);
                                        setLongPressActive(false);
                                    }}
                                    className={`absolute -top-6 ${
                                        isSent ? '-left-1' : '-right-1'
                                    } p-1 bg-white border border-gray-200 rounded-full shadow-lg hover:bg-gray-50 transition-colors z-10`}
                                    title="Reply to message"
                                >
                                    <CornerUpLeft className="w-3 h-3 text-gray-600" />
                                </button>
                            )}
                            
                            {/* Image Content */}
                            {message.message_type === 'image' && message.media_url && (
                                <img 
                                    src={message.media_url} 
                                    className='w-full max-w-xs md:max-w-sm rounded-lg mb-2 object-cover cursor-pointer' 
                                    alt="Shared media"
                                    onClick={() => window.open(message.media_url, '_blank')} 
                                />
                            )}
                            
                            {/* Voice Message Content */}
                            {message.message_type === 'audio' && message.media_url && (
                                <div className="flex items-center gap-2 mb-2 p-2 bg-black/10 rounded-lg">
                                    <audio 
                                        ref={audioRef}
                                        src={message.media_url} 
                                        controls 
                                        className="flex-1 h-8 max-w-[180px] sm:max-w-[200px]"
                                    />
                                    <span className="text-xs text-gray-600 bg-white/80 px-2 py-1 rounded whitespace-nowrap">
                                        {message.duration ? `${message.duration}s` : 'Voice'}
                                    </span>
                                </div>
                            )}
                            
                            {/* Text Content */}
                            {message.text && (
                                <p className='whitespace-pre-wrap break-words'>
                                    {isTranslating ? 
                                        <Loader className="w-3 h-3 sm:w-4 h-4 animate-spin inline mr-2" /> : 
                                        displayText
                                    }
                                </p>
                            )}
                            
                            {/* Translation Toggle Buttons */}
                            {!isSent && translationReady && (
                                <div className="flex flex-wrap gap-1 sm:gap-2 mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-100">
                                    <button
                                        onClick={() => setViewMode('translated')}
                                        className={`flex items-center text-xs font-semibold px-2 py-1 rounded-lg transition-colors ${
                                            viewMode === 'translated' 
                                                ? 'bg-indigo-500 text-white shadow-md' 
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                        title={`View message in ${currentLangName}`}
                                    >
                                        <LanguagesIcon className="w-3 h-3 mr-1" />
                                        Translation
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
                                        <MessageSquareIcon className="w-3 h-3 mr-1" />
                                        Original
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        {/* Time Stamp with Message Status */}
                        <div className={`flex items-center gap-1 sm:gap-2 mt-1 ${isSent ? 'flex-row-reverse' : 'flex-row'}`}>
                            <p className={`text-xs ${isSent ? 'text-gray-500' : 'text-gray-500'}`}>
                                {time}
                            </p>
                            {isSent && renderMessageStatus(message)}
                        </div>
                    </div>
                </div>

                {/* FIXED: Message Actions Popup */}
                {showMessageActions === message._id && (
                    <MessageActions 
                        message={message} 
                        position={cursorPosition}
                    />
                )}
            </div>
        );
    };

    // Connections List Component
    const ConnectionsList = () => (
        <div 
            ref={connectionsListRef}
            className='w-full md:w-80 border-r border-gray-200 bg-white h-full overflow-y-auto flex-shrink-0'
        >
            <div className='p-4 border-b border-gray-100 sticky top-0 bg-white z-10'>
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
                            onClick={() => {
                                navigate(`/messages/${connection._id}`);
                                setIsConnectionsListVisible(false);
                            }}
                            className={`flex items-center p-3 sm:p-4 border-b border-gray-100 transition-all cursor-pointer ${
                                isSelected ? 'bg-indigo-50 border-l-4 border-indigo-600' : 'hover:bg-gray-50 border-l-4 border-white'
                            }`}
                        >
                            <div className="relative">
                                <img
                                    src={connection.profile_picture || '/default-avatar.png'}
                                    alt={connection.full_name}
                                    className='size-10 sm:size-12 rounded-full object-cover flex-shrink-0'
                                    onError={(e) => { e.target.src = '/default-avatar.png'; }}
                                />
                                <div className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border-2 border-white ${
                                    isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                                }`} />
                            </div>
                            <div className='ml-3 overflow-hidden flex-1'>
                                <p className='font-semibold text-slate-800 truncate text-sm sm:text-base'>{connection.full_name}</p>
                                <p className='text-xs text-gray-500 truncate'>@{connection.username}</p>
                                <p className='text-xs text-gray-400 mt-1 truncate'>
                                    {isOnline ? (
                                        <span className="text-green-600 font-medium flex items-center gap-1">
                                            <Circle className="w-1.5 h-1.5 sm:w-2 sm:h-2 fill-green-500" />
                                            Online
                                        </span>
                                    ) : lastSeen ? (
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
                                            {formatLastSeen(lastSeen)}
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

    // Chat Content Component
    const ChatContent = () => {
        if (!user) {
            return (
                <div className='flex items-center justify-center flex-1 bg-gray-100 p-4'>
                    <div className="text-center p-4">
                        <MessageSquare className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg sm:text-xl font-bold text-gray-700 mb-2">Select a Connection</h3>
                        <p className="text-sm sm:text-base text-gray-500">Choose a user from the list to start chatting.</p>
                    </div>
                </div>
            );
        }
        
        return (
            <div className={`flex flex-col flex-1 h-full w-full ${currentTheme.bgColor} ${currentTheme.textColor} overflow-hidden`}>
                {/* Chat Header - FIXED: Better mobile layout */}
                <div className={`sticky top-0 z-20 flex items-center justify-between p-2 sm:p-4 ${currentTheme.bgColor} shadow-md border-b border-gray-100 flex-shrink-0 w-full`}>
                    
                    {/* User Info */}
                    <div className='flex items-center gap-2 flex-1 min-w-0'>
                        <button 
                            onClick={() => setIsConnectionsListVisible(true)} 
                            className='p-1.5 rounded-full hover:bg-gray-100 transition-colors md:hidden flex-shrink-0' 
                            title="Back to Connections"
                        >
                            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700"/>
                        </button>
                        <div className="relative flex-shrink-0">
                            <img 
                                src={user.profile_picture || '/default-avatar.png'} 
                                alt={user.full_name} 
                                className="size-8 sm:size-10 rounded-full object-cover border-2 border-indigo-300"
                                onError={(e) => { e.target.src = '/default-avatar.png' }}
                            />
                            <div className={`absolute -bottom-1 -right-1 w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full border-2 border-white ${
                                isUserOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                            }`} />
                        </div>
                        <div className="min-w-0 flex-1 ml-2">
                            <p className="font-semibold text-sm sm:text-lg text-slate-800 truncate">{user.full_name}</p>
                            <p className="text-xs text-gray-500 -mt-0.5 flex items-center gap-1 truncate">
                                {isUserOnline ? (
                                    <span className="text-green-600 font-medium flex items-center gap-1">
                                        <Circle className="w-1.5 h-1.5 sm:w-2 sm:h-2 fill-green-500 flex-shrink-0" />
                                        <span className="truncate text-xs sm:text-sm">Online</span>
                                    </span>
                                ) : lastSeen ? (
                                    <span className="text-gray-500 flex items-center gap-1 truncate">
                                        <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
                                        <span className="truncate text-xs">{formatLastSeen(lastSeen)}</span>
                                    </span>
                                ) : (
                                    <span className="text-gray-500 truncate text-xs">Offline</span>
                                )}
                            </p>
                            {/* Enhanced Typing Indicator */}
                            {isTyping && (
                                <div className="text-xs text-indigo-600 font-medium mt-0.5 flex items-center gap-2 truncate">
                                    <div className="flex gap-0.5">
                                        <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce"></div>
                                        <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                                        <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                                    </div>
                                    <span className="truncate text-xs">typing...</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Side Buttons - FIXED: Better mobile layout */}
                    <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                        {/* Language Selector - FIXED: Better mobile layout */}
                        <div className="relative" ref={dropdownRef}>
                            <button
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-gray-100/80 border border-gray-200 text-gray-600 text-xs sm:text-sm font-medium transition-colors hover:bg-gray-200/80"
                                title="Select Target Translation Language"
                            >
                                <LanguagesIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500 flex-shrink-0" />
                                <span className="hidden sm:inline truncate">Translate to:</span>
                                <span className="truncate max-w-[40px] sm:max-w-[80px] font-bold text-slate-800 text-xs sm:text-sm">{currentLangName}</span>
                            </button>
                                    
                            {isDropdownOpen && (
                                <div className="absolute right-0 top-12 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-2xl z-20 overflow-hidden">
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
                                                    <span className="truncate">{lang.name}</span>
                                                    <span className="text-gray-400 text-xs ml-1">({lang.code})</span>
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

                        {/* Settings Button */}
                        <div className="relative">
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className="p-1.5 sm:p-2 rounded-full hover:bg-gray-100 transition-colors"
                                title="Chat Settings"
                            >
                                <MoreVertical className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                            </button>
                            {showSettings && <SettingsDropdown />}
                        </div>
                    </div>
                </div>

                {/* Message Area - FIXED: Better scrolling */}
                <div className={`flex-1 p-2 sm:p-4 overflow-y-auto space-y-1 sm:space-y-2 ${currentTheme.bgColor === 'bg-gray-900' ? 'bg-gray-800' : 'bg-gray-100'} w-full`}>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-32">
                            <Loader className="w-8 h-8 animate-spin text-indigo-600" />
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
                            <MessageSquare className="w-12 h-12 sm:w-16 sm:h-16 mb-3 sm:mb-4 opacity-50" />
                            <p className="text-base sm:text-lg font-medium">No messages yet</p>
                            <p className="text-xs sm:text-sm">Start a conversation by sending a message!</p>
                        </div>
                    ) : (
                        <div className='max-w-4xl mx-auto py-1 sm:py-2 w-full'>
                            {messages.toSorted((a,b) => new Date(a.createdAt) - new Date(b.createdAt)).map((message) => {
                                const senderId = message.from_user_id?._id || message.from_user_id;
                                const currentClerkId = currentUser?.id;
                                const isSent = senderId === currentClerkId;

                                return (
                                    <MessageBubble 
                                        key={message._id} 
                                        message={message} 
                                        isSent={isSent} 
                                    />
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>

                {/* Message Input - FIXED: Better mobile layout */}
                <div className={`sticky bottom-0 z-10 ${currentTheme.bgColor} p-2 sm:p-4 shadow-xl flex-shrink-0 border-t border-gray-200 w-full`}>
                    
                    {/* FIXED: Reply Preview Bar */}
                    {replyingTo && (
                        <div className="max-w-full mx-auto mb-2 p-2 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs sm:text-sm text-indigo-800 flex-1 min-w-0">
                                <Reply className="w-3 h-3 flex-shrink-0" />
                                <span className="font-medium flex-shrink-0 hidden sm:inline">Replying to</span>
                                <span className="text-indigo-600 truncate flex-1 text-left text-xs sm:text-sm">
                                    {replyingTo.text ? 
                                        (replyingTo.text.length > 30 ? 
                                            replyingTo.text.substring(0, 30) + '...' : 
                                            replyingTo.text
                                        ) : 
                                        'Media message'
                                    }
                                </span>
                            </div>
                            <button
                                onClick={cancelReply}
                                className="p-1 hover:bg-indigo-100 rounded-full transition-colors flex-shrink-0 ml-1"
                                title="Cancel reply"
                            >
                                <X className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-600" />
                            </button>
                        </div>
                    )}

                    {/* Voice Recording Indicator */}
                    {isRecording && (
                        <div className="max-w-full mx-auto mb-2 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></div>
                                <span className="text-red-700 font-medium text-xs sm:text-sm">Recording... {recordingTime}s</span>
                            </div>
                            <button
                                onClick={stopRecording}
                                className="px-2 py-1 sm:px-3 sm:py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs sm:text-sm"
                            >
                                Stop
                            </button>
                        </div>
                    )}

                    {/* Emoji Picker - FIXED: Better positioning */}
                    {showEmojiPicker && (
                        <div 
                            ref={pickerRef}
                            className='absolute bottom-full left-2 right-2 sm:left-auto sm:right-4 sm:transform w-auto max-w-full sm:max-w-xl p-1 sm:p-2 z-30'
                        >
                            <div className='bg-white border border-gray-200 rounded-xl shadow-2xl h-48 sm:h-64 flex flex-col'>
                                <div className='flex justify-between items-center p-2 sm:p-3 border-b border-gray-100'>
                                    <div className='flex gap-3 sm:gap-4'>
                                        <button 
                                            onClick={() => setActiveTab('emojis')}
                                            className={`font-semibold text-xs sm:text-sm pb-1 transition ${activeTab === 'emojis' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            Emojis
                                        </button>
                                        <button 
                                            onClick={() => setActiveTab('stickers')}
                                            className={`font-semibold text-xs sm:text-sm pb-1 transition ${activeTab === 'stickers' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            Stickers
                                        </button>
                                    </div>
                                    <button 
                                        onClick={() => setShowEmojiPicker(false)}
                                        className='p-1 rounded-full hover:bg-red-100 text-gray-500 hover:text-red-600 transition'
                                        title="Close Picker"
                                    >
                                        <X className='size-3 sm:size-4'/>
                                    </button>
                                </div>
                                <div className='p-2 sm:p-4 flex-1 overflow-y-auto'>
                                    {activeTab === 'emojis' && (
                                        <div className='grid grid-cols-8 sm:grid-cols-10 gap-0.5 sm:gap-1'>
                                            {emojis.slice(0, 120).map((emoji, index) => (
                                                <button 
                                                    key={index}
                                                    onClick={() => handleEmojiSelect(emoji)} 
                                                    className='text-lg sm:text-xl hover:bg-gray-100 p-0.5 sm:p-1 rounded transition flex items-center justify-center aspect-square'
                                                    title={emoji}
                                                >
                                                    {emoji}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {activeTab === 'stickers' && (
                                        <div className='grid grid-cols-4 sm:grid-cols-5 gap-1 sm:gap-2'>
                                            {stickers.slice(0, 20).map((stickerUrl, index) => (
                                                <button 
                                                    key={index}
                                                    onClick={() => handleEmojiSelect(stickerUrl)} 
                                                    className='p-1 sm:p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition flex items-center justify-center aspect-square'
                                                    title="Sticker"
                                                >
                                                    <img 
                                                        src={stickerUrl} 
                                                        alt={`Sticker ${index + 1}`} 
                                                        className="max-h-full max-w-full object-contain"
                                                        onError={(e) => { e.target.style.display = 'none'; }}
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* FIXED: Enhanced Image Preview */}
                    {image && (
                        <div className='max-w-full mx-auto mb-2 p-2 bg-indigo-50 border border-indigo-200 rounded-lg'>
                            <div className='flex items-center justify-between'>
                                <div className='flex items-center gap-2 flex-1 min-w-0'>
                                    <img 
                                        src={URL.createObjectURL(image)} 
                                        alt="Preview" 
                                        className='h-10 w-10 sm:h-12 sm:w-12 object-cover rounded-lg flex-shrink-0 border border-indigo-200'
                                    />
                                    <div className="min-w-0 flex-1 ml-2">
                                        <p className='text-xs sm:text-sm font-medium text-indigo-800 truncate'>{image.name}</p>
                                        <p className='text-xs text-indigo-600'>{(image.size / 1024 / 1024).toFixed(2)} MB</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setImage(null)} 
                                    className='p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors flex-shrink-0 ml-2'
                                    title="Remove image"
                                >
                                    <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Input Row - FIXED: Better mobile layout */}
                    <form 
                        onSubmit={sendMessage}
                        className='flex items-center gap-1 sm:gap-2 p-1.5 sm:p-2 bg-white w-full max-w-full mx-auto border border-gray-300 rounded-full shadow-lg'
                    >
                      
                        {/* Emoji/Sticker Button */}
                        <button
                            ref={emojiButtonRef}
                            type="button"
                            onClick={() => setShowEmojiPicker(prev => !prev)}
                            className={`flex-shrink-0 size-7 sm:size-10 flex items-center justify-center rounded-full transition ${showEmojiPicker ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:text-indigo-500'}`}
                            title="Select Emoji or Sticker"
                        >
                            <Smile className='size-3.5 sm:size-5'/>
                        </button>

                        {/* Voice Message Button */}
                        <button
                            type="button"
                            onClick={isRecording ? stopRecording : startRecording}
                            disabled={isLoading}
                            className={`flex-shrink-0 size-7 sm:size-10 flex items-center justify-center rounded-full transition ${
                                isRecording 
                                    ? 'bg-red-100 text-red-600 animate-pulse' 
                                    : 'text-gray-400 hover:text-red-500 disabled:opacity-50'
                            }`}
                            title={isRecording ? 'Stop Recording' : 'Record Voice Message'}
                        >
                            {isRecording ? <Square className='size-3.5 sm:size-5' /> : <Mic className='size-3.5 sm:size-5' />}
                        </button>

                        <input 
                            type="text" 
                            ref={inputRef} 
                            className='flex-1 py-1.5 px-2 sm:px-3 outline-none text-slate-700 placeholder:text-gray-400 bg-transparent text-sm sm:text-base w-full'
                            placeholder='Type a message...'
                            onChange={handleTextChange} 
                            value={text} 
                            onFocus={() => setShowEmojiPicker(false)}
                            disabled={isLoading}
                        />

                        {/* FIXED: Enhanced Image Upload */}
                        <label htmlFor="image" className='flex-shrink-0'>
                            <div className={`p-1 sm:p-2 cursor-pointer rounded-full hover:bg-gray-100 transition-colors ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`} title="Add Image">
                                <ImageIcon className='size-3.5 sm:size-5 text-indigo-500'/>
                            </div>
                            <input 
                                type="file" 
                                id='image' 
                                accept="image/*" 
                                hidden 
                                onChange={handleImageChange}
                                onClick={(e) => e.target.value = null}
                                disabled={isLoading}
                            />
                        </label>

                        {/* Send Button */}
                        <button 
                            type="submit"
                            disabled={(!text.trim() && !image) || isLoading}
                            className={`flex-shrink-0 cursor-pointer text-white p-1.5 sm:p-3 rounded-full transition-all ${
                                (!text.trim() && !image) || isLoading
                                    ? 'bg-gray-400 cursor-not-allowed' 
                                    : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95'
                            }`}
                            title="Send"
                        >
                            {isLoading ? (
                                <Loader className="size-3 sm:size-4 animate-spin" />
                            ) : (
                                <SendHorizonal size={14} className="sm:size-5"/>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        );
    };

    // Main Render - FIXED: Better responsive layout
    return (
        <div className='flex h-screen w-screen overflow-hidden bg-white'>
            {/* Connections List */}
            <div className={`h-full transition-all duration-300 fixed md:relative z-40 md:z-auto ${
                isConnectionsListVisible 
                    ? 'w-full md:w-80 inset-0' 
                    : 'hidden md:block md:w-80'
            }`}>
                <ConnectionsList />
            </div>

            {/* Chat Area */}
            <div className={`h-full flex-1 transition-all duration-300 w-full ${
                isConnectionsListVisible ? 'hidden md:flex' : 'flex'
            }`}>
                <ChatContent />
            </div>

            {/* Mobile Overlay */}
            {isConnectionsListVisible && (
                <div 
                    className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
                    onClick={() => setIsConnectionsListVisible(false)}
                />
            )}

            {/* Clear Chat Confirmation Modal */}
            {showClearChatConfirm && <ClearChatConfirmation />}
        </div>
    );
};

export default ChatBox;