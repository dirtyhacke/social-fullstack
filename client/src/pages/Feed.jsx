import React, { useEffect, useState, useCallback } from 'react'
import { assets } from '../assets/assets'
import StoriesBar from '../components/StoriesBar'
import PostCard from '../components/PostCard'
import RecentMessages from '../components/RecentMessages'
import { useAuth } from '@clerk/clerk-react'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { Zap, CornerDownRight, MessageCircle, User } from 'lucide-react'
import { Link } from 'react-router-dom'

// Skeleton Components with graceful gliding effect
const PostCardSkeleton = () => {
    return (
        <div className='bg-white rounded-xl shadow-lg p-4 sm:p-5 space-y-4 w-full max-w-2xl border border-gray-100 overflow-hidden mx-auto'>
            {/* Gliding overlay */}
            <div className='absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent animate-glide z-10'></div>
            
            {/* User Info Skeleton */}
            <div className='flex items-center justify-between relative'>
                <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 relative overflow-hidden'></div>
                    <div className='space-y-2'>
                        <div className='h-4 w-28 sm:w-32 bg-gradient-to-r from-gray-100 to-gray-200 rounded relative overflow-hidden'></div>
                        <div className='h-3 w-20 sm:w-24 bg-gradient-to-r from-gray-100 to-gray-200 rounded relative overflow-hidden'></div>
                    </div>
                </div>
                <div className='w-5 h-5 sm:w-6 sm:h-6 bg-gradient-to-r from-gray-100 to-gray-200 rounded relative overflow-hidden'></div>
            </div>
            
            {/* Content Skeleton */}
            <div className='space-y-2 relative'>
                <div className='h-4 w-full bg-gradient-to-r from-gray-100 to-gray-200 rounded relative overflow-hidden'></div>
                <div className='h-4 w-3/4 bg-gradient-to-r from-gray-100 to-gray-200 rounded relative overflow-hidden'></div>
                <div className='h-4 w-1/2 bg-gradient-to-r from-gray-100 to-gray-200 rounded relative overflow-hidden'></div>
            </div>
            
            {/* Media Skeleton */}
            <div className='grid grid-cols-2 gap-2 relative'>
                <div className='h-40 sm:h-48 bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg relative overflow-hidden'></div>
                <div className='h-40 sm:h-48 bg-gradient-to-r from-gray-100 to-gray-200 rounded-lg relative overflow-hidden'></div>
            </div>
            
            {/* Actions Skeleton */}
            <div className='flex items-center justify-between pt-3 border-t border-gray-100 relative'>
                <div className='flex items-center gap-4 sm:gap-6'>
                    <div className='flex items-center gap-2'>
                        <div className='w-4 h-4 sm:w-5 sm:h-5 bg-gradient-to-r from-gray-100 to-gray-200 rounded relative overflow-hidden'></div>
                        <div className='h-4 w-6 sm:w-8 bg-gradient-to-r from-gray-100 to-gray-200 rounded relative overflow-hidden'></div>
                    </div>
                    <div className='flex items-center gap-2'>
                        <div className='w-4 h-4 sm:w-5 sm:h-5 bg-gradient-to-r from-gray-100 to-gray-200 rounded relative overflow-hidden'></div>
                        <div className='h-4 w-6 sm:w-8 bg-gradient-to-r from-gray-100 to-gray-200 rounded relative overflow-hidden'></div>
                    </div>
                    <div className='flex items-center gap-2'>
                        <div className='w-4 h-4 sm:w-5 sm:h-5 bg-gradient-to-r from-gray-100 to-gray-200 rounded relative overflow-hidden'></div>
                        <div className='h-4 w-6 sm:w-8 bg-gradient-to-r from-gray-100 to-gray-200 rounded relative overflow-hidden'></div>
                    </div>
                </div>
                <div className='h-4 w-20 sm:w-24 bg-gradient-to-r from-gray-100 to-gray-200 rounded relative overflow-hidden'></div>
            </div>
        </div>
    );
};

