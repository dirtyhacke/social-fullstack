import React, { useState, useEffect, useMemo } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { dummyPostsData, dummyUserData } from '../assets/assets'
import Loading from '../components/Loading'
import UserProfileInfo from '../components/UserProfileInfo'
import PostCard from '../components/PostCard'
import moment from 'moment'
import ProfileModal from '../components/ProfileModal'
import ProfileSettingsModal from '../components/ProfileSettingsModal'
import { useAuth } from '@clerk/clerk-react'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { useSelector, useDispatch } from 'react-redux'
import { fetchConnections } from '../features/connections/connectionsSlice'
import { fetchUser } from '../features/user/userSlice'
import { BluetoothIcon, Lock, Heart, Image as ImageIcon, Video, Settings, UserPlus, Send, X, UserCheck, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, Maximize, Minimize } from 'lucide-react'

// Enhanced helper function to check if a URL is a video
const isVideoUrl = (url) => {
  if (!url) return false;
  
  const videoExtensions = /\.(mp4|webm|ogg|mov|avi|flv|mkv|3gp|m4v|mpg|mpeg|wmv)$/i;
  if (videoExtensions.test(url.toLowerCase())) {
    return true;
  }
  
  if (url.startsWith('data:video/')) {
    return true;
  }
  
  if (typeof url === 'object' && url.type === 'video') {
    return true;
  }
  
  return false;
}

// Helper function to check if a URL is an image
const isImageUrl = (url) => {
  if (!url) return false;
  
  const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|webp|svg|ico)$/i;
  if (imageExtensions.test(url.toLowerCase())) {
    return true;
  }
  
  if (url.startsWith('data:image/')) {
    return true;
  }
  
  if (typeof url === 'object' && url.type === 'image') {
    return true;
  }
  
  return false;
}

// Helper to extract URL from media object or string
const extractUrl = (mediaItem) => {
  if (!mediaItem) return null;
  
  if (typeof mediaItem === 'string') {
    return mediaItem;
  }
  
  if (typeof mediaItem === 'object') {
    return mediaItem.url || mediaItem;
  }
  
  return null;
}

// Helper to extract type from media object
const extractType = (mediaItem) => {
  if (!mediaItem) return null;
  
  if (typeof mediaItem === 'object') {
    if (mediaItem.type) return mediaItem.type;
    
    const url = extractUrl(mediaItem);
    if (isVideoUrl(url)) return 'video';
    if (isImageUrl(url)) return 'image';
  }
  
  if (typeof mediaItem === 'string') {
    if (isVideoUrl(mediaItem)) return 'video';
    if (isImageUrl(mediaItem)) return 'image';
  }
  
  return null;
}

