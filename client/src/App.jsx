import React, { useRef } from 'react'
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

const App = () => {
  const {user} = useUser()
  const {getToken } = useAuth()
  const {pathname} = useLocation()
  const pathnameRef = useRef(pathname)
  const eventSourceRef = useRef(null)

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

  useEffect(()=>{
    pathnameRef.current = pathname
  },[pathname])

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

          // ✅ FIXED: Use correct backend URL with port 4000
          const backendUrl = 'https://social-server-nine.vercel.app';
          eventSourceRef.current = new EventSource(`${backendUrl}/api/sse/${user.id}?token=${token}`)

          eventSourceRef.current.onopen = () => {
            console.log('🔗 SSE connection opened in App')
          }

          eventSourceRef.current.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data)
              console.log('📩 SSE message received in App:', data)

              if (data.type === 'new_message') {
                const message = data.message
                
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
              } else if (data.type === 'heartbeat') {
                console.log('❤️ SSE heartbeat in App')
              } else if (data.type === 'connected') {
                console.log('✅ SSE connected successfully in App')
              }
            } catch (error) {
              console.log('❌ Error parsing SSE data in App:', error)
            }
          }

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
  
  return (
    <>
      <Toaster />
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
        </Route>
      </Routes>
    </>
  )
}

export default App