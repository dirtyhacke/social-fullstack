// utils/socketClient.js
import webSocketClient from './websocketClient';
import WebRTCHandler from './webrtcHandler';

class SocketClient {
    constructor() {
        this.socket = webSocketClient;
        this.webrtcHandler = null;
        this.callState = {
            activeCall: null,
            incomingCall: null,
            isCalling: false,
            callStatus: 'idle'
        };
        this.messageHandlers = new Map();
        this.callHandlers = new Map();
    }

    // Initialize connection
    async initialize(authToken, userId) {
        this.socket.initialize(authToken, userId);
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize WebRTC handler
        this.webrtcHandler = new WebRTCHandler(this.socket);
        
        return new Promise((resolve, reject) => {
            const cleanup = this.socket.on('connect', () => {
                cleanup();
                resolve();
            });
            
            this.socket.on('connect_error', (error) => {
                cleanup();
                reject(error);
            });
            
            // Timeout after 10 seconds
            setTimeout(() => {
                cleanup();
                reject(new Error('Connection timeout'));
            }, 10000);
        });
    }

    setupEventListeners() {
        // Message events
        this.socket.on('new_message', (data) => {
            this.triggerMessageHandler('new_message', data);
        });

        this.socket.on('message_delivered', (data) => {
            this.triggerMessageHandler('message_delivered', data);
        });

        this.socket.on('message_seen', (data) => {
            this.triggerMessageHandler('message_seen', data);
        });

        // Typing events
        this.socket.on('typing_start', (data) => {
            this.triggerMessageHandler('typing_start', data);
        });

        this.socket.on('typing_stop', (data) => {
            this.triggerMessageHandler('typing_stop', data);
        });

        // User status events
        this.socket.on('user_online', (data) => {
            this.triggerMessageHandler('user_online', data);
        });

        this.socket.on('user_offline', (data) => {
            this.triggerMessageHandler('user_offline', data);
        });

        // Call events
        this.socket.on('call_incoming', (data) => {
            this.handleIncomingCall(data);
        });

        this.socket.on('call_accepted', (data) => {
            this.handleCallAccepted(data);
        });

        this.socket.on('call_rejected', (data) => {
            this.handleCallRejected(data);
        });

        this.socket.on('call_ended', (data) => {
            this.handleCallEnded(data);
        });

        // WebRTC signaling events
        this.socket.on('webrtc_offer', (data) => {
            this.handleWebRTCOffer(data);
        });

        this.socket.on('webrtc_answer', (data) => {
            this.handleWebRTCAnswer(data);
        });

        this.socket.on('webrtc_ice_candidate', (data) => {
            this.handleICECandidate(data);
        });
    }

    // Message methods
    sendMessage(messageData) {
        this.socket.sendMessage(messageData);
    }

    sendTypingIndicator(toUserId, isTyping) {
        this.socket.sendTypingIndicator(toUserId, isTyping);
    }

    markMessageAsSeen(messageId) {
        this.socket.markMessageSeen(messageId);
    }

    // Call methods
    initiateCall(toUserId, callType = 'audio') {
        return new Promise((resolve, reject) => {
            this.callState.isCalling = true;
            this.callState.callStatus = 'calling';
            
            this.socket.initiateCall({
                toUserId,
                callType
            });
            
            // Listen for call response
            const cleanup = this.socket.on('call_initiated', (data) => {
                cleanup();
                this.callState.activeCall = {
                    callId: data.callId,
                    callType: data.callType,
                    toUserId: data.toUserId,
                    status: 'ringing',
                    isInitiator: true,
                    startTime: new Date()
                };
                resolve(data);
            });
            
            this.socket.on('call_error', (error) => {
                cleanup();
                this.resetCallState();
                reject(error);
            });
            
            // Timeout after 30 seconds
            setTimeout(() => {
                cleanup();
                if (this.callState.isCalling) {
                    this.resetCallState();
                    reject(new Error('Call timeout - no response'));
                }
            }, 30000);
        });
    }

    acceptCall(callId) {
        this.socket.acceptCall({ callId });
        this.callState.activeCall = {
            ...this.callState.incomingCall,
            status: 'connected',
            isInitiator: false,
            connectedAt: new Date()
        };
        this.callState.incomingCall = null;
        this.callState.callStatus = 'connected';
    }

    rejectCall(callId) {
        this.socket.rejectCall({ callId });
        this.resetCallState();
    }

    endCall(callId) {
        this.socket.endCall({ callId });
        this.resetCallState();
    }

