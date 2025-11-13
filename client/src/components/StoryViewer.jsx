import { X, ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react'
import React, { useEffect, useState, useRef } from 'react'

const StoryViewer = ({viewStory, setViewStory}) => {

    const [progress, setProgress] = useState(0)
    const [isPlaying, setIsPlaying] = useState(false)
    const [audioProgress, setAudioProgress] = useState(0)
    const [currentLyric, setCurrentLyric] = useState("")
    const [showMusicOptions, setShowMusicOptions] = useState(false) // Keeping this state for potential future use

    const audioRef = useRef(null)
    const progressIntervalRef = useRef(null)
    const storyDuration = 10000; // 10 seconds for non-video stories

    // Fallback for user data
    const storyUser = viewStory?.user || {};

    // Initialize audio
    useEffect(() => {
        audioRef.current = new Audio()
        audioRef.current.volume = 0.5
        
        return () => {
            // Cleanup on initial mount/unmount
            stopSongPreview()
        }
    }, [])

    // Start story progress and music
    useEffect(() => {
        let timer, progressInterval;

        // Only start timer/progress if the story is not a video
        if(viewStory && viewStory.media_type !== 'video'){
            setProgress(0)

            const setTime = 50; // Update every 50ms
            let elapsed = 0;

           progressInterval = setInterval(() => {
                elapsed += setTime;
                // Ensure progress doesn't exceed 100%
                setProgress(Math.min(100, (elapsed / storyDuration) * 100));
            }, setTime);

             // Close story after duration
             timer = setTimeout(()=>{
                setViewStory(null) // Simulates moving to the next story by closing the current one
             }, storyDuration)
        }

        // Start music if story has music
        if (viewStory?.music_data) {
            setTimeout(() => {
                playSongPreview(viewStory.music_data);
            }, 500);
        }

        // Clean up on dependency change (e.g., viewing a new story)
        return ()=>{
            clearTimeout(timer);
            clearInterval(progressInterval)
            // NOTE: stopSongPreview is now handled by handleClose/handleNextStory for immediate response
        }

    }, [viewStory, setViewStory])

    // Music functions (Logic is preserved)
    const playSongPreview = async (musicData) => {
        stopSongPreview();

        if (!musicData?.downloadUrl) {
            console.log('🎵 No music URL available');
            return;
        }

        try {
            const audio = audioRef.current;
            const favoritePartStart = viewStory?.favorite_part_start || 0;
            const clipDuration = musicData.clipDuration || 15;

            audio.pause();
            audio.currentTime = favoritePartStart;
            audio.volume = 0.5;
            audio.crossOrigin = 'anonymous';
            audio.src = musicData.downloadUrl;

            audio.oncanplaythrough = async () => {
                try {
                    await audio.play(); 
                    setIsPlaying(true);
                    
                    progressIntervalRef.current = setInterval(() => {
                        const currentTime = audio.currentTime - favoritePartStart;
                        if (audio.ended || currentTime >= clipDuration) {
                            audio.currentTime = favoritePartStart;
                            audio.play();
                            setAudioProgress(0);
                        } else {
                            const progress = (currentTime / clipDuration) * 100;
                            setAudioProgress(progress);
                            if (viewStory?.show_lyrics) {
                                setCurrentLyric(getLyricsForTime(audio.currentTime));
                            }
                        }
                    }, 100);
                    
                } catch (playError) {
                    console.error('🎵 Auto-play failed (requires user interaction in some browsers):', playError);
                    setIsPlaying(false); 
                }
            };

            audio.load();
            
        } catch (error) {
            console.error('🎵 Playback setup failed:', error);
        }
    };

    const stopSongPreview = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        
        setIsPlaying(false);
        setAudioProgress(0);
        setCurrentLyric("");
        
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }
    };

    const togglePlayPause = () => {
        if (!viewStory?.music_data) return;
        
        if (isPlaying) {
            stopSongPreview();
        } else {
            playSongPreview(viewStory.music_data);
        }
    };

    const getLyricsForTime = (currentTime) => {
        const lyrics = [
            { time: 0, text: "🎵 Starting the vibe..." },
            { time: 5, text: "🎶 Feel the rhythm flow" },
            { time: 10, text: "✨ Living in this moment" },
            { time: 15, text: "🌟 Lights shining bright" },
            { time: 20, text: "💫 Lost in the melody" },
            { time: 25, text: "🎵 Beat takes over now" }
        ];
        
        const currentLyric = lyrics.reverse().find(lyric => currentTime >= lyric.time);
        return currentLyric ? currentLyric.text : "🎵 Music playing...";
    };

    // Card style classes for MusicSticker 
    const getCardStyleClasses = () => {
        const sizeClasses = {
            small: "p-1.5 min-w-[120px]", 
            medium: "p-2 min-w-[160px]", 
            large: "p-3 min-w-[200px]"
        };

        const styleClasses = {
            default: "bg-white/20 backdrop-blur-md", 
            minimal: "bg-black/40 backdrop-blur-sm",
            classic: "bg-purple-500/30 backdrop-blur-md", 
            modern: "bg-cyan-500/30 backdrop-blur-md"
        };

        const size = viewStory?.card_size || 'medium';
        const style = viewStory?.card_style || 'default';
        
        // Use rounded-full for a proper pill shape for non-lyric card
        return `${sizeClasses[size]} ${styleClasses[style]} rounded-full`; 
    };

    const handleClose = ()=>{
        // FIX: Explicitly stop audio before unmounting the story viewer
        stopSongPreview(); 
        setViewStory(null);
    }
    
    // --- New Navigation Handlers ---
    const handleNextStory = (e) => {
        e.stopPropagation(); 
        // FIX: Explicitly stop audio before simulating move to next story
        stopSongPreview();
        console.log("Next Story Clicked");
        setViewStory(null); // This closes the current story, simulating moving to the next
    };

    const handlePreviousStory = (e) => {
        e.stopPropagation();
        console.log("Previous Story Clicked");
        // In a real app, this would go back to the previous story object.
    };
    // -------------------------------

    if(!viewStory) return null

    const renderContent = ()=>{
        // Use object-contain for media to fit without cropping, consistent with Instagram
        const mediaClass = 'w-full h-full object-contain';

        switch (viewStory.media_type) {
            case 'image':
                return (
                    // We use object-contain here to ensure the full image is visible,
                    // but the containing div is `w-full h-full`
                    <img src={viewStory.media_url} alt="Story content" className={mediaClass}/>
                );
            case 'video':
                return (
                    <video 
                        onEnded={()=>{
                            stopSongPreview();
                            setViewStory(null);
                        }} 
                        src={viewStory.media_url} 
                        className={mediaClass} 
                        controls 
                        autoPlay 
                        style={{ maxHeight: '100%' }}
                    />
                );
            case 'text':
                // Text stories fill the entire container with the background color
                return (
                    <div className='w-full h-full flex items-center justify-center p-8 text-white'
                        style={{ backgroundColor: viewStory.background_color || 'black' }}
                    >
                        <p className='text-3xl sm:text-5xl font-extrabold text-center leading-snug break-words max-h-full overflow-hidden'
                           style={{ lineHeight: '1.2' }}
                        >
                            {viewStory.content}
                        </p>
                    </div>
                );
        
            default:
                return null;
        }
    }

    // Music sticker component - Repositioned and stylized for the top
    const MusicSticker = () => {
        if (!viewStory?.music_data) return null;

        // Default position is now purely top-center (y=12)
        const musicPosition = viewStory.music_position || { x: 50, y: 12 }; 
        const musicData = viewStory.music_data;
        const baseClass = getCardStyleClasses();

        // Use rounded-lg for lyric card for better text display
        const lyricCardClass = `px-4 py-1 text-white font-extrabold text-sm rounded-lg backdrop-blur-md bg-black/50`;

        // If lyrics are showing, use the larger, centered card
        if (viewStory.show_lyrics && currentLyric) {
            return (
                 <div 
                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 z-40 text-center transition-all duration-200`}
                    style={{
                        left: `${musicPosition.x}%`,
                        top: `${musicPosition.y}%`,
                    }}
                >
                    <button onClick={togglePlayPause} className={`${lyricCardClass} hover:bg-black/70 active:scale-95 transition-all duration-150`}>
                        {currentLyric}
                        {isPlaying ? (
                            <Pause size={14} className='inline ml-2 align-middle text-white'/>
                        ) : (
                            <Play size={14} className='inline ml-2 align-middle text-white'/>
                        )}
                    </button>
                </div>
            )
        }


        // Standard Music Card (No Lyrics) - Top position
        return (
            <div 
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 z-40 cursor-pointer transition-all duration-200`}
                style={{
                    left: `${musicPosition.x}%`,
                    top: `${musicPosition.y}%`, 
                }}
                onClick={togglePlayPause}
            >
                {/* IMPROVED CARD UI: Added subtle progress bar back and used rounded-full */}
                <div className={`${baseClass} flex items-center gap-2 hover:scale-[1.03] active:scale-[0.98] relative overflow-hidden`}>
                    
                    {/* Album Art with Play/Pause Indicator */}
                    <div className='relative flex-shrink-0'>
                        <img 
                            src={musicData.image} 
                            alt={musicData.name}
                            className={`
                                ${viewStory.card_size === 'small' ? 'w-6 h-6' : 'w-8 h-8'} 
                                rounded-full object-cover // Using rounded-full for better album art display
                            `}
                        />
                         {/* Play/Pause indicator dot */}
                        <div
                            className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center 
                                ${isPlaying ? 'bg-white' : 'bg-red-500'}`}
                        >
                            {isPlaying ? (
                                <Pause size={10} className='text-black' />
                            ) : (
                                <Play size={10} className='text-white ml-0.5' />
                            )}
                        </div>
                    </div>
                    
                    {/* Song Info */}
                    <div className='flex-1 min-w-0'>
                        <p className={`
                            ${viewStory.card_size === 'small' ? 'text-xs' : 'text-sm'} 
                            font-semibold text-white truncate mr-2`
                        }>
                            {musicData.name}
                        </p>
                    </div>
                    
                    {/* Progress Bar (Subtle) */}
                    {isPlaying && (
                        <div className='absolute bottom-0 left-0 right-0 h-[2px] bg-white/50 overflow-hidden'>
                            <div 
                                className='h-full bg-white transition-all duration-100 ease-linear' 
                                style={{ width: `${audioProgress}%` }}
                            />
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div 
            className='fixed inset-0 h-[100dvh] z-[1000] flex items-center justify-center bg-black/95' 
        >
          {/* Main Story Container - Constrained like a phone screen */}
          <div 
            className='relative w-full max-w-sm h-full max-h-[95vh] sm:max-h-[90vh] mx-auto shadow-2xl rounded-xl overflow-hidden'
            style={{ 
                backgroundColor: viewStory.media_type === 'text' && viewStory.background_color 
                    ? viewStory.background_color 
                    : 'black' 
            }}
          >
              
              {/* Progress Bar */}
              <div className='absolute top-0 left-0 right-0 p-1 flex gap-0.5 z-50'>
                {viewStory.media_type !== 'video' && (
                    <div className='w-full h-1 bg-white/40 rounded-full overflow-hidden'>
                        <div 
                            className='h-full bg-white rounded-full transition-all duration-50 linear' 
                            style={{width: `${progress}%`}}
                        />
                    </div>
                )}
                 {viewStory.media_type === 'video' && (
                    <div className='w-full h-1 bg-white/40 rounded-full'/>
                )}
              </div>
              
              {/* Top Bar - User Info and Close */}
              <div className='absolute top-2 left-0 right-0 px-3 py-2 z-40'>
                <div className='flex items-center justify-between'>
                    {/* User Info */}
                    <div className='flex items-center space-x-2'>
                        <img 
                            src={storyUser.profile_picture || '/default-avatar.png'} 
                            alt={storyUser.full_name} 
                            className='size-8 rounded-full object-cover border-2 border-white/80'
                        />
                        <div className='text-white font-semibold text-sm'>
                            <span>{storyUser.full_name || 'Anonymous'}</span>
                        </div>
                    </div>

                    {/* Close Button */}
                    <button 
                        onClick={handleClose} 
                        className='text-white p-1.5 opacity-80 hover:opacity-100 transition-opacity'
                        aria-label="Close story viewer"
                    >
                        <X className='w-6 h-6'/>
                    </button>
                </div>
              </div>

              {/* Content Wrapper and Tap-to-Advance zones */}
              <div className='w-full h-full relative'>
                  {/* The actual content (media/text) */}
                  {renderContent()}
                  
                  {/* Music Sticker (positioned over content) */}
                  <MusicSticker />
                  
                  {/* --- Tap-to-Advance Zones (Full height, Z-index 30) --- */}
                  <div className='absolute inset-0 flex justify-between z-30'>
                      {/* Left side for previous story (simulated) */}
                      <button 
                          onClick={handlePreviousStory} 
                          className='w-1/4 h-full cursor-pointer'
                          aria-label="Previous story"
                      />
                      {/* Center remains for viewing content */}
                      <div className='w-2/4 h-full'/>
                      {/* Right side for next story (simulated) */}
                      <button 
                          onClick={handleNextStory} 
                          className='w-1/4 h-full cursor-pointer'
                          aria-label="Next story"
                      />
                  </div>
              </div>
              
              {/* --- Desktop Navigation Arrows (Enhanced UI) --- */}
              {/* These arrows are outside the constrained story view for desktop users */}
              <button 
                onClick={handlePreviousStory} 
                className='absolute left-[-65px] top-1/2 transform -translate-y-1/2 p-4 rounded-full bg-white/30 text-white z-60 hidden md:block hover:bg-white/50 backdrop-blur-sm transition-all'
                aria-label="Previous story (desktop)"
              >
                  <ChevronLeft className='w-7 h-7'/>
              </button>
              
              <button 
                onClick={handleNextStory} 
                className='absolute right-[-65px] top-1/2 transform -translate-y-1/2 p-4 rounded-full bg-white/30 text-white z-60 hidden md:block hover:bg-white/50 backdrop-blur-sm transition-all'
                aria-label="Next story (desktop)"
              >
                  <ChevronRight className='w-7 h-7'/>
              </button>
          </div>
          
        </div>
    )
}

export default StoryViewer