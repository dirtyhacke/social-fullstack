import React, { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import moment from 'moment'
import { useAuth, useUser } from '@clerk/clerk-react'
import api from '../api/axios'
import toast from 'react-hot-toast'

const RecentMessages = () => {
    const [conversations, setConversations] = useState([])
    const { user } = useUser()
    const { getToken } = useAuth()
    const eventSourceRef = useRef(null)

    // Function to show system notification
    const showNotification = (data) => {
        try {
            const notification = data?.notification;
            const message = data?.message;
            
            const title = notification?.title || 'New Message';
            const fromName = notification?.from || message?.from_user_id?.full_name || 'Someone';
            const body = notification?.body || message?.text || '📷 Image';
            const avatar = notification?.avatar || message?.from_user_id?.profile_picture || '/default-avatar.png';

            if ("Notification" in window && Notification.permission === "granted") {
                const notif = new Notification(title, {
                    body: `${fromName}: ${body}`,
                    icon: avatar,
                    badge: '/favicon.ico',
                    tag: 'chat-message'
                });

                notif.onclick = () => {
                    window.focus();
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

            // ✅ FIXED: Use correct backend URL (port 4000)
            const backendUrl = 'https://social-server-nine.vercel.app';
            eventSourceRef.current = new EventSource(
                `${backendUrl}/api/sse/${currentUserId}?token=${token}`
            );

            eventSourceRef.current.onopen = () => {
                console.log('🔗 SSE connection opened for RecentMessages');
            };

            eventSourceRef.current.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('📩 SSE message received in RecentMessages:', data);

                    if (data.type === 'new_message') {
                        // Update recent messages list
                        fetchRecentMessages();
                        
                        // Show notification
                        showNotification(data);

                        // Show toast notification
                        const fromName = data.notification?.from || data.message?.from_user_id?.full_name || 'Someone';
                        toast.success(`New message from ${fromName}`, {
                            duration: 4000,
                            icon: '💬'
                        });
                    } else if (data.type === 'heartbeat') {
                        console.log('❤️ SSE heartbeat received in RecentMessages');
                    } else if (data.type === 'connected') {
                        console.log('✅ SSE connected successfully in RecentMessages');
                    }
                } catch (error) {
                    console.log('❌ Error parsing SSE data in RecentMessages:', error);
                }
            };

            eventSourceRef.current.onerror = (error) => {
                console.log('❌ SSE error in RecentMessages:', error);
                console.log('🔧 EventSource readyState:', eventSourceRef.current?.readyState);
                
                // Attempt to reconnect after 5 seconds
                setTimeout(() => {
                    if (user?.id) {
                        console.log('🔄 Attempting to reconnect SSE...');
                        setupSSE();
                    }
                }, 5000);
            };

        } catch (error) {
            console.log('❌ Error setting up SSE in RecentMessages:', error);
        }
    }

    const fetchRecentMessages = async () => {
        try {
            const token = await getToken()
            const { data } = await api.get('/api/messages/recent', {
                headers: { Authorization: `Bearer ${token}` }
            })
            
            if(data?.success){
                const conversationsData = data.conversations || [];
                setConversations(conversationsData);
            } else {
                setConversations([]);
            }
        } catch (error) {
            console.log('❌ Error fetching recent messages:', error);
            setConversations([]);
        }
    }

    useEffect(() => {
        if(user?.id){
            fetchRecentMessages();
            setupSSE();
            
            const interval = setInterval(fetchRecentMessages, 30000);
            return () => {
                clearInterval(interval);
                if (eventSourceRef.current) {
                    eventSourceRef.current.close();
                    console.log('🧹 SSE connection cleaned up');
                }
            };
        }
    }, [user])

    // Request notification permission on component mount
    useEffect(() => {
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission().then(permission => {
                console.log('Notification permission:', permission);
            });
        }
    }, []);

    return (
        <div className='bg-white max-w-xs mt-4 p-4 min-h-20 rounded-md shadow text-xs text-slate-800'>
            <h3 className='font-semibold text-slate-800 mb-4'>Recent Messages</h3>
            <div className='flex flex-col max-h-56 overflow-y-scroll no-scrollbar'>
                {!conversations || conversations.length === 0 ? (
                    <p className='text-gray-500 text-center py-4'>No recent conversations</p>
                ) : (
                    conversations.map((conversation, index) => {
                        const userData = conversation?.user;
                        const lastMessage = conversation?.lastMessage;
                        const unreadCount = conversation?.unreadCount || 0;

                        if (!userData) return null;

                        const uniqueKey = `${userData._id}_${lastMessage?._id}_${index}`;
                        
                        return (
                            <Link 
                                to={`/messages/${userData._id}`} 
                                key={uniqueKey}
                                className='flex items-start gap-2 py-2 hover:bg-slate-100 rounded px-2'
                            >
                                <img 
                                    src={userData.profile_picture || '/default-avatar.png'} 
                                    alt={userData.full_name}
                                    className='w-8 h-8 rounded-full object-cover'
                                    onError={(e) => {
                                        e.target.src = '/default-avatar.png'
                                    }}
                                />
                                <div className='w-full'>
                                    <div className='flex justify-between'>
                                        <p className='font-medium'>{userData.full_name}</p>
                                        <p className='text-[10px] text-slate-400'>
                                            {moment(lastMessage?.createdAt || lastMessage?.created_at).fromNow()}
                                        </p>
                                    </div>
                                    <div className='flex justify-between'>
                                        <p className='text-gray-500 truncate max-w-[120px]'>
                                            {lastMessage?.text 
                                                ? (lastMessage.text.length > 25 
                                                    ? lastMessage.text.substring(0, 25) + '...' 
                                                    : lastMessage.text)
                                                : '📷 Media'
                                            }
                                        </p>
                                        {unreadCount > 0 && (
                                            <p className='bg-indigo-500 text-white w-4 h-4 flex items-center justify-center rounded-full text-[10px]'>
                                                {unreadCount}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        );
                    })
                )}
            </div>
        </div>
    )
}

export default RecentMessages