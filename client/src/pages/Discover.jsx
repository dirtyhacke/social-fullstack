import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Search, Users, AlertCircle, MessageCircle, User, X, Filter, Clock, TrendingUp, Loader2 } from 'lucide-react'; 
import UserCard from '../components/UserCard'; 
import api from '../api/axios';
import { useAuth } from '@clerk/clerk-react';
import toast from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import { fetchUser } from '../features/user/userSlice';
import { Link } from 'react-router-dom';

// --- Skeleton Card Component for Loading State ---
const UserCardSkeleton = () => (
  <div className="bg-white border border-gray-100 rounded-lg p-4 animate-pulse">
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 bg-gray-100 rounded-full"></div>
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-100 rounded w-3/4"></div>
        <div className="h-3 bg-gray-50 rounded w-1/2"></div>
      </div>
    </div>
    <div className="h-3 bg-gray-50 rounded mt-3"></div>
    <div className="h-9 bg-gradient-to-r from-gray-100 to-gray-50 rounded-full mt-3 w-full"></div>
  </div>
);
// ----------------------------------------------------

const Discover = () => {
  const dispatch = useDispatch();
  const currentUser = useSelector(state => state.user.value);
  const [input, setInput] = useState('');
  const [allUsers, setAllUsers] = useState([]); // All users from API
  const [filteredUsers, setFilteredUsers] = useState([]); // Filtered users for display
  const [loading, setLoading] = useState(false);
  const [searchExecuted, setSearchExecuted] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const searchTimeout = useRef(null);
  const { getToken } = useAuth();

  // Load recent searches from localStorage
  useEffect(() => {
    const savedSearches = localStorage.getItem('recentSearches');
    if (savedSearches) {
      setRecentSearches(JSON.parse(savedSearches));
    }
  }, []);

  // Save recent search
  const saveRecentSearch = (term) => {
    if (!term.trim()) return;
    
    const updatedSearches = [
      term,
      ...recentSearches.filter(s => s !== term).slice(0, 4) // Keep only last 5 unique searches
    ];
    
    setRecentSearches(updatedSearches);
    localStorage.setItem('recentSearches', JSON.stringify(updatedSearches));
  };

  // Function to fetch all users from API
  const fetchAllUsers = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.post('/api/user/discover', { input: '' }, {
        headers: { Authorization: `Bearer ${await getToken()}` }
      });
      
      if (data.success) {
        setAllUsers(data.users);
        setFilteredUsers(data.users);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error("Failed to fetch users: " + error.message);
    } finally {
      setLoading(false);
      setSearchExecuted(true);
    }
  }, [getToken]);

  // Real-time client-side filtering
  const performRealTimeFiltering = useCallback((searchTerm) => {
    if (!searchTerm.trim()) {
      setFilteredUsers(allUsers);
      return;
    }

    const searchLower = searchTerm.toLowerCase().trim();
    
    // Filter users based on search term
    const filtered = allUsers.filter(user => {
      // Search in full name
      if (user.full_name?.toLowerCase().includes(searchLower)) return true;
      
      // Search in username
      if (user.username?.toLowerCase().includes(searchLower)) return true;
      
      // Search in bio/description
      if (user.bio?.toLowerCase().includes(searchLower)) return true;
      
      // Search in interests (if available)
      if (user.interests?.some(interest => 
        interest.toLowerCase().includes(searchLower)
      )) return true;
      
      return false;
    });
    
    setFilteredUsers(filtered);
  }, [allUsers]);

  // Handle input change with real-time filtering
  const handleInputChange = useCallback((e) => {
    const value = e.target.value;
    setInput(value);
    
    // Show suggestions when typing
    if (value.trim().length > 0) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
    
    // Debounce the filtering
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    
    searchTimeout.current = setTimeout(() => {
      performRealTimeFiltering(value);
    }, 150); // Small delay for smoother UX
  }, [performRealTimeFiltering]);

  const handleSearch = async (e) => {
    if (e.key === 'Enter' || e.type === 'click') {
      if (input.trim()) {
        saveRecentSearch(input.trim());
        setShowSuggestions(false);
      } else {
        setShowSuggestions(false);
      }
    }
  };

  const clearSearch = () => {
    setInput('');
    setFilteredUsers(allUsers);
    setShowSuggestions(false);
  };

  // Quick search from suggestion
  const handleQuickSearch = (term) => {
    setInput(term);
    performRealTimeFiltering(term);
    saveRecentSearch(term);
    setShowSuggestions(false);
  };

  // Remove recent search
  const removeRecentSearch = (term, e) => {
    e.stopPropagation();
    const updatedSearches = recentSearches.filter(s => s !== term);
    setRecentSearches(updatedSearches);
    localStorage.setItem('recentSearches', JSON.stringify(updatedSearches));
  };

  // Clear all recent searches
  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('recentSearches');
  };
  
  // --- Connection Request Logic ---
  const handleConnect = async (userId) => {
    try {
      const token = await getToken();
      
      // Optimistically update UI
      const updatedAllUsers = allUsers.filter(user => user._id !== userId);
      const updatedFilteredUsers = filteredUsers.filter(user => user._id !== userId);
      
      setAllUsers(updatedAllUsers);
      setFilteredUsers(updatedFilteredUsers);
      
      const { data } = await api.post('/api/user/connect', { id: userId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (data.success) {
        toast.success(data.message || "Connection request sent!");
        dispatch(fetchUser(token));
      } else {
        toast.error(data.message || "Failed to send connection request.");
        // Refresh the list to restore
        await fetchAllUsers();
      }
    } catch (error) {
      toast.error("Error sending connection request.");
      await fetchAllUsers();
    }
  };

  // Initial data load
  useEffect(() => {
    const initializeData = async () => {
      const token = await getToken();
      dispatch(fetchUser(token));
      await fetchAllUsers();
    };
    
    initializeData();
    
    // Cleanup timeout on unmount
    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [dispatch, getToken, fetchAllUsers]);

  // Popular search suggestions
  const popularSuggestions = [
    { term: 'Technology', icon: '💻' },
    { term: 'Design', icon: '🎨' },
    { term: 'Business', icon: '💼' },
    { term: 'Art', icon: '🖼️' },
    { term: 'Music', icon: '🎵' },
    { term: 'Travel', icon: '✈️' },
    { term: 'Fitness', icon: '💪' },
    { term: 'Food', icon: '🍕' }
  ];

  // Real-time search results preview (first 5 matches)
  const realTimePreviewResults = useMemo(() => {
    if (!input.trim() || filteredUsers.length === 0) return [];
    return filteredUsers.slice(0, 5);
  }, [input, filteredUsers]);

  return (
    <>
      {/* Instagram-style Fixed Header */}
      <div className='fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between shadow-sm'>
        <div className='flex items-center gap-3'>
          {/* Title */}
          <h1 className='text-lg font-bold text-gray-900 flex items-center gap-2'>
            <Users className='w-5 h-5 text-gray-700'/>
            Discover
          </h1>
        </div>

        {/* Instagram-style Icons */}
        <div className='flex items-center gap-4'>
          {/* Message Button */}
          <Link 
            to="/messages"
            className='p-2 rounded-full text-gray-700 hover:text-blue-600 hover:bg-gray-50 transition-colors duration-200'
            title="Messages"
          >
            <MessageCircle className='w-5 h-5' />
          </Link>

          {/* My Profile Button */}
          <Link 
            to="/profile"
            className='p-2 rounded-full text-gray-700 hover:text-green-600 hover:bg-gray-50 transition-colors duration-200'
            title="My Profile"
          >
            <User className='w-5 h-5' />
          </Link>
        </div>
      </div>

      {/* Main Content with padding for fixed header */}
      <div className='pt-16 min-h-screen bg-gradient-to-b from-white to-gray-50/30'>
        <div className='max-w-4xl mx-auto p-4 sm:p-6'>
          
          {/* Professional Search Bar with Real-time Results */}
          <div className='mb-10 relative'>
            <div className='relative group'>
              {/* Clean line-style search container */}
              <div className={`relative transition-all duration-300 ${isSearchFocused ? 'border-b-2 border-blue-500' : 'border-b border-gray-200 hover:border-gray-300'}`}>
                <div className='flex items-center'>
                  <Search className={`w-5 h-5 ml-1 transition-colors duration-300 ${isSearchFocused ? 'text-blue-500' : 'text-gray-400'}`} />
                  <input 
                    type="text" 
                    placeholder='Search people by name, username, or interests...' 
                    className='flex-1 pl-3 pr-10 py-4 text-sm bg-transparent focus:outline-none placeholder-gray-400 text-gray-800'
                    value={input} 
                    onChange={handleInputChange}
                    onFocus={() => {
                      setIsSearchFocused(true);
                      if (input.trim().length > 0) {
                        setShowSuggestions(true);
                      }
                    }}
                    onBlur={() => {
                      setIsSearchFocused(false);
                      // Delay hiding suggestions to allow clicks
                      setTimeout(() => setShowSuggestions(false), 200);
                    }}
                    onKeyUp={handleSearch}
                  />
                  {input && (
                    <button 
                      onClick={clearSearch}
                      className='absolute right-2 p-1 rounded-full hover:bg-gray-100 transition-colors duration-200'
                      onMouseDown={(e) => e.preventDefault()} // Prevent blur before click
                    >
                      <X className='w-4 h-4 text-gray-400 hover:text-gray-600' />
                    </button>
                  )}
                </div>
              </div>
              
              {/* Search hint and real-time indicator */}
              <div className='flex items-center justify-between mt-2'>
                <div className='flex items-center gap-2'>
                  {input.trim() && (
                    <div className='flex items-center gap-1 px-2 py-0.5 bg-blue-50 rounded-full'>
                      <div className='w-2 h-2 bg-blue-500 rounded-full animate-pulse'></div>
                      <span className='text-xs text-blue-600 font-medium'>Live Filtering</span>
                    </div>
                  )}
                  <p className='text-xs text-gray-500 ml-6'>
                    {input.trim() 
                      ? `Found ${filteredUsers.length} ${filteredUsers.length === 1 ? 'match' : 'matches'}` 
                      : 'Start typing to filter results in real-time'
                    }
                  </p>
                </div>
                {input.trim() && (
                  <button 
                    onClick={clearSearch}
                    className='flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all duration-300'
                  >
                    <X className='w-3 h-3' />
                    Clear
                  </button>
                )}
              </div>

              {/* Real-time Search Suggestions Dropdown */}
              {showSuggestions && (
                <div className='absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-y-auto'>
                  {/* Recent Searches */}
                  {recentSearches.length > 0 && input.trim().length === 0 && (
                    <div className='p-3 border-b border-gray-100'>
                      <div className='flex items-center justify-between mb-2'>
                        <div className='flex items-center gap-2 text-xs font-medium text-gray-500'>
                          <Clock className='w-3 h-3' />
                          Recent Searches
                        </div>
                        <button 
                          onClick={clearRecentSearches}
                          className='text-xs text-gray-400 hover:text-gray-600'
                        >
                          Clear all
                        </button>
                      </div>
                      <div className='space-y-1'>
                        {recentSearches.map((term, index) => (
                          <div 
                            key={index}
                            className='flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer group'
                            onClick={() => handleQuickSearch(term)}
                          >
                            <div className='flex items-center gap-2'>
                              <Search className='w-3 h-3 text-gray-400' />
                              <span className='text-sm text-gray-700'>{term}</span>
                            </div>
                            <button 
                              onClick={(e) => removeRecentSearch(term, e)}
                              className='opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-opacity'
                            >
                              <X className='w-3 h-3 text-gray-400' />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Popular Suggestions */}
                  {input.trim().length === 0 && (
                    <div className='p-3 border-b border-gray-100'>
                      <div className='flex items-center gap-2 text-xs font-medium text-gray-500 mb-2'>
                        <TrendingUp className='w-3 h-3' />
                        Popular Searches
                      </div>
                      <div className='flex flex-wrap gap-2'>
                        {popularSuggestions.map((item, index) => (
                          <button
                            key={index}
                            onClick={() => handleQuickSearch(item.term)}
                            className='flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors duration-200 border border-gray-200'
                          >
                            <span>{item.icon}</span>
                            {item.term}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Real-time Results Preview */}
                  {input.trim().length > 0 && (
                    <div className='p-3'>
                      <div className='flex items-center justify-between mb-2'>
                        <span className='text-xs font-medium text-gray-500'>
                          {filteredUsers.length === 0 
                            ? 'No matches found'
                            : `${filteredUsers.length} ${filteredUsers.length === 1 ? 'match' : 'matches'} for "${input}"`
                          }
                        </span>
                        <span className='text-xs text-blue-500 font-medium'>
                          Live results
                        </span>
                      </div>
                      
                      {realTimePreviewResults.length > 0 ? (
                        <div className='space-y-2 max-h-48 overflow-y-auto'>
                          {realTimePreviewResults.map((user) => (
                            <div 
                              key={user._id}
                              className='flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer'
                              onClick={() => {
                                // Navigate to user profile or show more details
                                toast.success(`Viewing ${user.full_name}'s profile`);
                                setShowSuggestions(false);
                              }}
                            >
                              <img 
                                src={user.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=random`}
                                alt={user.full_name}
                                className='w-8 h-8 rounded-full object-cover'
                              />
                              <div className='flex-1'>
                                <p className='text-sm font-medium text-gray-800'>{user.full_name}</p>
                                <p className='text-xs text-gray-500'>@{user.username}</p>
                              </div>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleConnect(user._id);
                                }}
                                className='text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 hover:bg-blue-50 rounded'
                              >
                                Connect
                              </button>
                            </div>
                          ))}
                          {filteredUsers.length > 5 && (
                            <div className='text-center pt-2 border-t border-gray-100'>
                              <p className='text-xs text-gray-500'>
                                Showing 5 of {filteredUsers.length} results
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className='py-4 text-center'>
                          <p className='text-sm text-gray-500'>No results found for "{input}"</p>
                          <p className='text-xs text-gray-400 mt-1'>Try different keywords</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Results Section Header */}
          <div className='mb-8'>
            <div className='flex items-center justify-between'>
              <div>
                <h2 className='text-xl font-semibold text-gray-900'>
                  {searchExecuted && input.trim() ? 
                    `Results for "${input}"` : 
                    'Recommended Connections'
                  }
                  {input.trim() && (
                    <span className='ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-medium rounded-full'>
                      <div className='w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse'></div>
                      Live
                    </span>
                  )}
                </h2>
                <p className='text-sm text-gray-500 mt-1'>
                  {input.trim() 
                    ? `Found ${filteredUsers.length} ${filteredUsers.length === 1 ? 'person' : 'people'} matching your search`
                    : 'Connect with professionals who match your interests'
                  }
                </p>
              </div>
              <div className='flex items-center gap-2'>
                <span className='text-sm font-medium text-gray-700 bg-gray-100 px-3 py-1 rounded-full'>
                  {filteredUsers.length} {filteredUsers.length === 1 ? 'person' : 'people'}
                </span>
              </div>
            </div>
          </div>

          {/* Users Grid */}
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5'>
            {loading ? (
              // Show 6 skeleton cards while loading (initial load)
              Array(6).fill(0).map((_, i) => <UserCardSkeleton key={i} />)
            ) : filteredUsers.length > 0 ? (
              // Show actual UserCards
              filteredUsers.map((user) => (
                <UserCard 
                  user={user} 
                  key={user._id}
                  onConnect={handleConnect} 
                  currentUserId={currentUser?._id}
                />
              ))
            ) : (
              // Empty State - Professional Design
              <div className="col-span-1 sm:col-span-2 lg:col-span-3">
                <div className="max-w-md mx-auto text-center py-16">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-50 rounded-full mb-4">
                    <AlertCircle className='w-8 h-8 text-gray-400'/>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    {input.trim() ? 'No matching results' : 'No recommendations yet'}
                  </h3>
                  <p className='text-sm text-gray-500 mb-6'>
                    {input.trim() 
                      ? "Try searching with different keywords or browse recommended connections." 
                      : "Start by searching for people or explore popular interests."
                    }
                  </p>
                  {!input.trim() && (
                    <button 
                      onClick={() => fetchAllUsers()}
                      className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors duration-200"
                    >
                      <Loader2 className='w-4 h-4 inline mr-2' />
                      Refresh Recommendations
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Suggestions Section */}
          {!input.trim() && !loading && filteredUsers.length > 0 && (
            <div className='mt-12 pt-8 border-t border-gray-100'>
              <div className='flex items-center justify-between mb-4'>
                <h3 className='text-base font-semibold text-gray-800'>Try searching for</h3>
                <Filter className='w-4 h-4 text-gray-400' />
              </div>
              <div className='flex flex-wrap gap-2'>
                {popularSuggestions.map((item) => (
                  <button
                    key={item.term}
                    onClick={() => handleQuickSearch(item.term)}
                    className='flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors duration-200 border border-gray-200'
                  >
                    <span>{item.icon}</span>
                    {item.term}
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
};

export default Discover;