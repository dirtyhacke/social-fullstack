import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    X, Video, Phone, PhoneOff, Mic, MicOff, Volume2, Maximize2,
    MessageSquare, UserPlus, Search, MoreVertical, PhoneCall,
    Users, User, VideoOff, Camera, CameraOff, Wifi, WifiOff, Signal,
    ArrowLeft, Clock, AlertCircle, CheckCircle, XCircle, Headphones,
    RefreshCw, Zap, Battery, BatteryCharging
} from 'lucide-react';
import { useSelector } from 'react-redux';
import { useUser, useAuth } from '@clerk/clerk-react';
import { Howl } from 'howler';
import toast from 'react-hot-toast';

// Sound URLs
const SOUND_URLS = {
    ringing: 'https://assets.mixkit.co/active_storage/sfx/1010/1010-preview.mp3',
    dialing: 'https://assets.mixkit.co/active_storage/sfx/1008/1008-preview.mp3',
    callEnd: 'https://assets.mixkit.co/active_storage/sfx/257/257-preview.mp3',
    callConnected: 'https://assets.mixkit.co/active_storage/sfx/256/256-preview.mp3',
    messageTone: 'https://assets.mixkit.co/active_storage/sfx/126/126-preview.mp3'
};

const Calling = ({ onClose }) => {
    // State
    const [activeTab, setActiveTab] = useState('all');
    const [callType, setCallType] = useState(null);
    const [callStatus, setCallStatus] = useState('idle');
    const [selectedUser, setSelectedUser] = useState(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOn, setIsVideoOn] = useState(true);
    const [isSpeakerOn, setIsSpeakerOn] = useState(true);
    const [callDuration, setCallDuration] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [incomingCall, setIncomingCall] = useState(null);
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [callQuality, setCallQuality] = useState('excellent');
    const [showCallLog, setShowCallLog] = useState(false);
    const [callHistory, setCallHistory] = useState([]);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [isSocketConnected, setIsSocketConnected] = useState(false);
    const [connectionAttempts, setConnectionAttempts] = useState(0);
    const [networkStatus, setNetworkStatus] = useState('online');

    // Refs
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerConnectionRef = useRef(null);
    const signalingSocketRef = useRef(null);
    const callDurationIntervalRef = useRef(null);
    const soundRefs = useRef({});
    const reconnectTimeoutRef = useRef(null);
    const callIdRef = useRef(null);
    const connectionQueueRef = useRef([]);
    const mediaStreamRef = useRef(null);

    // Data from Redux
    const { connections } = useSelector((state) => state.connections);
    const { user: currentUser } = useUser();
    const { getToken } = useAuth();

    // Get signaling URL
    const getSignalingUrl = () => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        return `${protocol}//${host}/api/webrtc-signaling`;
    };

    // Initialize sounds
    useEffect(() => {
        soundRefs.current = {
            ringing: new Howl({ 
                src: [SOUND_URLS.ringing], 
                loop: true, 
                volume: 0.4,
                html5: true,
                onloaderror: () => console.log('Failed to load ringing sound')
            }),
            dialing: new Howl({ 
                src: [SOUND_URLS.dialing], 
                loop: true, 
                volume: 0.3,
                html5: true,
                onloaderror: () => console.log('Failed to load dialing sound')
            }),
            callEnd: new Howl({ 
                src: [SOUND_URLS.callEnd], 
                volume: 0.5,
                html5: true 
            }),
            callConnected: new Howl({ 
                src: [SOUND_URLS.callConnected], 
                volume: 0.5,
                html5: true 
            }),
            messageTone: new Howl({ 
                src: [SOUND_URLS.messageTone], 
                volume: 0.3,
                html5: true 
            })
        };

        // Load call history from localStorage
        const savedHistory = localStorage.getItem('callHistory');
        if (savedHistory) {
            setCallHistory(JSON.parse(savedHistory));
        }

        // Network status listener
        const handleOnline = () => {
            setNetworkStatus('online');
            toast.success('Back online');
            if (!isSocketConnected) {
                connectSignaling();
            }
        };

        const handleOffline = () => {
            setNetworkStatus('offline');
            toast.error('Network connection lost');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            Object.values(soundRefs.current).forEach(sound => {
                if (sound.playing()) sound.stop();
                sound.unload();
            });
            
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            
            cleanupMediaStream();
            cleanupWebSocket();
            
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Cleanup functions
    const cleanupMediaStream = () => {
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => {
                track.stop();
                track.enabled = false;
            });
            mediaStreamRef.current = null;
        }
        setLocalStream(null);
    };

    const cleanupWebSocket = () => {
        if (signalingSocketRef.current) {
            signalingSocketRef.current.close();
            signalingSocketRef.current = null;
        }
        setIsSocketConnected(false);
    };

    // Safe WebSocket send with retry
    const safeWebSocketSend = (message, retryCount = 0) => {
        if (!signalingSocketRef.current) {
            console.error('No WebSocket connection');
            return false;
        }

        const socket = signalingSocketRef.current;
        
        if (socket.readyState === WebSocket.OPEN) {
            try {
                socket.send(JSON.stringify(message));
                return true;
            } catch (error) {
                console.error('WebSocket send error:', error);
                return false;
            }
        } 
        else if (socket.readyState === WebSocket.CONNECTING) {
            // Queue the message for when connection opens
            connectionQueueRef.current.push(message);
            
            if (retryCount < 3) {
                setTimeout(() => {
                    safeWebSocketSend(message, retryCount + 1);
                }, 500);
            }
            return false;
        }
        else {
            console.error('WebSocket not in OPEN state:', socket.readyState);
            
            if (retryCount < 2 && callStatus !== 'idle') {
                setTimeout(() => {
                    connectSignaling().then(() => {
                        safeWebSocketSend(message, retryCount + 1);
                    });
                }, 1000);
            }
            return false;
        }
    };

    // WebSocket Signaling Connection
    const connectSignaling = useCallback(async () => {
        try {
            // Don't reconnect if already connecting/connected
            if (signalingSocketRef.current?.readyState === WebSocket.CONNECTING) {
                console.log('WebSocket already connecting');
                return signalingSocketRef.current;
            }

            if (signalingSocketRef.current?.readyState === WebSocket.OPEN) {
                console.log('WebSocket already connected');
                return signalingSocketRef.current;
            }

            setIsReconnecting(true);
            setConnectionAttempts(prev => prev + 1);

            const token = await getToken();
            if (!token) {
                toast.error('Authentication required');
                setIsReconnecting(false);
                return null;
            }

            const socketUrl = `${getSignalingUrl()}?token=${token}`;
            console.log(`🔗 Connecting to signaling (attempt ${connectionAttempts + 1}):`, socketUrl);
            
            return new Promise((resolve, reject) => {
                const socket = new WebSocket(socketUrl);
                signalingSocketRef.current = socket;

                // Set timeout for connection
                const connectionTimeout = setTimeout(() => {
                    if (socket.readyState !== WebSocket.OPEN) {
                        socket.close();
                        reject(new Error('Connection timeout after 10s'));
                        toast.error('Connection timeout');
                    }
                }, 10000);

                socket.onopen = () => {
                    clearTimeout(connectionTimeout);
                    console.log('✅ WebRTC signaling connected');
                    setIsSocketConnected(true);
                    setIsReconnecting(false);
                    setConnectionAttempts(0);
                    
                    // Send connection confirmation
                    socket.send(JSON.stringify({
                        type: 'hello',
                        userId: currentUser?.id,
                        timestamp: Date.now(),
                        userAgent: navigator.userAgent
                    }));
                    
                    // Process queued messages
                    if (connectionQueueRef.current.length > 0) {
                        console.log(`Processing ${connectionQueueRef.current.length} queued messages`);
                        connectionQueueRef.current.forEach(msg => {
                            safeWebSocketSend(msg);
                        });
                        connectionQueueRef.current = [];
                    }
                    
                    toast.dismiss();
                    resolve(socket);
                };

                socket.onmessage = async (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        console.log('📨 Signaling message:', message.type);
                        await handleSignalingMessage(message);
                    } catch (error) {
                        console.error('❌ Error parsing message:', error);
                    }
                };

                socket.onerror = (error) => {
                    clearTimeout(connectionTimeout);
                    console.error('❌ WebSocket error:', error);
                    setIsSocketConnected(false);
                    reject(error);
                };

                socket.onclose = (event) => {
                    clearTimeout(connectionTimeout);
                    console.log('🔌 WebSocket closed:', event.code, event.reason);
                    setIsSocketConnected(false);
                    
                    if (callStatus !== 'idle' && callStatus !== 'ended') {
                        const retryDelay = Math.min(5000, 1000 * Math.pow(2, connectionAttempts));
                        console.log(`Will retry in ${retryDelay}ms`);
                        
                        setTimeout(() => {
                            if (callStatus !== 'idle') {
                                connectSignaling();
                            }
                        }, retryDelay);
                    }
                };
            });

        } catch (error) {
            console.error('❌ Failed to connect signaling:', error);
            setIsReconnecting(false);
            
            if (connectionAttempts < 3) {
                setTimeout(() => {
                    connectSignaling();
                }, 2000);
            } else {
                toast.error('Failed to connect to call service');
            }
            
            throw error;
        }
    }, [getToken, currentUser?.id, callStatus, connectionAttempts]);

    // Handle signaling messages
    const handleSignalingMessage = async (message) => {
        switch (message.type) {
            case 'connected':
                console.log('✅ Connected to signaling server');
                toast.success('Connected to call service');
                break;
                
            case 'incoming-call':
                await handleIncomingCall(message);
                break;
                
            case 'call-answer':
                await handleCallAnswer(message);
                break;
                
            case 'ice-candidate':
                await handleNewICECandidate(message);
                break;
                
            case 'call-rejected':
                handleCallRejected(message);
                break;
                
            case 'call-ended':
                handleRemoteCallEnded(message);
                break;
                
            case 'user-offline':
                toast.error(`${message.targetUserId ? 'User' : 'User'} is currently offline`);
                if (callStatus === 'calling') {
                    endCall('User offline');
                }
                break;
                
            case 'offer-sent':
                console.log('📞 Call offer sent successfully');
                break;
                
            case 'pong':
                // Keep-alive response
                break;
                
            default:
                console.log('📨 Unknown message:', message.type);
        }
    };

    // Handle incoming call
    const handleIncomingCall = async (message) => {
        const caller = connections.find(c => c._id === message.callerId);
        if (!caller) {
            console.log('❌ Caller not found in connections');
            return;
        }

        // Stop any current sounds
        Object.values(soundRefs.current).forEach(sound => {
            if (sound.playing()) sound.stop();
        });
        
        // Play ringing sound
        soundRefs.current.ringing.play();
        
        setIncomingCall({
            user: caller,
            type: message.callType,
            offer: message.offer,
            callId: message.callId,
            timestamp: new Date().toISOString()
        });
        
        // Show notification
        if (document.hidden && Notification.permission === 'granted') {
            const notification = new Notification(`Incoming ${message.callType} call`, {
                body: `From: ${caller.full_name}`,
                icon: caller.profile_picture || '/default-avatar.png',
                requireInteraction: true,
                tag: 'incoming-call'
            });
            
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
            
            // Auto close after 30 seconds
            setTimeout(() => notification.close(), 30000);
        }
    };

    // WebRTC Configuration
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
        iceTransportPolicy: 'all'
    };

    // Start a new call - FIXED VERSION
    const startCall = async (user, type) => {
        if (!user || !user._id) {
            toast.error('Invalid user selected');
            return;
        }

        if (callStatus !== 'idle') {
            toast.error('Please end current call first');
            return;
        }

        setIsConnecting(true);
        setSelectedUser(user);
        setCallType(type);
        
        try {
            // Step 1: Ensure WebSocket connection is ready
            let socket = signalingSocketRef.current;
            if (!socket || socket.readyState !== WebSocket.OPEN) {
                console.log('WebSocket not ready, connecting...');
                toast.loading('Connecting to call service...');
                
                socket = await connectSignaling();
                
                // Wait a bit for connection to stabilize
                await new Promise(resolve => setTimeout(resolve, 300));
                
                if (!socket || socket.readyState !== WebSocket.OPEN) {
                    throw new Error('WebSocket connection failed');
                }
                
                toast.dismiss();
                toast.success('Connected!');
            }

            // Step 2: Get media permissions
            toast.loading('Requesting camera/microphone access...');
            
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1
                },
                video: type === 'video' ? {
                    width: { ideal: 640, max: 1280 },
                    height: { ideal: 480, max: 720 },
                    frameRate: { ideal: 24, max: 30 },
                    facingMode: 'user'
                } : false
            };

            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                mediaStreamRef.current = stream;
            } catch (mediaError) {
                console.error('Media error:', mediaError);
                
                if (mediaError.name === 'NotAllowedError') {
                    toast.error('Please allow camera/microphone access in browser settings');
                } else if (mediaError.name === 'NotFoundError') {
                    toast.error('No camera/microphone found');
                    
                    // Try audio only
                    constraints.video = false;
                    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    mediaStreamRef.current = stream;
                    setCallType('voice'); // Force voice call
                } else {
                    throw mediaError;
                }
            }
            
            setLocalStream(stream);
            
            if (localVideoRef.current && type === 'video') {
                localVideoRef.current.srcObject = stream;
            }

            toast.dismiss();
            toast.loading('Setting up call...');

            // Step 3: Create peer connection
            const pc = new RTCPeerConnection(configuration);
            peerConnectionRef.current = pc;

            // Add local tracks
            stream.getTracks().forEach(track => {
                pc.addTrack(track, stream);
            });

            // ICE candidate handler
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    // Wait for WebSocket to be ready
                    setTimeout(() => {
                        const success = safeWebSocketSend({
                            type: 'ice-candidate',
                            targetUserId: user._id,
                            candidate: event.candidate,
                            callId: callIdRef.current
                        });
                        
                        if (!success) {
                            console.warn('Failed to send ICE candidate');
                        }
                    }, 100);
                }
            };

            // Track connection state
            pc.onconnectionstatechange = () => {
                console.log('📶 Peer connection state:', pc.connectionState);
                
                switch (pc.connectionState) {
                    case 'connected':
                        setCallQuality('excellent');
                        toast.success('Call connected!');
                        break;
                    case 'disconnected':
                        setCallQuality('poor');
                        toast.warning('Connection unstable');
                        break;
                    case 'failed':
                        toast.error('Call failed. Reconnecting...');
                        attemptReconnectCall();
                        break;
                    case 'closed':
                        console.log('Peer connection closed');
                        break;
                }
            };

            // Handle remote stream
            pc.ontrack = (event) => {
                console.log('📹 Received remote stream');
                const [remoteStream] = event.streams;
                setRemoteStream(remoteStream);
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream;
                }
            };

            // Create call ID
            const callId = `call_${currentUser?.id}_${user._id}_${Date.now()}`;
            callIdRef.current = callId;

            // Step 4: Create and send offer
            toast.loading('Creating call...');
            
            const offerOptions = {
                offerToReceiveAudio: true,
                offerToReceiveVideo: type === 'video'
            };

            const offer = await pc.createOffer(offerOptions);
            await pc.setLocalDescription(offer);

            // Wait to ensure WebSocket is ready
            await new Promise(resolve => setTimeout(resolve, 200));

            // Send offer via WebSocket
            const offerMessage = {
                type: 'call-offer',
                targetUserId: user._id,
                callType: type,
                offer: offer,
                callId: callId
            };

            const sent = safeWebSocketSend(offerMessage);
            
            if (!sent) {
                // Queue and retry
                connectionQueueRef.current.push(offerMessage);
                
                setTimeout(() => {
                    if (connectionQueueRef.current.length > 0) {
                        console.log('Retrying queued offer...');
                        safeWebSocketSend(offerMessage);
                    }
                }, 1000);
            }

            setCallStatus('calling');
            soundRefs.current.dialing.play();
            setIsConnecting(false);

            // Add to call history
            addToCallHistory({
                userId: user._id,
                userName: user.full_name,
                type: type,
                direction: 'outgoing',
                timestamp: new Date().toISOString(),
                status: 'calling'
            });

            toast.dismiss();

        } catch (error) {
            console.error('❌ Error starting call:', error);
            
            let errorMessage = 'Failed to start call';
            if (error.message.includes('WebSocket')) {
                errorMessage = 'Connection failed. Please try again.';
            } else if (error.name === 'NotAllowedError') {
                errorMessage = 'Please allow camera/microphone access';
            } else if (error.name === 'NotFoundError') {
                errorMessage = 'No camera/microphone found';
            }
            
            toast.error(errorMessage);
            
            // Clean up
            cleanupMediaStream();
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
                peerConnectionRef.current = null;
            }
            
            setCallStatus('idle');
            setSelectedUser(null);
            setCallType(null);
            setIsConnecting(false);
        }
    };

    // Attempt to reconnect call
    const attemptReconnectCall = () => {
        if (selectedUser && callIdRef.current) {
            console.log('Attempting to reconnect call...');
            
            setTimeout(async () => {
                if (callStatus === 'calling' || callStatus === 'connected') {
                    try {
                        // Re-establish WebSocket connection
                        await connectSignaling();
                        
                        // Re-send offer
                        if (peerConnectionRef.current) {
                            const offer = await peerConnectionRef.current.createOffer();
                            await peerConnectionRef.current.setLocalDescription(offer);
                            
                            safeWebSocketSend({
                                type: 'call-offer',
                                targetUserId: selectedUser._id,
                                callType: callType,
                                offer: offer,
                                callId: callIdRef.current
                            });
                        }
                    } catch (error) {
                        console.error('Reconnect failed:', error);
                    }
                }
            }, 2000);
        }
    };

    // Accept incoming call
    const acceptIncomingCall = async () => {
        if (!incomingCall) return;

        soundRefs.current.ringing.stop();
        setSelectedUser(incomingCall.user);
        setCallType(incomingCall.type);
        setCallStatus('connecting');
        callIdRef.current = incomingCall.callId;

        try {
            // Ensure WebSocket is connected
            if (!signalingSocketRef.current || signalingSocketRef.current.readyState !== WebSocket.OPEN) {
                await connectSignaling();
            }

            // Get local media
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: incomingCall.type === 'video' ? {
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                } : false
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            mediaStreamRef.current = stream;
            setLocalStream(stream);
            
            if (localVideoRef.current && incomingCall.type === 'video') {
                localVideoRef.current.srcObject = stream;
            }

            // Create peer connection
            const pc = new RTCPeerConnection(configuration);
            peerConnectionRef.current = pc;

            // Add local tracks
            stream.getTracks().forEach(track => {
                pc.addTrack(track, stream);
            });

            // ICE candidate handler
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    safeWebSocketSend({
                        type: 'ice-candidate',
                        targetUserId: incomingCall.user._id,
                        candidate: event.candidate,
                        callId: incomingCall.callId
                    });
                }
            };

            // Handle remote stream
            pc.ontrack = (event) => {
                const [remoteStream] = event.streams;
                setRemoteStream(remoteStream);
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream;
                }
            };

            // Set remote description from offer
            await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));

            // Create and send answer
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            // Send answer via signaling
            safeWebSocketSend({
                type: 'call-answer',
                callerId: incomingCall.user._id,
                answer: answer,
                callId: incomingCall.callId
            });

            setCallStatus('connected');
            soundRefs.current.callConnected.play();
            startCallTimer();

            // Add to call history
            addToCallHistory({
                userId: incomingCall.user._id,
                userName: incomingCall.user.full_name,
                type: incomingCall.type,
                direction: 'incoming',
                timestamp: new Date().toISOString(),
                status: 'answered',
                duration: 0
            });

            setIncomingCall(null);

        } catch (error) {
            console.error('❌ Error accepting call:', error);
            toast.error('Failed to accept call');
            endCall('Accept failed');
        }
    };

    // Handle call answer
    const handleCallAnswer = async (message) => {
        if (!peerConnectionRef.current) return;

        try {
            await peerConnectionRef.current.setRemoteDescription(
                new RTCSessionDescription(message.answer)
            );
            
            if (callStatus === 'calling') {
                setCallStatus('connected');
                soundRefs.current.dialing.stop();
                soundRefs.current.callConnected.play();
                startCallTimer();
                
                // Update call history
                updateCallHistory('connected');
            }
        } catch (error) {
            console.error('❌ Error setting remote description:', error);
        }
    };

    // Handle ICE candidates
    const handleNewICECandidate = async (message) => {
        if (!peerConnectionRef.current || !message.candidate) return;
        
        try {
            await peerConnectionRef.current.addIceCandidate(
                new RTCIceCandidate(message.candidate)
            );
        } catch (error) {
            console.error('❌ Error adding ICE candidate:', error);
        }
    };

    // Handle call rejection
    const handleCallRejected = (message) => {
        toast.error(`Call rejected: ${message.reason || 'User busy'}`);
        endCall('Rejected');
    };

    // Handle remote call end
    const handleRemoteCallEnded = (message) => {
        toast.info('Call ended by other user');
        endCall('Remote ended');
    };

    // Reject incoming call
    const rejectIncomingCall = () => {
        soundRefs.current.ringing.stop();
        
        if (incomingCall) {
            safeWebSocketSend({
                type: 'call-reject',
                callerId: incomingCall.user._id,
                callId: incomingCall.callId,
                reason: 'User rejected'
            });
            
            // Add to call history
            addToCallHistory({
                userId: incomingCall.user._id,
                userName: incomingCall.user.full_name,
                type: incomingCall.type,
                direction: 'incoming',
                timestamp: new Date().toISOString(),
                status: 'rejected'
            });
        }
        
        setIncomingCall(null);
        soundRefs.current.messageTone.play();
    };

    // End call
    const endCall = (reason = 'User ended') => {
        console.log('📴 Ending call:', reason);
        
        // Stop all sounds
        Object.values(soundRefs.current).forEach(sound => {
            if (sound.playing()) sound.stop();
        });
        
        // Stop call timer
        if (callDurationIntervalRef.current) {
            clearInterval(callDurationIntervalRef.current);
            callDurationIntervalRef.current = null;
        }

        // Close peer connection
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }

        // Send end call message if connected
        if (selectedUser && callIdRef.current) {
            safeWebSocketSend({
                type: 'end-call',
                targetUserId: selectedUser._id,
                callId: callIdRef.current,
                reason: reason
            });
        }

        // Play end sound
        soundRefs.current.callEnd.play();

        // Update call history with duration
        if (selectedUser && callDuration > 0) {
            updateCallHistory('ended', callDuration);
        }

        // Cleanup
        cleanupMediaStream();
        setRemoteStream(null);
        callIdRef.current = null;
        connectionQueueRef.current = [];

        // Reset state
        setCallStatus('ended');
        setTimeout(() => {
            setCallStatus('idle');
            setSelectedUser(null);
            setCallType(null);
            setCallDuration(0);
            setIsMuted(false);
            setIsVideoOn(true);
        }, 1500);
    };

    // Start call timer
    const startCallTimer = () => {
        if (callDurationIntervalRef.current) {
            clearInterval(callDurationIntervalRef.current);
        }
        
        callDurationIntervalRef.current = setInterval(() => {
            setCallDuration(prev => {
                const newDuration = prev + 1;
                
                // Update quality randomly (for demo)
                if (newDuration % 30 === 0) {
                    const qualities = ['excellent', 'good', 'fair', 'poor'];
                    setCallQuality(qualities[Math.floor(Math.random() * qualities.length)]);
                }
                
                return newDuration;
            });
        }, 1000);
    };

    // Call history management
    const addToCallHistory = (call) => {
        const newHistory = [call, ...callHistory.slice(0, 49)];
        setCallHistory(newHistory);
        localStorage.setItem('callHistory', JSON.stringify(newHistory));
    };

    const updateCallHistory = (status, duration = 0) => {
        if (callHistory.length > 0) {
            const updatedHistory = [...callHistory];
            const latestCall = updatedHistory[0];
            
            if (latestCall.status === 'calling' || latestCall.status === 'answered') {
                latestCall.status = status;
                latestCall.duration = duration;
                latestCall.endedAt = new Date().toISOString();
                
                setCallHistory(updatedHistory);
                localStorage.setItem('callHistory', JSON.stringify(updatedHistory));
            }
        }
    };

    // Format duration
    const formatDuration = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Filter users
    const filteredUsers = connections.filter(user => {
        if (!user || !user.full_name) return false;
        
        const matchesSearch = 
            user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (user.username && user.username.toLowerCase().includes(searchQuery.toLowerCase()));
        
        if (activeTab === 'online') {
            return matchesSearch;
        }
        if (activeTab === 'recent') {
            const recentCall = callHistory.find(call => call.userId === user._id);
            return matchesSearch && recentCall;
        }
        
        return matchesSearch;
    });

    // Connect to signaling on mount
    useEffect(() => {
        connectSignaling();
        
        // Request notification permission
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }
        
        // Handle beforeunload
        const handleBeforeUnload = () => {
            if (callStatus !== 'idle') {
                endCall('Page closed');
            }
        };
        
        window.addEventListener('beforeunload', handleBeforeUnload);
        
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            cleanupWebSocket();
            cleanupMediaStream();
        };
    }, []);

    // Render UI
    return (
        <div className="fixed inset-0 z-[70] bg-white">
            {/* Connection Status Bar */}
            <div className={`absolute top-0 left-0 right-0 z-50 py-1 px-4 text-xs font-medium text-center ${
                isReconnecting ? 'bg-yellow-500 text-white' : 
                isSocketConnected ? 'bg-green-500 text-white' : 
                'bg-red-500 text-white'
            }`}>
                {isReconnecting ? '🔄 Reconnecting...' : 
                 isSocketConnected ? `✅ Connected ${connectionAttempts > 0 ? `(Attempt ${connectionAttempts})` : ''}` : 
                 '🔴 Disconnected'}
            </div>

            {/* Incoming Call Modal */}
            {incomingCall && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/90 backdrop-blur-sm">
                    <div className="bg-gradient-to-br from-gray-900 to-black rounded-3xl p-8 max-w-md w-full mx-4 border border-gray-700 shadow-2xl">
                        <div className="text-center">
                            {/* Animated rings */}
                            <div className="relative inline-block mb-6">
                                <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping"></div>
                                <div className="absolute inset-4 rounded-full bg-blue-500/30 animate-ping" style={{animationDelay: '0.2s'}}></div>
                                <div className="absolute inset-8 rounded-full bg-blue-500/40 animate-ping" style={{animationDelay: '0.4s'}}></div>
                                
                                <img 
                                    src={incomingCall.user.profile_picture || '/default-avatar.png'}
                                    alt={incomingCall.user.full_name}
                                    className="relative w-28 h-28 rounded-full border-4 border-blue-500/50 object-cover"
                                />
                            </div>
                            
                            <h2 className="text-3xl font-bold text-white mb-2">{incomingCall.user.full_name}</h2>
                            <p className="text-gray-300 mb-4">
                                {incomingCall.type === 'video' ? '📹 Incoming Video Call' : '📞 Incoming Voice Call'}
                            </p>
                            <p className="text-sm text-gray-400 mb-8">
                                {new Date(incomingCall.timestamp).toLocaleTimeString()}
                            </p>
                            
                            <div className="flex justify-center gap-8">
                                <button
                                    onClick={rejectIncomingCall}
                                    className="p-5 bg-red-500 hover:bg-red-600 text-white rounded-full hover:scale-110 transition-all shadow-lg"
                                >
                                    <PhoneOff className="w-8 h-8" />
                                </button>
                                <button
                                    onClick={acceptIncomingCall}
                                    className="p-5 bg-green-500 hover:bg-green-600 text-white rounded-full hover:scale-110 transition-all shadow-lg animate-pulse"
                                >
                                    <Phone className="w-8 h-8" />
                                </button>
                            </div>
                            
                            <p className="text-xs text-gray-500 mt-8">
                                Press Enter to accept • Esc to reject
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Loading Overlay */}
            {isConnecting && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="text-center bg-white/10 p-8 rounded-2xl backdrop-blur-lg">
                        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4 mx-auto"></div>
                        <p className="text-white text-lg font-medium">Setting up call...</p>
                        <p className="text-gray-300 text-sm mt-2">
                            {!isSocketConnected ? 'Connecting to server...' : 'Getting camera/microphone access...'}
                        </p>
                    </div>
                </div>
            )}

            {/* Main Interface */}
            <div className="h-full flex flex-col pt-6">
                {/* Header */}
                <div className="sticky top-0 z-20 bg-white border-b border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={onClose}
                                className="p-2 hover:bg-gray-100 rounded-full transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <h1 className="text-2xl font-bold text-gray-900">Calls</h1>
                            
                            {callStatus === 'connected' && (
                                <div className="flex items-center gap-2 ml-4 px-3 py-1 bg-green-50 rounded-full">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    <span className="text-sm font-medium text-green-700">
                                        {formatDuration(callDuration)}
                                    </span>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={connectSignaling}
                                className={`p-2 rounded-full transition ${
                                    isReconnecting ? 'bg-yellow-100 text-yellow-600' : 
                                    isSocketConnected ? 'bg-green-100 text-green-600' : 
                                    'bg-red-100 text-red-600'
                                }`}
                                title={isReconnecting ? 'Reconnecting...' : isSocketConnected ? 'Connected' : 'Disconnected'}
                            >
                                <Wifi className="w-4 h-4" />
                            </button>
                            
                            <button 
                                onClick={() => setShowCallLog(!showCallLog)}
                                className="p-2 hover:bg-gray-100 rounded-full transition"
                                title="Call History"
                            >
                                <Clock className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* User List / Call Interface */}
                {callStatus === 'idle' ? (
                    // User List View
                    <div className="flex-1 overflow-y-auto">
                        {/* Search & Tabs */}
                        <div className="sticky top-0 z-10 bg-white p-4 border-b border-gray-100">
                            <div className="relative mb-4">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="text"
                                    placeholder="Search contacts..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            
                            {/* Tabs */}
                            <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl">
                                {['all', 'online', 'recent'].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                                            activeTab === tab
                                                ? 'bg-white text-blue-600 shadow-sm'
                                                : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                    >
                                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Users List */}
                        <div className="p-4">
                            {filteredUsers.length === 0 ? (
                                <div className="text-center py-12">
                                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No contacts found</h3>
                                    <p className="text-gray-500">
                                        {searchQuery ? 'Try a different search' : 'Add friends to start calling'}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {filteredUsers.map((user) => (
                                        <div
                                            key={user._id}
                                            className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl cursor-pointer transition-all active:scale-[0.98]"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <img
                                                        src={user.profile_picture || '/default-avatar.png'}
                                                        alt={user.full_name}
                                                        className="w-12 h-12 rounded-full object-cover bg-gray-200"
                                                    />
                                                </div>
                                                <div>
                                                    <h3 className="font-medium text-gray-900">{user.full_name}</h3>
                                                    <p className="text-sm text-gray-500">@{user.username || 'user'}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        startCall(user, 'voice');
                                                    }}
                                                    className="p-2 bg-green-100 text-green-600 rounded-full hover:bg-green-200 transition disabled:opacity-50"
                                                    title="Voice call"
                                                    disabled={!isSocketConnected || isConnecting}
                                                >
                                                    <Phone className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        startCall(user, 'video');
                                                    }}
                                                    className="p-2 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 transition disabled:opacity-50"
                                                    title="Video call"
                                                    disabled={!isSocketConnected || isConnecting}
                                                >
                                                    <Video className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    // Call Interface
                    <div className="flex-1 flex flex-col bg-black">
                        {/* Remote Video */}
                        {callType === 'video' && remoteStream && (
                            <div className="flex-1 relative bg-black">
                                <video
                                    ref={remoteVideoRef}
                                    autoPlay
                                    playsInline
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute top-4 left-4 bg-black/50 text-white px-4 py-2 rounded-full backdrop-blur-sm">
                                    <p className="font-medium">{selectedUser?.full_name}</p>
                                    <p className="text-sm text-gray-300">{formatDuration(callDuration)}</p>
                                </div>
                            </div>
                        )}

                        {/* Voice Call Interface */}
                        {callType === 'voice' && (
                            <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-black">
                                <div className="text-center">
                                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-6 mx-auto shadow-2xl">
                                        <span className="text-white text-3xl font-bold">
                                            {selectedUser?.full_name?.charAt(0) || 'U'}
                                        </span>
                                    </div>
                                    <h2 className="text-2xl font-bold text-white mb-2">{selectedUser?.full_name}</h2>
                                    <p className="text-gray-300 mb-6">{formatDuration(callDuration)} • Voice call</p>
                                    
                                    {/* Connection quality indicator */}
                                    <div className="flex items-center justify-center gap-2 mb-6">
                                        <div className={`w-2 h-2 rounded-full ${
                                            callQuality === 'excellent' ? 'bg-green-500' :
                                            callQuality === 'good' ? 'bg-green-400' :
                                            callQuality === 'fair' ? 'bg-yellow-500' : 'bg-red-500'
                                        }`}></div>
                                        <span className="text-sm text-gray-300 capitalize">{callQuality} connection</span>
                                    </div>
                                    
                                    {/* Audio visualization */}
                                    <div className="flex justify-center gap-1 mt-8">
                                        {[...Array(9)].map((_, i) => (
                                            <div
                                                key={i}
                                                className="w-1.5 bg-gradient-to-t from-blue-400 to-blue-600 rounded-full animate-pulse"
                                                style={{
                                                    height: `${Math.sin(i * 0.7) * 20 + 25}px`,
                                                    animationDelay: `${i * 0.1}s`,
                                                    animationDuration: '1s'
                                                }}
                                            ></div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Local Video Preview */}
                        {callType === 'video' && localStream && (
                            <div className="absolute bottom-24 right-6 w-40 h-56 bg-gray-900 rounded-xl overflow-hidden border-2 border-white shadow-xl">
                                <video
                                    ref={localVideoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                                    You {!isVideoOn && '(Off)'}
                                </div>
                            </div>
                        )}

                        {/* Call Controls */}
                        <div className="p-6 bg-gradient-to-t from-black to-gray-900">
                            <div className="flex justify-center items-center gap-4">
                                {/* Mute Toggle */}
                                <button
                                    onClick={() => setIsMuted(!isMuted)}
                                    className={`p-4 rounded-full transition-all shadow-lg ${
                                        isMuted ? 'bg-red-600 text-white' : 'bg-gray-800 text-white hover:bg-gray-700'
                                    }`}
                                    title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                                >
                                    {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                                </button>

                                {/* Video Toggle */}
                                {callType === 'video' && (
                                    <button
                                        onClick={() => setIsVideoOn(!isVideoOn)}
                                        className={`p-4 rounded-full transition-all shadow-lg ${
                                            !isVideoOn ? 'bg-red-600 text-white' : 'bg-gray-800 text-white hover:bg-gray-700'
                                        }`}
                                        title={isVideoOn ? 'Turn off camera' : 'Turn on camera'}
                                    >
                                        {!isVideoOn ? <CameraOff className="w-6 h-6" /> : <Camera className="w-6 h-6" />}
                                    </button>
                                )}

                                {/* Speaker Toggle */}
                                <button
                                    onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                                    className={`p-4 rounded-full transition-all shadow-lg ${
                                        isSpeakerOn ? 'bg-green-600 text-white' : 'bg-gray-800 text-white hover:bg-gray-700'
                                    }`}
                                    title={isSpeakerOn ? 'Switch to earpiece' : 'Switch to speaker'}
                                >
                                    {isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <Headphones className="w-6 h-6" />}
                                </button>

                                {/* End Call Button */}
                                <button
                                    onClick={() => endCall('User ended')}
                                    className="p-5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-all shadow-xl hover:scale-105 active:scale-95"
                                    title="End call (Esc)"
                                >
                                    <PhoneOff className="w-7 h-7" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Calling;