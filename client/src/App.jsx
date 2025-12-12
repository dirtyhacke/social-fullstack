import React, { useRef, useState, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import Login from './pages/Login'
import Feed from './pages/Feed'
import Messages from './pages/Messages'
import ChatBox from './pages/ChatBox'
import Connections from './pages/Connections'
import Discover from './pages/Discover'
import Profile from './pages/Profile'
import CreatePost from './pages/CreatePost'
import {useUser, useAuth} from '@clerk/clerk-react'
import Layout from './pages/Layout'
import toast, {Toaster} from 'react-hot-toast'
import { useDispatch } from 'react-redux'
import { fetchUser } from './features/user/userSlice'
import { fetchConnections } from './features/connections/connectionsSlice'
import { addMessage } from './features/messages/messagesSlice'
import Notification from './components/Notification'
import RandomChat from './components/RandomChat'
import ChatBot from './pages/ChatBot'
import PixoMusic from './pages/pixoMusic';
import PixoGames from './components/PixoGames';
import GroupChat from './pages/GroupChat'
import { io } from 'socket.io-client';

// Create Call Context
export const CallContext = React.createContext();

const App = () => {
  const {user} = useUser()
  const {getToken } = useAuth()
  const {pathname} = useLocation()
  const pathnameRef = useRef(pathname)
  const eventSourceRef = useRef(null)
  const socketRef = useRef(null)

  const dispatch = useDispatch()

  // Call State Management
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [callHistory, setCallHistory] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState(new Map());
  const [wsConnectionStatus, setWsConnectionStatus] = useState('disconnected');

  // Initialize Socket.io Connection
  useEffect(() => {
    const initializeSocket = async () => {
      if (!user?.id) return;

      try {
        const token = await getToken();
        
        // Disconnect existing socket
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }

        console.log('🔌 Initializing Socket.io connection...');
        
        socketRef.current = io('https://pixo-toj7.onrender.com', {
          query: {
            userId: user.id,
            token: token
          },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          timeout: 20000,
          forceNew: true
        });

        // Connection events
        socketRef.current.on('connect', () => {
          console.log('✅ Socket.io connected:', socketRef.current.id);
          setWsConnectionStatus('connected');
          
          // Mark user as online
          socketRef.current.emit('user_online', {
            userId: user.id,
            userName: user.fullName || user.username,
            userAvatar: user.imageUrl
          });
        });

        socketRef.current.on('connect_error', (error) => {
          console.error('❌ Socket.io connect error:', error);
          setWsConnectionStatus('disconnected');
        });

        socketRef.current.on('disconnect', (reason) => {
          console.log('🔌 Socket.io disconnected:', reason);
          setWsConnectionStatus('disconnected');
        });

        socketRef.current.on('reconnect', (attemptNumber) => {
          console.log(`🔄 Socket.io reconnected after ${attemptNumber} attempts`);
          setWsConnectionStatus('connected');
        });

        socketRef.current.on('reconnect_error', (error) => {
          console.error('❌ Socket.io reconnect error:', error);
        });

        socketRef.current.on('reconnect_failed', () => {
          console.error('❌ Socket.io reconnect failed');
          setWsConnectionStatus('disconnected');
        });

        // User presence events
        socketRef.current.on('user_online', (data) => {
          console.log('🟢 User online:', data.userId);
          setOnlineUsers(prev => new Map(prev.set(data.userId, {
            socketId: data.socketId,
            userId: data.userId,
            userName: data.userName,
            userAvatar: data.userAvatar,
            timestamp: new Date().toISOString()
          })));
        });

        socketRef.current.on('user_offline', (data) => {
          console.log('🔴 User offline:', data.userId);
          setOnlineUsers(prev => {
            const newMap = new Map(prev);
            newMap.delete(data.userId);
            return newMap;
          });
        });

        socketRef.current.on('online_users', (users) => {
          console.log('📊 Online users received:', users.length);
          const onlineMap = new Map();
          users.forEach(user => {
            onlineMap.set(user.userId, user);
          });
          setOnlineUsers(onlineMap);
        });

        // Call events via Socket.io
        socketRef.current.on('call_incoming', (data) => {
          console.log('📞 Incoming call via Socket.io:', data);
          handleIncomingCall(data);
        });

        socketRef.current.on('call_accepted', (data) => {
          console.log('✅ Call accepted via Socket.io:', data);
          handleCallAccepted(data);
        });

        socketRef.current.on('call_rejected', (data) => {
          console.log('❌ Call rejected via Socket.io:', data);
          handleCallEnded({...data, reason: 'Call rejected'});
        });

        socketRef.current.on('call_ended', (data) => {
          console.log('📞 Call ended via Socket.io:', data);
          handleCallEnded(data);
        });

        socketRef.current.on('call_connected', (data) => {
          console.log('🔗 Call connected via Socket.io:', data);
          setActiveCall(prev => prev ? { ...prev, status: 'connected' } : null);
        });

        // WebRTC signaling events
        socketRef.current.on('webrtc_offer', (data) => {
          console.log('📥 WebRTC offer received via Socket.io:', data);
          // This will be handled in ChatBox component
        });

        socketRef.current.on('webrtc_answer', (data) => {
          console.log('📥 WebRTC answer received via Socket.io:', data);
          // This will be handled in ChatBox component
        });

        socketRef.current.on('ice_candidate', (data) => {
          console.log('🧊 ICE candidate received via Socket.io:', data);
          // This will be handled in ChatBox component
        });

      } catch (error) {
        console.error('❌ Error initializing socket:', error);
      }
    };

    initializeSocket();

    return () => {
      if (socketRef.current) {
        console.log('🧹 Cleaning up Socket.io connection');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setWsConnectionStatus('disconnected');
      setOnlineUsers(new Map());
    };
  }, [user, getToken]);

  // Call Handler Functions
  const handleIncomingCall = (callData) => {
    console.log('📞 Incoming call received:', callData);
    
    // Check if call is already active or incoming
    if (activeCall || incomingCall) {
      console.log('⚠️ Already in a call, rejecting incoming call');
      // Reject the call automatically
      rejectIncomingCall(callData.callId);
      return;
    }

    setIncomingCall({
      ...callData,
      timestamp: new Date().toISOString()
    });
    
    // Play incoming call sound
    playSound('incoming_call');
    
    // Show notification
    toast.custom((t) => (
      <div className="bg-blue-500 text-white p-4 rounded-lg shadow-lg max-w-md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
            {callData.callType === 'video' ? (
              <span className="text-2xl">📹</span>
            ) : (
              <span className="text-2xl">📞</span>
            )}
          </div>
          <div className="flex-1">
            <p className="font-semibold">Incoming {callData.callType} Call</p>
            <p className="text-sm opacity-90">From: {callData.fromUserName}</p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => {
                  toast.dismiss(t.id);
                  rejectIncomingCall(callData.callId);
                }}
                className="px-3 py-1 bg-red-400 hover:bg-red-500 rounded text-sm"
              >
                Decline
              </button>
              <button
                onClick={() => {
                  toast.dismiss(t.id);
                  // Navigate to chat and accept call
                  window.location.href = `/messages/${callData.fromUserId}`;
                }}
                className="px-3 py-1 bg-green-400 hover:bg-green-500 rounded text-sm"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      </div>
    ), { 
      duration: 30000, 
      position: 'top-center',
      id: `call-${callData.callId}` 
    });

    // Browser notification
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(`Incoming ${callData.callType} Call`, {
          body: `From: ${callData.fromUserName}`,
          icon: callData.fromUserAvatar || '/default-avatar.png',
          badge: '/favicon.ico',
          requireInteraction: true,
          tag: `call-${callData.callId}`,
          silent: false
        });
      } catch (error) {
        console.error('Browser notification error:', error);
      }
    }
  };

  const rejectIncomingCall = async (callId) => {
    try {
      const token = await getToken();
      if (socketRef.current?.connected) {
        socketRef.current.emit('call_reject', { callId });
      }
      setIncomingCall(null);
      playSound('call_end');
      toast.info('Call declined');
    } catch (error) {
      console.error('Error rejecting call:', error);
      setIncomingCall(null);
    }
  };

  const handleCallEnded = (callData) => {
    console.log('📞 Call ended:', callData);
    
    // Add to call history
    setCallHistory(prev => [...prev, {
      ...callData,
      endedAt: new Date().toISOString(),
      duration: callData.duration || 0
    }]);

    // Clear active/incoming calls
    setIncomingCall(null);
    setActiveCall(null);

    // Play end sound
    playSound('call_end');

    // Show notification
    if (callData.reason === 'No answer' || callData.reason === 'Call rejected') {
      toast.error(`Missed ${callData.callType} call from ${callData.fromUserName}`);
    } else if (callData.reason === 'Call ended') {
      toast.success(`Call ended with ${callData.fromUserName} (${callData.duration || 0}s)`);
    } else {
      toast.info(`Call ended: ${callData.reason || 'Completed'}`);
    }
  };

  const handleCallAccepted = (callData) => {
    console.log('✅ Call accepted:', callData);
    setActiveCall({
      ...callData,
      status: 'connected',
      connectedAt: new Date().toISOString(),
      isInitiator: false
    });
    setIncomingCall(null);
    playSound('call_connected');
    toast.success(`Call connected with ${callData.fromUserName}`);
  };

  // Sound utility function
  const playSound = (soundType) => {
    try {
      const audio = new Audio(`/sounds/${soundType}.mp3`);
      audio.volume = 0.3;
      audio.play().catch(e => console.log('Sound play failed:', e));
    } catch (error) {
      console.log('Sound error:', error);
    }
  };

  // Call Context Value
  const callContextValue = {
    incomingCall,
    activeCall,
    callHistory,
    onlineUsers,
    wsConnectionStatus,
    socket: socketRef.current,
    setIncomingCall,
    setActiveCall,
    handleCallAccepted,
    rejectIncomingCall
  };

  // Fetch user data
  useEffect(() => {
    const fetchData = async () => {
      if(user){
        try {
          const token = await getToken();
          dispatch(fetchUser(token));
          dispatch(fetchConnections(token));
        } catch (error) {
          console.error('Error fetching data:', error);
        }
      }
    };
    fetchData();
  }, [user, getToken, dispatch]);

  // Track pathname changes
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // Setup SSE for messages (keeping for backward compatibility)
  useEffect(() => {
    if(!user) return;

    const setupSSE = async () => {
      try {
        const token = await getToken();
        
        // Close existing connection if any
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }

        const backendUrl = 'https://pixo-toj7.onrender.com';
        // 🆕 FIXED: Correct SSE route
        eventSourceRef.current = new EventSource(`${backendUrl}/api/messages/sse/${user.id}?token=${token}`);

        eventSourceRef.current.onopen = () => {
          console.log('🔗 SSE connection opened in App');
        };

        eventSourceRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('📩 SSE message received in App:', data.type);

            // Handle different event types
            switch(data.type) {
              case 'new_message':
                handleNewMessage(data);
                break;
                
              case 'call_incoming':
                // Prefer Socket.io for calls, but handle SSE as fallback
                if (!socketRef.current?.connected) {
                  handleIncomingCall(data);
                }
                break;
                
              case 'call_ended':
                handleCallEnded(data);
                break;
                
              case 'call_accepted':
                handleCallAccepted(data);
                break;
                
              case 'heartbeat':
                // console.log('❤️ SSE heartbeat');
                break;
                
              case 'connected':
                console.log('✅ SSE connected successfully');
                break;
                
              case 'user_online':
                // Update online users via SSE as fallback
                if (data.userId && data.socketId) {
                  setOnlineUsers(prev => new Map(prev.set(data.userId, {
                    socketId: data.socketId,
                    userId: data.userId,
                    timestamp: new Date().toISOString()
                  })));
                }
                break;
                
              case 'user_offline':
                if (data.userId) {
                  setOnlineUsers(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(data.userId);
                    return newMap;
                  });
                }
                break;
                
              default:
                console.log('📨 Unknown SSE event type:', data.type);
            }
            
          } catch (error) {
            console.log('❌ Error parsing SSE data:', error);
          }
        };

        // New message handling
        const handleNewMessage = (data) => {
          const message = data.message;
          
          // Check if we're in the chat with the sender
          if(pathnameRef.current === `/messages/${message.from_user_id?._id || message.from_user_id}`){
            dispatch(addMessage(message));
          } else {
            // Show notification for messages from other users
            toast.custom((t) => (
              <Notification t={t} message={message}/>
            ), { 
              position: "bottom-right",
              duration: 5000 
            });

            // Browser notification
            if ("Notification" in window && Notification.permission === "granted") {
              try {
                new Notification(`New message from ${message.from_user_id?.full_name || 'Someone'}`, {
                  body: message.text?.substring(0, 100) || '📷 Media message',
                  icon: message.from_user_id?.profile_picture || '/default-avatar.png',
                  badge: '/favicon.ico',
                  tag: `message-${message._id}`
                });
              } catch (error) {
                console.error('Browser notification error:', error);
              }
            }
          }
        };

        eventSourceRef.current.onerror = (error) => {
          console.log('❌ SSE error:', error);
          
          // Attempt to reconnect after 5 seconds
          setTimeout(() => {
            if (user) {
              console.log('🔄 Attempting SSE reconnection...');
              setupSSE();
            }
          }, 5000);
        };

      } catch (error) {
        console.log('❌ Error setting up SSE:', error);
      }
    };

    setupSSE();

    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then(permission => {
        console.log('Notification permission:', permission);
      });
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        console.log('🧹 SSE connection cleaned up');
      }
    };
  }, [user, getToken, dispatch]);

  // Global Call Components
  const GlobalCallComponents = () => (
    <>
      {/* WebSocket Status Indicator */}
      <div className={`fixed top-4 right-4 px-3 py-1 rounded-full text-xs font-semibold z-40 ${
        wsConnectionStatus === 'connected' 
          ? 'bg-green-100 text-green-700 border border-green-300' 
          : 'bg-red-100 text-red-700 border border-red-300'
      }`}>
        {wsConnectionStatus === 'connected' ? '🟢 Live' : '🔴 Offline'}
        <span className="ml-1 text-xs opacity-75">
          {onlineUsers.size} online
        </span>
      </div>

      {/* Incoming Call Modal */}
      {incomingCall && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-fade-in">
            <div className="p-8 text-center">
              <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center animate-pulse">
                {incomingCall.callType === 'video' ? (
                  <span className="text-4xl">📹</span>
                ) : (
                  <span className="text-4xl">📞</span>
                )}
              </div>
              
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Incoming {incomingCall.callType === 'video' ? 'Video' : 'Voice'} Call
              </h3>
              
              <div className="mb-6">
                <p className="text-gray-600 mb-1">from</p>
                <div className="flex items-center justify-center gap-3">
                  <img 
                    src={incomingCall.fromUserAvatar || '/default-avatar.png'} 
                    alt={incomingCall.fromUserName}
                    className="w-12 h-12 rounded-full border-2 border-indigo-200"
                  />
                  <p className="text-xl font-semibold text-indigo-600">
                    {incomingCall.fromUserName || 'Unknown User'}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => rejectIncomingCall(incomingCall.callId)}
                  className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full transition-all font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <span className="text-xl">✕</span>
                  Decline
                </button>
                <button
                  onClick={() => {
                    // Navigate to chat with the caller
                    window.location.href = `/messages/${incomingCall.fromUserId}`;
                    toast.success('Redirecting to chat...');
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-full transition-all font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <span className="text-xl">✓</span>
                  Accept
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Call Notification */}
      {activeCall && (
        <div className="fixed top-20 right-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-3 rounded-lg shadow-2xl z-40 animate-slide-in">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-3 h-3 bg-white rounded-full animate-ping absolute"></div>
              <div className="w-3 h-3 bg-white rounded-full relative"></div>
            </div>
            <div>
              <p className="font-semibold">Active {activeCall.callType} Call</p>
              <p className="text-sm opacity-90">With: {activeCall.fromUserName || activeCall.toUserName}</p>
            </div>
            <button 
              onClick={() => {
                setActiveCall(null);
                toast.info('Call minimized');
              }}
              className="ml-2 text-white hover:text-gray-200 text-lg"
            >
              −
            </button>
          </div>
        </div>
      )}
    </>
  );
  
  return (
    <CallContext.Provider value={callContextValue}>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10B981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#EF4444',
              secondary: '#fff',
            },
          },
        }}
      />
      <GlobalCallComponents />
      <Routes>
        <Route path='/' element={ !user ? <Login /> : <Layout/>}>
          <Route index element={<Feed/>}/>
          <Route path='messages' element={<Messages/>}/>
          <Route path='messages/:userId' element={<ChatBox/>}/>
          <Route path='connections' element={<Connections/>}/>
          <Route path='discover' element={<Discover/>}/>
          <Route path='profile' element={<Profile/>}/>
          <Route path='profile/:profileId' element={<Profile/>}/>
          <Route path='create-post' element={<CreatePost/>}/>
          <Route path='/random-chat' element={<RandomChat/>}/>
          <Route path='chat-bot' element={<ChatBot/>}/>
          <Route path="/pixo-music" element={<PixoMusic />} />
          <Route path="/pixo-games" element={<PixoGames />} />
          <Route path="/messages/group/:groupId" element={<GroupChat/>}/>
        </Route>
      </Routes>
    </CallContext.Provider>
  )
}

export default App