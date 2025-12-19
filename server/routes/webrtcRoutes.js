// server/routes/webrtcRoutes.js
import express from 'express';
import { clerkClient } from '@clerk/express';

const router = express.Router();

// In-memory stores for signaling
const pendingSignals = new Map(); // Map<userId, Array<signal>>
const activeCalls = new Map(); // Map<callId, {callerId, calleeId, type, status}>

// Extract user ID from Clerk request
async function getUserIdFromRequest(req) {
    try {
        // Clerk middleware already adds auth to req
        const auth = req.auth;
        if (!auth || !auth.userId) {
            throw new Error('Not authenticated');
        }
        return auth.userId;
    } catch (error) {
        console.error('Auth error:', error);
        return null;
    }
}

// Store pending signals
function storeSignal(userId, signal) {
    if (!pendingSignals.has(userId)) {
        pendingSignals.set(userId, []);
    }
    
    const userSignals = pendingSignals.get(userId);
    userSignals.push({
        ...signal,
        timestamp: Date.now(),
        expiresAt: Date.now() + 30000 // 30 seconds expiry
    });
    
    // Clean up old signals
    const now = Date.now();
    const validSignals = userSignals.filter(s => s.expiresAt > now);
    pendingSignals.set(userId, validSignals);
    
    return signal;
}

// Get signals for user
function getSignals(userId) {
    if (!pendingSignals.has(userId)) {
        return [];
    }
    
    const now = Date.now();
    const userSignals = pendingSignals.get(userId);
    const validSignals = userSignals.filter(s => s.expiresAt > now);
    
    // Remove expired signals
    pendingSignals.set(userId, validSignals);
    
    return validSignals;
}

// Clear signals after they've been delivered
function clearSignals(userId) {
    pendingSignals.set(userId, []);
}

// WebRTC Signaling endpoint - POST /api/webrtc/signal
router.post('/signal', async (req, res) => {
    try {
        const senderId = await getUserIdFromRequest(req);
        if (!senderId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Not authenticated' 
            });
        }

        const { type, targetUserId, callType, offer, answer, candidate, callId, reason } = req.body;

        if (!type) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing type field' 
            });
        }

        console.log(`📤 Signal from ${senderId}: ${type}`, { targetUserId, callId });

        // Handle different signal types
        switch (type) {
            case 'call-offer':
                if (!targetUserId || !callType || !offer || !callId) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'Missing required fields for call-offer' 
                    });
                }
                
                // Create new call
                activeCalls.set(callId, {
                    callerId: senderId,
                    calleeId: targetUserId,
                    type: callType,
                    status: 'calling',
                    createdAt: Date.now()
                });
                
                // Send as incoming call to target
                storeSignal(targetUserId, {
                    type: 'incoming-call',
                    callerId: senderId,
                    callType: callType,
                    offer: offer,
                    callId: callId,
                    timestamp: Date.now()
                });
                
                console.log(`📞 Call offer from ${senderId} to ${targetUserId}, callId: ${callId}`);
                break;

            case 'call-answer':
                if (!targetUserId || !answer || !callId) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'Missing required fields for call-answer' 
                    });
                }
                
                // Update call status
                const call = activeCalls.get(callId);
                if (call) {
                    call.status = 'answered';
                    call.answeredAt = Date.now();
                    
                    // Forward answer to caller
                    storeSignal(call.callerId, {
                        type: 'call-answer',
                        senderId: senderId,
                        answer: answer,
                        callId: callId,
                        timestamp: Date.now()
                    });
                    console.log(`✅ Call answered from ${senderId} to ${call.callerId}`);
                } else {
                    console.log(`❌ Call ${callId} not found`);
                }
                break;

            case 'ice-candidate':
                if (!targetUserId || !candidate || !callId) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'Missing required fields for ice-candidate' 
                    });
                }
                
                // Forward ICE candidate to the other party
                const iceCall = activeCalls.get(callId);
                if (iceCall) {
                    const otherUserId = iceCall.callerId === senderId ? iceCall.calleeId : iceCall.callerId;
                    storeSignal(otherUserId, {
                        type: 'ice-candidate',
                        senderId: senderId,
                        candidate: candidate,
                        callId: callId,
                        timestamp: Date.now()
                    });
                    console.log(`🧊 ICE candidate from ${senderId} to ${otherUserId}`);
                }
                break;

            case 'end-call':
            case 'call-reject':
                if (!callId) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'Missing callId' 
                    });
                }
                
                // Clean up call
                const endCall = activeCalls.get(callId);
                if (endCall) {
                    // Notify the other party
                    const otherUserId = endCall.callerId === senderId ? endCall.calleeId : endCall.callerId;
                    
                    storeSignal(otherUserId, {
                        type: type === 'end-call' ? 'call-ended' : 'call-rejected',
                        senderId: senderId,
                        callId: callId,
                        reason: reason || 'Call ended',
                        timestamp: Date.now()
                    });
                    
                    // Remove call from active calls
                    activeCalls.delete(callId);
                    console.log(`📴 Call ${callId} ended by ${senderId}`);
                }
                break;

            default:
                console.log(`❓ Unknown signal type: ${type}`);
        }

        res.json({ 
            success: true, 
            message: 'Signal processed',
            timestamp: Date.now()
        });

    } catch (error) {
        console.error('❌ Error in signal endpoint:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Get pending signals - GET /api/webrtc/signals/:userId
router.get('/signals/:userId', async (req, res) => {
    try {
        const requestorId = await getUserIdFromRequest(req);
        if (!requestorId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Not authenticated' 
            });
        }

        const { userId } = req.params;

        // Verify requestor is accessing their own signals
        if (requestorId !== userId) {
            return res.status(403).json({ 
                success: false, 
                error: 'Access denied' 
            });
        }

        const signals = getSignals(userId);
        
        // Clear signals after reading
        clearSignals(userId);

        res.json({
            success: true,
            signals,
            count: signals.length,
            timestamp: Date.now()
        });

    } catch (error) {
        console.error('❌ Error getting signals:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Get active call info - GET /api/webrtc/call/:callId
router.get('/call/:callId', async (req, res) => {
    try {
        const userId = await getUserIdFromRequest(req);
        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Not authenticated' 
            });
        }

        const { callId } = req.params;
        const call = activeCalls.get(callId);
        
        if (!call) {
            return res.status(404).json({ 
                success: false, 
                error: 'Call not found' 
            });
        }

        // Verify user is part of the call
        if (call.callerId !== userId && call.calleeId !== userId) {
            return res.status(403).json({ 
                success: false, 
                error: 'Not authorized' 
            });
        }

        res.json({
            success: true,
            call: {
                ...call,
                duration: call.answeredAt ? Date.now() - call.answeredAt : 0
            }
        });

    } catch (error) {
        console.error('❌ Error getting call info:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Health check for WebRTC signaling
router.get('/health', (req, res) => {
    res.json({
        success: true,
        service: 'WebRTC Signaling',
        status: 'online',
        timestamp: Date.now(),
        stats: {
            pendingSignals: pendingSignals.size,
            activeCalls: activeCalls.size,
            totalUsers: pendingSignals.size
        }
    });
});

export default router;