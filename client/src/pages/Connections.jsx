import React, { useState, useEffect } from 'react';
import { Users, UserPlus, UserCheck, UserRoundPen, MessageSquare, AlertCircle, Clock, UserMinus, Search, Filter, ChevronRight } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const dispatch = useDispatch();

  // Assuming connections state is loaded with user objects
  const { connections, pendingConnections, followers, following } = useSelector((state) => state.connections);

  const dataArray = [
    { label: 'Followers', value: followers, icon: Users, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { label: 'Following', value: following, icon: UserCheck, color: 'text-green-600', bgColor: 'bg-green-50' },
    { label: 'Pending', value: pendingConnections, icon: UserRoundPen, color: 'text-amber-600', bgColor: 'bg-amber-50' },
    { label: 'Connections', value: connections, icon: UserPlus, color: 'text-purple-600', bgColor: 'bg-purple-50' },
    { label: 'Requests', value: followRequests, icon: Clock, color: 'text-orange-600', bgColor: 'bg-orange-50' },
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
  const currentTabColor = dataArray.find((item) => item.label === currentTab)?.color || 'text-gray-800';

  // Filter current list data based on search query
  const filteredData = currentListData.filter(item => {
    if (!searchQuery.trim()) return true;
    
    const searchTerm = searchQuery.toLowerCase();
    const fullName = item.full_name || item.fromUserId?.full_name || '';
    const username = item.username || item.fromUserId?.username || '';
    const bio = item.bio || item.fromUserId?.bio || '';
    
    return fullName.toLowerCase().includes(searchTerm) || 
           username.toLowerCase().includes(searchTerm) ||
           bio.toLowerCase().includes(searchTerm);
  });

  const getEmptyMessage = (tab) => {
    switch (tab) {
      case 'Followers': return "You don't have any followers yet";
      case 'Following': return "You are not following anyone";
      case 'Pending': return "No pending connection requests";
      case 'Connections': return "No established connections yet";
      case 'Requests': return "No pending follow requests";
      default: return "No data available";
    }
  };

  // Format date for follow requests
  const formatRequestDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffMinutes = Math.ceil(diffTime / (1000 * 60));
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Get total connections count
  const getTotalConnections = () => {
    return followers.length + following.length + pendingConnections.length + connections.length + followRequests.length;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">Connections</h1>
            <span className="text-sm text-gray-500 font-medium">
              {getTotalConnections()} total
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="pt-20 max-w-6xl mx-auto px-6 pb-8">
        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search connections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            <button className="absolute right-4 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded-lg transition-colors">
              <Filter className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid grid-cols-2 md:grid-cols-5 gap-4">
          {dataArray.map((item, index) => (
            <div 
              key={index} 
              className={`p-4 bg-white border border-gray-200 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-md ${
                currentTab === item.label ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
              }`}
              onClick={() => setCurrentTab(item.label)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-lg font-bold ${item.color}`}>{item.value.length}</span>
                <div className={`p-2 rounded-lg ${item.bgColor}`}>
                  <item.icon className={`w-4 h-4 ${item.color}`} />
                </div>
              </div>
              <p className="text-sm text-gray-600">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {/* Tab Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <span className={currentTabColor}>{currentTab}</span>
                <span className="text-sm text-gray-500 font-normal">
                  ({filteredData.length} {filteredData.length === 1 ? 'person' : 'people'})
                </span>
              </h2>
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Clear search
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {loading ? (
              <div className="flex justify-center items-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-600 font-medium mb-2">
                  {getEmptyMessage(currentTab)}
                </p>
                <p className="text-sm text-gray-500">
                  {searchQuery ? 'Try a different search term' : 'Check back later'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredData.map((item) => (
                  <div key={item._id || item.fromUserId?._id} className="flex items-center p-4 hover:bg-gray-50 rounded-xl transition-colors duration-200 group">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <img 
                        src={item.profile_picture || item.fromUserId?.profile_picture || '/default-avatar.png'} 
                        alt={item.full_name || item.fromUserId?.full_name} 
                        className="w-14 h-14 rounded-xl object-cover border border-gray-200"
                      />
                      {currentTab === 'Requests' && (
                        <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs px-2 py-1 rounded-full">
                          New
                        </div>
                      )}
                    </div>

                    {/* User Info */}
                    <div className="flex-1 ml-4 min-w-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900 truncate">
                            {item.full_name || item.fromUserId?.full_name}
                          </h3>
                          <p className="text-sm text-gray-500 truncate">
                            @{item.username || item.fromUserId?.username}
                          </p>
                        </div>
                        {/* Request date for follow requests */}
                        {currentTab === 'Requests' && item.createdAt && (
                          <span className="text-xs text-gray-400">
                            {formatRequestDate(item.createdAt)}
                          </span>
                        )}
                      </div>
                      
                      {/* Bio */}
                      {(item.bio || item.fromUserId?.bio) && (
                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                          {item.bio || item.fromUserId?.bio}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="ml-4 flex items-center gap-3">
                      <button
                        onClick={() => navigate(`/profile/${item._id || item.fromUserId?._id}`)}
                        className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        View
                      </button>
                      
                      {currentTab === 'Following' && (
                        <button
                          onClick={() => handleUnfollow(item._id)}
                          className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          <UserMinus className="w-4 h-4 inline mr-1" />
                          Unfollow
                        </button>
                      )}
                      
                      {currentTab === 'Pending' && (
                        <button
                          onClick={() => acceptConnection(item._id)}
                          className="px-4 py-2 text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                        >
                          Accept
                        </button>
                      )}
                      
                      {currentTab === 'Connections' && (
                        <button
                          onClick={() => navigate(`/messages/${item._id}`)}
                          className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Message"
                        >
                          <MessageSquare className="w-5 h-5" />
                        </button>
                      )}
                      
                      {currentTab === 'Requests' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => acceptFollowRequest(item._id)}
                            className="px-3 py-1.5 text-sm font-medium text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => rejectFollowRequest(item._id)}
                            className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                          >
                            Decline
                          </button>
                        </div>
                      )}
                      
                      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Connections;