const StoriesBarSkeleton = () => {
    return (
        <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 px-2 sm:px-0 relative">
            {[1, 2, 3, 4, 5, 6].map((item) => (
                <div key={item} className="flex flex-col items-center gap-2 relative overflow-hidden flex-shrink-0">
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent animate-glide z-10"></div>
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 border-2 border-gray-300 relative overflow-hidden"></div>
                    <div className="h-3 w-10 sm:w-12 bg-gradient-to-r from-gray-100 to-gray-200 rounded relative overflow-hidden"></div>
                </div>
            ))}
        </div>
    );
};

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
        console.log(`✅ Loaded ${data.posts?.length || 0} posts in feed`);
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

  // Add CSS for the glide animation
  const glideStyles = `
    @keyframes glide {
      0% {
        transform: translateX(-100%);
      }
      100% {
        transform: translateX(100%);
      }
    }
    .animate-glide {
      animation: glide 1.5s ease-in-out infinite;
    }
  `;

  // Handle post deletion from feed
  const handleDeletePost = (deletedPostId) => {
    setFeeds(prevFeeds => prevFeeds.filter(post => post._id !== deletedPostId));
    toast.success('Post deleted successfully!');
  };

  // Handle post edit (if you implement editing)
  const handleEditPost = (updatedPost) => {
    setFeeds(prevFeeds => 
      prevFeeds.map(post => 
        post._id === updatedPost._id ? updatedPost : post
      )
    );
    toast.success('Post updated successfully!');
  };

  return (
    <>
      <style>{glideStyles}</style>
      
      {/* Instagram-style Fixed Header */}
      <div className='fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm'>
        <div className='flex items-center gap-3'>
          {/* Logo */}
          <img 
            src={assets.logo} 
            className='w-8 h-8' 
            alt="PixoNet Logo" 
          />
          <h1 className='text-xl font-bold text-gray-900 hidden sm:block'>
            <span className="text-green-600">Pixo</span>Net
          </h1>
        </div>

        {/* Instagram-style Icons */}
        <div className='flex items-center gap-4'>
          {/* My Profile Button */}
          <Link 
            to="/profile"
            className='p-2 rounded-full text-gray-700 hover:text-green-600 hover:bg-gray-100 transition-colors duration-200'
            title="My Profile"
          >
            <User className='w-5 h-5 sm:w-6 sm:h-6' />
          </Link>

          {/* Message Button */}
          <Link 
            to="/messages"
            className='p-2 rounded-full text-gray-700 hover:text-blue-600 hover:bg-gray-100 transition-colors duration-200'
            title="Messages"
          >
            <MessageCircle className='w-5 h-5 sm:w-6 sm:h-6' />
          </Link>
        </div>
      </div>

      {/* Main Content with padding for fixed header */}
      <div className='pt-16 max-w-7xl mx-auto px-3 sm:px-4 md:px-6 flex justify-center items-start gap-4 lg:gap-8'>
        
        {/* Main Content Column */}
        <div className='flex flex-col w-full max-w-2xl flex-shrink-0'>
          
          {/* Stories Bar */}
          <div className='mb-4 sm:mb-6'>
            {loading ? <StoriesBarSkeleton /> : <StoriesBar />}
          </div>

          {/* Post Feed */}
          <div className='space-y-4 sm:space-y-6'>
            {loading ? (
              // Show skeleton posts while loading with graceful gliding effect
              [1, 2, 3].map((item) => (
                <PostCardSkeleton key={item} />
              ))
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
              <div className="p-6 sm:p-8 text-center bg-white rounded-xl shadow-lg border border-gray-100 mt-6 sm:mt-10 mx-2 sm:mx-0">
                <div className="text-4xl mb-3 sm:mb-4">📷</div>
                <p className="text-lg sm:text-xl font-semibold text-gray-700">No posts in your feed yet.</p>
                <p className="text-gray-500 mt-2 text-sm sm:text-base">Follow more people to see content here!</p>
                <button 
                  onClick={fetchFeeds}
                  className="mt-4 px-5 sm:px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition duration-200 text-sm sm:text-base flex items-center gap-2 mx-auto"
                >
                  Check for New Posts
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Hidden on mobile and tablet, visible on xl screens */}
        <div className='hidden xl:block w-full max-w-xs mt-16'>
          <div className='sticky top-20 flex flex-col gap-6'>
            
            {/* Sponsored Ad Card */}
            <div className='bg-white p-5 rounded-xl border border-indigo-100 shadow-lg'>
              <h3 className='flex items-center gap-2 text-indigo-600 font-bold text-sm mb-3 uppercase'>
                <Zap className='w-4 h-4'/> Sponsored
              </h3>
              
              {/* Ad Image */}
              <img 
                src={assets.sponsored_img} 
                className='w-full h-auto object-cover rounded-lg mb-3 border border-gray-100' 
                alt="Sponsored content" 
                loading="lazy"
              />
              
              {/* Ad Text */}
              <div>
                <p className='text-slate-800 font-semibold text-md mb-1'>Email Marketing Platform</p>
                <p className='text-slate-500 text-sm'>Supercharge your marketing with a powerful, easy-to-use platform built for results.</p>
              </div>

              {/* Call to Action */}
              <button className='mt-4 w-full flex items-center justify-center gap-2 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-semibold transition duration-200'>
                Learn More <CornerDownRight className='w-4 h-4'/>
              </button>
            </div>
            
            {/* Recent Messages Component */}
            <RecentMessages />
            
          </div>
        </div>
      </div>
    </>
  )
}

export default Feed;