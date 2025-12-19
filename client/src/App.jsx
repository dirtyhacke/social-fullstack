import React, { useRef, useState } from 'react'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
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

const App = () => {
  const {user} = useUser()
  const {getToken } = useAuth()
  const {pathname} = useLocation()
  const pathnameRef = useRef(pathname)
  const eventSourceRef = useRef(null)
  const navigate = useNavigate()

  const dispatch = useDispatch()

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

  // Setup SSE for real-time messages
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
          
          // Use the correct SSE endpoint
          eventSourceRef.current = new EventSource(`${backendUrl}/api/messages/sse/${user.id}?token=${token}`)

          eventSourceRef.current.onopen = () => {
            console.log('🔗 SSE connection opened in App')
          }

          eventSourceRef.current.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data)
              console.log('📩 SSE message received in App:', data)

              // Handle different event types
              switch(data.type) {
                case 'new_message':
                  handleNewMessage(data);
                  break;
                  
                case 'heartbeat':
                  console.log('❤️ SSE heartbeat in App');
                  break;
                  
                case 'connected':
                  console.log('✅ SSE connected successfully in App');
                  break;
                  
                case 'user_online':
                  console.log(`🟢 User ${data.userId} is online`);
                  break;
                  
                case 'user_offline':
                  console.log(`🔴 User ${data.userId} is offline`);
                  break;
                  
                case 'typing_start':
                  console.log(`✍️ User ${data.fromUserId} is typing`);
                  break;
                  
                case 'typing_stop':
                  console.log(`✍️ User ${data.fromUserId} stopped typing`);
                  break;
                  
                default:
                  console.log('📨 Unknown SSE event type:', data.type);
              }
              
            } catch (error) {
              console.log('❌ Error parsing SSE data in App:', error)
            }
          }

          // Separate function for new message handling
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
          // Retry after 10 seconds on error
          setTimeout(() => {
            if (user) {
              setupSSE()
            }
          }, 10000)
        }
      }

      setupSSE()

      // Request notification permission
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission()
      }

      // Cleanup function
      return () => {
        if (eventSourceRef.current) {
          eventSourceRef.current.close()
          eventSourceRef.current = null
          console.log('🧹 App SSE connection cleaned up')
        }
      }
    }
  },[user, getToken, dispatch, navigate])

  return (
    <>
      <Toaster 
        toastOptions={{
          duration: 4000,
          position: 'top-right',
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
            duration: 5000,
            iconTheme: {
              primary: '#EF4444',
              secondary: '#fff',
            },
          },
        }}
      />
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
    </>
  )
}

export default App