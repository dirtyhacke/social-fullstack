import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Eye, MessageSquare, Bell, BellOff, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useAuth, useUser } from '@clerk/clerk-react';
import api from '../api/axios';
import toast from 'react-hot-toast';

const Messages = () => {
  const { connections } = useSelector((state) => state.connections);
  const navigate = useNavigate();
  const { user } = useUser();
  const { getToken } = useAuth();
  const eventSourceRef = useRef(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

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

  // Setup SSE for real-time messages with absolute URL
  const setupSSE = async () => {
    if (!user?.id) {
      console.log('❌ No user ID available for SSE');
      return;
    }

    try {
      const token = await getToken();
      const currentUserId = user.id;

      // Close existing connection if any
      if (eventSourceRef.current) {
        console.log('🔒 Closing existing SSE connection');
        eventSourceRef.current.close();
      }

      // Use absolute URL for production
      const baseUrl = window.location.origin;
      const sseUrl = `${baseUrl}/api/sse/${currentUserId}?token=${token}`;
      
      console.log('🔗 Attempting SSE connection to:', sseUrl);
      
      eventSourceRef.current = new EventSource(sseUrl);

      eventSourceRef.current.onopen = () => {
        console.log('✅ SSE connection opened successfully for Messages page');
        setNotificationsEnabled(true);
        toast.success('Real-time messaging connected');
      };

      eventSourceRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📩 SSE message received in Messages:', data);

          if (data.type === 'new_message') {
            showNotification(data);

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
        console.log('❌ SSE readyState:', eventSourceRef.current?.readyState);
        setNotificationsEnabled(false);
        
        // Show error toast
        toast.error('Connection lost - reconnecting...');
        
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
      toast.error('Failed to connect to real-time messaging');
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

  // Request notification permission and setup SSE on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "granted") {
      setupSSE();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Add connection status monitoring
  useEffect(() => {
    const checkConnection = () => {
      if (eventSourceRef.current) {
        const isConnected = eventSourceRef.current.readyState === EventSource.OPEN;
        console.log('🔍 SSE Connection status:', isConnected ? 'Connected' : 'Disconnected');
        
        if (!isConnected && notificationsEnabled) {
          console.log('🔄 Connection lost, attempting reconnect...');
          setupSSE();
        }
      }
    };

    const interval = setInterval(checkConnection, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, [notificationsEnabled]);

  return (
    <div className='min-h-screen relative bg-slate-50'>
      <div className='max-w-6xl mx-auto p-4 sm:p-6'>
        {/* Title and Header */}
        <div className='mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center'>
          <div>
            <h1 className='text-4xl font-extrabold text-slate-900 mb-2'>Chat <span className='text-blue-600'>Connections</span></h1>
            <p className='text-slate-600'>Start conversations with the people you follow or connect with.</p>
          </div>
          
          {/* Notification Toggle Button */}
          <button
            onClick={toggleNotifications}
            className={`mt-4 sm:mt-0 flex items-center gap-2 px-4 py-2 rounded-full border transition-all shadow-md text-sm font-semibold ${
              notificationsEnabled 
                ? 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100' 
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
            }`}
            title={notificationsEnabled ? "Disable message notifications" : "Enable real-time message notifications"}
          >
            {notificationsEnabled ? (
              <Bell className="w-4 h-4 text-green-500" />
            ) : (
              <BellOff className="w-4 h-4 text-gray-500" />
            )}
            <span className="hidden sm:inline">
              {notificationsEnabled ? 'Notifications ON' : 'Notifications OFF'}
            </span>
            <span className="inline sm:hidden">{notificationsEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {/* Connection Status */}
        {notificationsEnabled && (
          <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-lg shadow-sm">
            <p className="text-blue-800 text-sm flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              **Live Connection Active** - You are ready for real-time messaging.
            </p>
          </div>
        )}

        {/* Connected Users List */}
        <div className='mb-8'>
          <h2 className='text-xl font-semibold text-slate-700 mb-4'>Your Connections ({connections.length})</h2>
          
          {connections.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl shadow-lg border border-gray-100">
              <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">It's quiet here...</h3>
              <p className="text-gray-500 max-w-sm mx-auto">Connect with people on the main feed to start messaging them instantly!</p>
            </div>
          ) : (
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              {connections.map((user) => (
                <div 
                  key={user._id} 
                  onClick={() => navigate(`/messages/${user._id}`)} 
                  className='flex items-center p-4 bg-white shadow-lg rounded-xl transition-all duration-200 border border-gray-100 hover:shadow-xl hover:border-blue-300 cursor-pointer group'
                >
                  {/* User Avatar */}
                  <img 
                    src={user.profile_picture || '/default-avatar.png'} 
                    alt={user.full_name}
                    className='rounded-full size-14 sm:size-16 object-cover flex-shrink-0 border-2 border-white shadow-md'
                    onError={(e) => {
                      e.target.src = '/default-avatar.png'
                    }}
                  />
                  
                  {/* User Info */}
                  <div className='flex-1 ml-4 overflow-hidden'>
                    <div className='flex items-center justify-between'>
                      <p className='font-bold text-lg text-slate-800 truncate'>{user.full_name}</p>
                    </div>
                    <p className='text-blue-500 text-sm font-medium'>@{user.username}</p>
                    <p className='text-sm text-gray-600 mt-1 truncate'>{user.bio || 'No bio available'}</p>
                  </div>

                  {/* Action Buttons */}
                  <div className='ml-4 flex flex-col gap-2 items-end flex-shrink-0'>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/profile/${user._id}`);
                      }} 
                      className='size-8 flex items-center justify-center text-sm rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer'
                      title="View Profile"
                    >
                      <Eye className="w-4 h-4"/>
                    </button>
                    <ArrowRight className="w-5 h-5 text-blue-500 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="mt-8 p-6 bg-white border-t-4 border-blue-500 rounded-lg shadow-md">
          <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-2"><MessageSquare className='w-5 h-5 text-blue-500'/> Chat Guide</h4>
          <ul className="text-sm text-slate-600 space-y-2">
            <li>• Click on any **Connection Card** to jump directly into the chat.</li>
            <li>• Toggle **Notifications ON** to receive system alerts for new messages.</li>
            <li>• Live updates rely on an **SSE (Server-Sent Events) connection**, indicated by the "Live Connection Active" banner.</li>
            <li>• Connection issues? Make sure your backend server supports SSE and CORS.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Messages;