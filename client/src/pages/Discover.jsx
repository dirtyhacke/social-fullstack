import React, { useEffect, useState } from 'react';
import { Search, Users, AlertCircle, UserPlus } from 'lucide-react'; 
import UserCard from '../components/UserCard'; 
import Loading from '../components/Loading'; 
import api from '../api/axios';
import { useAuth } from '@clerk/clerk-react';
import toast from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux'; // Added useSelector
import { fetchUser } from '../features/user/userSlice';

// --- Skeleton Card Component for Loading State ---
const UserCardSkeleton = () => (
  <div className="bg-white border border-gray-100 rounded-xl shadow-md p-4 sm:p-6 animate-pulse">
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-200 rounded-full"></div>
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-3 bg-gray-100 rounded w-1/2"></div>
      </div>
    </div>
    <div className="h-3 bg-gray-100 rounded mt-4"></div>
    <div className="h-8 bg-indigo-200 rounded-lg mt-4 w-full"></div>
  </div>
);
// ----------------------------------------------------

const Discover = () => {
  const dispatch = useDispatch();
  const currentUser = useSelector(state => state.user.value); // Get current user info for status check
  const [input, setInput] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchExecuted, setSearchExecuted] = useState(false);
  const { getToken } = useAuth();

  // Function to fetch users (used for both initial load and search)
  const fetchUsers = async (searchInput = '') => {
    try {
      setLoading(true);
      const { data } = await api.post('/api/user/discover', { input: searchInput }, {
        headers: { Authorization: `Bearer ${await getToken()}` }
      });
      data.success ? setUsers(data.users) : toast.error(data.message);
    } catch (error) {
      toast.error("Failed to fetch users: " + error.message);
    } finally {
      setLoading(false);
      setSearchExecuted(true);
    }
  };

  const handleSearch = async (e) => {
    if (e.key === 'Enter') {
      if (input.trim()) {
        await fetchUsers(input.trim());
      } else {
        await fetchUsers('');
      }
    }
  };
  
  // --- New Logic: Send Connection Request ---
  const handleConnect = async (userId) => {
    try {
      const token = await getToken();
      // Optimistically update UI
      setUsers(prevUsers => prevUsers.filter(user => user._id !== userId));
      
      const { data } = await api.post('/api/user/connect', { id: userId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (data.success) {
        toast.success(data.message || "Connection request sent!");
        // Refresh current user data to update the following list in Redux
        dispatch(fetchUser(token)); 
        
        // Refetch the Discover list to remove the user or update their status
        // If the search input is empty, refetch all users. Otherwise, refetch the search results.
        await fetchUsers(input.trim()); 
      } else {
        toast.error(data.message || "Failed to send connection request.");
        // Revert optimistic update if request fails
        await fetchUsers(input.trim()); 
      }
    } catch (error) {
      toast.error("Error sending connection request.");
      await fetchUsers(input.trim()); // Revert
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      const token = await getToken();
      // Ensure current user data is loaded for connection status checks
      dispatch(fetchUser(token)); 
      await fetchUsers(''); 
    };
    
    initializeData();
  }, [dispatch, getToken]);

  return (
    <div className='min-h-screen bg-gray-50'> 
      <div className='max-w-6xl mx-auto p-4 sm:p-6 lg:p-8'> 
        
        {/* Title & Header */}
        <div className='mb-8 sm:mb-10 text-center'>
          <h1 className='text-3xl sm:text-4xl font-extrabold text-slate-900 mb-2 flex items-center justify-center gap-2'>
            <Users className='w-7 h-7 sm:w-8 sm:h-8 text-indigo-600'/>
            Discover People
          </h1>
          <p className='text-base sm:text-lg text-slate-600'>Connect with amazing people and grow your network.</p>
        </div>

        {/* Search - Mobile adjustments on padding/size */}
        <div className='mb-10 sm:mb-12'>
          <div className='relative max-w-3xl mx-auto'>
            <Search className='absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5' />
            <input 
              type="text" 
              placeholder='Search by name, username, or interests (Press Enter)' 
              className='pl-12 pr-4 py-3 sm:py-4 w-full text-sm sm:text-base border border-gray-300 rounded-xl shadow-lg focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all duration-300' 
              onChange={(e)=>setInput(e.target.value)}
              value={input} 
              onKeyUp={handleSearch}
            />
          </div>
        </div>

        {/* Users Grid */}
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6'>
          {loading ? (
            // Show 6 skeleton cards while loading
            Array(6).fill(0).map((_, i) => <UserCardSkeleton key={i} />)
          ) : users.length > 0 ? (
            // Show actual UserCards
            users.map((user) => (
              <UserCard 
                user={user} 
                key={user._id}
                // Pass the connection handler down to the UserCard
                onConnect={handleConnect} 
                currentUserId={currentUser?._id}
              />
            ))
          ) : (
            // Empty State - optimized for mobile
            <div className="col-span-1 sm:col-span-2 lg:col-span-3 text-center py-12 sm:py-16 bg-white border border-gray-200 rounded-xl shadow-inner mx-4 sm:mx-0">
                <AlertCircle className='w-8 h-8 sm:w-10 sm:h-10 text-gray-400 mx-auto mb-3'/>
                <p className="text-lg sm:text-xl font-semibold text-slate-700">No users found</p>
                <p className='text-sm sm:text-md text-gray-500 mt-1'>
                    {searchExecuted ? "Try a different search term, or check your spelling." : "No users are available to discover at this moment."}
                </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Discover;