    // WebRTC methods
    async handleIncomingCall(data) {
        this.callState.incomingCall = {
            callId: data.callId,
            callType: data.callType,
            fromUserId: data.fromUserId,
            fromUserName: data.fromUserName,
            fromUserAvatar: data.fromUserAvatar,
            timestamp: data.timestamp
        };
        
        this.triggerCallHandler('incoming_call', this.callState.incomingCall);
    }

    async handleCallAccepted(data) {
        if (this.callState.activeCall?.callId === data.callId) {
            this.callState.activeCall.status = 'connected';
            this.callState.activeCall.connectedAt = new Date();
            this.callState.callStatus = 'connected';
            this.callState.isCalling = false;
            
            // Initialize WebRTC for the call
            if (this.webrtcHandler) {
                await this.webrtcHandler.initializeCall(
                    data.callId,
                    data.acceptedBy,
                    true
                );
            }
            
            this.triggerCallHandler('call_accepted', data);
        }
    }

    handleCallRejected(data) {
        this.resetCallState();
        this.triggerCallHandler('call_rejected', data);
    }

    handleCallEnded(data) {
        if (this.webrtcHandler) {
            this.webrtcHandler.endCall();
        }
        this.resetCallState();
        this.triggerCallHandler('call_ended', data);
    }

    async handleWebRTCOffer(data) {
        if (this.webrtcHandler && this.callState.activeCall?.callId === data.callId) {
            await this.webrtcHandler.handleOffer(data.offer);
        }
    }

    async handleWebRTCAnswer(data) {
        if (this.webrtcHandler && this.callState.activeCall?.callId === data.callId) {
            await this.webrtcHandler.handleAnswer(data.answer);
        }
    }

    async handleICECandidate(data) {
        if (this.webrtcHandler && this.callState.activeCall?.callId === data.callId) {
            await this.webrtcHandler.handleICECandidate(data.candidate);
        }
    }

    // Callback management
    onMessage(event, callback) {
        if (!this.messageHandlers.has(event)) {
            this.messageHandlers.set(event, []);
        }
        this.messageHandlers.get(event).push(callback);
        return () => this.offMessage(event, callback);
    }

    offMessage(event, callback) {
        if (this.messageHandlers.has(event)) {
            const handlers = this.messageHandlers.get(event);
            const index = handlers.indexOf(callback);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    onCall(event, callback) {
        if (!this.callHandlers.has(event)) {
            this.callHandlers.set(event, []);
        }
        this.callHandlers.get(event).push(callback);
        return () => this.offCall(event, callback);
    }

    offCall(event, callback) {
        if (this.callHandlers.has(event)) {
            const handlers = this.callHandlers.get(event);
            const index = handlers.indexOf(callback);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    triggerMessageHandler(event, data) {
        if (this.messageHandlers.has(event)) {
            this.messageHandlers.get(event).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in ${event} handler:`, error);
                }
            });
        }
    }

    triggerCallHandler(event, data) {
        if (this.callHandlers.has(event)) {
            this.callHandlers.get(event).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in ${event} handler:`, error);
                }
            });
        }
    }

    // Utility methods
    resetCallState() {
        this.callState = {
            activeCall: null,
            incomingCall: null,
            isCalling: false,
            callStatus: 'idle'
        };
    }

    getCallState() {
        return { ...this.callState };
    }

    isConnected() {
        return this.socket.isConnected();
    }

    disconnect() {
        if (this.webrtcHandler) {
            this.webrtcHandler.endCall();
        }
        this.socket.disconnect();
        this.messageHandlers.clear();
        this.callHandlers.clear();
        this.resetCallState();
    }

    getSocketId() {
        return this.socket.getSocketId();
    }

    // WebRTC control methods
    async toggleAudio() {
        if (this.webrtcHandler) {
            return this.webrtcHandler.toggleAudio();
        }
        return false;
    }

    async toggleVideo() {
        if (this.webrtcHandler) {
            return this.webrtcHandler.toggleVideo();
        }
        return false;
    }

    async switchCamera() {
        if (this.webrtcHandler) {
            return this.webrtcHandler.switchCamera();
        }
        return false;
    }

    getLocalStream() {
        return this.webrtcHandler?.localStream || null;
    }

    getRemoteStream() {
        return this.webrtcHandler?.remoteStream || null;
    }

    setWebRTCCallbacks(callbacks) {
        if (this.webrtcHandler) {
            if (callbacks.onRemoteStream) {
                this.webrtcHandler.onRemoteStream(callbacks.onRemoteStream);
            }
            if (callbacks.onCallConnected) {
                this.webrtcHandler.onCallConnected(callbacks.onCallConnected);
            }
            if (callbacks.onCallDisconnected) {
                this.webrtcHandler.onCallDisconnected(callbacks.onCallDisconnected);
            }
        }
    }
}

// Create singleton instance
const socketClient = new SocketClient();
export default socketClient;