// --- Image Modal Component ---
const ImageModal = ({ isOpen, onClose, images, currentIndex, onNavigate }) => {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  if (!isOpen || !images[currentIndex]) return null;

  const currentImage = images[currentIndex];

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 1));
    if (zoom <= 1) {
      setPosition({ x: 0, y: 0 });
    }
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = currentImage.url;
    link.download = `image-${currentIndex + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleMouseDown = (e) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && zoom > 1) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      setPosition({ x: newX, y: newY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowLeft':
        onNavigate('prev');
        break;
      case 'ArrowRight':
        onNavigate('next');
        break;
      case 'Escape':
        onClose();
        break;
      case '+':
      case '=':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handleZoomIn();
        }
        break;
      case '-':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handleZoomOut();
        }
        break;
      case '0':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handleResetZoom();
        }
        break;
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, currentIndex]);

  useEffect(() => {
    handleResetZoom();
  }, [currentIndex]);

  return (
    <div className="fixed inset-0 z-[10001] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-all duration-200 hover:scale-110"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Navigation arrows */}
      {currentIndex > 0 && (
        <button
          onClick={() => onNavigate('prev')}
          className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-all duration-200 hover:scale-110"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      {currentIndex < images.length - 1 && (
        <button
          onClick={() => onNavigate('next')}
          className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-all duration-200 hover:scale-110"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Image container */}
      <div 
        className="relative w-full h-full flex items-center justify-center overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          src={currentImage.url}
          alt={`Image ${currentIndex + 1}`}
          className={`max-w-full max-h-full object-contain transition-transform duration-200 ${isDragging ? 'cursor-grabbing' : zoom > 1 ? 'cursor-grab' : 'cursor-default'}`}
          style={{
            transform: `scale(${zoom}) translate(${position.x}px, ${position.y}px)`,
          }}
          onDoubleClick={handleResetZoom}
        />
      </div>

      {/* Controls bar */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 p-3 bg-black/50 backdrop-blur-md rounded-full">
        <button
          onClick={handleZoomOut}
          disabled={zoom <= 1}
          className={`p-2 rounded-full ${zoom <= 1 ? 'bg-gray-700/50 text-gray-500' : 'bg-white/10 hover:bg-white/20 text-white'}`}
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        
        <button
          onClick={handleResetZoom}
          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full text-sm font-medium"
        >
          {Math.round(zoom * 100)}%
        </button>
        
        <button
          onClick={handleZoomIn}
          disabled={zoom >= 3}
          className={`p-2 rounded-full ${zoom >= 3 ? 'bg-gray-700/50 text-gray-500' : 'bg-white/10 hover:bg-white/20 text-white'}`}
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        
        <div className="h-6 w-px bg-white/30 mx-1"></div>
        
        <button
          onClick={handleDownload}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
        >
          <Download className="w-5 h-5" />
        </button>
      </div>

      {/* Image counter */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 px-3 py-1.5 bg-black/50 backdrop-blur-md text-white rounded-full text-sm font-medium">
        {currentIndex + 1} / {images.length}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 flex gap-2 max-w-full overflow-x-auto pb-2">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => onNavigate(idx)}
              className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all duration-200 ${currentIndex === idx ? 'border-white scale-110' : 'border-transparent hover:border-white/50'}`}
            >
              <img
                src={img.url}
                alt={`Thumb ${idx + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// --- MediaTabs Component with Image Modal ---
const MediaTabs = ({ mediaPosts }) => {
  const [activeMediaTab, setActiveMediaTab] = useState('images');
  const [playingVideoId, setPlayingVideoId] = useState(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filter posts into images and videos
  const filteredMedia = useMemo(() => {
    const images = [];
    const videos = [];

    mediaPosts.forEach(post => {
      const postId = post._id;
      const createdAt = post.createdAt;

      // Check media_urls
      post.media_urls?.forEach(media => {
        try {
          const url = extractUrl(media);
          const type = extractType(media);
          
          if (!url || !type) return;
          
          const mediaItem = { 
            url, 
            postId, 
            createdAt, 
            type,
            originalMedia: media
          };
          
          if (type === 'video') {
            videos.push(mediaItem);
          } else if (type === 'image') {
            images.push(mediaItem);
          }
        } catch (error) {
          console.error('Error processing media_urls:', error);
        }
      });

      // Check image_urls
      post.image_urls?.forEach(media => {
        try {
          const url = extractUrl(media);
          if (!url) return;
          
          const isDuplicate = [...images, ...videos].some(item => item.url === url);
          if (isDuplicate) return;
          
          const type = extractType(media);
          const mediaItem = { 
            url, 
            postId, 
            createdAt, 
            type: type || (isVideoUrl(url) ? 'video' : 'image'),
            originalMedia: media
          };
          
          if (mediaItem.type === 'video') {
            videos.push(mediaItem);
          } else {
            images.push(mediaItem);
          }
        } catch (error) {
          console.error('Error processing image_urls:', error);
        }
      });
    });

    return { images, videos };
  }, [mediaPosts]);

  const currentMedia = activeMediaTab === 'images' ? filteredMedia.images : filteredMedia.videos;

  // Handle video play/pause
  const handleVideoPlay = (videoId) => {
    setPlayingVideoId(videoId);
  };

  const handleVideoPause = () => {
    setPlayingVideoId(null);
  };

  // Handle image click
  const handleImageClick = (index) => {
    setSelectedImageIndex(index);
    setIsModalOpen(true);
  };

  // Handle modal navigation
  const handleModalNavigate = (direction) => {
    if (direction === 'prev' && selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1);
    } else if (direction === 'next' && selectedImageIndex < filteredMedia.images.length - 1) {
      setSelectedImageIndex(selectedImageIndex + 1);
    } else if (typeof direction === 'number') {
      setSelectedImageIndex(direction);
    }
  };

  // Render Image item
  const renderImageItem = (media, index) => (
    <button
      onClick={() => handleImageClick(index)}
      key={`image-${media.postId}-${index}-${media.url.substring(0, 20)}`} 
      className='relative group w-full aspect-square block transition-all duration-300 hover:scale-[1.02] rounded-xl overflow-hidden shadow-lg hover:shadow-2xl border border-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500'
    >
      <img 
        src={media.url} 
        className='w-full h-full object-cover group-hover:brightness-90 transition duration-300' 
        alt={`Post image ${index + 1}`} 
        onError={(e) => {
          e.target.src = 'https://via.placeholder.com/400x400?text=Image+Not+Found';
          e.target.className = 'w-full h-full object-cover bg-gray-100';
        }}
        loading="lazy"
      />
      
      {/* Image icon overlay */}
      <div className='absolute top-2 right-2 bg-black/50 backdrop-blur-sm rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition duration-300'>
        <ImageIcon className='w-4 h-4 text-white' />
      </div>

      {/* Click hint overlay */}
      <div className='absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300'>
        <div className='bg-black/40 backdrop-blur-sm rounded-full p-3'>
          <ZoomIn className='w-6 h-6 text-white' />
        </div>
      </div>

      {/* Timestamp Overlay */}
      <div className='absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-3'>
        <p className='text-xs text-white font-medium'>
          {moment(media.createdAt).fromNow()}
        </p>
      </div>
    </button>
  );

  // Render Video item
  const renderVideoItem = (media, index) => {
    const videoId = `video-${media.postId}-${index}`;
    const isPlaying = playingVideoId === videoId;
    
    return (
      <div 
        key={`video-${media.postId}-${index}-${media.url.substring(0, 20)}`} 
        className='relative group w-full aspect-square block transition-all duration-300 hover:scale-[1.02] rounded-xl overflow-hidden shadow-lg hover:shadow-2xl border border-gray-100'
      >
        <video 
          id={videoId}
          src={media.url} 
          className='w-full h-full object-cover'
          controls={true}
          muted={!isPlaying}
          playsInline
          preload="metadata"
          onPlay={() => handleVideoPlay(videoId)}
          onPause={handleVideoPause}
          onEnded={handleVideoPause}
          poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%231e293b'/%3E%3Cpath d='M150 120L270 200L150 280Z' fill='%236b7280'/%3E%3C/svg%3E"
          onError={(e) => {
            e.target.parentElement.innerHTML = `
              <div class="w-full h-full bg-gray-900 flex flex-col items-center justify-center p-4">
                <Video className="w-12 h-12 text-gray-500 mb-2" />
                <p class="text-sm text-gray-400 text-center">Video failed to load</p>
              </div>
            `;
          }}
        >
          Your browser does not support the video tag.
        </video>
        
        {/* Video icon overlay */}
        <div className='absolute top-2 right-2 bg-black/50 backdrop-blur-sm rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition duration-300'>
          <Video className='w-4 h-4 text-white' />
        </div>

        {/* Timestamp Overlay */}
        <div className='absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-3'>
          <p className='text-xs text-white font-medium'>
            {moment(media.createdAt).fromNow()}
          </p>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className='w-full'>
        {/* Media Sub-Tabs */}
        <div className='bg-white rounded-xl shadow-lg p-1 flex max-w-sm mx-auto mb-6 border border-gray-100'>
          <button 
            onClick={() => {
              setActiveMediaTab('images');
              setPlayingVideoId(null);
            }} 
            className={`flex-1 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
              activeMediaTab === 'images' 
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" 
                : "text-gray-700 hover:text-indigo-600 hover:bg-indigo-50"
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            Images ({filteredMedia.images.length})
          </button>
          <button 
            onClick={() => setActiveMediaTab('videos')} 
            className={`flex-1 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 ${
              activeMediaTab === 'videos' 
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" 
                : "text-gray-700 hover:text-indigo-600 hover:bg-indigo-50"
            }`}
          >
            <Video className="w-4 h-4" />
            Videos ({filteredMedia.videos.length})
          </button>
        </div>

        {/* Media Grid */}
        {currentMedia.length > 0 ? (
          <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 justify-center'>
            {currentMedia.map((media, index) => 
              media.type === 'image' 
                ? renderImageItem(media, index)
                : renderVideoItem(media, index)
            )}
          </div>
        ) : (
          <div className="w-full text-center py-16 text-gray-500 bg-white rounded-xl shadow-lg border border-gray-100 mt-6">
            <div className="text-6xl mb-4 text-indigo-400">
              {activeMediaTab === 'images' 
                ? <ImageIcon className='w-16 h-16 mx-auto' /> 
                : <Video className='w-16 h-16 mx-auto' />
              }
            </div>
            <p className="text-xl font-semibold text-gray-800">
              No {activeMediaTab} yet
            </p>
            <p className="text-sm text-gray-500 mt-2">
              {activeMediaTab === 'images' 
                ? "This user hasn't posted any images yet."
                : "This user hasn't posted any videos yet."
              }
            </p>
          </div>
        )}
      </div>

      {/* Image Modal */}
      {isModalOpen && (
        <ImageModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          images={filteredMedia.images}
          currentIndex={selectedImageIndex}
          onNavigate={handleModalNavigate}
        />
      )}
    </>
  );
};

