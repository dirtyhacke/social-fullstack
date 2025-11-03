import { BadgeCheck, X, ChevronLeft, ChevronRight } from 'lucide-react'
import React, { useEffect, useState } from 'react'

const StoryViewer = ({viewStory, setViewStory}) => {

    const [progress, setProgress] = useState(0)

    // Fallback for user data
    const storyUser = viewStory?.user || {};

    useEffect(()=>{
        let timer, progressInterval;

        // Only start timer/progress if the story is not a video
        if(viewStory && viewStory.media_type !== 'video'){
            setProgress(0)

            const duration = 10000; // 10 seconds
            const setTime = 50; // Update every 50ms
            let elapsed = 0;

           progressInterval = setInterval(() => {
                elapsed += setTime;
                // Ensure progress doesn't exceed 100%
                setProgress(Math.min(100, (elapsed / duration) * 100));
            }, setTime);

             // Close story after duration
             timer = setTimeout(()=>{
                setViewStory(null)
             }, duration)
        }

        // Clean up on component unmount or dependency change
        return ()=>{
            clearTimeout(timer);
            clearInterval(progressInterval)
        }

    // Dependency on viewStory and setViewStory (for closure cleanup)
    }, [viewStory, setViewStory])

    const handleClose = ()=>{
        setViewStory(null)
    }

    if(!viewStory) return null

    const renderContent = ()=>{
        // Common class for media content to ensure it fits nicely
        const mediaClass = 'max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl';

        switch (viewStory.media_type) {
            case 'image':
                return (
                    <img src={viewStory.media_url} alt="Story content" className={mediaClass}/>
                );
            case 'video':
                return (
                    // Video duration is handled by 'onEnded' event, no progress bar needed
                    <video 
                        onEnded={()=>setViewStory(null)} 
                        src={viewStory.media_url} 
                        className={mediaClass} 
                        controls 
                        autoPlay 
                        style={{ maxHeight: '90vh' }}
                    />
                );
            case 'text':
                return (
                    // Text background color is applied to the modal background
                    <div className='w-full max-w-lg h-[50vh] sm:h-[60vh] flex items-center justify-center p-8 text-white rounded-xl shadow-2xl'>
                        <p className='text-3xl sm:text-4xl font-extrabold text-center leading-snug break-words max-h-full overflow-hidden'>
                            {viewStory.content}
                        </p>
                    </div>
                );
        
            default:
                return null;
        }
    }

  return (
    // Modal Backdrop: fixed, uses modern viewport height (dvh), dark background
    <div 
        className='fixed inset-0 h-[100dvh] z-[1000] flex items-center justify-center p-4' 
        style={{
            backgroundColor: viewStory.media_type === 'text' && viewStory.background_color 
                ? viewStory.background_color 
                : 'rgba(0, 0, 0, 0.95)'
        }}
    >
      
      {/* Top Bar - User Info and Progress */}
      <div className='absolute top-0 left-0 right-0 p-4 z-20'>
        {/* Progress Bar (Sleeker design) */}
        {viewStory.media_type !== 'video' && (
             <div className='w-full h-1 bg-white/30 rounded-full mb-3'>
                <div 
                    className='h-full bg-white rounded-full transition-all duration-50 linear' 
                    style={{width: `${progress}%`}}
                />
             </div>
        )}
       
        <div className='flex items-center justify-between'>
            {/* User Info */}
            <div className='flex items-center space-x-3 p-1 rounded-full backdrop-blur-sm bg-black/20'>
                <img 
                    src={storyUser.profile_picture || '/default-avatar.png'} 
                    alt={storyUser.full_name} 
                    className='size-8 sm:size-9 rounded-full object-cover border-2 border-white'
                />
                <div className='text-white font-semibold flex items-center gap-1.5 text-sm sm:text-base'>
                    <span>{storyUser.full_name || 'Anonymous'}</span>
                    <BadgeCheck size={16} className="text-blue-400"/>
                </div>
            </div>

            {/* Close Button */}
            <button 
                onClick={handleClose} 
                className='text-white p-2 rounded-full hover:bg-white/20 transition-colors'
                aria-label="Close story viewer"
            >
                <X className='w-7 h-7'/>
            </button>
        </div>
      </div>

      {/* Content Wrapper - takes up central space */}
      <div className='flex items-center justify-center w-full h-full'>
          {renderContent()}
      </div>

      {/* Navigation Arrows (Placeholder - add actual navigation logic if needed) */}
      {/* <button className='absolute left-2 top-1/2 -translate-y-1/2 p-3 text-white rounded-full bg-black/30 hover:bg-black/50 transition-colors hidden sm:block'>
          <ChevronLeft className='w-6 h-6'/>
      </button>
      <button className='absolute right-2 top-1/2 -translate-y-1/2 p-3 text-white rounded-full bg-black/30 hover:bg-black/50 transition-colors hidden sm:block'>
          <ChevronRight className='w-6 h-6'/>
      </button> */}
      
    </div>
  )
}

export default StoryViewer