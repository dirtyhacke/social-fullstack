import React, { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import moment from 'moment'
import StoryModal from './StoryModal'
import StoryViewer from './StoryViewer'
import { useAuth } from '@clerk/clerk-react'
import api from '../api/axios'
import toast from 'react-hot-toast'

const StoriesBar = () => {

    const {getToken} = useAuth()

    const [stories, setStories] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [viewStory, setViewStory] = useState(null)

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

    const StoryCard = ({ story }) => {
        const isTextStory = story.media_type === 'text';
        
        // Define a consistent aspect ratio and size for the cards
        const cardClass = 'min-w-[75px] w-[75px] h-[100px] sm:min-w-[90px] sm:w-[90px] sm:h-[120px]';

        // Background for media content
        const mediaBackground = isTextStory 
            ? { backgroundColor: story.background_color || '#374151' } // Use text background if available
            : {};
            
        return (
            <div 
                onClick={() => setViewStory(story)} 
                className={`relative rounded-xl shadow-lg cursor-pointer transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98] ${cardClass} overflow-hidden`}
                style={mediaBackground}
            >
                {/* Media Content Area */}
                {!isTextStory && (
                    <div className='absolute inset-0 z-10'>
                        {/* Image/Video Background with soft overlay */}
                        <div className='absolute inset-0 bg-black/30 z-20'></div>
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
                                // Muted and playsInline for auto-play possibility, though full auto-play depends on browser
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
                        // Story "ring" effect: bright border to show it's new/unread
                        className='size-7 rounded-full object-cover ring-2 ring-white/90 shadow-lg'
                    />
                </div>

                {/* Username at the bottom */}
                <p className='absolute bottom-1.5 left-2 right-2 z-30 text-xs font-semibold text-white truncate text-shadow'>
                    {story.user?.username || story.user?.full_name}
                </p>
                {/* Optional: Time stamp in a very subtle way */}
                <p className='text-white/70 absolute bottom-1 right-1 z-30 text-[0.6rem] hidden'>{moment(story.createdAt).fromNow(true)}</p>
            </div>
        );
    };


  return (
    // Container for horizontal scrolling
    <div className='w-full lg:max-w-2xl overflow-x-auto px-4'>

        {/* Flex container for all story cards */}
        <div className='flex gap-4 pb-5'>
            
            {/* Add Story Card (Modernized) */}
            <div 
                onClick={()=>setShowModal(true)} 
                className='rounded-xl shadow-md min-w-[75px] w-[75px] h-[100px] sm:min-w-[90px] sm:w-[90px] sm:h-[120px] aspect-[3/4] cursor-pointer transition-all duration-200 border-2 border-dashed border-gray-300 bg-white hover:border-indigo-500 hover:shadow-lg active:scale-[0.98]'
            >
                <div className='h-full flex flex-col items-center justify-center p-2'>
                    <div className='size-8 sm:size-10 bg-indigo-500 rounded-full flex items-center justify-center mb-1 sm:mb-2 shadow-lg'>
                        <Plus className='w-5 h-5 text-white'/>
                    </div>
                    <p className='text-xs sm:text-sm font-medium text-slate-700 text-center leading-tight'>Your Story</p>
                </div>
            </div>
            
            {/* Render Story Cards */}
            {
                stories.map((story, index)=> (
                   <StoryCard key={index} story={story} />
                ))
            }
        </div>

        {/* Modals */}
        {showModal && <StoryModal setShowModal={setShowModal} fetchStories={fetchStories}/>}
        {viewStory && <StoryViewer viewStory={viewStory} setViewStory={setViewStory}/>}
      
    </div>
  )
}

export default StoriesBar