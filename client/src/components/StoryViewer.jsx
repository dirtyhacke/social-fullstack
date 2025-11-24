import { X, ChevronLeft, ChevronRight, Volume2, VolumeX, Clock } from 'lucide-react'
import React, { useEffect, useState, useRef } from 'react'
import moment from 'moment'

const StoryViewer = ({ stories, currentStoryIndex, setCurrentStoryIndex, setViewStory }) => {

    const [progress, setProgress] = useState(0)
    const [audioProgress, setAudioProgress] = useState(0)
    const [currentLyric, setCurrentLyric] = useState("")
    const [isMuted, setIsMuted] = useState(true)
    const [videoLoaded, setVideoLoaded] = useState(false)

    const audioRef = useRef(null)
    const videoRef = useRef(null)
    const progressIntervalRef = useRef(null)
    const storyDuration = 10000; // 10 seconds for non-video stories

    // Get current story data
    const viewStory = stories?.[currentStoryIndex] || null;
    const storyUser = viewStory?.user || {};

    // Format time function
    const formatUploadTime = (timestamp) => {
        if (!timestamp) return '';
        
        const now = moment();
        const storyTime = moment(timestamp);
        const diffInHours = now.diff(storyTime, 'hours');
        const diffInDays = now.diff(storyTime, 'days');
        
        if (diffInHours < 1) {
            const diffInMinutes = now.diff(storyTime, 'minutes');
            return `${diffInMinutes}m ago`;
        } else if (diffInHours < 24) {
            return `${diffInHours}h ago`;
        } else if (diffInDays < 7) {
            return `${diffInDays}d ago`;
        } else {
            return storyTime.format('MMM D');
        }
    };

    // Initialize audio
    useEffect(() => {
        audioRef.current = new Audio()
        audioRef.current.volume = 0.5
        
        return () => {
            stopSongPreview()
        }
    }, [])

    // Start story progress and music when story changes
    useEffect(() => {
        if (!viewStory) return;

        let timer, progressInterval;

        // Reset progress when story changes
        setProgress(0);
        setVideoLoaded(false);
        stopSongPreview();

        // Handle different media types
        if (viewStory.media_type === 'video') {
            // For videos, wait for video to load and play
            if (videoRef.current) {
                const video = videoRef.current;
                video.currentTime = 0;
                
                const playVideo = async () => {
                    try {
                        video.muted = true;
                        video.playsInline = true;
                        video.preload = "auto";
                        
                        // Wait for video to be ready
                        if (video.readyState < 3) {
                            video.load();
                        }
                        
                        await video.play();
                        console.log('🎥 Video playback started successfully');
                    } catch (error) {
                        console.error('🎥 Video play failed:', error);
                    }
                };

                setTimeout(playVideo, 100);
            }
        } else {
            // For non-video stories, use timer-based progress
            const setTime = 50;
            let elapsed = 0;

            progressInterval = setInterval(() => {
                elapsed += setTime;
                setProgress(Math.min(100, (elapsed / storyDuration) * 100));
            }, setTime);

            timer = setTimeout(() => {
                handleNextStory();
            }, storyDuration)
        }

        // Auto-play music if story has music
        if (viewStory?.music_data) {
            setTimeout(() => {
                playSongPreview(viewStory.music_data);
            }, 500);
        }

        return () => {
            clearTimeout(timer);
            clearInterval(progressInterval);
            stopSongPreview();
        }

    }, [viewStory, currentStoryIndex])

    // Handle video events
    const handleVideoLoad = () => {
        console.log('🎥 Video loaded successfully');
        setVideoLoaded(true);
    }

    const handleVideoError = (e) => {
        console.error('🎥 Video error:', e);
        console.error('🎥 Video source:', viewStory?.media_url);
    }

    const handleVideoEnd = () => {
        console.log('🎥 Video ended, moving to next story');
        handleNextStory();
    }

    // Toggle video mute
    const toggleMute = (e) => {
        if (e) e.stopPropagation();
        if (videoRef.current) {
            videoRef.current.muted = !videoRef.current.muted;
            setIsMuted(videoRef.current.muted);
        }
    }

    // Music functions
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
                    console.error('🎵 Auto-play failed:', playError);
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
            audioRef.current.src = '';
        }
        
        setAudioProgress(0);
        setCurrentLyric("");
        
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
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
        
        return `${sizeClasses[size]} ${styleClasses[style]} rounded-full`; 
    };

    const handleClose = () => {
        console.log("🛑 Closing story viewer");
        stopSongPreview(); 
        setViewStory(false);
    }
    
    const handleNextStory = (e) => {
        if (e) e.stopPropagation();
        console.log("⏭️ Next story");
        stopSongPreview();
        
        if (currentStoryIndex < stories.length - 1) {
            setCurrentStoryIndex(currentStoryIndex + 1);
        } else {
            console.log("📕 No more stories - closing");
            setViewStory(false);
        }
    };

    const handlePreviousStory = (e) => {
        if (e) e.stopPropagation();
        console.log("⏮️ Previous story");
        stopSongPreview();
        
        if (currentStoryIndex > 0) {
            setCurrentStoryIndex(currentStoryIndex - 1);
        } else {
            console.log("📗 First story - closing");
            setViewStory(false);
        }
    };

    // Progress bars for all stories
    const ProgressBars = () => {
        if (!stories || stories.length === 0) return null;

        return (
            <div className='absolute top-0 left-0 right-0 p-1 flex gap-0.5 z-50'>
                {stories.map((story, index) => (
                    <div 
                        key={index}
                        className='flex-1 h-1 bg-white/40 rounded-full overflow-hidden'
                    >
                        <div 
                            className={`h-full bg-white rounded-full transition-all duration-50 linear ${
                                index === currentStoryIndex ? 'bg-white' : 
                                index < currentStoryIndex ? 'bg-white' : 'bg-transparent'
                            }`}
                            style={{
                                width: index === currentStoryIndex ? `${progress}%` : 
                                      index < currentStoryIndex ? '100%' : '0%'
                            }}
                        />
                    </div>
                ))}
            </div>
        );
    };

    // Don't render if no stories or no current story
    if(!stories || stories.length === 0 || !viewStory) {
        console.log("❌ No stories to display");
        return null;
    }

    const renderContent = () => {
        switch (viewStory.media_type) {
            case 'image':
                return (
                    <img 
                        src={viewStory.media_url} 
                        alt="Story content" 
                        className="w-full h-full object-contain"
                        loading="lazy"
                    />
                );
            case 'video':
                return (
                    <div className="relative w-full h-full bg-black">
                        {!videoLoaded && (
                            <div className="absolute inset-0 flex items-center justify-center z-10">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                            </div>
                        )}
                        
                        <video 
                            ref={videoRef}
                            onEnded={handleVideoEnd}
                            onLoadedData={handleVideoLoad}
                            onCanPlay={handleVideoLoad}
                            onError={handleVideoError}
                            onPlay={() => console.log('🎥 Video playing')}
                            src={viewStory.media_url} 
                            className="w-full h-full object-contain"
                            muted={isMuted}
                            playsInline
                            autoPlay
                            preload="auto"
                            controls={false}
                            style={{ 
                                backgroundColor: 'black',
                                display: videoLoaded ? 'block' : 'none'
                            }}
                        >
                            Your browser does not support the video tag.
                        </video>
                        
                        <button
                            onClick={toggleMute}
                            className="absolute bottom-4 left-4 p-3 bg-black/50 rounded-full text-white hover:bg-black/70 transition-all z-40"
                        >
                            {isMuted ? (
                                <VolumeX className="w-5 h-5" />
                            ) : (
                                <Volume2 className="w-5 h-5" />
                            )}
                        </button>

                        {!videoLoaded && (
                            <div className="absolute inset-0 flex items-center justify-center z-20">
                                <div className="text-white text-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                                    <p className="text-sm">Loading video...</p>
                                </div>
                            </div>
                        )}
                    </div>
                );
            case 'text':
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
                return (
                    <div className="w-full h-full flex items-center justify-center bg-black">
                        <p className="text-white text-lg">Unsupported story type</p>
                    </div>
                );
        }
    }

    // Music sticker component
    const MusicSticker = () => {
        if (!viewStory?.music_data) return null;

        const musicPosition = viewStory.music_position || { x: 20, y: 12 };
        const musicData = viewStory.music_data;
        const baseClass = getCardStyleClasses();

        // Lyric card styling
        const lyricCardClass = `px-4 py-2 text-white font-extrabold text-sm rounded-lg backdrop-blur-md bg-black/50 text-center`;

        // If lyrics are showing, use the centered lyric card
        if (viewStory.show_lyrics && currentLyric) {
            return (
                 <div 
                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 z-40 text-center transition-all duration-200`}
                    style={{
                        left: `${musicPosition.x}%`,
                        top: `${musicPosition.y}%`,
                    }}
                >
                    <div className={`${lyricCardClass} flex items-center justify-center gap-2`}>
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        {currentLyric}
                    </div>
                </div>
            )
        }

        // Standard Music Card
        return (
            <div 
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 z-40 transition-all duration-200`}
                style={{
                    left: `${musicPosition.x}%`,
                    top: `${musicPosition.y}%`,
                }}
            >
                <div className={`${baseClass} flex items-center gap-2 relative overflow-hidden`}>
                    
                    {/* Album Art */}
                    <div className='relative flex-shrink-0'>
                        <img 
                            src={musicData.image} 
                            alt={musicData.name}
                            className={`
                                ${viewStory.card_size === 'small' ? 'w-6 h-6' : 'w-8 h-8'} 
                                rounded-full object-cover
                            `}
                        />
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
                    
                    {/* Audio Progress Bar */}
                    <div className='absolute bottom-0 left-0 right-0 h-[2px] bg-white/30 overflow-hidden'>
                        <div 
                            className='h-full bg-green-400 transition-all duration-100 ease-linear' 
                            style={{ width: `${audioProgress}%` }}
                        />
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div 
            className='fixed inset-0 h-[100dvh] z-[1000] flex items-center justify-center bg-black/95' 
        >
          {/* Main Story Container */}
          <div 
            className='relative w-full max-w-sm h-full max-h-[95vh] sm:max-h-[90vh] mx-auto shadow-2xl rounded-xl overflow-hidden bg-black'
          >
              
              {/* Progress Bars for all stories */}
              <ProgressBars />
              
              {/* Top Bar - User Info on LEFT and Close on RIGHT */}
              <div className='absolute top-2 left-0 right-0 px-3 py-2 z-40'>
                <div className='flex items-center justify-between'>
                    {/* User Info - LEFT SIDE */}
                    <div className='flex items-center space-x-2'>
                        <img 
                            src={storyUser.profile_picture || '/default-avatar.png'} 
                            alt={storyUser.full_name} 
                            className='size-8 rounded-full object-cover border-2 border-white/80'
                        />
                        <div className='flex flex-col'>
                            <span className='text-white font-semibold text-sm'>
                                {storyUser.full_name || 'Anonymous'}
                            </span>
                            {/* Upload Time */}
                            {viewStory.createdAt && (
                                <div className='flex items-center gap-1'>
                                    <Clock className='w-3 h-3 text-white/60' />
                                    <span className='text-white/60 text-xs'>
                                        {formatUploadTime(viewStory.createdAt)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Story Counter and Close Button - RIGHT SIDE */}
                    <div className='flex items-center gap-3'>
                        {/* Story Counter */}
                        <div className='text-white/70 text-xs bg-black/40 px-2 py-1 rounded-full'>
                            {currentStoryIndex + 1} / {stories.length}
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
              </div>

              {/* Content Wrapper and Tap-to-Advance zones */}
              <div className='w-full h-full relative bg-black'>
                  {/* The actual content (media/text) */}
                  {renderContent()}
                  
                  {/* Music Sticker */}
                  <MusicSticker />
                  
                  {/* Tap-to-Advance Zones */}
                  <div className='absolute inset-0 flex justify-between z-30'>
                      {/* Left tap zone for previous story */}
                      <button 
                          onClick={handlePreviousStory} 
                          className='w-1/3 h-full cursor-pointer'
                          aria-label="Previous story"
                      />
                      {/* Center zone for pause/play (future feature) */}
                      <div className='w-1/3 h-full'/>
                      {/* Right tap zone for next story */}
                      <button 
                          onClick={handleNextStory} 
                          className='w-1/3 h-full cursor-pointer'
                          aria-label="Next story"
                      />
                  </div>
              </div>
              
              {/* Desktop Navigation Arrows */}
              <button 
                onClick={handlePreviousStory} 
                className={`absolute left-[-65px] top-1/2 transform -translate-y-1/2 p-4 rounded-full text-white z-60 hidden md:flex items-center justify-center backdrop-blur-sm transition-all ${
                    currentStoryIndex > 0 ? 'bg-white/30 hover:bg-white/50' : 'bg-white/10 cursor-not-allowed'
                }`}
                aria-label="Previous story (desktop)"
                disabled={currentStoryIndex === 0}
              >
                  <ChevronLeft className='w-7 h-7'/>
              </button>
              
              <button 
                onClick={handleNextStory} 
                className={`absolute right-[-65px] top-1/2 transform -translate-y-1/2 p-4 rounded-full text-white z-60 hidden md:flex items-center justify-center backdrop-blur-sm transition-all ${
                    currentStoryIndex < stories.length - 1 ? 'bg-white/30 hover:bg-white/50' : 'bg-white/10 cursor-not-allowed'
                }`}
                aria-label="Next story (desktop)"
                disabled={currentStoryIndex === stories.length - 1}
              >
                  <ChevronRight className='w-7 h-7'/>
              </button>
          </div>
          
        </div>
    )
}

export default StoryViewer