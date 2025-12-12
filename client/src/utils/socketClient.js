// client/src/utils/socketClient.js
import { io } from 'socket.io-client';

class SocketClient {
    constructor() {
        this.socket = null;
        this.userId = null;
        this.callbacks = new Map();
    }

    // Initialize socket connection
    connect(userId, token) {
        if (this.socket?.connected) return;
        
        this.userId = userId;
        
        // Use your backend URL
        const socketUrl = import.meta.env.VITE_WS_URL || 'http://localhost:5000';
        
        this.socket = io(socketUrl, {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        this.setupEventListeners();
    }

    // Setup event listeners
    setupEventListeners() {
        this.socket.on('connect', () => {
            console.log('✅ Socket connected:', this.socket.id);
            this.authenticate();
        });

        this.socket.on('authenticated', (data) => {
            console.log('✅ Socket authenticated');
            this.emitCallback('connected', data);
        });

        this.socket.on('disconnect', (reason) => {
            console.log('🔌 Socket disconnected:', reason);
            this.emitCallback('disconnected', { reason });
        });

        this.socket.on('error', (error) => {
            console.log('❌ Socket error:', error);
            this.emitCallback('error', error);
        });

        // Chat events
        this.socket.on('new_message', (data) => {
            this.emitCallback('new_message', data);
        });

        this.socket.on('message_delivered', (data) => {
            this.emitCallback('message_delivered', data);
        });

        this.socket.on('message_seen', (data) => {
            this.emitCallback('message_seen', data);
        });

        this.socket.on('typing_start', (data) => {
            this.emitCallback('typing_start', data);
        });

        this.socket.on('typing_stop', (data) => {
            this.emitCallback('typing_stop', data);
        });

        this.socket.on('user_online', (data) => {
            this.emitCallback('user_online', data);
        });

        this.socket.on('user_offline', (data) => {
            this.emitCallback('user_offline', data);
        });

        // Call events
        this.socket.on('call_incoming', (data) => {
            this.emitCallback('call_incoming', data);
        });

        this.socket.on('call_accepted', (data) => {
            this.emitCallback('call_accepted', data);
        });

        this.socket.on('call_rejected', (data) => {
            this.emitCallback('call_rejected', data);
        });

        this.socket.on('call_ended', (data) => {
            this.emitCallback('call_ended', data);
        });

        // WebRTC signaling events
        this.socket.on('webrtc_offer', (data) => {
            this.emitCallback('webrtc_offer', data);
        });

        this.socket.on('webrtc_answer', (data) => {
            this.emitCallback('webrtc_answer', data);
        });

        this.socket.on('webrtc_ice_candidate', (data) => {
            this.emitCallback('webrtc_ice_candidate', data);
        });
    }

    // Authenticate with server
    authenticate() {
        if (this.userId && this.socket) {
            this.socket.emit('authenticate', { userId: this.userId });
        }
    }

    // Register callback for events
    on(event, callback) {
        this.callbacks.set(event, callback);
    }

    // Remove callback
    off(event) {
        this.callbacks.delete(event);
    }

    // Emit callback
    emitCallback(event, data) {
        const callback = this.callbacks.get(event);
        if (callback) {
            callback(data);
        }
    }

    // Send message
    sendMessage(data) {
        this.socket.emit('send_message', data);
    }

    // Typing indicator
    setTyping(toUserId, isTyping) {
        this.socket.emit('typing', {
            toUserId,
            isTyping
        });
    }

    // Mark message as seen
    markAsSeen(messageId) {
        this.socket.emit('mark_seen', { messageId });
    }

    // Call functions
    initiateCall(toUserId, callType = 'audio') {
        this.socket.emit('initiate_call', {
            toUserId,
            callType
        });
    }

    acceptCall(callId) {
        this.socket.emit('accept_call', { callId });
    }

    rejectCall(callId, reason = 'Rejected') {
        this.socket.emit('reject_call', { callId, reason });
    }

    endCall(callId, reason = 'Call ended') {
        this.socket.emit('end_call', { callId, reason });
    }

    // WebRTC signaling
    sendOffer(callId, toUserId, offer) {
        this.socket.emit('webrtc_offer', {
            callId,
            toUserId,
            offer
        });
    }

    sendAnswer(callId, toUserId, answer) {
        this.socket.emit('webrtc_answer', {
            callId,
            toUserId,
            answer
        });
    }

    sendIceCandidate(callId, toUserId, candidate) {
        this.socket.emit('webrtc_ice_candidate', {
            callId,
            toUserId,
            candidate
        });
    }

    // Disconnect
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.userId = null;
            this.callbacks.clear();
        }
    }

    // Check if connected
    isConnected() {
        return this.socket?.connected || false;
    }
}

export const socketClient = new SocketClient();