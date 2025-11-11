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
    const [showModal, setShowModal] = useState(false)
    const [viewStory, setViewStory] = useState(null)
    const [viewedStories, setViewedStories] = useState(new Set())
    const [showLeftArrow, setShowLeftArrow] = useState(false)
    const [showRightArrow, setShowRightArrow] = useState(false)

    // Load viewed stories from localStorage
    useEffect(() => {
        const storedViewedStories = localStorage.getItem('viewedStories')
        if (storedViewedStories) {
            try {
                const { stories: viewedIds, timestamp } = JSON.parse(storedViewedStories)
                
                // Check if data is older than 24 hours
                const isExpired = moment().diff(moment(timestamp), 'hours') >= 24
                
                if (!isExpired) {
                    setViewedStories(new Set(viewedIds))
                } else {
                    // Clear expired data
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
    }, [stories])

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

    const handleStoryView = (story) => {
        // Mark story as viewed
        const newViewedStories = new Set(viewedStories)
        newViewedStories.add(story._id)
        setViewedStories(newViewedStories)
        saveViewedStories(newViewedStories)
        
        setViewStory(story)
    }

    const StoryCard = ({ story }) => {
        const isTextStory = story.media_type === 'text';
        const isViewed = viewedStories.has(story._id)
        
        // Define a consistent aspect ratio and size for the cards
        const cardClass = 'min-w-[75px] w-[75px] h-[100px] sm:min-w-[90px] sm:w-[90px] sm:h-[120px] flex-shrink-0';

        // Background for media content - gray if viewed
        const mediaBackground = isTextStory 
            ? { backgroundColor: isViewed ? '#6B7280' : (story.background_color || '#059669') }
            : {};
            
        return (
            <div 
                onClick={() => handleStoryView(story)} 
                className={`relative rounded-xl shadow-lg cursor-pointer transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] ${cardClass} overflow-hidden ${
                    isViewed ? 'opacity-80 grayscale-20' : 'opacity-100'
                }`}
                style={mediaBackground}
            >
                {/* Media Content Area */}
                {!isTextStory && (
                    <div className='absolute inset-0 z-10'>
                        {/* Overlay - gray if viewed, green if not */}
                        <div className={`absolute inset-0 z-20 ${
                            isViewed ? 'bg-gray-800/40' : 'bg-green-900/30'
                        }`}></div>
                        {story.media_type === "image" ? 
                            <img 
                                src={story.media_url} 
                                alt="Story visual" 
                                className='h-full w-full object-cover'
                            />
                            : 
                            <video 
                                src={story.media_url} 
                                className='h-full w-full object-cover'
                                muted playsInline
                            />
                        }
                    </div>
                )}
                
                {/* Text Content for Text Stories */}
                {isTextStory && (
                    <div className='w-full h-full flex items-center justify-center p-2'>
                         <p className='text-sm font-semibold text-white/90 text-center line-clamp-3'>{story.content}</p>
                    </div>
                )}
                
                {/* User Profile Picture & Info */}
                <div className='absolute top-2 left-2 z-30'>
                    <img 
                        src={story.user?.profile_picture || '/default-avatar.png'} 
                        alt={story.user?.full_name} 
                        // Ring color based on viewed status
                        className={`size-7 rounded-full object-cover ring-2 shadow-lg ${
                            isViewed ? 'ring-gray-400' : 'ring-green-400'
                        }`}
                    />
                </div>

                {/* Viewed indicator dot */}
                {isViewed && (
                    <div className='absolute top-2 right-2 z-30'>
                        <div className='w-2 h-2 bg-gray-400 rounded-full'></div>
                    </div>
                )}

                {/* Username at the bottom */}
                <p className='absolute bottom-1.5 left-2 right-2 z-30 text-xs font-semibold text-white truncate text-shadow'>
                    {story.user?.username || story.user?.full_name}
                </p>
                
                {/* Optional: Time stamp in a very subtle way */}
                <p className='text-white/70 absolute bottom-1 right-1 z-30 text-[0.6rem] hidden'>
                    {moment(story.createdAt).fromNow(true)}
                </p>
            </div>
        );
    };

    return (
        <div className='w-full lg:max-w-2xl relative'>
            {/* Scroll Arrows */}
            {showLeftArrow && (
                <button 
                    onClick={scrollLeft}
                    className='absolute left-2 top-1/2 transform -translate-y-1/2 z-10 bg-white/90 hover:bg-white text-gray-700 rounded-full p-2 shadow-lg transition-all duration-200 hover:scale-110'
                >
                    <ChevronLeft className='w-4 h-4' />
                </button>
            )}
            
            {showRightArrow && (
                <button 
                    onClick={scrollRight}
                    className='absolute right-2 top-1/2 transform -translate-y-1/2 z-10 bg-white/90 hover:bg-white text-gray-700 rounded-full p-2 shadow-lg transition-all duration-200 hover:scale-110'
                >
                    <ChevronRight className='w-4 h-4' />
                </button>
            )}

            {/* Container for horizontal scrolling */}
            <div 
                ref={scrollContainerRef}
                className='overflow-x-auto px-4 scrollbar-hide'
                onScroll={checkScrollPosition}
            >
                {/* Flex container for all story cards */}
                <div className='flex gap-4 pb-5'>
                    
                    {/* Add Story Card - Green Theme */}
                    <div 
                        onClick={()=>setShowModal(true)} 
                        className='rounded-xl shadow-md min-w-[75px] w-[75px] h-[100px] sm:min-w-[90px] sm:w-[90px] sm:h-[120px] aspect-[3/4] cursor-pointer transition-all duration-200 border-2 border-dashed border-green-300 bg-white hover:border-green-500 hover:shadow-lg active:scale-[0.98] hover:bg-green-50 flex-shrink-0'
                    >
                        <div className='h-full flex flex-col items-center justify-center p-2'>
                            <div className='size-8 sm:size-10 bg-green-500 rounded-full flex items-center justify-center mb-1 sm:mb-2 shadow-lg hover:bg-green-600 transition-colors'>
                                <Plus className='w-5 h-5 text-white'/>
                            </div>
                            <p className='text-xs sm:text-sm font-medium text-green-700 text-center leading-tight'>Your Story</p>
                        </div>
                    </div>
                    
                    {/* Render Story Cards */}
                    {stories.map((story, index)=> (
                       <StoryCard key={story._id || index} story={story} />
                    ))}
                </div>
            </div>

            {/* Modals */}
            {showModal && <StoryModal setShowModal={setShowModal} fetchStories={fetchStories}/>}
            {viewStory && (
                <StoryViewer 
                    viewStory={viewStory} 
                    setViewStory={setViewStory}
                    onStoryView={() => {
                        // Mark story as viewed when viewer closes
                        const newViewedStories = new Set(viewedStories)
                        newViewedStories.add(viewStory._id)
                        setViewedStories(newViewedStories)
                        saveViewedStories(newViewedStories)
                    }}
                />
            )}
        </div>
    )
}

export default StoriesBar