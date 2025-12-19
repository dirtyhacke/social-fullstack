import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    X, Video, Phone, PhoneOff, Mic, MicOff, Volume2,
    Users, User, VideoOff, Camera, CameraOff, Headphones,
    Search, Activity
} from 'lucide-react';
import { useSelector } from 'react-redux';
import { useUser, useAuth } from '@clerk/clerk-react';
import { Howl } from 'howler';
import toast from 'react-hot-toast';

// Backend API URL
const API_BASE_URL = 'http://localhost:4000';

// Sound URLs - Using alternative reliable URLs
const SOUND_URLS = {
    ringing: 'https://assets.mixkit.co/sfx/preview/mixkit-phone-call-ringing-1170.mp3',
    dialing: 'https://assets.mixkit.co/sfx/preview/mixkit-phone-ringing-1256.mp3',
    callEnd: 'https://assets.mixkit.co/sfx/preview/mixkit-phone-hang-up-909.mp3',
    callConnected: 'https://assets.mixkit.co/sfx/preview/mixkit-call-answer-voice-1176.mp3',
    messageTone: 'https://assets.mixkit.co/sfx/preview/mixkit-message-tone-1323.mp3'
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
    const [callHistory, setCallHistory] = useState([]);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isPolling, setIsPolling] = useState(false);
    const [signalingStatus, setSignalingStatus] = useState('disconnected');

    // Refs
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const remoteAudioRef = useRef(null);
    const peerConnectionRef = useRef(null);
    const callDurationIntervalRef = useRef(null);
    const soundRefs = useRef({});
    const callIdRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const signalPollIntervalRef = useRef(null);
    const pendingIceCandidatesRef = useRef([]);
    const dialingTimeoutRef = useRef(null);
    const hasAnsweredRef = useRef(false);
    const callEndedRef = useRef(false);
    const isEndingCallRef = useRef(false);
    const debugAudioStreamRef = useRef(null);
    const debugAudioElementsRef = useRef([]);

    // Data from Redux
    const { connections } = useSelector((state) => state.connections);
    const { user: currentUser } = useUser();
    const { getToken } = useAuth();

    // Debug audio stream to console - FIXED VERSION
    const debugAudioStream = (stream, label) => {
        if (!stream) return;
        
        const audioTracks = stream.getAudioTracks();
        const videoTracks = stream.getVideoTracks();
        
        console.log(`🔊 ${label}:`, {
            streamId: stream.id,
            audioTracks: audioTracks.length,
            videoTracks: videoTracks.length,
            audioTrackDetails: audioTracks.map(track => ({
                id: track.id,
                enabled: track.enabled,
                muted: track.muted,
                readyState: track.readyState,
                kind: track.kind,
                label: track.label
            })),
            videoTrackDetails: videoTracks.map(track => ({
                id: track.id,
                enabled: track.enabled,
                muted: track.muted,
                readyState: track.readyState,
                kind: track.kind,
                label: track.label
            }))
        });
        
        // Create a playable audio element for debugging
        if (audioTracks.length > 0 && debugAudioStreamRef.current) {
            try {
                // Clean up previous audio elements
                debugAudioElementsRef.current.forEach(el => {
                    if (el.parentNode) {
                        el.parentNode.remove();
                    }
                });
                debugAudioElementsRef.current = [];
                
                // Create audio element directly with the stream
                const audioEl = document.createElement('audio');
                audioEl.srcObject = stream;
                audioEl.controls = true;
                audioEl.style.width = '300px';
                audioEl.style.margin = '10px';
                audioEl.style.padding = '5px';
                audioEl.style.border = '1px solid #ccc';
                audioEl.style.borderRadius = '5px';
                audioEl.style.backgroundColor = '#f5f5f5';
                
                const labelEl = document.createElement('div');
                labelEl.textContent = `${label} Audio Stream`;
                labelEl.style.fontWeight = 'bold';
                labelEl.style.marginBottom = '5px';
                labelEl.style.color = 'white';
                
                const container = document.createElement('div');
                container.style.marginBottom = '10px';
                container.appendChild(labelEl);
                container.appendChild(audioEl);
                
                debugAudioStreamRef.current.appendChild(container);
                debugAudioElementsRef.current.push(container);
                
                // Also log stream info
                console.log(`🎵 ${label} Audio Stream:`, {
                    active: stream.active,
                    ended: stream.active ? 'No' : 'Yes',
                    tracks: stream.getTracks().map(t => ({
                        kind: t.kind,
                        enabled: t.enabled,
                        readyState: t.readyState
                    }))
                });
                
            } catch (error) {
                console.warn(`⚠️ Could not create debug audio element for ${label}:`, error);
            }
        }
    };

    // Initialize sounds with better error handling
    useEffect(() => {
        console.log('🎵 Initializing sounds...');
        
        // Create debug container
        debugAudioStreamRef.current = document.createElement('div');
        debugAudioStreamRef.current.id = 'audio-debug-container';
        debugAudioStreamRef.current.style.position = 'fixed';
        debugAudioStreamRef.current.style.top = '100px';
        debugAudioStreamRef.current.style.right = '20px';
        debugAudioStreamRef.current.style.zIndex = '9999';
        debugAudioStreamRef.current.style.backgroundColor = 'rgba(0,0,0,0.8)';
        debugAudioStreamRef.current.style.color = 'white';
        debugAudioStreamRef.current.style.padding = '10px';
        debugAudioStreamRef.current.style.borderRadius = '5px';
        debugAudioStreamRef.current.style.maxHeight = '300px';
        debugAudioStreamRef.current.style.overflowY = 'auto';
        debugAudioStreamRef.current.style.display = 'none'; // Hidden by default
        debugAudioStreamRef.current.style.fontSize = '12px';
        document.body.appendChild(debugAudioStreamRef.current);

        const soundConfig = {
            html5: true,
            preload: true,
            onload: function() {
                console.log(`✅ Sound loaded: ${this._src}`);
            },
            onloaderror: function(id, err) {
                console.error(`❌ Failed to load sound: ${this._src}`, err);
            },
            onplayerror: function() {
                console.warn(`⚠️ Play error for sound: ${this._src}`);
                // Try to play on user interaction
                document.addEventListener('click', () => {
                    this.play();
                }, { once: true });
            }
        };

        soundRefs.current = {
            ringing: new Howl({ 
                src: [SOUND_URLS.ringing], 
                loop: true, 
                volume: 0.6,
                ...soundConfig
            }),
            dialing: new Howl({ 
                src: [SOUND_URLS.dialing], 
                loop: true, 
                volume: 0.5,
                ...soundConfig
            }),
            callEnd: new Howl({ 
                src: [SOUND_URLS.callEnd], 
                volume: 0.7,
                ...soundConfig
            }),
            callConnected: new Howl({ 
                src: [SOUND_URLS.callConnected], 
                volume: 0.7,
                ...soundConfig
            }),
            messageTone: new Howl({ 
                src: [SOUND_URLS.messageTone], 
                volume: 0.5,
                ...soundConfig
            })
        };

        // Preload all sounds
        Object.values(soundRefs.current).forEach(sound => {
            sound.load();
        });

        // Load call history from localStorage
        const savedHistory = localStorage.getItem('callHistory');
        if (savedHistory) {
            setCallHistory(JSON.parse(savedHistory));
        }

        // Start signal polling
        startSignalPolling();

        return () => {
            console.log('🧹 Cleaning up component...');
            
            // Clear any timeouts
            if (dialingTimeoutRef.current) {
                clearTimeout(dialingTimeoutRef.current);
            }
            
            // Stop all sounds
            Object.values(soundRefs.current).forEach(sound => {
                if (sound.playing()) {
                    sound.stop();
                }
                sound.unload();
            });
            
            // Remove debug container and elements
            if (debugAudioStreamRef.current && debugAudioStreamRef.current.parentNode) {
                debugAudioStreamRef.current.parentNode.removeChild(debugAudioStreamRef.current);
            }
            
            // Clean up debug audio elements
            debugAudioElementsRef.current.forEach(el => {
                if (el.parentNode) {
                    el.parentNode.removeChild(el);
                }
            });
            debugAudioElementsRef.current = [];
            
            stopSignalPolling();
            cleanupMediaStream();
            cleanupPeerConnection();
            
            if (callDurationIntervalRef.current) {
                clearInterval(callDurationIntervalRef.current);
            }
        };
    }, []);

    // Toggle debug audio panel
    const toggleDebugAudio = () => {
        if (debugAudioStreamRef.current) {
            const isVisible = debugAudioStreamRef.current.style.display !== 'none';
            debugAudioStreamRef.current.style.display = isVisible ? 'none' : 'block';
        }
    };

    // Auto-stop dialing sound after timeout
    useEffect(() => {
        if (callStatus === 'calling' && !hasAnsweredRef.current) {
            // Auto-stop dialing sound after 45 seconds if no answer
            dialingTimeoutRef.current = setTimeout(() => {
                if (soundRefs.current.dialing && soundRefs.current.dialing.playing()) {
                    soundRefs.current.dialing.stop();
                    toast.error('Call timed out - no answer');
                    endCall('No answer');
                }
            }, 45000);
        } else {
            // Clear timeout if not calling or already answered
            if (dialingTimeoutRef.current) {
                clearTimeout(dialingTimeoutRef.current);
                dialingTimeoutRef.current = null;
            }
        }
        
        return () => {
            if (dialingTimeoutRef.current) {
                clearTimeout(dialingTimeoutRef.current);
            }
        };
    }, [callStatus]);

    // ========== HTTP SIGNALING FUNCTIONS ==========
    
    // Send signal via HTTP POST
    const sendSignal = async (message) => {
        try {
            const token = await getToken();
            if (!token) {
                throw new Error('No authentication token');
            }

            const response = await fetch(`${API_BASE_URL}/api/webrtc/signal`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...message,
                    userId: currentUser?.id,
                    timestamp: Date.now()
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('❌ Send signal error:', error);
            throw error;
        }
    };

    // Poll for incoming signals
    const startSignalPolling = useCallback(() => {
        if (signalPollIntervalRef.current) {
            clearInterval(signalPollIntervalRef.current);
        }

        const poll = async () => {
            if (!currentUser?.id) return;
            
            try {
                const token = await getToken();
                if (!token) return;
                
                const response = await fetch(`${API_BASE_URL}/api/webrtc/signals/${currentUser.id}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Cache-Control': 'no-cache'
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.signals && data.signals.length > 0) {
                        data.signals.forEach(signal => {
                            handleSignalingMessage(signal);
                        });
                    }
                    setSignalingStatus('connected');
                } else {
                    setSignalingStatus('error');
                }
            } catch (error) {
                console.error('❌ Polling error:', error);
                setSignalingStatus('disconnected');
            }
        };

        // Start polling every 1 second
        signalPollIntervalRef.current = setInterval(poll, 1000);
        setIsPolling(true);
        
        // Initial poll
        poll();
    }, [currentUser?.id, getToken]);

    // Stop signal polling
    const stopSignalPolling = () => {
        if (signalPollIntervalRef.current) {
            clearInterval(signalPollIntervalRef.current);
            signalPollIntervalRef.current = null;
        }
        setIsPolling(false);
        setSignalingStatus('disconnected');
    };

    // Handle signaling messages from polling
    const handleSignalingMessage = async (message) => {
        console.log('📞 Received signal:', message.type);
        
        switch (message.type) {
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
                toast.error('User is currently offline');
                if (callStatus === 'calling') {
                    endCall('User offline');
                }
                break;
        }
    };

    // ========== MEDIA & WEBRTC FUNCTIONS ==========
    
    // Cleanup media stream
    const cleanupMediaStream = () => {
        if (mediaStreamRef.current) {
            console.log('🧹 Cleaning up media stream');
            mediaStreamRef.current.getTracks().forEach(track => {
                console.log(`Stopping track: ${track.kind} - ${track.id}`);
                track.stop();
            });
            mediaStreamRef.current = null;
        }
        setLocalStream(null);
        
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }
        if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = null;
            remoteAudioRef.current.pause();
        }
        
        setRemoteStream(null);
    };

    // Cleanup peer connection properly
    const cleanupPeerConnection = () => {
        if (peerConnectionRef.current) {
            try {
                console.log('🧹 Cleaning up peer connection');
                // Remove all event listeners
                peerConnectionRef.current.onconnectionstatechange = null;
                peerConnectionRef.current.oniceconnectionstatechange = null;
                peerConnectionRef.current.onicegatheringstatechange = null;
                peerConnectionRef.current.onsignalingstatechange = null;
                peerConnectionRef.current.ontrack = null;
                peerConnectionRef.current.onicecandidate = null;
                
                // Close connection
                peerConnectionRef.current.close();
            } catch (error) {
                console.error('Error closing peer connection:', error);
            }
            peerConnectionRef.current = null;
        }
    };

    // Create and setup peer connection
    const createPeerConnection = () => {
        console.log('🔗 Creating new peer connection');
        
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ],
            iceCandidatePoolSize: 10,
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require'
        };
        
        const pc = new RTCPeerConnection(configuration);
        
        // Track connection state
        pc.onconnectionstatechange = () => {
            console.log('🔗 Peer connection state:', pc.connectionState);
            switch (pc.connectionState) {
                case 'connected':
                    setCallQuality('excellent');
                    if (!callEndedRef.current) {
                        toast.success('Call connected!');
                    }
                    break;
                case 'disconnected':
                    setCallQuality('poor');
                    if (!callEndedRef.current) {
                        toast('Connection unstable', { icon: '⚠️' });
                    }
                    break;
                case 'failed':
                    if (!callEndedRef.current) {
                        toast.error('Call failed. Please try again.');
                        endCall('Connection failed');
                    }
                    break;
                case 'closed':
                    break;
            }
        };
        
        // Handle remote stream - FIXED for proper audio/video handling
        pc.ontrack = (event) => {
            console.log('🎬 Received remote track:', {
                trackKind: event.track.kind,
                trackId: event.track.id,
                streamCount: event.streams.length
            });
            
            if (event.streams && event.streams[0]) {
                const remoteMediaStream = event.streams[0];
                
                // Debug the received stream
                debugAudioStream(remoteMediaStream, 'Remote');
                
                setRemoteStream(remoteMediaStream);
                
                // Handle audio tracks
                const audioTracks = remoteMediaStream.getAudioTracks();
                const videoTracks = remoteMediaStream.getVideoTracks();
                
                // For voice calls or video calls with audio
                if (audioTracks.length > 0) {
                    console.log('🔊 Setting up remote audio');
                    
                    if (remoteAudioRef.current) {
                        remoteAudioRef.current.srcObject = remoteMediaStream;
                        remoteAudioRef.current.volume = 1.0;
                        
                        const playAudio = () => {
                            remoteAudioRef.current.play().catch(err => {
                                console.warn('Audio play failed, retrying...', err);
                                // Auto-retry with delay
                                setTimeout(() => {
                                    remoteAudioRef.current.play().catch(e => {
                                        console.error('Final audio play error:', e);
                                        // Last resort: user interaction
                                        document.addEventListener('click', () => {
                                            remoteAudioRef.current.play().catch(console.error);
                                        }, { once: true });
                                    });
                                }, 1000);
                            });
                        };
                        
                        // Try to play immediately
                        playAudio();
                        
                        // Also try on any user interaction
                        document.addEventListener('click', playAudio, { once: true });
                    }
                }
                
                // For video calls
                if (remoteVideoRef.current && callType === 'video' && videoTracks.length > 0) {
                    console.log('🎥 Setting up remote video');
                    remoteVideoRef.current.srcObject = remoteMediaStream;
                    
                    // Ensure video plays
                    remoteVideoRef.current.play().catch(err => {
                        console.warn('Video play error:', err);
                    });
                }
            }
        };
        
        // ICE candidate handler
        pc.onicecandidate = (event) => {
            if (event.candidate && callIdRef.current && selectedUser && !callEndedRef.current) {
                console.log('🧊 Generated ICE candidate');
                // Send ICE candidate via HTTP
                sendSignal({
                    type: 'ice-candidate',
                    targetUserId: selectedUser._id,
                    candidate: event.candidate,
                    callId: callIdRef.current
                }).catch(err => {
                    console.warn('Failed to send ICE candidate:', err);
                });
            } else if (!event.candidate) {
                console.log('🧊 ICE gathering complete');
            }
        };
        
        return pc;
    };

    // Start a new call
    const startCall = async (user, type) => {
        if (!user || !user._id) {
            toast.error('Invalid user selected');
            return;
        }

        if (callStatus !== 'idle') {
            toast.error('Please end current call first');
            return;
        }

        console.log('📞 Starting call to:', user.full_name, 'Type:', type);
        setIsConnecting(true);
        setSelectedUser(user);
        setCallType(type);
        hasAnsweredRef.current = false;
        callEndedRef.current = false;
        isEndingCallRef.current = false;
        
        try {
            // Step 1: Get media permissions
            toast.loading('Requesting camera/microphone access...');
            
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 2,
                    sampleRate: 48000,
                    sampleSize: 16,
                    volume: 1.0
                },
                video: type === 'video' ? {
                    width: { ideal: 640, max: 1280 },
                    height: { ideal: 480, max: 720 },
                    frameRate: { ideal: 30, max: 60 },
                    facingMode: 'user'
                } : false
            };

            let stream;
            try {
                console.log('🎤 Requesting media with constraints:', constraints);
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                mediaStreamRef.current = stream;
                
                // Debug the local stream
                debugAudioStream(stream, 'Local');
                
                console.log('✅ Got media stream:', {
                    audioTracks: stream.getAudioTracks().length,
                    videoTracks: stream.getVideoTracks().length
                });
                
            } catch (mediaError) {
                console.error('Media error:', mediaError);
                if (mediaError.name === 'NotAllowedError') {
                    toast.error('Please allow camera/microphone access in browser settings');
                    throw mediaError;
                } else if (mediaError.name === 'NotFoundError') {
                    toast.error('No camera/microphone found');
                    // Try audio only
                    stream = await navigator.mediaDevices.getUserMedia({ 
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true
                        }
                    });
                    mediaStreamRef.current = stream;
                    setCallType('voice');
                    console.log('🔄 Falling back to audio only');
                } else {
                    throw mediaError;
                }
            }
            
            setLocalStream(stream);
            
            // Set up local video preview - FIXED
            if (type === 'video' && localVideoRef.current) {
                console.log('🎥 Setting up local video preview');
                localVideoRef.current.srcObject = stream;
                localVideoRef.current.muted = true;
                localVideoRef.current.play().catch(err => {
                    console.warn('Local video play error:', err);
                });
            }

            toast.dismiss();
            toast.loading('Setting up call...');

            // Step 2: Create peer connection
            const pc = createPeerConnection();
            peerConnectionRef.current = pc;

            // Add local tracks
            stream.getTracks().forEach(track => {
                console.log(`➕ Adding local track: ${track.kind}`);
                pc.addTrack(track, stream);
            });

            // Create call ID
            const callId = `call_${currentUser?.id}_${user._id}_${Date.now()}`;
            callIdRef.current = callId;
            console.log('🆔 Call ID:', callId);

            // Step 3: Create and send offer
            console.log('📤 Creating offer...');
            const offer = await pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: type === 'video'
            });
            
            console.log('🔧 Setting local description');
            await pc.setLocalDescription(offer);

            // Send offer via HTTP
            console.log('📨 Sending call offer...');
            await sendSignal({
                type: 'call-offer',
                targetUserId: user._id,
                callType: type,
                offer: offer,
                callId: callId
            });

            setCallStatus('calling');
            
            // Play dialing sound - FIXED
            console.log('🔔 Playing dialing sound');
            if (soundRefs.current.dialing) {
                soundRefs.current.dialing.play();
            }
            
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
            console.error('Error starting call:', error);
            let errorMessage = 'Failed to start call';
            if (error.message.includes('HTTP') || error.message.includes('network')) {
                errorMessage = 'Connection failed. Please try again.';
            } else if (error.name === 'NotAllowedError') {
                errorMessage = 'Please allow camera/microphone access';
            } else if (error.name === 'TypeError' && error.message.includes('createObjectURL')) {
                // This is just a debug error, not a critical one
                console.warn('Debug audio visualization failed, but call should still work');
                errorMessage = 'Setting up call...';
                // Don't throw the error, continue with the call
            } else {
                toast.error(errorMessage);
                
                // Clean up
                cleanupMediaStream();
                cleanupPeerConnection();
                
                setCallStatus('idle');
                setSelectedUser(null);
                setCallType(null);
                setIsConnecting(false);
                return;
            }
            
            if (errorMessage !== 'Setting up call...') {
                toast.error(errorMessage);
                
                // Clean up
                cleanupMediaStream();
                cleanupPeerConnection();
                
                setCallStatus('idle');
                setSelectedUser(null);
                setCallType(null);
                setIsConnecting(false);
            }
        }
    };

    // Handle incoming call
    const handleIncomingCall = async (message) => {
        console.log('📲 Incoming call from:', message.callerId);
        
        // If we already have an active call, reject incoming
        if (callStatus !== 'idle' && callStatus !== 'ended') {
            console.log('❌ Already in a call, rejecting incoming');
            sendSignal({
                type: 'call-reject',
                targetUserId: message.callerId,
                callId: message.callId,
                reason: 'User busy'
            }).catch(err => {
                console.error('Failed to send reject:', err);
            });
            return;
        }
        
        const caller = connections.find(c => c._id === message.callerId);
        if (!caller) {
            console.log('❌ Caller not found in connections');
            return;
        }

        // Stop any current sounds
        Object.values(soundRefs.current).forEach(sound => {
            if (sound.playing()) sound.stop();
        });
        
        // Play ringing sound - FIXED
        console.log('🔔 Playing ringing sound');
        if (soundRefs.current.ringing) {
            soundRefs.current.ringing.play();
        }
        
        setIncomingCall({
            user: caller,
            type: message.callType,
            offer: message.offer,
            callId: message.callId,
            timestamp: new Date().toISOString()
        });
        
        console.log('✅ Incoming call set for:', caller.full_name);
        
        // Show notification
        if (Notification.permission === 'granted') {
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
            
            setTimeout(() => notification.close(), 30000);
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    const notification = new Notification(`Incoming ${message.callType} call`, {
                        body: `From: ${caller.full_name}`,
                        icon: caller.profile_picture || '/default-avatar.png',
                        tag: 'incoming-call'
                    });
                    
                    setTimeout(() => notification.close(), 30000);
                }
            });
        }
    };

    // Accept incoming call
    const acceptIncomingCall = async () => {
        if (!incomingCall) return;

        console.log('✅ Accepting incoming call');
        
        // Stop ringing sound
        if (soundRefs.current.ringing && soundRefs.current.ringing.playing()) {
            soundRefs.current.ringing.stop();
        }
        
        setSelectedUser(incomingCall.user);
        setCallType(incomingCall.type);
        setCallStatus('connecting');
        callIdRef.current = incomingCall.callId;
        hasAnsweredRef.current = true;
        callEndedRef.current = false;
        isEndingCallRef.current = false;

        try {
            // Get local media
            console.log('🎤 Getting local media for incoming call');
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 2
                },
                video: incomingCall.type === 'video' ? {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 30 },
                    facingMode: 'user'
                } : false
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            mediaStreamRef.current = stream;
            setLocalStream(stream);
            
            // Debug local stream (with try-catch to prevent errors)
            try {
                debugAudioStream(stream, 'Local (Incoming Call)');
            } catch (debugError) {
                console.warn('Debug error (non-critical):', debugError);
            }
            
            // Set up local video preview - FIXED
            if (incomingCall.type === 'video' && localVideoRef.current) {
                console.log('🎥 Setting up local video preview for incoming call');
                localVideoRef.current.srcObject = stream;
                localVideoRef.current.muted = true;
                localVideoRef.current.play().catch(err => {
                    console.warn('Local video play error:', err);
                });
            }

            // Create peer connection
            const pc = createPeerConnection();
            peerConnectionRef.current = pc;

            // Add local tracks
            stream.getTracks().forEach(track => {
                console.log(`➕ Adding local track for incoming call: ${track.kind}`);
                pc.addTrack(track, stream);
            });

            // Set remote description from offer
            console.log('🔧 Setting remote description from offer');
            await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));

            // Process any pending ICE candidates
            if (pendingIceCandidatesRef.current.length > 0) {
                console.log(`Processing ${pendingIceCandidatesRef.current.length} pending ICE candidates`);
                for (const candidate of pendingIceCandidatesRef.current) {
                    try {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (err) {
                        console.warn('Error adding pending ICE candidate:', err);
                    }
                }
                pendingIceCandidatesRef.current = [];
            }

            // Create and send answer
            console.log('📤 Creating answer...');
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            // Send answer back to caller
            console.log('📨 Sending call answer...');
            await sendSignal({
                type: 'call-answer',
                targetUserId: incomingCall.user._id,
                answer: answer,
                callId: incomingCall.callId
            });

            setCallStatus('connected');
            
            // Play connected sound - FIXED
            if (soundRefs.current.callConnected) {
                soundRefs.current.callConnected.play();
            }
            
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
            toast.success('Call connected!');

        } catch (error) {
            console.error('Error accepting call:', error);
            toast.error('Failed to accept call');
            endCall('Accept failed');
        }
    };

    // Handle call answer from polling
    const handleCallAnswer = async (message) => {
        console.log('✅ Received call answer');
        
        if (!peerConnectionRef.current || callEndedRef.current) {
            console.log('❌ No peer connection or call ended');
            return;
        }

        try {
            console.log('🔧 Setting remote description from answer');
            await peerConnectionRef.current.setRemoteDescription(
                new RTCSessionDescription(message.answer)
            );
            
            // Process any pending ICE candidates
            if (pendingIceCandidatesRef.current.length > 0) {
                console.log(`Processing ${pendingIceCandidatesRef.current.length} pending ICE candidates for answer`);
                for (const candidate of pendingIceCandidatesRef.current) {
                    try {
                        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (err) {
                        console.warn('Error adding pending ICE candidate:', err);
                    }
                }
                pendingIceCandidatesRef.current = [];
            }
            
            if (peerConnectionRef.current && !callEndedRef.current) {
                hasAnsweredRef.current = true;
                
                // Stop dialing sound
                if (soundRefs.current.dialing && soundRefs.current.dialing.playing()) {
                    soundRefs.current.dialing.stop();
                }
                
                // Set to connected state
                setCallStatus('connected');
                
                // Play connected sound
                if (soundRefs.current.callConnected) {
                    soundRefs.current.callConnected.play();
                }
                
                // Start timer
                startCallTimer();
                
                // Update history
                updateCallHistory('connected');
                toast.success('Call connected!');
            }
        } catch (error) {
            console.error('Error setting remote description:', error);
        }
    };

    // Handle ICE candidates
    const handleNewICECandidate = async (message) => {
        if (!message.candidate || callEndedRef.current) {
            return;
        }
        
        try {
            const candidate = new RTCIceCandidate(message.candidate);
            
            if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
                await peerConnectionRef.current.addIceCandidate(candidate);
            } else {
                // Store candidate for later
                pendingIceCandidatesRef.current.push(message.candidate);
            }
        } catch (error) {
            console.warn('Error adding ICE candidate:', error);
        }
    };

    // Handle call rejection
    const handleCallRejected = (message) => {
        console.log('❌ Call rejected:', message.reason);
        toast.error(`Call rejected: ${message.reason || 'User busy'}`);
        endCall('Rejected');
    };

    // Handle remote call end
    const handleRemoteCallEnded = (message) => {
        console.log('📞 Remote call ended');
        // Only end if we're not already ended and not in the process of ending
        if (!callEndedRef.current && !isEndingCallRef.current) {
            toast('Call ended by other user', { icon: 'ℹ️' });
            endCall('Remote ended', false);
        }
    };

    // Reject incoming call
    const rejectIncomingCall = () => {
        console.log('❌ Rejecting incoming call');
        
        if (soundRefs.current.ringing && soundRefs.current.ringing.playing()) {
            soundRefs.current.ringing.stop();
        }
        
        if (incomingCall) {
            sendSignal({
                type: 'call-reject',
                targetUserId: incomingCall.user._id,
                callId: incomingCall.callId,
                reason: 'User rejected'
            }).catch(err => {
                console.error('Failed to send reject:', err);
            });
            
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
        
        // Play message tone
        if (soundRefs.current.messageTone) {
            soundRefs.current.messageTone.play();
        }
    };

    // End call
    const endCall = (reason = 'User ended', sendEndSignal = true) => {
        console.log('📞 Ending call:', reason, 'sendSignal:', sendEndSignal);
        
        // Prevent multiple end calls
        if (isEndingCallRef.current) {
            return;
        }
        
        isEndingCallRef.current = true;
        callEndedRef.current = true;
        hasAnsweredRef.current = false;
        
        // Stop all sounds
        Object.values(soundRefs.current).forEach(sound => {
            if (sound.playing()) sound.stop();
        });
        
        // Clear dialing timeout
        if (dialingTimeoutRef.current) {
            clearTimeout(dialingTimeoutRef.current);
            dialingTimeoutRef.current = null;
        }
        
        // Stop call timer
        if (callDurationIntervalRef.current) {
            clearInterval(callDurationIntervalRef.current);
            callDurationIntervalRef.current = null;
        }

        // Send end call message if connected and requested
        if (selectedUser && callIdRef.current && sendEndSignal) {
            sendSignal({
                type: 'end-call',
                targetUserId: selectedUser._id,
                callId: callIdRef.current,
                reason: reason
            }).catch(err => {
                console.error('Failed to send end call:', err);
            });
        }

        // Play end sound
        if (soundRefs.current.callEnd) {
            soundRefs.current.callEnd.play();
        }

        // Update call history with duration
        if (selectedUser && callDuration > 0) {
            updateCallHistory('ended', callDuration);
        }

        // Cleanup
        cleanupMediaStream();
        cleanupPeerConnection();
        
        setRemoteStream(null);
        callIdRef.current = null;
        pendingIceCandidatesRef.current = [];

        // Reset state
        setCallStatus('ended');
        setTimeout(() => {
            setCallStatus('idle');
            setSelectedUser(null);
            setCallType(null);
            setCallDuration(0);
            setIsMuted(false);
            setIsVideoOn(true);
            isEndingCallRef.current = false;
        }, 1500);
    };

    // Start call timer
    const startCallTimer = () => {
        if (callDurationIntervalRef.current) {
            clearInterval(callDurationIntervalRef.current);
        }
        
        callDurationIntervalRef.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
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
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
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

    // Restart polling if disconnected
    const restartPolling = () => {
        stopSignalPolling();
        startSignalPolling();
        toast.success('Reconnected to signaling server');
    };

    // Get signaling status color
    const getSignalingStatusColor = () => {
        switch(signalingStatus) {
            case 'connected': return 'bg-green-100 text-green-600';
            case 'error': return 'bg-yellow-100 text-yellow-600';
            case 'disconnected': return 'bg-red-100 text-red-600';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    // Get signaling status text
    const getSignalingStatusText = () => {
        switch(signalingStatus) {
            case 'connected': return 'Connected';
            case 'error': return 'Connection Error';
            case 'disconnected': return 'Disconnected';
            default: return 'Connecting...';
        }
    };

    // Toggle audio mute
    const toggleMute = () => {
        if (mediaStreamRef.current) {
            const audioTracks = mediaStreamRef.current.getAudioTracks();
            const newMuteState = !isMuted;
            
            audioTracks.forEach(track => {
                track.enabled = !newMuteState;
            });
            
            setIsMuted(newMuteState);
            toast.success(newMuteState ? 'Muted' : 'Unmuted');
        }
    };

    // Toggle video
    const toggleVideo = () => {
        if (mediaStreamRef.current) {
            const videoTracks = mediaStreamRef.current.getVideoTracks();
            const newVideoState = !isVideoOn;
            
            videoTracks.forEach(track => {
                track.enabled = !newVideoState;
            });
            
            setIsVideoOn(newVideoState);
            toast.success(newVideoState ? 'Camera on' : 'Camera off');
            
            // Update local video display
            if (localVideoRef.current && callType === 'video') {
                if (newVideoState) {
                    localVideoRef.current.style.opacity = '1';
                } else {
                    localVideoRef.current.style.opacity = '0.5';
                }
            }
        }
    };

    // Render UI
    return (
        <div className="fixed inset-0 z-[70] bg-white">
            {/* Hidden audio element for remote audio playback */}
            <audio 
                ref={remoteAudioRef}
                autoPlay
                playsInline
                controls={false}
                style={{ display: 'none' }}
                volume={1}
            />
            
            {/* Debug button */}
            <button 
                onClick={toggleDebugAudio}
                className="absolute top-4 right-20 z-50 bg-gray-800 text-white px-3 py-1 rounded text-xs hover:bg-gray-700"
            >
                Debug Audio
            </button>
            
            {/* Signaling Status Bar */}
            <div className="absolute top-0 left-0 right-0 z-50 py-1 px-4 flex items-center justify-between bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                        signalingStatus === 'connected' ? 'bg-green-500' :
                        signalingStatus === 'error' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}></div>
                    <span className="text-xs font-medium">
                        {getSignalingStatusText()}
                    </span>
                </div>
                <button
                    onClick={restartPolling}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                    Reconnect
                </button>
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
                            {signalingStatus !== 'connected' ? 'Connecting to server...' : 'Getting camera/microphone access...'}
                        </p>
                    </div>
                </div>
            )}

            {/* Main Interface */}
            <div className="h-full flex flex-col pt-8">
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
                            <div className={`px-3 py-1 rounded-full text-sm font-medium ${getSignalingStatusColor()}`}>
                                <span className="flex items-center gap-1">
                                    <Activity className="w-3 h-3" />
                                    {isPolling ? 'Polling' : 'Offline'}
                                </span>
                            </div>
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
                                                    disabled={signalingStatus !== 'connected' || isConnecting}
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
                                                    disabled={signalingStatus !== 'connected' || isConnecting}
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
                        {callType === 'video' && (
                            <div className="flex-1 relative bg-black">
                                <video
                                    ref={remoteVideoRef}
                                    autoPlay
                                    playsInline
                                    className="w-full h-full object-cover bg-gray-900"
                                />
                                <div className="absolute top-4 left-4 bg-black/50 text-white px-4 py-2 rounded-full backdrop-blur-sm">
                                    <p className="font-medium">{selectedUser?.full_name}</p>
                                    <p className="text-sm text-gray-300">{formatDuration(callDuration)}</p>
                                    {peerConnectionRef.current && (
                                        <div className="text-xs text-gray-400">
                                            ICE: {peerConnectionRef.current.iceConnectionState}
                                        </div>
                                    )}
                                </div>
                                {!remoteStream && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="text-center">
                                            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4 mx-auto">
                                                <span className="text-white text-2xl font-bold">
                                                    {selectedUser?.full_name?.charAt(0) || 'U'}
                                                </span>
                                            </div>
                                            <p className="text-white">Connecting video...</p>
                                        </div>
                                    </div>
                                )}
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
                                    {remoteStream && (
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
                                    )}
                                    
                                    {!remoteStream && (
                                        <p className="text-gray-400 mt-4">Waiting for audio connection...</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Local Video Preview - FIXED */}
                        {callType === 'video' && localStream && (
                            <div className="absolute bottom-24 right-6 w-40 h-56 bg-gray-900 rounded-xl overflow-hidden border-2 border-white shadow-xl">
                                <video
                                    ref={localVideoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-cover"
                                    style={{
                                        opacity: isVideoOn ? '1' : '0.5',
                                        filter: isVideoOn ? 'none' : 'grayscale(100%)'
                                    }}
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
                                    onClick={toggleMute}
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
                                        onClick={toggleVideo}
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