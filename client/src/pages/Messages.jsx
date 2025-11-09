import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Eye, MessageSquare, Bell, BellOff, ArrowRight, Wifi, WifiOff, Circle, Clock } from 'lucide-react';
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
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [connectionsWithStatus, setConnectionsWithStatus] = useState([]);

  // Format last seen time
  const formatLastSeen = (lastSeenDate) => {
    if (!lastSeenDate) return 'Never';
    
    const now = new Date();
    const lastSeen = new Date(lastSeenDate);
    const diffInMinutes = Math.floor((now - lastSeen) / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return lastSeen.toLocaleDateString();
  };

  // Fetch multiple users' last seen status
  const fetchUsersLastSeen = async (userIds) => {
    try {
      const token = await getToken();
      const response = await api.post('/api/messages/last-seen/batch', 
        { userIds },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching users last seen:', error);
      return null;
    }
  };

  // Update connections with last seen data
  const updateConnectionsWithStatus = async () => {
    if (connections.length > 0) {
      const userIds = connections.map(conn => conn._id);
      const lastSeenData = await fetchUsersLastSeen(userIds);
      
      if (lastSeenData?.success) {
        const updatedConnections = connections.map(conn => ({
          ...conn,
          lastSeen: lastSeenData.lastSeenData[conn._id]?.lastSeen,
          isOnline: lastSeenData.lastSeenData[conn._id]?.isOnline || onlineUsers.has(conn._id)
        }));
        setConnectionsWithStatus(updatedConnections);
      } else {
        // Fallback to basic online status
        const updatedConnections = connections.map(conn => ({
          ...conn,
          isOnline: onlineUsers.has(conn._id)
        }));
        setConnectionsWithStatus(updatedConnections);
      }
    }
  };

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

  // Setup SSE for real-time messages and online status
  const setupSSE = async () => {
    if (!user?.id) return;

    try {
      const token = await getToken();
      const currentUserId = user.id;

      // Close existing connection if any
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      // Use the correct endpoint
      eventSourceRef.current = new EventSource(`https://social-server-nine.vercel.app/api/messages/sse/${currentUserId}?token=${token}`);

      eventSourceRef.current.onopen = () => {
        console.log('🔗 SSE connection opened for Messages page');
        setNotificationsEnabled(true);
        toast.success('Real-time connection established');
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
            // Initialize online users from server
            if (data.onlineUsers) {
              setOnlineUsers(new Set(data.onlineUsers));
              updateConnectionsWithStatus();
            }
          } else if (data.type === 'user_online') {
            // Update online status when user comes online
            setOnlineUsers(prev => new Set(prev).add(data.userId));
            console.log(`🟢 User ${data.userId} is online`);
            
            // Update connections with new status
            updateConnectionsWithStatus();
            
            // Show toast for connections coming online
            const connection = connections.find(conn => conn._id === data.userId);
            if (connection) {
              toast.success(`${connection.full_name} is now online`, {
                duration: 3000,
                icon: '🟢'
              });
            }
          } else if (data.type === 'user_offline') {
            // Update online status when user goes offline
            setOnlineUsers(prev => {
              const newSet = new Set(prev);
              newSet.delete(data.userId);
              return newSet;
            });
            console.log(`🔴 User ${data.userId} is offline`);
            
            // Update connections with new status
            updateConnectionsWithStatus();
            
            // Show toast for connections going offline
            const connection = connections.find(conn => conn._id === data.userId);
            if (connection) {
              toast.error(`${connection.full_name} went offline`, {
                duration: 3000,
                icon: '🔴'
              });
            }
          } else if (data.type === 'message_delivered') {
            console.log('✅ Message delivered:', data.messageId);
            toast.success('Message delivered', { duration: 2000 });
          }
        } catch (error) {
          console.log('❌ Error parsing SSE data in Messages:', error);
        }
      };

      eventSourceRef.current.onerror = (error) => {
        console.log('❌ SSE error in Messages:', error);
        setNotificationsEnabled(false);
        
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
      setOnlineUsers(new Set()); // Clear online status when disconnecting
      setConnectionsWithStatus([]); // Clear connections status
      setNotificationsEnabled(false);
      toast.success('Notifications disabled');
    }
  }

  // Check if a user is online
  const isUserOnline = (userId) => {
    return onlineUsers.has(userId);
  };

  // Get online connections count
  const getOnlineConnectionsCount = () => {
    if (connectionsWithStatus.length > 0) {
      return connectionsWithStatus.filter(conn => conn.isOnline).length;
    }
    return connections.filter(conn => isUserOnline(conn._id)).length;
  };

  // Get offline connections count
  const getOfflineConnectionsCount = () => {
    if (connectionsWithStatus.length > 0) {
      return connectionsWithStatus.filter(conn => !conn.isOnline).length;
    }
    return connections.filter(conn => !isUserOnline(conn._id)).length;
  };

  // Request notification permission and setup SSE on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "granted") {
      setupSSE();
    } else {
      // Still try to setup SSE for online status even if notifications are blocked
      setupSSE();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Update connections status when connections change
  useEffect(() => {
    if (connections.length > 0) {
      updateConnectionsWithStatus();
    }
  }, [connections]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Display connections with status or fallback to basic connections
  const displayConnections = connectionsWithStatus.length > 0 ? connectionsWithStatus : connections;

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
              **Live Connection Active** - {getOnlineConnectionsCount()} of {connections.length} connections online
            </p>
          </div>
        )}

        {/* Online Status Legend */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span>Online</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span>Offline</span>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {getOnlineConnectionsCount()} online • {getOfflineConnectionsCount()} offline
          </div>
        </div>

        {/* Connected Users List */}
        <div className='mb-8'>
          <h2 className='text-xl font-semibold text-slate-700 mb-4'>
            Your Connections ({connections.length})
          </h2>
          
          {connections.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl shadow-lg border border-gray-100">
              <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">It's quiet here...</h3>
              <p className="text-gray-500 max-w-sm mx-auto">Connect with people on the main feed to start messaging them instantly!</p>
            </div>
          ) : (
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              {displayConnections.map((user) => {
                const isOnline = user.isOnline !== undefined ? user.isOnline : isUserOnline(user._id);
                const lastSeen = user.lastSeen;
                
                return (
                  <div 
                    key={user._id} 
                    onClick={() => navigate(`/messages/${user._id}`)} 
                    className='flex items-center p-4 bg-white shadow-lg rounded-xl transition-all duration-200 border border-gray-100 hover:shadow-xl hover:border-blue-300 cursor-pointer group relative'
                  >
                    {/* Online/Offline Status Badge */}
                    <div className="absolute -top-1 -left-1 z-10">
                      <div 
                        className={`w-4 h-4 rounded-full border-2 border-white ${
                          isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                        }`}
                        title={isOnline ? 'Online' : 'Offline'}
                      />
                    </div>
                    
                    {/* User Avatar */}
                    <div className="relative">
                      <img 
                        src={user.profile_picture || '/default-avatar.png'} 
                        alt={user.full_name}
                        className='rounded-full size-14 sm:size-16 object-cover flex-shrink-0 border-2 border-white shadow-md'
                        onError={(e) => {
                          e.target.src = '/default-avatar.png'
                        }}
                      />
                    </div>
                    
                    {/* User Info */}
                    <div className='flex-1 ml-4 overflow-hidden'>
                      <div className='flex items-center justify-between'>
                        <p className='font-bold text-lg text-slate-800 truncate flex items-center gap-2'>
                          {user.full_name}
                          {isOnline ? (
                            <span className="text-xs font-normal text-green-600 bg-green-50 px-2 py-1 rounded-full flex items-center gap-1">
                              <Wifi className="w-3 h-3" />
                              Live
                            </span>
                          ) : (
                            <span className="text-xs font-normal text-gray-500 bg-gray-50 px-2 py-1 rounded-full flex items-center gap-1">
                              <WifiOff className="w-3 h-3" />
                              Offline
                            </span>
                          )}
                        </p>
                      </div>
                      <p className='text-blue-500 text-sm font-medium'>@{user.username}</p>
                      <p className='text-sm text-gray-600 mt-1 truncate'>
                        {isOnline ? (
                          <span className="text-green-600 font-medium flex items-center gap-1">
                            <Circle className="w-2 h-2 fill-green-500" />
                            Online now
                          </span>
                        ) : lastSeen ? (
                          <span className="text-gray-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Last seen {formatLastSeen(lastSeen)}
                          </span>
                        ) : (
                          <span className="text-gray-500">Never seen</span>
                        )}
                      </p>
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
                );
              })}
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="mt-8 p-6 bg-white border-t-4 border-blue-500 rounded-lg shadow-md">
          <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
            <MessageSquare className='w-5 h-5 text-blue-500'/> Chat Guide
          </h4>
          <ul className="text-sm text-slate-600 space-y-2">
            <li className="flex items-start gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse mt-1.5 flex-shrink-0"></span>
              <span><strong>Green dot</strong> indicates user is <strong>online</strong> and can receive messages instantly</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full mt-1.5 flex-shrink-0"></span>
              <span><strong>Red dot</strong> indicates user is <strong>offline</strong> - they'll see messages when they return</span>
            </li>
            <li>• Click on any <strong>Connection Card</strong> to jump directly into the chat</li>
            <li>• Toggle <strong>Notifications ON</strong> to receive system alerts for new messages</li>
            <li>• You'll receive notifications when connections come online/go offline</li>
            <li>• <strong>Last seen</strong> shows when the user was last active</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Messages;