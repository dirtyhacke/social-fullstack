import React, { useState, useEffect } from 'react';
import { Users, UserPlus, UserCheck, UserRoundPen, MessageSquare, CornerUpRight, AlertCircle, Clock, UserMinus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { useAuth } from '@clerk/clerk-react';
import { fetchConnections } from '../features/connections/connectionsSlice';
import api from '../api/axios';
import toast from 'react-hot-toast';

const Connections = () => {
  const [currentTab, setCurrentTab] = useState('Followers');
  const [followRequests, setFollowRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const dispatch = useDispatch();

  // Assuming connections state is loaded with user objects
  const { connections, pendingConnections, followers, following } = useSelector((state) => state.connections);

  const dataArray = [
    { label: 'Followers', value: followers, icon: Users, color: 'text-indigo-600', hoverBg: 'hover:bg-indigo-50' },
    { label: 'Following', value: following, icon: UserCheck, color: 'text-green-600', hoverBg: 'hover:bg-green-50' },
    { label: 'Pending', value: pendingConnections, icon: UserRoundPen, color: 'text-yellow-600', hoverBg: 'hover:bg-yellow-50' },
    { label: 'Connections', value: connections, icon: UserPlus, color: 'text-purple-600', hoverBg: 'hover:bg-purple-50' },
    { label: 'Follow Requests', value: followRequests, icon: Clock, color: 'text-orange-600', hoverBg: 'hover:bg-orange-50' },
  ];

  // Fetch follow requests
  const fetchFollowRequests = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const { data } = await api.get('/api/user/follow-requests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.success) {
        setFollowRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Error fetching follow requests:', error);
      toast.error('Failed to load follow requests');
    } finally {
      setLoading(false);
    }
  };

  // --- API Handlers ---

  const handleUnfollow = async (userId) => {
    try {
      const token = await getToken();
      const { data } = await api.post('/api/user/unfollow', { id: userId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.success) {
        toast.success(data.message);
        dispatch(fetchConnections(token));
      } else {
        toast(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const acceptConnection = async (userId) => {
    try {
      const token = await getToken();
      const { data } = await api.post('/api/user/accept', { id: userId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.success) {
        toast.success(data.message);
        dispatch(fetchConnections(token));
      } else {
        toast(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const acceptFollowRequest = async (requestId) => {
    try {
      const token = await getToken();
      const { data } = await api.post('/api/user/accept-follow-request', { requestId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.success) {
        toast.success(data.message);
        // Refresh both follow requests and connections
        await fetchFollowRequests();
        dispatch(fetchConnections(token));
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const rejectFollowRequest = async (requestId) => {
    try {
      const token = await getToken();
      const { data } = await api.post('/api/user/reject-follow-request', { requestId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.success) {
        toast.success(data.message);
        // Refresh follow requests
        await fetchFollowRequests();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      const token = await getToken();
      dispatch(fetchConnections(token));
      await fetchFollowRequests();
    };
    loadData();
  }, [dispatch, getToken]);

  // --- Utility Functions ---

  const currentListData = dataArray.find((item) => item.label === currentTab)?.value || [];
  const currentTabColor = dataArray.find((item) => item.label === currentTab)?.color || 'text-slate-900';

  const getEmptyMessage = (tab) => {
    switch (tab) {
      case 'Followers': return "You don't have any followers yet.";
      case 'Following': return "You are not following anyone.";
      case 'Pending': return "No pending connection requests.";
      case 'Connections': return "No established connections yet.";
      case 'Follow Requests': return "No pending follow requests.";
      default: return "No data available.";
    }
  };

  // Format date for follow requests
  const formatRequestDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  // --- Component Render ---

  return (
    <div className='min-h-screen bg-gray-50'>
      <div className='max-w-6xl mx-auto p-4 sm:p-6 lg:p-8'>
        
        {/* Header and Title */}
        <div className='mb-10'>
          <h1 className='text-4xl font-extrabold text-slate-900 mb-2'>Your Network</h1>
          <p className='text-slate-600'>Manage your connections, followers, and pending requests efficiently.</p>
        </div>

        {/* Counts - Grid Layout */}
        <div className='mb-10 grid grid-cols-2 md:grid-cols-5 gap-4 sm:gap-6'>
          {dataArray.map((item, index) => (
            <div 
              key={index} 
              className={`flex items-center justify-between p-5 bg-white border border-gray-200 rounded-xl shadow-lg transition-all duration-300 ${item.hoverBg}`}
            >
              <div className='space-y-1'>
                <p className='text-lg text-slate-600'>{item.label}</p>
                <b className={`text-4xl font-extrabold ${item.color}`}>{item.value.length}</b>
              </div>
              <item.icon className={`w-8 h-8 ${item.color} opacity-70`} />
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className='mb-8 border-b border-gray-200'>
          <div className='flex flex-wrap gap-2 sm:gap-4'>
            {dataArray.map((tab) => (
              <button 
                onClick={() => setCurrentTab(tab.label)} 
                key={tab.label} 
                className={`
                  cursor-pointer flex items-center px-4 py-2 text-base font-semibold transition-all duration-200
                  rounded-t-lg
                  ${currentTab === tab.label 
                    ? `border-b-4 ${currentTabColor} border-current text-slate-900` 
                    : 'text-gray-500 hover:text-slate-800'
                  }
                `}
              >
                <tab.icon className='w-5 h-5 mr-2' />
                <span>{tab.label}</span>
                <span className={`ml-2 text-xs font-bold ${currentTab === tab.label ? 'bg-gray-200 text-slate-800' : 'bg-gray-100 text-gray-500'} px-2 py-0.5 rounded-full`}>
                    {tab.value.length}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Connections List */}
        <div className='mt-8'>
          <h2 className={`text-2xl font-bold mb-6 flex items-center gap-2 ${currentTabColor}`}>
             <CornerUpRight className='w-6 h-6 rotate-90'/> 
             {currentTab} List
          </h2>

          {loading ? (
            <div className='flex justify-center items-center p-8'>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          ) : currentListData.length === 0 ? (
            <div className='p-8 bg-white border border-gray-200 rounded-xl shadow-inner text-center'>
                <AlertCircle className='w-8 h-8 text-gray-400 mx-auto mb-3'/>
                <p className='text-lg font-medium text-gray-700'>{getEmptyMessage(currentTab)}</p>
                <p className='text-sm text-gray-500 mt-1'>Check the other tabs or explore the platform to find people.</p>
            </div>
          ) : (
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
              {currentListData.map((item) => (
                <div key={item._id || item.fromUserId?._id} className='flex flex-col p-6 bg-white border border-gray-100 rounded-xl shadow-lg transition-all duration-300 hover:shadow-xl hover:border-indigo-100'>
                  
                  {/* User Info Header */}
                  <div className='flex items-center gap-4 mb-4'>
                    <img 
                      src={item.profile_picture || item.fromUserId?.profile_picture || 'default-avatar.png'} 
                      alt={item.full_name || item.fromUserId?.full_name} 
                      className="rounded-full w-14 h-14 object-cover shadow-md flex-shrink-0"
                    />
                    <div className='truncate'>
                      <p className="text-lg font-bold text-slate-800 truncate">
                        {item.full_name || item.fromUserId?.full_name}
                      </p>
                      <p className="text-sm text-indigo-600">
                        @{item.username || item.fromUserId?.username}
                      </p>
                      {/* Request date for follow requests */}
                      {currentTab === 'Follow Requests' && item.createdAt && (
                        <p className="text-xs text-gray-500 mt-1">
                          Requested {formatRequestDate(item.createdAt)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Bio */}
                  <p className="text-sm text-gray-600 mb-4 flex-1">
                    {item.bio || item.fromUserId?.bio 
                      ? `${(item.bio || item.fromUserId?.bio).slice(0, 70)}${(item.bio || item.fromUserId?.bio).length > 70 ? '...' : ''}` 
                      : 'No bio provided.'
                    }
                  </p>
                  
                  {/* Actions */}
                  <div className='flex flex-col sm:flex-row gap-3 mt-4 border-t pt-4'>
                    <button 
                      onClick={() => navigate(`/profile/${item._id || item.fromUserId?._id}`)} 
                      className='w-full p-2 text-sm rounded-lg bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 transition text-white font-medium shadow-md'
                    >
                      View Profile
                    </button>
                    
                    {currentTab === 'Following' && (
                      <button 
                        onClick={() => handleUnfollow(item._id)} 
                        className='w-full p-2 text-sm rounded-lg border border-red-300 text-red-600 hover:bg-red-50 active:bg-red-100 transition flex items-center justify-center gap-1'
                      >
                        <UserMinus className='w-4 h-4' />
                        Unfollow
                      </button>
                    )}
                    
                    {currentTab === 'Pending' && (
                      <button 
                        onClick={() => acceptConnection(item._id)} 
                        className='w-full p-2 text-sm rounded-lg bg-green-500 text-white hover:bg-green-600 active:bg-green-700 transition font-medium'
                      >
                        Accept Request
                      </button>
                    )}
                    
                    {currentTab === 'Connections' && (
                      <button 
                        onClick={() => navigate(`/messages/${item._id}`)} 
                        className='w-full p-2 text-sm rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300 transition flex items-center justify-center gap-1 font-medium'
                      >
                        <MessageSquare className='w-4 h-4'/>
                        Message
                      </button>
                    )}
                    
                    {currentTab === 'Follow Requests' && (
                      <div className='flex gap-2 w-full'>
                        <button 
                          onClick={() => acceptFollowRequest(item._id)} 
                          className='flex-1 p-2 text-sm rounded-lg bg-green-500 text-white hover:bg-green-600 active:bg-green-700 transition font-medium'
                        >
                          Accept
                        </button>
                        <button 
                          onClick={() => rejectFollowRequest(item._id)} 
                          className='flex-1 p-2 text-sm rounded-lg border border-red-300 text-red-600 hover:bg-red-50 active:bg-red-100 transition'
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Connections;