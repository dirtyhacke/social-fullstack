import React, { useEffect, useState, useCallback } from 'react';
import { assets } from '../assets/assets';
import StoriesBar from '../components/StoriesBar';
import PostCard from '../components/PostCard';
import RecentMessages from '../components/RecentMessages';
import { useAuth } from '@clerk/clerk-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { Zap, CornerDownRight, MessageCircle, User, Bell, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

// --- STYLES FOR SHIMMER ANIMATION ---
const shimmerStyles = `
  @keyframes shimmer {
    100% { transform: translateX(100%); }
  }
  .animate-shimmer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    transform: translateX(-100%);
    background-image: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0) 0,
      rgba(255, 255, 255, 0.2) 20%,
      rgba(255, 255, 255, 0.5) 60%,
      rgba(255, 255, 255, 0)
    );
    animation: shimmer 2s infinite;
  }
`;

// --- SKELETON COMPONENTS ---

const StoriesBarSkeleton = () => {
    return (
        <div className="bg-white border border-gray-100 rounded-xl p-4 mb-5 shadow-sm">
            <div className="flex gap-4 overflow-x-auto no-scrollbar">
                {[1, 2, 3, 4, 5, 6, 7].map((item) => (
                    <div key={item} className="flex flex-col items-center gap-2 flex-shrink-0">
                        <div className="relative w-16 h-16 rounded-full bg-gray-200 overflow-hidden">
                            <div className="animate-shimmer"></div>
                        </div>
                        <div className="relative h-3 w-12 bg-gray-200 rounded overflow-hidden">
                            <div className="animate-shimmer"></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const PostCardSkeleton = () => {
    return (
        <div className='bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6'>
            {/* Header */}
            <div className='p-4 flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                    <div className='relative w-10 h-10 rounded-full bg-gray-200 overflow-hidden'>
                        <div className="animate-shimmer"></div>
                    </div>
                    <div className='space-y-2'>
                        <div className='relative h-4 w-32 bg-gray-200 rounded overflow-hidden'>
                            <div className="animate-shimmer"></div>
                        </div>
                        <div className='relative h-3 w-20 bg-gray-200 rounded overflow-hidden'>
                            <div className="animate-shimmer"></div>
                        </div>
                    </div>
                </div>
                <div className='relative h-5 w-5 bg-gray-200 rounded-full overflow-hidden'>
                    <div className="animate-shimmer"></div>
                </div>
            </div>
            
            {/* Image Placeholder - Aspect Ratio Preservation */}
            <div className='relative w-full aspect-[4/3] bg-gray-200 overflow-hidden'>
                <div className="animate-shimmer"></div>
            </div>
            
            {/* Footer Actions */}
            <div className='p-4 space-y-3'>
                <div className='flex justify-between items-center'>
                    <div className='flex gap-4'>
                        {[1, 2, 3].map(i => (
                             <div key={i} className='relative w-6 h-6 bg-gray-200 rounded-full overflow-hidden'>
                                <div className="animate-shimmer"></div>
                             </div>
                        ))}
                    </div>
                     <div className='relative w-6 h-6 bg-gray-200 rounded-full overflow-hidden'>
                        <div className="animate-shimmer"></div>
                     </div>
                </div>
                
                {/* Caption Lines */}
                <div className='space-y-2 mt-3'>
                    <div className='relative h-4 w-full bg-gray-200 rounded overflow-hidden'>
                        <div className="animate-shimmer"></div>
                    </div>
                    <div className='relative h-4 w-2/3 bg-gray-200 rounded overflow-hidden'>
                        <div className="animate-shimmer"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- MAIN FEED COMPONENT ---

const Feed = () => {
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const { getToken } = useAuth();

  const fetchFeeds = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const { data } = await api.get('/api/post/feed', {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000
      });

      if (data.success) {
        setFeeds(data.posts || []);
      } else {
        toast.error(data.message || 'Failed to load feed');
        setFeeds([]);
      }
    } catch (error) {
      console.error('Error fetching feeds:', error);
      toast.error(error.message || 'Failed to load feed');
      setFeeds([]);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchFeeds();
  }, [fetchFeeds]);

  const handleDeletePost = (deletedPostId) => {
    setFeeds(prevFeeds => prevFeeds.filter(post => post._id !== deletedPostId));
    toast.success('Post deleted successfully!');
  };

  const handleEditPost = (updatedPost) => {
    setFeeds(prevFeeds => 
      prevFeeds.map(post => post._id === updatedPost._id ? updatedPost : post)
    );
    toast.success('Post updated successfully!');
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      <style>{shimmerStyles}</style>
      
      {/* --- Header (Mobile Optimized) --- */}
      <div className='fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200 transition-all duration-300'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
            <div className="flex items-center justify-between h-16">
                {/* Logo */}
                <div className='flex items-center gap-2 cursor-pointer' onClick={() => window.scrollTo({top:0, behavior:'smooth'})}>
                    <img src={assets.logo} className='w-8 h-8 object-contain' alt="Logo" />
                    <h1 className='text-xl font-bold tracking-tight hidden sm:block text-gray-900'>
                        <span className="text-blue-600">Pixo</span>Net
                    </h1>
                </div>

                {/* Search Bar (Hidden on small mobile) */}
                <div className="hidden md:flex items-center bg-gray-100 rounded-full px-4 py-2 w-64">
                    <Search className="w-4 h-4 text-gray-500 mr-2" />
                    <input type="text" placeholder="Search..." className="bg-transparent border-none focus:outline-none text-sm w-full" />
                </div>

                {/* Icons */}
                <div className='flex items-center gap-2 sm:gap-4'>
                    <Link to="/messages" className='p-2.5 rounded-full text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-all relative'>
                        <MessageCircle className='w-6 h-6' />
                        {/* Notification Dot Example */}
                        <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
                    </Link>
                    <Link to="/notifications" className='p-2.5 rounded-full text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-all hidden sm:block'>
                        <Bell className='w-6 h-6' />
                    </Link>
                    <Link to="/profile" className='p-1 rounded-full hover:ring-2 hover:ring-blue-100 transition-all ml-1'>
                        <div className="w-9 h-9 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold shadow-sm">
                            <User className="w-5 h-5" />
                        </div>
                    </Link>
                </div>
            </div>
        </div>
      </div>

      {/* --- Main Layout --- */}
      <div className='pt-20 pb-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='grid grid-cols-1 lg:grid-cols-12 gap-8'>
            
            {/* Left Sidebar (Optional Navigation - Hidden on Mobile) */}
            {/* If you don't have a left sidebar, we can center the feed or span it */}
            
            {/* --- Feed Column (Center) --- */}
            <div className='lg:col-span-8 xl:col-span-7 mx-auto w-full max-w-2xl lg:max-w-none'>
                
                {/* Stories Section */}
                <div className='mb-6'>
                    {loading ? <StoriesBarSkeleton /> : <StoriesBar />}
                </div>

                {/* Posts Feed */}
                <div className='space-y-6'>
                    {loading ? (
                        <>
                            <PostCardSkeleton />
                            <PostCardSkeleton />
                            <PostCardSkeleton />
                        </>
                    ) : feeds.length > 0 ? (
                        feeds.map((post) => (
                            <PostCard 
                                key={post._id} 
                                post={post}
                                onDelete={handleDeletePost}
                                onEdit={handleEditPost}
                            />
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100 text-center px-4">
                            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4 animate-bounce">
                                <span className="text-4xl">📸</span>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">No Posts Yet</h3>
                            <p className="text-gray-500 max-w-xs mx-auto mb-6">
                                Your feed looks a bit empty. Follow some people or create your first post!
                            </p>
                            <button 
                                onClick={fetchFeeds}
                                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                            >
                                Refresh Feed
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* --- Right Sidebar (Desktop Only) --- */}
            <div className='hidden lg:block lg:col-span-4 xl:col-span-5 space-y-6'>
                <div className="sticky top-24 space-y-6">
                    
                    {/* Sponsored Card */}
                    <div className='bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group'>
                        <div className="p-4 border-b border-gray-50 flex items-center justify-between">
                             <span className='flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider'>
                                <Zap className='w-3 h-3 text-yellow-500 fill-yellow-500'/> Sponsored
                            </span>
                            <span className="text-xs text-gray-400">Ad</span>
                        </div>
                        
                        <div className="p-4">
                            <div className="relative overflow-hidden rounded-xl mb-3">
                                <img 
                                    src={assets.sponsored_img} 
                                    className='w-full h-48 object-cover transform group-hover:scale-105 transition-transform duration-500' 
                                    alt="Sponsored" 
                                />
                                <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
                            </div>
                            
                            <h3 className='font-bold text-gray-900 text-lg leading-tight mb-1'>
                                Premium Marketing Tools
                            </h3>
                            <p className='text-gray-500 text-sm leading-relaxed mb-4'>
                                Boost your reach with our AI-driven marketing analytics. Start your free trial today.
                            </p>

                            <button className='w-full py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-900 font-semibold rounded-lg text-sm transition-colors border border-gray-200 flex items-center justify-center gap-2 group-hover:border-blue-200 group-hover:text-blue-600'>
                                Learn More <CornerDownRight className='w-4 h-4'/>
                            </button>
                        </div>
                    </div>

                    {/* Recent Messages / Suggestions */}
                    <RecentMessages />
                    
                    {/* Footer Links (Optional) */}
                    <div className="flex flex-wrap gap-x-4 gap-y-2 px-2 text-xs text-gray-400">
                        <a href="#" className="hover:underline">Privacy</a>
                        <a href="#" className="hover:underline">Terms</a>
                        <a href="#" className="hover:underline">Advertising</a>
                        <span>© 2024 PixoNet</span>
                    </div>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
}

export default Feed;