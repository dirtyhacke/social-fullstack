import React, { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import moment from 'moment'
import { useAuth, useUser } from '@clerk/clerk-react'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { MessageSquareText } from 'lucide-react' // Added a new icon for empty state

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
            const backendUrl = 'https://pixo-toj7.onrender.com';
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
            
            // Polling fallback every 30 seconds (even with SSE, this is good for missed updates/disconnections)
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
        <div className='bg-white max-w-xs mt-4 p-4 rounded-xl border border-gray-100 shadow-lg text-sm text-slate-800'> {/* Updated Container Style */}
            <h3 className='font-bold text-slate-900 mb-4 text-lg border-b pb-2'>
                Recent Conversations 💬
            </h3>
            <div className='flex flex-col max-h-72 overflow-y-scroll custom-scrollbar divide-y divide-gray-100 -mx-4 px-4'> {/* Added divide-y */}
                {!conversations || conversations.length === 0 ? (
                    <div className='text-center py-6 text-gray-500'>
                        <MessageSquareText className='w-6 h-6 mx-auto mb-2 text-indigo-400' />
                        <p className='text-xs'>Start a conversation to see it here!</p>
                    </div>
                ) : (
                    conversations.map((conversation, index) => {
                        const userData = conversation?.user;
                        const lastMessage = conversation?.lastMessage;
                        const unreadCount = conversation?.unreadCount || 0;

                        if (!userData) return null;

                        const uniqueKey = `${userData._id}_${lastMessage?._id}_${index}`;
                        const isUnread = unreadCount > 0;
                        
                        // Determine the last message content to display
                        const messageText = lastMessage?.text 
                            ? (lastMessage.text.length > 25 
                                ? lastMessage.text.substring(0, 25) + '...' 
                                : lastMessage.text)
                            : lastMessage?.image_url 
                                ? '🖼️ Image' 
                                : '💬 New Chat'; // Fallback for media

                        return (
                            <Link 
                                to={`/messages/${userData._id}`} 
                                key={uniqueKey}
                                // Highlight the row if there are unread messages
                                className={`flex items-center gap-3 py-3 px-2 -mx-2 transition-all 
                                            ${isUnread ? 'bg-indigo-50/50' : ''} 
                                            hover:bg-indigo-100 rounded-lg`} 
                            >
                                <div className='relative flex-shrink-0'>
                                    <img 
                                        src={userData.profile_picture || '/default-avatar.png'} 
                                        alt={userData.full_name}
                                        className='w-10 h-10 rounded-full object-cover ring-2 ring-gray-200' // Larger avatar
                                        onError={(e) => {
                                            e.target.src = '/default-avatar.png'
                                        }}
                                    />
                                </div>

                                <div className='flex-1 min-w-0'>
                                    <div className='flex justify-between items-center'>
                                        <p className={`text-sm ${isUnread ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                                            {userData.full_name}
                                        </p>
                                        <p className={`text-[11px] ${isUnread ? 'font-bold text-indigo-600' : 'text-slate-400'}`}>
                                            {moment(lastMessage?.createdAt || lastMessage?.created_at).fromNow()}
                                        </p>
                                    </div>
                                    <div className='flex justify-between items-center mt-0.5'>
                                        <p className={`truncate text-xs ${isUnread ? 'text-slate-700 font-medium' : 'text-gray-500'}`}>
                                            {messageText}
                                        </p>
                                        {unreadCount > 0 && (
                                            <p className='bg-indigo-600 text-white w-4 h-4 flex items-center justify-center rounded-full text-[10px] font-bold shadow-md flex-shrink-0 ml-2'>
                                                {unreadCount > 9 ? '9+' : unreadCount}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        );
                    })
                )}
            </div>
            {/* Custom Scrollbar Style */}
            <style jsx="true">{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #e0e7ff; /* light indigo */
                    border-radius: 20px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background-color: #c7d2fe;
                }
            `}</style>
        </div>
    )
}

export default RecentMessages