// Skeleton Loading Components
const ProfileSkeleton = () => {
  return (
    <div className='relative h-full overflow-y-scroll bg-gray-100 p-4 md:p-6'>
      <div className='max-w-4xl mx-auto'>
        <div className='bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden'>
          <div className='h-48 md:h-64 bg-gray-200 animate-pulse'></div>
          
          <div className='px-6 pb-8 -mt-20 relative'>
            <div className='flex flex-col md:flex-row md:items-end md:justify-between'>
              <div className='flex flex-col md:flex-row md:items-start space-y-4 md:space-y-0 md:space-x-8'>
                <div className='relative'>
                  <div className='w-36 h-36 rounded-full border-4 border-white shadow-2xl bg-gray-300 animate-pulse'></div>
                </div>
                
                <div className='space-y-3 pt-4 md:pt-16'>
                  <div className='h-8 w-56 bg-gray-300 rounded-full animate-pulse'></div>
                  <div className='h-4 w-40 bg-gray-200 rounded-full animate-pulse'></div>
                  <div className='h-4 w-80 bg-gray-200 rounded animate-pulse'></div>
                  
                  <div className='flex space-x-8 pt-4'>
                    {[1, 2, 3].map((i) => (
                      <div key={i} className='text-center'>
                        <div className='h-7 w-10 bg-gray-300 rounded-full animate-pulse'></div>
                        <div className='h-3 w-16 bg-gray-200 rounded mt-1'></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className='flex space-x-3 mt-6 md:mt-0'>
                <div className='h-10 w-28 bg-blue-500/20 rounded-full animate-pulse'></div>
                <div className='h-10 w-36 bg-green-500/20 rounded-full animate-pulse'></div>
              </div>
            </div>
          </div>
        </div>

        <div className='mt-8'>
          <div className='bg-white rounded-xl shadow-lg p-1 flex max-w-lg mx-auto border border-gray-100'>
            {[1, 2, 3].map((i) => (
              <div key={i} className='flex-1 px-4 py-2'>
                <div className='h-9 w-full bg-gray-200 rounded-full animate-pulse'></div>
              </div>
            ))}
          </div>

          <div className='mt-8'>
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className='bg-white rounded-xl shadow-md overflow-hidden animate-pulse border border-gray-100'>
                  <div className='h-56 bg-gray-200'></div>
                  <div className='p-4 space-y-2'>
                    <div className='h-4 bg-gray-200 rounded w-3/4'></div>
                    <div className='h-4 bg-gray-200 rounded w-1/2'></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const MediaSkeleton = () => {
  return (
    <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'>
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div key={i} className='w-full aspect-square bg-gray-200 rounded-xl animate-pulse shadow-md'></div>
      ))}
    </div>
  )
}

const PostsSkeleton = () => {
  return (
    <div className='flex flex-col items-center gap-8'>
      {[1, 2].map((i) => (
        <div key={i} className='w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-pulse'>
          <div className='p-5 flex items-center space-x-4'>
            <div className='w-12 h-12 bg-gray-200 rounded-full'></div>
            <div className='space-y-2'>
              <div className='h-4 w-32 bg-gray-200 rounded'></div>
              <div className='h-3 w-20 bg-gray-200 rounded'></div>
            </div>
          </div>
          <div className='h-80 bg-gray-200'></div>
          <div className='p-5 space-y-4'>
            <div className='h-5 bg-gray-200 rounded w-11/12'></div>
            <div className='h-5 bg-gray-200 rounded w-3/4'></div>
            <div className='flex space-x-6 pt-3'>
              <div className='h-8 w-16 bg-gray-200 rounded-full'></div>
              <div className='h-8 w-16 bg-gray-200 rounded-full'></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// --- Main Profile Component ---
const Profile = () => {
  const currentUser = useSelector((state) => state.user.value)
  const connections = useSelector((state) => state.connections)
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const { getToken } = useAuth()
  const { profileId } = useParams()
  const [user, setUser] = useState(null)
  const [posts, setPosts] = useState([])
  const [likedPosts, setLikedPosts] = useState([])
  const [mediaPosts, setMediaPosts] = useState([])
  const [activeTab, setActiveTab] = useState('posts')
  const [showEdit, setShowEdit] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingPosts, setIsLoadingPosts] = useState(false)
  const [isLoadingMedia, setIsLoadingMedia] = useState(false)
  const [isLoadingLikes, setIsLoadingLikes] = useState(false)
  const [localIsFollowing, setLocalIsFollowing] = useState(false)
  const [followRequestStatus, setFollowRequestStatus] = useState('none')

  const isOwnProfile = !profileId || profileId === currentUser?._id

  const isFollowing = localIsFollowing || currentUser?.following?.includes(user?._id)
  const isConnected = connections.connections?.some(conn => 
    conn._id === user?._id || conn.from_user_id === user?._id || conn.to_user_id === user?._id
  )
  const hasPendingRequest = connections.pendingConnections?.some(conn => 
    conn.from_user_id === user?._id || conn.to_user_id === user?._id
  )

  const fetchUserData = async (profileId) => {
    const token = await getToken()
    setIsLoading(true)
    try {
      const { data: profileData } = await api.post(`/api/user/profiles`, { profileId }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (profileData.success) {
        setUser(profileData.profile)
        setLocalIsFollowing(currentUser?.following?.includes(profileData.profile._id))
        
        if (profileData.profile.settings?.profilePrivacy === 'private' && 
            profileId !== currentUser?._id &&
            !profileData.profile.followers?.includes(currentUser?._id)) {
          const { data: followRequests } = await api.get(`/api/user/follow-requests`, {
            headers: { Authorization: `Bearer ${token}` }
          })
          if (followRequests.success) {
            const hasPendingFollow = followRequests.requests.some(req => 
              req.fromUserId === currentUser?._id && req.toUserId === profileId && req.status === 'pending'
            )
            setFollowRequestStatus(hasPendingFollow ? 'requested' : 'none')
          }
        } else {
          setFollowRequestStatus('accepted')
        }
        
        await fetchAllPosts(profileId, token)
        
      } else {
        toast.error(profileData.message)
      }
    } catch (error) {
      console.error('Error fetching user data:', error)
      toast.error(error.response?.data?.message || error.message || 'Failed to load profile')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchAllPosts = async (profileId, token) => {
    setIsLoadingPosts(true)
    try {
      const { data: postsData } = await api.post('/api/post/profile-posts', { profileId }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (postsData.success) {
        const allPosts = postsData.posts || [];
        setPosts(allPosts);
        processMediaPosts(allPosts);
        await processLikedPosts(allPosts, profileId, token);
      } else {
        toast.error(postsData.message);
        setPosts([]);
        setMediaPosts([]);
        setLikedPosts([]);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast.error('Failed to load posts');
      setPosts([]);
      setMediaPosts([]);
      setLikedPosts([]);
    } finally {
      setIsLoadingPosts(false);
    }
  }

  const processMediaPosts = (allPosts) => {
    const mediaFiltered = allPosts.filter(post => {
      const hasMedia = post?.media_urls && Array.isArray(post.media_urls) && post.media_urls.length > 0;
      const hasImageUrls = post?.image_urls && Array.isArray(post.image_urls) && post.image_urls.length > 0;
      
      return hasMedia || hasImageUrls;
    });
    
    setMediaPosts(mediaFiltered);
  }

  const processLikedPosts = async (allPosts, profileId, token) => {
    setIsLoadingLikes(true);
    try {
      const targetUserId = profileId || currentUser?._id;
      const likedFiltered = allPosts.filter(post => {
        const hasLikesCountArray = post?.likes_count && 
                                  Array.isArray(post.likes_count) && 
                                  post.likes_count.includes(targetUserId);
        
        const hasLikesArray = post?.likes && 
                             Array.isArray(post.likes) && 
                             post.likes.includes(targetUserId);
        
        return hasLikesCountArray || hasLikesArray;
      });
      
      setLikedPosts(likedFiltered);
    } catch (error) {
      console.error('Error processing liked posts:', error);
      setLikedPosts([]);
    } finally {
      setIsLoadingLikes(false);
    }
  }

  const loadMediaPosts = () => {
    if (mediaPosts.length > 0 || posts.length === 0) return;
    setIsLoadingMedia(true);
    try {
      processMediaPosts(posts);
    } catch (error) {
      console.error('Error loading media posts:', error);
    } finally {
      setIsLoadingMedia(false);
    }
  }

  const loadLikedPosts = async () => {
    if (likedPosts.length > 0 || posts.length === 0) return;
    
    setIsLoadingLikes(true);
    try {
      const token = await getToken();
      const targetUserId = profileId || currentUser?._id;
      await processLikedPosts(posts, targetUserId, token);
    } catch (error) {
      console.error('Error loading liked posts:', error);
    } finally {
      setIsLoadingLikes(false);
    }
  }

  const handleFollow = async () => {
    if (!user?._id) return;
    
    setIsLoading(true);
    try {
      const token = await getToken();
      
      if (user.settings?.profilePrivacy === 'private' && !isOwnProfile) {
        const { data } = await api.post('/api/user/follow-request', { targetUserId: user._id }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (data.success) {
          toast.success('Follow request sent!');
          setFollowRequestStatus('requested');
        } else {
          toast.error(data.message);
        }
      } else {
        const { data } = await api.post('/api/user/follow', { id: user._id }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (data.success) {
          toast.success(data.message);
          setLocalIsFollowing(true);
          setFollowRequestStatus('accepted');
          await dispatch(fetchUser(token));
          await fetchUserData(user._id);
        } else {
          toast.error(data.message);
        }
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  const handleUnfollow = async () => {
    if (!user?._id) return;
    
    setIsLoading(true);
    try {
      const token = await getToken();
      
      if (followRequestStatus === 'requested') {
        const { data } = await api.post('/api/user/cancel-follow-request', { targetUserId: user._id }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (data.success) {
          toast.success('Follow request cancelled!');
          setFollowRequestStatus('none');
        } else {
          toast.error(data.message);
        }
      } else {
        const { data } = await api.post('/api/user/unfollow', { id: user._id }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (data.success) {
          toast.success(data.message);
          setLocalIsFollowing(false);
          setFollowRequestStatus('none');
          await dispatch(fetchUser(token));
          await fetchUserData(user._id);
        } else {
          toast.error(data.message);
        }
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  const handleConnectionRequest = async () => {
    if (isLoading || !user?._id) return;
    
    setIsLoading(true);

    if (isConnected) {
      setIsLoading(false);
      return navigate('/messages/' + user._id);
    }

    if (hasPendingRequest) {
      try {
        const token = await getToken();
        const { data } = await api.post('/api/user/accept', { id: user._id }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (data.success) {
          toast.success('Connection accepted!');
          dispatch(fetchConnections(token));
        } else {
          toast.error(data.message);
        }
      } catch (error) {
        toast.error(error.message);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      const token = await getToken();
      const { data } = await api.post('/api/user/connect', { id: user._id }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.success) {
        toast.success(data.message);
        dispatch(fetchConnections(token));
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (profileId) {
      fetchUserData(profileId);
    } else if (currentUser?._id) {
      fetchUserData(currentUser._id);
    }
  }, [profileId, currentUser]);

  useEffect(() => {
    if (user && currentUser) {
      setLocalIsFollowing(currentUser.following?.includes(user._id));
    }
  }, [user, currentUser]);

  useEffect(() => {
    const loadConnections = async () => {
      if (currentUser) {
        const token = await getToken();
        dispatch(fetchConnections(token));
      }
    };
    loadConnections();
  }, [currentUser, dispatch, getToken]);

  useEffect(() => {
    if (activeTab === 'media' && posts.length > 0 && mediaPosts.length === 0) {
      loadMediaPosts();
    }
  }, [activeTab, posts, mediaPosts]);

  useEffect(() => {
    if (activeTab === 'likes' && posts.length > 0 && likedPosts.length === 0) {
      loadLikedPosts();
    }
  }, [activeTab, posts, likedPosts]);

  const isPrivateProfile = user?.settings?.profilePrivacy === 'private' && 
                          profileId && 
                          profileId !== currentUser?._id && 
                          !user?.followers?.includes(currentUser?._id) &&
                          followRequestStatus !== 'accepted';

  if (isLoading && !user) {
    return <ProfileSkeleton />;
  }

  if (isPrivateProfile) {
    return (
      <div className='relative h-full overflow-y-scroll bg-gray-100 p-4 md:p-6'>
        <div className='max-w-4xl mx-auto'>
          <div className='bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden'>
            <div className='h-48 md:h-64 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-80'>
              {user.cover_photo && <img src={user.cover_photo} alt='' className='w-full h-full object-cover blur-sm'/>}
            </div>
            
            <div className='px-8 pb-8 -mt-20 relative'>
              <div className='flex flex-col md:flex-row md:items-end md:justify-between'>
                <div className='flex flex-col md:flex-row md:items-start space-y-4 md:space-y-0 md:space-x-8'>
                  <div className='relative'>
                    <div className='w-36 h-36 rounded-full border-4 border-white shadow-2xl bg-gray-300 flex items-center justify-center'>
                      <UserCheck className='w-16 h-16 text-white bg-gray-500 rounded-full p-2'/>
                    </div>
                  </div>
                  
                  <div className='space-y-3 pt-4 md:pt-16'>
                    <h1 className='text-3xl md:text-4xl font-extrabold text-gray-900'>
                      {user.full_name}
                    </h1>
                    <p className='text-gray-600 font-medium'>@{user.username}</p>
                    
                    <div className='flex space-x-8 pt-4'>
                      <div className='text-center'>
                        <span className='block font-extrabold text-2xl text-gray-900'>-</span>
                        <span className='text-sm text-gray-600'>Posts</span>
                      </div>
                      <div className='text-center'>
                        <span className='block font-extrabold text-2xl text-gray-900'>-</span>
                        <span className='text-sm text-gray-600'>Followers</span>
                      </div>
                      <div className='text-center'>
                        <span className='block font-extrabold text-2xl text-gray-900'>-</span>
                        <span className='text-sm text-gray-600'>Following</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className='flex space-x-3 mt-6 md:mt-0'>
                  {followRequestStatus === 'requested' ? (
                    <button 
                      onClick={handleUnfollow}
                      disabled={isLoading}
                      className='px-6 py-2.5 bg-gray-500 text-white rounded-full hover:bg-gray-600 transition-colors duration-200 font-semibold text-sm flex items-center gap-2 disabled:opacity-50 shadow-md'
                    >
                      <X className='w-5 h-5'/> Requested
                    </button>
                  ) : (
                    <button 
                      onClick={handleFollow}
                      disabled={isLoading}
                      className='px-6 py-2.5 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors duration-200 font-semibold text-sm flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-green-300'
                    >
                      <UserPlus className='w-5 h-5'/> Follow
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className='mt-8 bg-white rounded-3xl shadow-xl p-10 text-center border border-gray-200'>
            <div className='text-7xl mb-6 text-indigo-500'><Lock className='w-20 h-20 mx-auto' /></div>
            <h2 className='text-3xl font-extrabold text-gray-900 mb-3'>This account is private</h2>
            <p className='text-gray-600 mb-6 text-lg'>Follow this account to see their posts, media, and activity.</p>
            {followRequestStatus === 'requested' ? (
              <div className="space-y-3">
                <button 
                  onClick={handleUnfollow}
                  disabled={isLoading}
                  className='px-8 py-3 bg-gray-500 text-white rounded-full hover:bg-gray-600 transition-colors duration-200 font-semibold flex items-center gap-3 mx-auto disabled:opacity-50 shadow-md'
                >
                  <X className='w-5 h-5'/> Cancel Request
                </button>
                <p className="text-sm text-gray-500 mt-3">Your request is pending approval.</p>
              </div>
            ) : (
              <button 
                onClick={handleFollow}
                disabled={isLoading}
                className='px-8 py-3 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors duration-200 font-semibold flex items-center gap-3 mx-auto disabled:opacity-50 shadow-lg shadow-green-400/50'
              >
                <UserPlus className='w-5 h-5'/> Send Follow Request
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return user ? (
    <div className='relative h-full overflow-y-scroll bg-gray-100 p-4 md:p-6'>
      <div className='max-w-4xl mx-auto'>
        <div className='bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden'>
          <div className='h-48 md:h-64 bg-gradient-to-r from-indigo-200 via-purple-200 to-pink-200'>
            {user.cover_photo && <img src={user.cover_photo} alt='' className='w-full h-full object-cover'/>}
          </div>
          
          <UserProfileInfo 
            user={user} 
            posts={posts} 
            profileId={profileId} 
            setShowEdit={setShowEdit}
            setShowSettings={setShowSettings}
            isOwnProfile={isOwnProfile}
            isFollowing={isFollowing}
            isConnected={isConnected}
            hasPendingRequest={hasPendingRequest}
            followRequestStatus={followRequestStatus}
            onFollow={handleFollow}
            onUnfollow={handleUnfollow}
            onConnectionRequest={handleConnectionRequest}
            isLoading={isLoading}
          />
        </div>

        <div className='mt-8'>
          <div className='bg-white rounded-xl shadow-lg p-1 flex max-w-lg mx-auto border border-gray-100'>
            {[
              { id: 'posts', label: 'Posts', icon: <BluetoothIcon className="w-5 h-5" /> },
              { id: 'media', label: 'Media', icon: <ImageIcon className="w-5 h-5" /> },
              { id: 'likes', label: 'Likes', icon: <Heart className="w-5 h-5" /> }
            ].map((tab) => (
              <button 
                onClick={() => setActiveTab(tab.id)} 
                key={tab.id} 
                className={`flex-1 px-4 py-2.5 text-base font-semibold rounded-lg transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 tracking-wide
                  ${
                  activeTab === tab.id 
                    ? "bg-green-600 text-white shadow-lg shadow-green-300/50 scale-[1.01]" 
                    : "text-gray-700 hover:text-green-600 hover:bg-gray-100/70"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
          
          <div className='mt-8'>
            {activeTab === 'posts' && (
              <>
                {isLoadingPosts ? (
                  <PostsSkeleton />
                ) : posts.length > 0 ? (
                  <div className='flex flex-col items-center gap-8'>
                    {posts.map((post) => <PostCard key={post._id} post={post} />)}
                  </div>
                ) : (
                  <div className="w-full text-center py-16 text-gray-500 bg-white rounded-xl shadow-lg border border-gray-100">
                    <div className="text-7xl mb-4 text-green-500">📝</div>
                    <p className="text-xl font-semibold text-gray-800">No posts yet</p>
                    <p className="text-sm text-gray-500 mt-2">When you create posts, they will appear here</p>
                  </div>
                )}
              </>
            )}

            {activeTab === 'media' && (
              <>
                {isLoadingMedia ? (
                  <MediaSkeleton />
                ) : mediaPosts.length > 0 ? (
                  <MediaTabs mediaPosts={mediaPosts} />
                ) : (
                  <div className="w-full text-center py-16 text-gray-500 bg-white rounded-xl shadow-lg border border-gray-100">
                    <div className="text-7xl mb-4 text-indigo-500">📷</div>
                    <p className="text-xl font-semibold text-gray-800">No media posts yet</p>
                    <p className="text-sm text-gray-500 mt-2">When you post images or videos, they will appear here</p>
                  </div>
                )}
              </>
            )}

            {activeTab === 'likes' && (
              <>
                {isLoadingLikes ? (
                  <PostsSkeleton />
                ) : likedPosts.length > 0 ? (
                  <div className='flex flex-col items-center gap-8'>
                    {likedPosts.map((post) => <PostCard key={post._id} post={post} />)}
                  </div>
                ) : (
                  <div className="w-full text-center py-16 text-gray-500 bg-white rounded-xl shadow-lg border border-gray-100">
                    <div className="text-7xl mb-4 text-red-500">❤️</div>
                    <p className="text-xl font-semibold text-gray-800">No liked posts yet</p>
                    <p className="text-sm text-gray-500 mt-2">
                      {isOwnProfile 
                        ? "Posts you like will appear here" 
                        : "This user hasn't liked any posts yet"
                      }
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      
      {showEdit && <ProfileModal setShowEdit={setShowEdit} />}
      {showSettings && <ProfileSettingsModal setShowSettings={setShowSettings} user={user} />}
    </div>
  ) : <Loading />;
}

export default Profile