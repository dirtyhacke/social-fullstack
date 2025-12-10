import { X, ChevronLeft, ChevronRight, Volume2, VolumeX, Clock, Music } from 'lucide-react'
import React, { useEffect, useState, useRef } from 'react'
import moment from 'moment'

const StoryViewer = ({ stories, currentStoryIndex, setCurrentStoryIndex, setViewStory }) => {

    const [progress, setProgress] = useState(0)
    const [audioProgress, setAudioProgress] = useState(0)
    const [currentLyric, setCurrentLyric] = useState("")
    // 2. Changed default mute state to false (unmuted)
    const [isMuted, setIsMuted] = useState(false) 
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
            return `${diffInMinutes}m`;
        } else if (diffInHours < 24) {
            return `${diffInHours}h`;
        } else if (diffInDays < 7) {
            return `${diffInDays}d`;
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
                        // Removed video.muted = true to respect the default unmute setting
                        video.muted = isMuted; 
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
                        // Fallback: if browser blocks unmuted autoplay, mute and try again
                        if(!isMuted) {
                             console.log('Trying muted playback as fallback');
                             video.muted = true;
                             setIsMuted(true);
                             video.play().catch(e => console.error("Fallback failed", e));
                        }
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

        // Auto-play music if story has music AND it's not a video (videos usually have own audio)
        // If you want music over video, remove the check.
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

    // 1. New function to update progress bar based on video time
    const handleVideoTimeUpdate = (e) => {
        if(e.target.duration) {
            const currentProgress = (e.target.currentTime / e.target.duration) * 100;
            setProgress(currentProgress);
        }
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
            const newMuteState = !videoRef.current.muted;
            videoRef.current.muted = newMuteState;
            setIsMuted(newMuteState);
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
            <div className='absolute top-0 left-0 right-0 p-2 flex gap-1 z-50'>
                {stories.map((story, index) => (
                    <div 
                        key={index}
                        className='flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden'
                    >
                        <div 
                            className={`h-full bg-white shadow-sm transition-all duration-100 ease-linear ${
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
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />
                );
            case 'video':
                return (
                    <div className="relative w-full h-full bg-black flex items-center justify-center">
                        {!videoLoaded && (
                            <div className="absolute inset-0 flex items-center justify-center z-10">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/50"></div>
                            </div>
                        )}
                        
                        <video 
                            ref={videoRef}
                            onEnded={handleVideoEnd}
                            onLoadedData={handleVideoLoad}
                            onCanPlay={handleVideoLoad}
                            onTimeUpdate={handleVideoTimeUpdate} // Added this for progress bar
                            onError={handleVideoError}
                            src={viewStory.media_url} 
                            className="w-full h-full object-contain" // Changed to cover for full immersive feel or contain to see all
                            muted={isMuted}
                            playsInline
                            autoPlay
                            preload="auto"
                            controls={false}
                            style={{ 
                                display: videoLoaded ? 'block' : 'none'
                            }}
                        >
                            Your browser does not support the video tag.
                        </video>
                        
                        <button
                            onClick={toggleMute}
                            className="absolute bottom-4 right-4 p-2 bg-black/40 backdrop-blur-sm rounded-full text-white hover:bg-black/60 transition-all z-40"
                        >
                            {isMuted ? (
                                <VolumeX className="w-4 h-4" />
                            ) : (
                                <Volume2 className="w-4 h-4" />
                            )}
                        </button>
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

    // 3. Instagram-style Header Integration
    // This replaces the complex MusicSticker logic for the default view
    const HeaderInfo = () => {
        const musicData = viewStory?.music_data;

        return (
            <div className='flex items-center space-x-3'>
                {/* Profile Pic */}
                <div className="relative">
                    <img 
                        src={storyUser.profile_picture || '/default-avatar.png'} 
                        alt={storyUser.full_name} 
                        className='size-9 rounded-full object-cover border border-white/20'
                    />
                </div>

                {/* Text Info */}
                <div className='flex flex-col justify-center text-left'>
                    {/* Top Row: Name + Time */}
                    <div className='flex items-center gap-2'>
                        <span className='text-white font-semibold text-sm drop-shadow-md'>
                            {storyUser.full_name || 'Anonymous'}
                        </span>
                        <span className='text-white/60 text-xs font-medium'>
                           • {formatUploadTime(viewStory.createdAt)}
                        </span>
                    </div>

                    {/* Bottom Row: Music (Instagram Style) */}
                    {musicData && (
                        <div className='flex items-center gap-1.5 mt-0.5 opacity-90'>
                            <Music className='w-3 h-3 text-white' />
                            <div className='flex items-center max-w-[150px] overflow-hidden'>
                                <span className='text-xs text-white truncate font-medium drop-shadow-md'>
                                    {musicData.name} {musicData.artist && `• ${musicData.artist}`}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // Optional: Only used if we want to show floating lyrics, otherwise music info is in header
    const LyricsOverlay = () => {
        if (viewStory.show_lyrics && currentLyric && viewStory?.music_data) {
             // Use original positioning logic only for lyrics
             const musicPosition = viewStory.music_position || { x: 50, y: 80 };
             return (
                 <div 
                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 z-40 text-center transition-all duration-200`}
                    style={{
                        left: `${musicPosition.x}%`,
                        top: `${musicPosition.y}%`,
                    }}
                >
                    <div className={`px-4 py-2 text-white font-extrabold text-xl sm:text-2xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] text-center`}>
                         {currentLyric}
                    </div>
                </div>
            )
        }
        return null;
    }

    return (
        <div 
            className='fixed inset-0 h-[100dvh] z-[1000] flex items-center justify-center bg-black/95' 
        >
          {/* Main Story Container */}
          <div 
            className='relative w-full max-w-md h-full sm:h-[90vh] mx-auto sm:rounded-xl overflow-hidden bg-black shadow-2xl'
          >
              
              {/* Progress Bars for all stories */}
              <ProgressBars />
              
              {/* Top Bar - Professional Gradient & Layout */}
              {/* Added gradient for text readability */}
              <div className='absolute top-0 left-0 right-0 p-4 pt-6 z-40 bg-gradient-to-b from-black/70 via-black/20 to-transparent'>
                <div className='flex items-start justify-between'>
                    
                    {/* User Info & Music (Combined) */}
                    <HeaderInfo />

                    {/* Right Side Actions */}
                    <div className='flex items-center gap-4'>
                         {/* Close Button */}
                        <button 
                            onClick={handleClose} 
                            className='text-white/90 hover:text-white transition-colors drop-shadow-md'
                            aria-label="Close story viewer"
                        >
                            <X className='w-7 h-7'/>
                        </button>
                    </div>
                </div>
              </div>

              {/* Content Wrapper and Tap-to-Advance zones */}
              <div className='w-full h-full relative bg-gray-900'>
                  {/* The actual content (media/text) */}
                  {renderContent()}
                  
                  {/* Lyrics Overlay (if enabled) */}
                  <LyricsOverlay />
                  
                  {/* Tap-to-Advance Zones */}
                  <div className='absolute inset-0 flex justify-between z-30'>
                      {/* Left tap zone for previous story */}
                      <button 
                          onClick={handlePreviousStory} 
                          className='w-1/3 h-full cursor-pointer focus:outline-none'
                          aria-label="Previous story"
                      />
                      {/* Center zone for pause/play (future feature) */}
                      <div className='w-1/3 h-full'/>
                      {/* Right tap zone for next story */}
                      <button 
                          onClick={handleNextStory} 
                          className='w-1/3 h-full cursor-pointer focus:outline-none'
                          aria-label="Next story"
                      />
                  </div>
              </div>
              
              {/* Desktop Navigation Arrows */}
              <button 
                onClick={handlePreviousStory} 
                className={`absolute left-4 top-1/2 transform -translate-y-1/2 p-2 rounded-full text-white/70 hover:text-white z-60 hidden md:flex items-center justify-center bg-black/20 hover:bg-black/40 backdrop-blur-sm transition-all ${
                    currentStoryIndex > 0 ? '' : 'invisible'
                }`}
                disabled={currentStoryIndex === 0}
              >
                  <ChevronLeft className='w-8 h-8'/>
              </button>
              
              <button 
                onClick={handleNextStory} 
                className={`absolute right-4 top-1/2 transform -translate-y-1/2 p-2 rounded-full text-white/70 hover:text-white z-60 hidden md:flex items-center justify-center bg-black/20 hover:bg-black/40 backdrop-blur-sm transition-all ${
                    currentStoryIndex < stories.length - 1 ? '' : 'invisible'
                }`}
                disabled={currentStoryIndex === stories.length - 1}
              >
                  <ChevronRight className='w-8 h-8'/>
              </button>
          </div>
          
        </div>
    )
}

export default StoryViewer