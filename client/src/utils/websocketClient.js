// utils/websocketClient.js
import { io } from 'socket.io-client';

class WebSocketClient {
    constructor() {
        this.socket = null;
        this.callbacks = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        this.isConnecting = false;
        this.userId = null;
    }

    initialize(token, userId) {
        if (this.socket?.connected) {
            return;
        }

        this.userId = userId;
        this.isConnecting = true;

        // Connect to your backend WebSocket server
        this.socket = io('https://pixo-toj7.onrender.com', {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: this.maxReconnectAttempts,
            reconnectionDelay: this.reconnectDelay,
            timeout: 20000,
            forceNew: true
        });

        this.setupEventHandlers();
    }

    setupEventHandlers() {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            console.log('✅ WebSocket connected:', this.socket.id);
            this.reconnectAttempts = 0;
            this.isConnecting = false;
            
            // Authenticate with user ID
            this.socket.emit('authenticate', this.userId);
            
            // Notify all callbacks
            this.triggerCallback('connect', { socketId: this.socket.id });
        });

        this.socket.on('disconnect', (reason) => {
            console.log('🔌 WebSocket disconnected:', reason);
            this.isConnecting = false;
            this.triggerCallback('disconnect', { reason });
            
            if (reason === 'io server disconnect' || reason === 'transport close') {
                setTimeout(() => {
                    if (this.userId && this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.reconnectAttempts++;
                        this.socket.connect();
                    }
                }, this.reconnectDelay);
            }
        });

        this.socket.on('connect_error', (error) => {
            console.error('❌ WebSocket connection error:', error);
            this.isConnecting = false;
            this.triggerCallback('connect_error', { error });
        });

        // Message Events
        this.socket.on('new_message', (data) => {
            this.triggerCallback('new_message', data);
        });

        this.socket.on('message_sent', (data) => {
            this.triggerCallback('message_sent', data);
        });

        this.socket.on('message_delivered', (data) => {
            this.triggerCallback('message_delivered', data);
        });

        this.socket.on('message_seen', (data) => {
            this.triggerCallback('message_seen', data);
        });

        this.socket.on('message_deleted', (data) => {
            this.triggerCallback('message_deleted', data);
        });

        // Typing Events
        this.socket.on('typing_start', (data) => {
            this.triggerCallback('typing_start', data);
        });

        this.socket.on('typing_stop', (data) => {
            this.triggerCallback('typing_stop', data);
        });

        // User Status Events
        this.socket.on('user_online', (data) => {
            this.triggerCallback('user_online', data);
        });

        this.socket.on('user_offline', (data) => {
            this.triggerCallback('user_offline', data);
        });

        this.socket.on('online_users', (data) => {
            this.triggerCallback('online_users', data);
        });

        // Call Events
        this.socket.on('call_incoming', (data) => {
            this.triggerCallback('call_incoming', data);
        });

        this.socket.on('call_initiated', (data) => {
            this.triggerCallback('call_initiated', data);
        });

        this.socket.on('call_accepted', (data) => {
            this.triggerCallback('call_accepted', data);
        });

        this.socket.on('call_rejected', (data) => {
            this.triggerCallback('call_rejected', data);
        });

        this.socket.on('call_connected', (data) => {
            this.triggerCallback('call_connected', data);
        });

        this.socket.on('call_ended', (data) => {
            this.triggerCallback('call_ended', data);
        });

        this.socket.on('call_timeout', (data) => {
            this.triggerCallback('call_timeout', data);
        });

        this.socket.on('call_error', (data) => {
            this.triggerCallback('call_error', data);
        });

        // WebRTC Signaling Events
        this.socket.on('webrtc_offer', (data) => {
            this.triggerCallback('webrtc_offer', data);
        });

        this.socket.on('webrtc_answer', (data) => {
            this.triggerCallback('webrtc_answer', data);
        });

        this.socket.on('webrtc_ice_candidate', (data) => {
            this.triggerCallback('webrtc_ice_candidate', data);
        });

        // Error Events
        this.socket.on('error', (data) => {
            this.triggerCallback('error', data);
        });
    }

    // Send Events
    sendMessage(messageData) {
        this.socket?.emit('send_message', messageData);
    }

    sendTypingIndicator(toUserId, isTyping) {
        this.socket?.emit('typing', { toUserId, isTyping });
    }

    markMessageSeen(messageId) {
        this.socket?.emit('mark_seen', { messageId });
    }

    initiateCall(callData) {
        this.socket?.emit('initiate_call', callData);
    }

    acceptCall(callData) {
        this.socket?.emit('accept_call', callData);
    }

    rejectCall(callData) {
        this.socket?.emit('reject_call', callData);
    }

    endCall(callData) {
        this.socket?.emit('end_call', callData);
    }

    // WebRTC Signaling
    sendWebRTCOffer(callData) {
        this.socket?.emit('webrtc_offer', callData);
    }

    sendWebRTCAnswer(callData) {
        this.socket?.emit('webrtc_answer', callData);
    }

    sendICECandidate(callData) {
        this.socket?.emit('webrtc_ice_candidate', callData);
    }

    // Callback Management
    on(event, callback) {
        if (!this.callbacks.has(event)) {
            this.callbacks.set(event, []);
        }
        this.callbacks.get(event).push(callback);
        return () => this.off(event, callback);
    }

    off(event, callback) {
        if (this.callbacks.has(event)) {
            const callbacks = this.callbacks.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    triggerCallback(event, data) {
        if (this.callbacks.has(event)) {
            this.callbacks.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in ${event} callback:`, error);
                }
            });
        }
    }

    // Utility Methods
    isConnected() {
        return this.socket?.connected || false;
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.callbacks.clear();
            this.isConnecting = false;
        }
    }

    reconnect() {
        if (this.socket && !this.socket.connected && !this.isConnecting) {
            this.socket.connect();
        }
    }

    getSocketId() {
        return this.socket?.id;
    }
}

// Create a singleton instance
const webSocketClient = new WebSocketClient();
export default webSocketClient;