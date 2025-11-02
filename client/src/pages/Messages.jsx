import React, { useEffect, useRef, useState } from 'react'
import { Eye, MessageSquare, Bell, BellOff } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useAuth, useUser } from '@clerk/clerk-react'
import api from '../api/axios'
import toast from 'react-hot-toast'

const Messages = () => {
  const { connections } = useSelector((state) => state.connections)
  const navigate = useNavigate()
  const { user } = useUser()
  const { getToken } = useAuth()
  const eventSourceRef = useRef(null)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)

  // Function to show system notification
  const showNotification = (data) => {
    try {
      const notification = data?.notification;
      const message = data?.message;
      
      const title = notification?.title || 'New Message';
      const fromName = notification?.from || message?.from_user_id?.full_name || 'Someone';
      const body = notification?.body || message?.text || '📷 Image';
      const avatar = notification?.avatar || message?.from_user_id?.profile_picture || '/default-avatar.png';
      const fromId = notification?.fromId || message?.from_user_id?._id;

      if ("Notification" in window && Notification.permission === "granted") {
        const notif = new Notification(title, {
          body: `${fromName}: ${body}`,
          icon: avatar,
          badge: '/favicon.ico',
          tag: 'chat-message'
        });

        notif.onclick = () => {
          window.focus();
          if (fromId) {
            navigate(`/messages/${fromId}`);
          }
          notif.close();
        };

        setTimeout(() => notif.close(), 5000);
      } else {
        toast.success(`New message from ${fromName}`);
      }
    } catch (error) {
      console.log('❌ Error showing notification:', error);
      toast.success('New message received');
    }
  }

  // Setup SSE for real-time messages
  const setupSSE = async () => {
    if (!user?.id) return;

    try {
      const token = await getToken();
      const currentUserId = user.id;

      // Close existing connection if any
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      // ✅ CORRECT: Use /api/sse/ endpoint (not /api/messages/sse/)
      eventSourceRef.current = new EventSource(`/api/sse/${currentUserId}?token=${token}`);

      eventSourceRef.current.onopen = () => {
        console.log('🔗 SSE connection opened for Messages page');
        setNotificationsEnabled(true);
      };

      eventSourceRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📩 SSE message received in Messages:', data);

          if (data.type === 'new_message') {
            // Show notification
            showNotification(data);

            // Show toast notification
            const fromName = data.notification?.from || data.message?.from_user_id?.full_name || 'Someone';
            toast.success(`New message from ${fromName}`, {
              duration: 4000,
              icon: '💬',
              onClick: () => {
                const fromId = data.notification?.fromId || data.message?.from_user_id?._id;
                if (fromId) {
                  navigate(`/messages/${fromId}`);
                }
              }
            });
          } else if (data.type === 'heartbeat') {
            console.log('❤️ SSE heartbeat received in Messages');
          } else if (data.type === 'connected') {
            console.log('✅ SSE connected successfully in Messages');
          }
        } catch (error) {
          console.log('❌ Error parsing SSE data in Messages:', error);
        }
      };

      eventSourceRef.current.onerror = (error) => {
        console.log('❌ SSE error in Messages:', error);
        console.log('🔍 SSE connection state:', eventSourceRef.current?.readyState);
        setNotificationsEnabled(false);
        
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          if (user?.id) {
            console.log('🔄 Attempting SSE reconnection...');
            setupSSE();
          }
        }, 5000);
      };

    } catch (error) {
      console.log('❌ Error setting up SSE in Messages:', error);
      setNotificationsEnabled(false);
    }
  }

  // Toggle notifications
  const toggleNotifications = async () => {
    if (!notificationsEnabled) {
      // Enable notifications
      if ("Notification" in window) {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          setupSSE();
          toast.success('Notifications enabled');
        } else {
          toast.error('Notifications blocked by browser');
        }
      }
    } else {
      // Disable notifications
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setNotificationsEnabled(false);
      toast.success('Notifications disabled');
    }
  }

  // Request notification permission on component mount
  useEffect(() => {
    if ("Notification" in window) {
      if (Notification.permission === "granted") {
        setupSSE();
      }
    }
  }, [user]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return (
    <div className='min-h-screen relative bg-slate-50'>
      <div className='max-w-6xl mx-auto p-6'>
        {/* Title and Header */}
        <div className='mb-8 flex justify-between items-center'>
          <div>
            <h1 className='text-3xl font-bold text-slate-900 mb-2'>Messages</h1>
            <p className='text-slate-600'>Talk to your friends and family</p>
          </div>
          
          {/* Notification Toggle Button */}
          <button
            onClick={toggleNotifications}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
              notificationsEnabled 
                ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200' 
                : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
            }`}
            title={notificationsEnabled ? "Disable notifications" : "Enable notifications"}
          >
            {notificationsEnabled ? (
              <Bell className="w-4 h-4" />
            ) : (
              <BellOff className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">
              {notificationsEnabled ? 'Notifications ON' : 'Notifications OFF'}
            </span>
          </button>
        </div>

        {/* Connection Status */}
        {notificationsEnabled && (
          <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-700 text-sm flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Real-time messaging enabled - You'll receive notifications for new messages
            </p>
          </div>
        )}

        {/* Connected Users */}
        <div className='flex flex-col gap-3'>
          {connections.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No connections yet</h3>
              <p className="text-gray-500">Connect with people to start messaging</p>
            </div>
          ) : (
            connections.map((user) => (
              <div key={user._id} className='max-w-xl flex flex-wrap gap-5 p-6 bg-white shadow rounded-md hover:shadow-md transition-shadow'>
                <img 
                  src={user.profile_picture || '/default-avatar.png'} 
                  alt={user.full_name}
                  className='rounded-full size-12 mx-auto object-cover'
                  onError={(e) => {
                    e.target.src = '/default-avatar.png'
                  }}
                />
                <div className='flex-1'>
                  <p className='font-medium text-slate-700'>{user.full_name}</p>
                  <p className='text-slate-500'>@{user.username}</p>
                  <p className='text-sm text-gray-600 mt-1'>{user.bio}</p>
                </div>

                <div className='flex flex-col gap-2 mt-4'>
                  <button 
                    onClick={() => navigate(`/messages/${user._id}`)} 
                    className='size-10 flex items-center justify-center text-sm rounded bg-blue-100 hover:bg-blue-200 text-blue-800 active:scale-95 transition cursor-pointer gap-1'
                    title="Send Message"
                  >
                    <MessageSquare className="w-4 h-4"/>
                  </button>

                  <button 
                    onClick={() => navigate(`/profile/${user._id}`)} 
                    className='size-10 flex items-center justify-center text-sm rounded bg-slate-100 hover:bg-slate-200 text-slate-800 active:scale-95 transition cursor-pointer'
                    title="View Profile"
                  >
                    <Eye className="w-4 h-4"/>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Help Text */}
        <div className="mt-8 p-4 bg-slate-100 rounded-lg">
          <h4 className="font-medium text-slate-700 mb-2">How messaging works:</h4>
          <ul className="text-sm text-slate-600 space-y-1">
            <li>• Click the message icon to start a conversation</li>
            <li>• Enable notifications to get real-time message alerts</li>
            <li>• You'll see unread message counts in the notifications</li>
            <li>• Click on notifications to jump directly to the chat</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default Messages