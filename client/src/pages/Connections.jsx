import React, { useState, useEffect } from 'react';
import { Users, UserPlus, UserCheck, UserRoundPen, MessageSquare, CornerUpRight, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { useAuth } from '@clerk/clerk-react';
import { fetchConnections } from '../features/connections/connectionsSlice';
import api from '../api/axios';
import toast from 'react-hot-toast';

const Connections = () => {
  const [currentTab, setCurrentTab] = useState('Followers');
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
  ];

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

  useEffect(() => {
    getToken().then((token) => {
      dispatch(fetchConnections(token));
    });
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
      default: return "No data available.";
    }
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
        <div className='mb-10 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6'>
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

          {currentListData.length === 0 ? (
            <div className='p-8 bg-white border border-gray-200 rounded-xl shadow-inner text-center'>
                <AlertCircle className='w-8 h-8 text-gray-400 mx-auto mb-3'/>
                <p className='text-lg font-medium text-gray-700'>{getEmptyMessage(currentTab)}</p>
                <p className='text-sm text-gray-500 mt-1'>Check the other tabs or explore the platform to find people.</p>
            </div>
          ) : (
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
              {currentListData.map((user) => (
                <div key={user._id} className='flex flex-col p-6 bg-white border border-gray-100 rounded-xl shadow-lg transition-all duration-300 hover:shadow-xl hover:border-indigo-100'>
                  
                  {/* User Info Header */}
                  <div className='flex items-center gap-4 mb-4'>
                    <img 
                      src={user.profile_picture || 'default-avatar.png'} 
                      alt={user.full_name} 
                      className="rounded-full w-14 h-14 object-cover shadow-md flex-shrink-0"
                    />
                    <div className='truncate'>
                      <p className="text-lg font-bold text-slate-800 truncate">{user.full_name}</p>
                      <p className="text-sm text-indigo-600">@{user.username}</p>
                    </div>
                  </div>

                  {/* Bio */}
                  <p className="text-sm text-gray-600 mb-4 flex-1">
                    {user.bio ? `${user.bio.slice(0, 70)}${user.bio.length > 70 ? '...' : ''}` : 'No bio provided.'}
                  </p>
                  
                  {/* Actions */}
                  <div className='flex flex-col sm:flex-row gap-3 mt-4 border-t pt-4'>
                    <button 
                      onClick={() => navigate(`/profile/${user._id}`)} 
                      className='w-full p-2 text-sm rounded-lg bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 transition text-white font-medium shadow-md'
                    >
                      View Profile
                    </button>
                    
                    {currentTab === 'Following' && (
                      <button 
                        onClick={() => handleUnfollow(user._id)} 
                        className='w-full p-2 text-sm rounded-lg border border-red-300 text-red-600 hover:bg-red-50 active:bg-red-100 transition'
                      >
                        Unfollow
                      </button>
                    )}
                    
                    {currentTab === 'Pending' && (
                      <button 
                        onClick={() => acceptConnection(user._id)} 
                        className='w-full p-2 text-sm rounded-lg bg-green-500 text-white hover:bg-green-600 active:bg-green-700 transition font-medium'
                      >
                        Accept Request
                      </button>
                    )}
                    
                    {currentTab === 'Connections' && (
                      <button 
                        onClick={() => navigate(`/messages/${user._id}`)} 
                        className='w-full p-2 text-sm rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300 transition flex items-center justify-center gap-1 font-medium'
                      >
                        <MessageSquare className='w-4 h-4'/>
                        Message
                      </button>
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