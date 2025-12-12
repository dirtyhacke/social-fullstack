// utils/webrtcHandler.js
class WebRTCHandler {
    constructor(socketClient) {
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.socketClient = socketClient;
        this.callId = null;
        this.remoteUserId = null;
        this.isCaller = false;
        
        // STUN servers configuration
        this.configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' }
            ],
            iceCandidatePoolSize: 10
        };
    }

    // Initialize WebRTC call
    async initializeCall(callId, remoteUserId, isCaller = false) {
        this.callId = callId;
        this.remoteUserId = remoteUserId;
        this.isCaller = isCaller;

        try {
            // Create peer connection
            this.peerConnection = new RTCPeerConnection(this.configuration);
            
            // Set up event handlers
            this.setupPeerConnectionHandlers();
            
            // Get local media stream
            await this.getLocalStream(isCaller);
            
            return this.peerConnection;
        } catch (error) {
            console.error('Error initializing call:', error);
            throw error;
        }
    }

    // Get local media stream
    async getLocalStream(isVideoCall = true) {
        try {
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 48000
                },
                video: isVideoCall ? {
                    width: { ideal: 1280, min: 640 },
                    height: { ideal: 720, min: 480 },
                    frameRate: { ideal: 30, min: 20 }
                } : false
            };

            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Add tracks to peer connection
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            return this.localStream;
        } catch (error) {
            console.error('Error accessing media devices:', error);
            throw error;
        }
    }

    // Set up peer connection event handlers
    setupPeerConnectionHandlers() {
        if (!this.peerConnection) return;

        // Handle remote stream
        this.peerConnection.ontrack = (event) => {
            console.log('Remote track received:', event);
            this.remoteStream = event.streams[0];
            this.onRemoteStream?.(this.remoteStream);
        };

        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.socketClient) {
                this.socketClient.sendICECandidate({
                    callId: this.callId,
                    toUserId: this.remoteUserId,
                    candidate: event.candidate
                });
            }
        };

        // Handle connection state changes
        this.peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', this.peerConnection.connectionState);
            this.onConnectionStateChange?.(this.peerConnection.connectionState);
            
            switch (this.peerConnection.connectionState) {
                case 'connected':
                    this.onCallConnected?.();
                    break;
                case 'disconnected':
                case 'failed':
                case 'closed':
                    this.onCallDisconnected?.();
                    break;
            }
        };

        // Handle ICE connection state
        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE connection state:', this.peerConnection.iceConnectionState);
            this.onICEConnectionStateChange?.(this.peerConnection.iceConnectionState);
        };

        // Handle negotiation needed
        this.peerConnection.onnegotiationneeded = async () => {
            if (this.isCaller) {
                await this.createOffer();
            }
        };
    }

    // Create offer (for caller)
    async createOffer() {
        try {
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            
            await this.peerConnection.setLocalDescription(offer);
            
            // Send offer to remote peer via signaling
            this.socketClient.sendWebRTCOffer({
                callId: this.callId,
                toUserId: this.remoteUserId,
                offer: offer
            });
            
            return offer;
        } catch (error) {
            console.error('Error creating offer:', error);
            throw error;
        }
    }

    // Handle incoming offer (for callee)
    async handleOffer(offer) {
        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            // Send answer to caller via signaling
            this.socketClient.sendWebRTCAnswer({
                callId: this.callId,
                toUserId: this.remoteUserId,
                answer: answer
            });
            
            return answer;
        } catch (error) {
            console.error('Error handling offer:', error);
            throw error;
        }
    }

    // Handle incoming answer
    async handleAnswer(answer) {
        try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
            console.error('Error handling answer:', error);
            throw error;
        }
    }

    // Handle incoming ICE candidate
    async handleICECandidate(candidate) {
        try {
            if (this.peerConnection.remoteDescription) {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            } else {
                // Store candidate for later
                setTimeout(() => {
                    if (this.peerConnection.remoteDescription) {
                        this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                    }
                }, 1000);
            }
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
        }
    }

    // Toggle audio mute
    toggleAudio() {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                return audioTrack.enabled;
            }
        }
        return false;
    }

    // Toggle video
    toggleVideo() {
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                return videoTrack.enabled;
            }
        }
        return false;
    }

    // Switch camera
    async switchCamera() {
        if (!this.localStream) return;
        
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (!videoTrack) return;
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        if (videoDevices.length < 2) {
            console.warn('Only one camera available');
            return;
        }
        
        const currentDeviceId = videoTrack.getSettings().deviceId;
        const otherDevice = videoDevices.find(device => device.deviceId !== currentDeviceId);
        
        if (!otherDevice) return;
        
        // Stop current track
        videoTrack.stop();
        
        // Get new stream with other camera
        const newStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: otherDevice.deviceId } },
            audio: true
        });
        
        // Replace video track
        const newVideoTrack = newStream.getVideoTracks()[0];
        const sender = this.peerConnection.getSenders().find(s => 
            s.track && s.track.kind === 'video'
        );
        
        if (sender) {
            sender.replaceTrack(newVideoTrack);
        }
        
        // Update local stream
        this.localStream.removeTrack(videoTrack);
        this.localStream.addTrack(newVideoTrack);
    }

    // End call and cleanup
    endCall() {
        // Stop all tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                track.stop();
            });
        }
        
        // Close peer connection
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        // Clear streams
        this.localStream = null;
        this.remoteStream = null;
        
        // Reset call data
        this.callId = null;
        this.remoteUserId = null;
        this.isCaller = false;
    }

    // Event callbacks
    onRemoteStream(callback) {
        this.onRemoteStream = callback;
    }

    onConnectionStateChange(callback) {
        this.onConnectionStateChange = callback;
    }

    onICEConnectionStateChange(callback) {
        this.onICEConnectionStateChange = callback;
    }

    onCallConnected(callback) {
        this.onCallConnected = callback;
    }

    onCallDisconnected(callback) {
        this.onCallDisconnected = callback;
    }
}

export default WebRTCHandler;