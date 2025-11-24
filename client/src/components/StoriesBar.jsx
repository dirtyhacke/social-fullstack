import React, { useEffect, useState, useRef } from 'react'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import moment from 'moment'
import StoryModal from './StoryModal'
import StoryViewer from './StoryViewer'
import { useAuth } from '@clerk/clerk-react'
import api from '../api/axios'
import toast from 'react-hot-toast'

const StoriesBar = () => {
    const {getToken} = useAuth()
    const scrollContainerRef = useRef(null)

    const [stories, setStories] = useState([])
    const [groupedStories, setGroupedStories] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [isViewingStories, setIsViewingStories] = useState(false)
    const [currentUserStories, setCurrentUserStories] = useState([])
    const [currentStoryIndex, setCurrentStoryIndex] = useState(0)
    const [viewedStories, setViewedStories] = useState(new Set())
    const [showLeftArrow, setShowLeftArrow] = useState(false)
    const [showRightArrow, setShowRightArrow] = useState(false)

    // Load viewed stories from localStorage
    useEffect(() => {
        const storedViewedStories = localStorage.getItem('viewedStories')
        if (storedViewedStories) {
            try {
                const { stories: viewedIds, timestamp } = JSON.parse(storedViewedStories)
                const isExpired = moment().diff(moment(timestamp), 'hours') >= 24
                
                if (!isExpired) {
                    setViewedStories(new Set(viewedIds))
                } else {
                    localStorage.removeItem('viewedStories')
                }
            } catch (error) {
                console.error('Error loading viewed stories:', error)
                localStorage.removeItem('viewedStories')
            }
        }
    }, [])

    // Save viewed stories to localStorage
    const saveViewedStories = (storyIds) => {
        const data = {
            stories: Array.from(storyIds),
            timestamp: moment().toISOString()
        }
        localStorage.setItem('viewedStories', JSON.stringify(data))
    }

    const fetchStories = async () => {
        try {
            const token = await getToken()
            const { data } = await api.get('/api/story/get', {
                headers: { Authorization: `Bearer ${token}` }
            })
            if (data.success){
                setStories(data.stories)
            }else{
                toast(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        }
    }

    // Group stories by user and sort like Instagram
    useEffect(() => {
        if (stories.length > 0) {
            const grouped = stories.reduce((acc, story) => {
                const userId = story.user?._id || story.user;
                if (!acc[userId]) {
                    acc[userId] = {
                        user: story.user,
                        stories: [],
                        latestStoryTime: new Date(story.createdAt)
                    };
                }
                
                acc[userId].stories.push(story);
                
                // Update latest story time
                const storyTime = new Date(story.createdAt);
                if (storyTime > acc[userId].latestStoryTime) {
                    acc[userId].latestStoryTime = storyTime;
                }
                
                return acc;
            }, {});

            // Convert to array and sort like Instagram:
            // 1. First, stories from users you interact with most
            // 2. Then by latest story time (newest first)
            // 3. Then alphabetically by username
            const groupedArray = Object.values(grouped)
                .sort((a, b) => {
                    // Sort by latest story time (newest first)
                    return new Date(b.latestStoryTime) - new Date(a.latestStoryTime);
                })
                .map(userGroup => ({
                    ...userGroup,
                    // Sort user's stories by creation time (oldest first for proper viewing)
                    stories: userGroup.stories.sort((a, b) => 
                        new Date(a.createdAt) - new Date(b.createdAt)
                    )
                }));

            setGroupedStories(groupedArray);
        } else {
            setGroupedStories([]);
        }
    }, [stories]);

    useEffect(()=>{
        fetchStories()
    },[])

    // Check scroll position for arrows
    const checkScrollPosition = () => {
        if (scrollContainerRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current
            setShowLeftArrow(scrollLeft > 0)
            setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10)
        }
    }

    useEffect(() => {
        checkScrollPosition()
        window.addEventListener('resize', checkScrollPosition)
        return () => window.removeEventListener('resize', checkScrollPosition)
    }, [groupedStories])

    // Scroll functions
    const scrollLeft = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' })
        }
    }

    const scrollRight = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' })
        }
    }

    // Handle story view - open all stories from a user
    const handleStoryView = (userStories) => {
        if (userStories.stories.length === 0) return;

        // Mark all stories from this user as viewed
        const newViewedStories = new Set(viewedStories);
        userStories.stories.forEach(story => {
            newViewedStories.add(story._id);
        });
        setViewedStories(newViewedStories);
        saveViewedStories(newViewedStories);
        
        // Set the stories for the viewer and open it
        setCurrentUserStories(userStories.stories);
        setCurrentStoryIndex(0); // Start from first story
        setIsViewingStories(true);
    }

    // Check if user has any unviewed stories
    const hasUnviewedStories = (userStories) => {
        return userStories.stories.some(story => !viewedStories.has(story._id));
    }

    const handleStoryViewerClose = () => {
        setIsViewingStories(false);
        setCurrentUserStories([]);
    }

    const StoryCard = ({ userStories }) => {
        const hasUnviewed = hasUnviewedStories(userStories);
        const latestStory = userStories.stories[userStories.stories.length - 1]; // Get latest story for display
        const isTextStory = latestStory?.media_type === 'text';
        
        // Instagram-like gradient border colors
        const borderGradient = hasUnviewed
            ? 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)' // Instagram rainbow gradient for unviewed
            : 'linear-gradient(45deg, #c7c7c7, #e0e0e0)' // Gray gradient for viewed stories

        return (
            <div className="flex flex-col items-center gap-2">
                {/* Story Circle - Instagram Style */}
                <div 
                    onClick={() => handleStoryView(userStories)} 
                    className={`
                        relative rounded-full p-0.5 cursor-pointer transition-all duration-300 
                        hover:scale-105 active:scale-95
                    `}
                    style={{
                        background: borderGradient,
                    }}
                >
                    {/* Inner white circle for padding */}
                    <div className="bg-white rounded-full p-0.5">
                        {/* Profile picture container */}
                        <div className="relative rounded-full overflow-hidden">
                            {isTextStory ? (
                                // Text story background
                                <div 
                                    className="w-16 h-16 rounded-full flex items-center justify-center"
                                    style={{ 
                                        backgroundColor: latestStory.background_color || '#059669',
                                        background: latestStory.background_color 
                                            ? latestStory.background_color 
                                            : 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)'
                                    }}
                                >
                                    <p className="text-xs font-semibold text-white text-center px-1 line-clamp-2">
                                        {latestStory.content?.length > 15 ? latestStory.content.substring(0, 15) + '...' : latestStory.content}
                                    </p>
                                </div>
                            ) : (
                                // Media story - show latest story media
                                <div className="w-16 h-16 rounded-full overflow-hidden">
                                    {latestStory.media_type === "image" ? 
                                        <img 
                                            src={latestStory.media_url} 
                                            alt="Story visual" 
                                            className='w-full h-full object-cover'
                                        />
                                        : 
                                        <video 
                                            src={latestStory.media_url} 
                                            className='w-full h-full object-cover'
                                            muted 
                                            playsInline
                                        />
                                    }
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Story count badge for users with multiple stories */}
                    {userStories.stories.length > 1 && (
                        <div className="absolute -bottom-1 -right-1 bg-white rounded-full px-1 border border-gray-300">
                            <span className="text-xs font-bold text-gray-800">
                                {userStories.stories.length}
                            </span>
                        </div>
                    )}
                </div>
                
                {/* Username - Instagram Style */}
                <p className="text-xs text-gray-800 font-medium max-w-[70px] truncate">
                    {userStories.user?.username || 
                     userStories.user?.full_name?.split(' ')[0] || 
                     'User'}
                </p>
            </div>
        );
    };

    return (
        <div className='w-full lg:max-w-2xl relative bg-white rounded-lg p-4 border border-gray-200'>
            {/* Scroll Arrows */}
            {showLeftArrow && (
                <button 
                    onClick={scrollLeft}
                    className='absolute left-2 top-1/2 transform -translate-y-1/2 z-10 bg-white/90 hover:bg-white text-gray-700 rounded-full p-1 shadow-lg border border-gray-200 transition-all duration-200 hover:scale-110'
                >
                    <ChevronLeft className='w-4 h-4' />
                </button>
            )}
            
            {showRightArrow && (
                <button 
                    onClick={scrollRight}
                    className='absolute right-2 top-1/2 transform -translate-y-1/2 z-10 bg-white/90 hover:bg-white text-gray-700 rounded-full p-1 shadow-lg border border-gray-200 transition-all duration-200 hover:scale-110'
                >
                    <ChevronRight className='w-4 h-4' />
                </button>
            )}

            {/* Scroll Container */}
            <div 
                ref={scrollContainerRef}
                className="overflow-x-auto px-2 scrollbar-hide"
                onScroll={checkScrollPosition}
                style={{
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    WebkitOverflowScrolling: 'touch',
                    cursor: 'grab',
                }}
            >
                {/* Hide scrollbar for Webkit browsers */}
                <style jsx>{`
                    div::-webkit-scrollbar {
                        display: none;
                        width: 0;
                        height: 0;
                        background: transparent;
                    }
                    div:active {
                        cursor: grabbing;
                    }
                `}</style>
                
                {/* Stories Container */}
                <div className='flex gap-6 pb-2 select-none'>
                    
                    {/* Your Story Card - Instagram Style */}
                    <div className="flex flex-col items-center gap-2">
                        <div 
                            onClick={() => setShowModal(true)} 
                            className="relative rounded-full p-0.5 cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95"
                            style={{
                                background: 'linear-gradient(45deg, #c7c7c7, #e0e0e0)'
                            }}
                        >
                            <div className="bg-white rounded-full p-0.5">
                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-100 to-gray-300 flex items-center justify-center overflow-hidden">
                                    <Plus className="w-6 h-6 text-gray-600" />
                                </div>
                            </div>
                        </div>
                        <p className="text-xs text-gray-800 font-medium">Your story</p>
                    </div>
                    
                    {/* Render Grouped Stories */}
                    {groupedStories.map((userStories, index) => (
                       <StoryCard key={userStories.user?._id || index} userStories={userStories} />
                    ))}
                </div>
            </div>

            {/* Modals */}
            {showModal && <StoryModal setShowModal={setShowModal} fetchStories={fetchStories}/>}
            
            {/* Story Viewer - Now shows all stories from the selected user */}
            {isViewingStories && currentUserStories.length > 0 && (
                <StoryViewer 
                    stories={currentUserStories}
                    currentStoryIndex={currentStoryIndex}
                    setCurrentStoryIndex={setCurrentStoryIndex}
                    setViewStory={setIsViewingStories}
                />
            )}
        </div>
    )
}

export default StoriesBar