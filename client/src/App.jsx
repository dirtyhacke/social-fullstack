import React, { useRef, useState } from 'react'
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
import { useEffect } from 'react'
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

// Create Call Context
export const CallContext = React.createContext();

const App = () => {
  const {user} = useUser()
  const {getToken } = useAuth()
  const {pathname} = useLocation()
  const pathnameRef = useRef(pathname)
  const eventSourceRef = useRef(null)

  const dispatch = useDispatch()

  // 🆕 Call State Management
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [callHistory, setCallHistory] = useState([]);

  // 🆕 Call Handler Functions
  const handleIncomingCall = (callData) => {
    console.log('📞 Incoming call received:', callData);
    setIncomingCall(callData);
    
    // Show notification for incoming call
    toast.custom((t) => (
      <div className="bg-blue-500 text-white p-4 rounded-lg shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
            <span className="text-blue-500 text-lg">📞</span>
          </div>
          <div>
            <p className="font-semibold">Incoming {callData.callType} Call</p>
            <p className="text-sm">From: {callData.fromUserName}</p>
          </div>
        </div>
      </div>
    ), { duration: 10000, position: 'top-center' });

    // Browser notification
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(`Incoming ${callData.callType} Call`, {
        body: `From: ${callData.fromUserName}`,
        icon: callData.fromUserAvatar || '/default-avatar.png',
        requireInteraction: true,
        tag: 'incoming-call'
      });
    }
  };

  const handleCallEnded = (callData) => {
    console.log('📞 Call ended:', callData);
    
    // Add to call history
    setCallHistory(prev => [...prev, {
      ...callData,
      endedAt: new Date().toISOString()
    }]);

    // Clear active/incoming calls
    setIncomingCall(null);
    setActiveCall(null);

    // Show call ended notification
    if (callData.reason === 'No answer') {
      toast.error(`Missed ${callData.callType} call from ${callData.fromUserName}`);
    } else {
      toast.info(`Call ended: ${callData.reason || 'Completed'}`);
    }
  };

  const handleCallAccepted = (callData) => {
    console.log('✅ Call accepted:', callData);
    setActiveCall({
      ...callData,
      status: 'connected',
      connectedAt: new Date().toISOString()
    });
    setIncomingCall(null);
    toast.success(`Call connected with ${callData.fromUserName}`);
  };

  // 🆕 Call Context Value
  const callContextValue = {
    incomingCall,
    activeCall,
    callHistory,
    setIncomingCall,
    setActiveCall,
    handleCallAccepted
  };

  useEffect(()=>{
    const fetchData = async () => {
      if(user){
      const token = await getToken()
      dispatch(fetchUser(token))
      dispatch(fetchConnections(token))
      }
    }
    fetchData()
    
  },[user, getToken, dispatch])

  useEffect(()=>{
    pathnameRef.current = pathname
  },[pathname])

  // Setup SSE for real-time messages and calls
  useEffect(()=>{
    if(user){
      const setupSSE = async () => {
        try {
          const token = await getToken()
          
          // Close existing connection if any
          if (eventSourceRef.current) {
            eventSourceRef.current.close()
          }

          const backendUrl = 'https://pixo-toj7.onrender.com';
          eventSourceRef.current = new EventSource(`${backendUrl}/api/sse/${user.id}?token=${token}`)

          eventSourceRef.current.onopen = () => {
            console.log('🔗 SSE connection opened in App')
          }

          eventSourceRef.current.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data)
              console.log('📩 SSE message received in App:', data)

              // 🆕 Handle different event types
              switch(data.type) {
                case 'new_message':
                  handleNewMessage(data);
                  break;
                  
                case 'call_incoming':
                  handleIncomingCall(data);
                  break;
                  
                case 'call_ended':
                  handleCallEnded(data);
                  break;
                  
                case 'call_accepted':
                  handleCallAccepted(data);
                  break;
                  
                case 'call_connected':
                  setActiveCall(prev => prev ? { ...prev, status: 'connected' } : null);
                  break;
                  
                case 'heartbeat':
                  console.log('❤️ SSE heartbeat in App');
                  break;
                  
                case 'connected':
                  console.log('✅ SSE connected successfully in App');
                  break;
                  
                default:
                  console.log('📨 Unknown SSE event type:', data.type);
              }
              
            } catch (error) {
              console.log('❌ Error parsing SSE data in App:', error)
            }
          }

          // 🆕 Separate function for new message handling
          const handleNewMessage = (data) => {
            const message = data.message;
            
            // Check if we're in the chat with the sender
            if(pathnameRef.current === (`/messages/${message.from_user_id._id}`)){
              dispatch(addMessage(message))
            } else {
              // Show notification for messages from other users
              toast.custom((t)=>(
                <Notification t={t} message={message}/>
              ), {position: "bottom-right"})

              // Also show system notification
              if ("Notification" in window && Notification.permission === "granted") {
                new Notification(`New message from ${message.from_user_id?.full_name || 'Someone'}`, {
                  body: message.text || '📷 Image',
                  icon: message.from_user_id?.profile_picture || '/default-avatar.png',
                  badge: '/favicon.ico'
                })
              }
            }
          };

          eventSourceRef.current.onerror = (error) => {
            console.log('❌ SSE error in App:', error)
            console.log('🔍 SSE connection state:', eventSourceRef.current?.readyState)
            
            // Attempt to reconnect after 5 seconds
            setTimeout(() => {
              if (user) {
                console.log('🔄 Attempting SSE reconnection in App...')
                setupSSE()
              }
            }, 5000)
          }

        } catch (error) {
          console.log('❌ Error setting up SSE in App:', error)
        }
      }

      setupSSE()

      // Request notification permission
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission()
      }

      return () => {
        if (eventSourceRef.current) {
          eventSourceRef.current.close()
          eventSourceRef.current = null
          console.log('🧹 App SSE connection cleaned up')
        }
      }
    }
  },[user, getToken, dispatch])

  // 🆕 Global Call Components
  const GlobalCallComponents = () => (
    <>
      {/* Incoming Call Modal */}
      {incomingCall && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
              {incomingCall.callType === 'video' ? (
                <span className="text-2xl">📹</span>
              ) : (
                <span className="text-2xl">📞</span>
              )}
            </div>
            
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              Incoming {incomingCall.callType === 'video' ? 'Video' : 'Voice'} Call
            </h3>
            
            <p className="text-gray-600 mb-2">from</p>
            <p className="text-xl font-semibold text-indigo-600 mb-6">
              {incomingCall.fromUserName || 'Unknown User'}
            </p>
            
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => {
                  setIncomingCall(null);
                  toast.info('Call declined');
                }}
                className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors font-semibold"
              >
                <span>❌</span>
                Decline
              </button>
              <button
                onClick={() => {
                  // Navigate to chat with the caller and accept call
                  window.location.href = `/messages/${incomingCall.fromUserId}`;
                  setTimeout(() => {
                    handleCallAccepted(incomingCall);
                  }, 1000);
                }}
                className="flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-full transition-colors font-semibold"
              >
                <span>✅</span>
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Call Overlay */}
      {activeCall && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-40">
          <div className="flex items-center gap-2">
            <span className="animate-pulse">●</span>
            <span>Active {activeCall.callType} Call</span>
            <button 
              onClick={() => setActiveCall(null)}
              className="ml-2 text-white hover:text-gray-200"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );
  
  return (
    <CallContext.Provider value={callContextValue}>
      <Toaster />
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