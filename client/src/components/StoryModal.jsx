import { useAuth } from '@clerk/clerk-react'
import { ArrowLeft, Sparkle, TextIcon, Upload, X, Camera, Music, Play, Pause, Heart, GripHorizontal, AlignLeft } from 'lucide-react'
import React, { useState, useRef, useEffect } from 'react'
import toast from 'react-hot-toast'
import api from '../api/axios'

const StoryModal = ({setShowModal, fetchStories}) => {

    const bgColors = ["#059669", "#10b981", "#84cc16", "#0d9488", "#65a30d", "#16a34a"]

    const [mode, setMode] = useState("text")
    const [background, setBackground] = useState(bgColors[0])
    const [text, setText] = useState("")
    const [media, setMedia] = useState(null)
    const [previewUrl, setPreviewUrl] = useState(null)
    const [loading, setLoading] = useState(false)
    const [showMusicSearch, setShowMusicSearch] = useState(false)
    const [musicSearchQuery, setMusicSearchQuery] = useState("")
    const [searchResults, setSearchResults] = useState([])
    const [selectedMusic, setSelectedMusic] = useState(null)
    const [searchLoading, setSearchLoading] = useState(false)
    const [trendingSongs, setTrendingSongs] = useState([])
    const [playingSong, setPlayingSong] = useState(null)
    const [audioProgress, setAudioProgress] = useState(0)
    const [isPlaying, setIsPlaying] = useState(false)
    const [selectedDuration, setSelectedDuration] = useState(15)
    const [showMusicOptions, setShowMusicOptions] = useState(false)
    const [musicPosition, setMusicPosition] = useState({ x: 50, y: 20 })
    const [isDragging, setIsDragging] = useState(false)
    const [showLyrics, setShowLyrics] = useState(false)
    const [currentLyric, setCurrentLyric] = useState("")
    const [hideWatermark, setHideWatermark] = useState(false)
    const [favoritePartStart, setFavoritePartStart] = useState(0)
    const [showFavoriteSelector, setShowFavoriteSelector] = useState(false)
    const [cardSize, setCardSize] = useState("medium")
    const [cardStyle, setCardStyle] = useState("default")
    const [compressing, setCompressing] = useState(false)
    const [compressionProgress, setCompressionProgress] = useState(0)
    const [currentCompressingFile, setCurrentCompressingFile] = useState("")

    const videoRef = useRef(null)
    const streamRef = useRef(null)
    const canvasRef = useRef(null)
    const audioRef = useRef(null)
    const progressIntervalRef = useRef(null)
    const musicStickerRef = useRef(null)
    const containerRef = useRef(null)
    const dragStartPos = useRef({ x: 0, y: 0 })
    const {getToken} = useAuth()

    const MAX_VIDEO_DURATION = 60;
    const MAX_VIDEO_SIZE_MB = 50;

    // COMPREHENSIVE CLEANUP FUNCTION
    const cleanupAll = () => {
        console.log('🧹 Cleaning up all resources...');
        
        // Stop and completely destroy audio
        if (audioRef.current) {
            console.log('🔇 Stopping and destroying audio...');
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current.src = '';
            audioRef.current.load();
            audioRef.current.onerror = null;
            audioRef.current.oncanplaythrough = null;
            audioRef.current.ontimeupdate = null;
            audioRef.current.onplay = null;
            audioRef.current.onpause = null;
            audioRef.current.onended = null;
        }
        
        // Clear progress interval
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }
        
        // Stop camera
        stopCamera();
        
        // Clean up preview URLs
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
        }
        
        // Reset audio states
        setIsPlaying(false);
        setPlayingSong(null);
        setAudioProgress(0);
        setCurrentLyric("");
        
        // Reset compression states
        setCompressing(false);
        setCompressionProgress(0);
        setCurrentCompressingFile("");
    };

    // Initialize audio element
    useEffect(() => {
        audioRef.current = new Audio();
        audioRef.current.volume = 0.5;
        
        loadTrendingSongs();
        
        return () => {
            console.log('🚪 Modal unmounting - cleaning up everything');
            cleanupAll();
        };
    }, []);

    // Handle escape key and background click
    useEffect(() => {
        const handleEscapeKey = (e) => {
            if (e.key === 'Escape') {
                handleCloseModal();
            }
        };

        const handleBackgroundClick = (e) => {
            if (e.target === e.currentTarget) {
                handleCloseModal();
            }
        };

        document.addEventListener('keydown', handleEscapeKey);
        document.addEventListener('click', handleBackgroundClick);

        return () => {
            document.removeEventListener('keydown', handleEscapeKey);
            document.removeEventListener('click', handleBackgroundClick);
        };
    }, []);

    // CLOSE MODAL HANDLER
    const handleCloseModal = () => {
        console.log('🚪 Closing modal and stopping all audio...');
        cleanupAll();
        setShowModal(false);
    };

    // Auto-play when music is selected
    useEffect(() => {
        if (selectedMusic && (mode === 'media' || mode === 'camera') && previewUrl) {
            setTimeout(() => {
                playSongPreview(selectedMusic);
            }, 500);
        }
    }, [selectedMusic, mode, previewUrl]);

    // SMOOTH DRAGGING IMPLEMENTATION
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isDragging || !containerRef.current) return;
            
            const container = containerRef.current;
            const rect = container.getBoundingClientRect();
            
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            
            const boundedX = Math.max(5, Math.min(95, x));
            const boundedY = Math.max(5, Math.min(95, y));
            
            setMusicPosition({ x: boundedX, y: boundedY });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        const handleTouchMove = (e) => {
            if (!isDragging || !containerRef.current) return;
            
            const container = containerRef.current;
            const rect = container.getBoundingClientRect();
            const touch = e.touches[0];
            
            const x = ((touch.clientX - rect.left) / rect.width) * 100;
            const y = ((touch.clientY - rect.top) / rect.height) * 100;
            
            const boundedX = Math.max(5, Math.min(95, x));
            const boundedY = Math.max(5, Math.min(95, y));
            
            setMusicPosition({ x: boundedX, y: boundedY });
        };

        const handleTouchEnd = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.addEventListener('touchend', handleTouchEnd);
            
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'grabbing';
        } else {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
            
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
            
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };
    }, [isDragging]);

    const startDragging = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    // VIDEO COMPRESSION FUNCTION
    const compressVideo = (file) => {
        return new Promise((resolve) => {
            if (!file.type.startsWith('video/')) {
                resolve(file);
                return;
            }

            // For videos smaller than 5MB, skip compression
            if (file.size <= 5 * 1024 * 1024) {
                resolve(file);
                return;
            }

            console.log('🎥 Starting video compression for story...');
            
            const video = document.createElement('video');
            const source = document.createElement('source');
            
            video.preload = 'metadata';
            source.src = URL.createObjectURL(file);
            video.appendChild(source);

            video.onloadedmetadata = () => {
                URL.revokeObjectURL(source.src);
                
                const duration = video.duration;
                const originalSizeMB = file.size / 1024 / 1024;
                
                let quality = 0.8;
                if (originalSizeMB > 50) quality = 0.6;
                if (originalSizeMB > 100) quality = 0.4;

                const mediaStream = video.captureStream();
                const mediaRecorder = new MediaRecorder(mediaStream, {
                    mimeType: 'video/webm;codecs=vp9',
                    videoBitsPerSecond: Math.floor(1000000 * quality)
                });

                const chunks = [];
                
                // Update compression progress
                const progressInterval = setInterval(() => {
                    setCompressionProgress(prev => {
                        if (prev >= 90) return 90;
                        return prev + 10;
                    });
                }, 500);
                
                mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) {
                        chunks.push(e.data);
                    }
                };

                mediaRecorder.onstop = () => {
                    clearInterval(progressInterval);
                    setCompressionProgress(100);
                    
                    const compressedBlob = new Blob(chunks, { type: 'video/webm' });
                    const compressedFile = new File([compressedBlob], file.name.replace(/\.[^/.]+$/, ".webm"), {
                        type: 'video/webm',
                        lastModified: Date.now()
                    });

                    console.log(`✅ Video compressed: ${originalSizeMB.toFixed(2)}MB → ${(compressedBlob.size / 1024 / 1024).toFixed(2)}MB`);
                    
                    setTimeout(() => {
                        setCompressing(false);
                        setCompressionProgress(0);
                        setCurrentCompressingFile("");
                        resolve(compressedFile);
                    }, 500);
                };

                mediaRecorder.onerror = () => {
                    clearInterval(progressInterval);
                    setCompressing(false);
                    setCompressionProgress(0);
                    setCurrentCompressingFile("");
                    resolve(file);
                };

                mediaRecorder.start();
                
                setTimeout(() => {
                    if (mediaRecorder.state === 'recording') {
                        mediaRecorder.stop();
                    }
                }, duration * 1000);

                video.play().catch(() => {
                    mediaRecorder.stop();
                    resolve(file);
                });
            };

            video.onerror = () => {
                setCompressing(false);
                setCompressionProgress(0);
                setCurrentCompressingFile("");
                resolve(file);
            };
        });
    };

    // FAVORITE PART SELECTOR
    const FavoritePartSelector = () => {
        const [previewTime, setPreviewTime] = useState(favoritePartStart);
        
        const handleTimeChange = (e) => {
            const newTime = parseInt(e.target.value);
            setPreviewTime(newTime);
            if (audioRef.current) {
                audioRef.current.currentTime = newTime;
                if (!isPlaying) {
                    audioRef.current.play().then(() => {
                        setTimeout(() => {
                            audioRef.current.pause();
                        }, 2000);
                    });
                }
            }
        };

        const confirmFavoritePart = () => {
            setFavoritePartStart(previewTime);
            setShowFavoriteSelector(false);
            toast.success(`Favorite part set to ${Math.floor(previewTime / 60)}:${(previewTime % 60).toString().padStart(2, '0')}`);
            
            if (selectedMusic) {
                setTimeout(() => {
                    playSongPreview(selectedMusic);
                }, 100);
            }
        };

        return (
            <div className="fixed inset-0 z-[1002] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-[#1a1a1a] rounded-xl p-5 max-w-md w-full border border-[#333] shadow-2xl">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-4 bg-gradient-to-b from-[#c32aa3] to-[#f46f30] rounded-sm"></div>
                            <h3 className="text-lg font-semibold text-white">Select Favorite Part</h3>
                        </div>
                        <button 
                            onClick={() => setShowFavoriteSelector(false)}
                            className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-[#333] transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    
                    <div className="mb-6">
                        <div className="flex justify-between text-xs text-gray-400 mb-2 px-1">
                            <span>0:00</span>
                            <span>{selectedDuration}s</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max={selectedDuration}
                            value={previewTime}
                            onChange={handleTimeChange}
                            className="w-full h-1.5 bg-[#333] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r from-[#c32aa3] to-[#f46f30]"
                        />
                        <div className="text-center mt-3">
                            <span className="text-white font-semibold text-lg">
                                {Math.floor(previewTime / 60)}:{(previewTime % 60).toString().padStart(2, '0')}
                            </span>
                            <span className="text-gray-400 text-sm ml-2 block">• Previewing 2 seconds</span>
                        </div>
                    </div>

                    <div className="flex gap-2 pt-3 border-t border-[#333]">
                        <button
                            onClick={() => setShowFavoriteSelector(false)}
                            className="flex-1 py-3 bg-[#333] hover:bg-[#444] rounded-lg transition text-gray-300 font-medium text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={confirmFavoritePart}
                            className="flex-1 py-3 bg-gradient-to-r from-[#c32aa3] to-[#f46f30] hover:opacity-90 rounded-lg transition text-white font-semibold text-sm"
                        >
                            Set Favorite Part
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // CARD STYLES
    const getCardStyleClasses = () => {
        const sizeClasses = {
            small: "p-2 min-w-[160px]",
            medium: "p-3 min-w-[200px]", 
            large: "p-4 min-w-[240px]"
        };

        const styleClasses = {
            default: "bg-black/80 backdrop-blur-lg border border-white/20",
            minimal: "bg-black/60 backdrop-blur-md border border-white/10",
            classic: "bg-gradient-to-br from-purple-900/70 to-pink-900/70 backdrop-blur-lg border border-purple-300/30",
            modern: "bg-gradient-to-br from-blue-900/70 to-cyan-900/70 backdrop-blur-lg border border-cyan-300/30"
        };

        return `${sizeClasses[cardSize]} ${styleClasses[cardStyle]} rounded-2xl`;
    };

    // AUDIO PLAYBACK WITH FAVORITE PART
    const playSongPreview = async (song) => {
        console.log('🎵 Playing story music from:', favoritePartStart + 's');
        
        stopSongPreview();

        if (!song?.downloadUrl) {
            toast.error('No preview available for this song');
            return;
        }

        setPlayingSong(song);

        try {
            const audio = audioRef.current;
            
            audio.pause();
            audio.currentTime = favoritePartStart;
            audio.volume = 0.5;
            audio.crossOrigin = 'anonymous';
            audio.src = song.downloadUrl;
            
            audio.onerror = null;
            audio.oncanplaythrough = null;
            audio.ontimeupdate = null;

            audio.onerror = (e) => {
                console.error('🎵 Audio error:', e);
            };

            audio.oncanplaythrough = async () => {
                console.log('🎵 Audio ready, playing from favorite part...');
                try {
                    await audio.play();
                    console.log('🎵 Story music playback started');
                    
                    setIsPlaying(true);
                    
                    progressIntervalRef.current = setInterval(() => {
                        const currentTime = audio.currentTime - favoritePartStart;
                        if (audio.ended || currentTime >= selectedDuration) {
                            audio.currentTime = favoritePartStart;
                            audio.play();
                            setAudioProgress(0);
                            setCurrentLyric(getLyricsForTime(favoritePartStart));
                        } else {
                            const progress = (currentTime / selectedDuration) * 100;
                            setAudioProgress(progress);
                            if (showLyrics) {
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
        console.log('🔇 Stopping song preview...');
        
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current.src = '';
        }
        
        setIsPlaying(false);
        setPlayingSong(null);
        setAudioProgress(0);
        setCurrentLyric("");
        
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }
    };

    // Simulate lyrics
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

    // Toggle play/pause
    const togglePlayPause = () => {
        if (!selectedMusic) return;
        
        if (isPlaying) {
            stopSongPreview();
        } else {
            playSongPreview(selectedMusic);
        }
    };

    // Camera functions
    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user' 
                } 
            })
            streamRef.current = stream
            if (videoRef.current) {
                videoRef.current.srcObject = stream
            }
            setMode("camera")
        } catch (error) {
            console.error('Camera error:', error)
            toast.error('Cannot access camera. Please check permissions.')
        }
    }

    const stopCamera = () => {
        console.log('📷 Stopping camera...');
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => {
                track.stop();
                track.enabled = false;
            });
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    }

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current
            const canvas = canvasRef.current
            const context = canvas.getContext('2d')
            
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            context.drawImage(video, 0, 0, canvas.width, canvas.height)
            
            canvas.toBlob((blob) => {
                const file = new File([blob], `camera-capture-${Date.now()}.jpg`, { type: 'image/jpeg' })
                setMedia(file)
                setPreviewUrl(URL.createObjectURL(file))
                setMode("media")
                stopCamera()
            }, 'image/jpeg', 0.9)
        }
    }

    const handleMediaUpload = async (e) => {
        const file = e.target.files?.[0]
        if(!file) return;

        if(file.type.startsWith("video")){
            if(file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024){
                toast.error(`Video file size cannot exceed ${MAX_VIDEO_SIZE_MB}MB.`)
                setMedia(null)
                setPreviewUrl(null)
                return;
            }
            
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = async ()=>{
                window.URL.revokeObjectURL(video.src)
                if(video.duration > MAX_VIDEO_DURATION){
                    toast.error("Video duration cannot exceed 1 minute.")
                    setMedia(null)
                    setPreviewUrl(null)
                }else{
                    // Start compression for videos larger than 5MB
                    if (file.size > 5 * 1024 * 1024) {
                        setCompressing(true);
                        setCompressionProgress(0);
                        setCurrentCompressingFile(file.name);
                        
                        try {
                            const compressedFile = await compressVideo(file);
                            setMedia(compressedFile);
                            setPreviewUrl(URL.createObjectURL(compressedFile));
                        } catch (error) {
                            console.error('Compression failed:', error);
                            setMedia(file);
                            setPreviewUrl(URL.createObjectURL(file));
                        }
                    } else {
                        setMedia(file);
                        setPreviewUrl(URL.createObjectURL(file));
                    }
                    setText('')
                    setMode("media")
                }
            }
            video.src = URL.createObjectURL(file)
        }else if(file.type.startsWith("image")){
            setMedia(file)
            setPreviewUrl(URL.createObjectURL(file))
            setText('')
            setMode("media")
        }
    }

    // Helper functions
    const getArtistName = (song) => {
        if (!song) return 'Unknown Artist';
        
        if (song.artists && typeof song.artists === 'object') {
            if (song.artists.primary && Array.isArray(song.artists.primary)) {
                const primaryArtists = song.artists.primary.map(artist => artist.name || artist.id).join(', ');
                if (primaryArtists) return primaryArtists;
            }
            
            if (song.artists.all && Array.isArray(song.artists.all)) {
                const allArtists = song.artists.all.map(artist => artist.name || artist.id).join(', ');
                if (allArtists) return allArtists;
            }
            
            if (song.artists.featured && Array.isArray(song.artists.featured)) {
                const featuredArtists = song.artists.featured.map(artist => artist.name || artist.id).join(', ');
                if (featuredArtists) return featuredArtists;
            }
        }
        
        if (typeof song.primaryArtists === 'string') {
            return song.primaryArtists;
        }
        
        return song.artist || song.singers || 'Unknown Artist';
    }

    const getSongName = (song) => {
        if (!song) return 'Unknown Song';
        return song.name || song.title || 'Unknown Song';
    }

    const getBestImage = (song) => {
        if (!song) return 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop';
        
        if (song.image && Array.isArray(song.image)) {
            return song.image[2]?.url || song.image[1]?.url || song.image[0]?.url;
        }
        if (song.image) return song.image;
        if (song.thumbnail) return song.thumbnail;
        
        return 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop';
    }

    const getBestDownloadUrl = (song) => {
        if (!song) return null;
        
        if (song.downloadUrl) {
            if (Array.isArray(song.downloadUrl)) {
                return song.downloadUrl[4]?.url || song.downloadUrl[3]?.url || song.downloadUrl[0]?.url;
            }
            return song.downloadUrl;
        }
        if (song.media_url) {
            return song.media_url;
        }
        if (song.encrypted_media_url) {
            return song.encrypted_media_url;
        }
        if (song.url) {
            return song.url;
        }
        
        return null;
    }

    // Music search functions
    const searchMusic = async (query) => {
        if (!query.trim()) {
            setSearchResults([])
            return;
        }
        
        setSearchLoading(true)
        try {
            const token = await getToken()
            const response = await api.get(`/api/music/search/${encodeURIComponent(query)}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            
            if (response.data.success) {
                let songs = [];
                
                if (response.data.data && response.data.data.results) {
                    songs = response.data.data.results;
                } else if (response.data.songs) {
                    songs = response.data.songs;
                } else if (Array.isArray(response.data)) {
                    songs = response.data;
                }
                
                const safeSongs = songs.map(song => ({
                    id: song.id || `song_${Date.now()}_${Math.random()}`,
                    name: getSongName(song),
                    artists: song.artists,
                    primaryArtists: getArtistName(song),
                    image: getBestImage(song),
                    duration: song.duration || '3:00',
                    downloadUrl: getBestDownloadUrl(song),
                    language: song.language || 'hindi',
                    album: song.album
                }));
                
                setSearchResults(safeSongs);
            } else {
                throw new Error(response.data.error || 'Search failed');
            }
        } catch (error) {
            console.error('🎵 Music search error:', error);
            toast.error('Failed to search music');
            setSearchResults([]);
        } finally {
            setSearchLoading(false);
        }
    }

    const handleMusicSelect = (song) => {
        stopSongPreview();
        
        const safeSong = {
            id: song.id,
            name: song.name,
            primaryArtists: song.primaryArtists,
            image: song.image,
            duration: song.duration,
            downloadUrl: song.downloadUrl
        }
        setSelectedMusic(safeSong);
        setShowMusicSearch(false);
        setMusicSearchQuery("");
        setSearchResults([]);
        setFavoritePartStart(0);
        toast.success(`"${safeSong.name}" added to your story`);
        
        if ((mode === 'media' || mode === 'camera') && previewUrl) {
            setTimeout(() => {
                playSongPreview(safeSong);
            }, 300);
        }
    }

    const handleRemoveMusic = () => {
        stopSongPreview();
        setSelectedMusic(null);
        setShowLyrics(false);
        setCurrentLyric("");
        setFavoritePartStart(0);
        toast.success('Music removed from story');
    }

    const handleCreateStory = async () => {
        setLoading(true);
        
        // STOP MUSIC BEFORE UPLOADING
        stopSongPreview();
        
        const media_type = mode === 'media' || mode === 'camera'
            ? media?.type.startsWith('image') ? 'image' : "video" 
            : "text";

        if(media_type === "text" && !text.trim()){
            throw new Error("Please enter some text")
        }
        if((media_type === "image" || media_type === "video") && !media){
            throw new Error("Please select media")
        }

        const formData = new FormData();
        formData.append('content', text.trim()); 
        formData.append('media_type', media_type);
        formData.append('background_color', background);
        formData.append('music_duration', selectedDuration.toString());
        formData.append('music_position', JSON.stringify(musicPosition));
        formData.append('show_lyrics', showLyrics.toString());
        formData.append('hide_watermark', hideWatermark.toString());
        formData.append('favorite_part_start', favoritePartStart.toString());
        formData.append('card_size', cardSize);
        formData.append('card_style', cardStyle);
        
        if (selectedMusic) {
            formData.append('music_data', JSON.stringify({
                id: selectedMusic.id,
                name: selectedMusic.name,
                artist: selectedMusic.primaryArtists,
                image: selectedMusic.image,
                duration: selectedMusic.duration,
                downloadUrl: selectedMusic.downloadUrl,
                clipDuration: selectedDuration,
                favoritePartStart: favoritePartStart
            }))
        }
        
        if(media) {
            formData.append('media', media);
        }

        const token = await getToken();
        try {
            const { data } = await api.post('/api/story/create', formData, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                }
            })

            if (data.success){
                // Cleanup before closing
                cleanupAll();
                setShowModal(false)
                toast.success("Story created successfully! 🎉")
                fetchStories()
            }else{
                throw new Error(data.message || "Failed to create story.")
            }
        } catch (error) {
            console.error('❌ Story creation error:', error);
            
            let errorMessage = error.message || "An unexpected error occurred.";
            if (error.response?.data?.message) {
                errorMessage = error.response.data.message;
            }
            
            throw new Error(errorMessage);
        } finally {
            setLoading(false);
        }
    }

    const resetState = (newMode) => {
        stopSongPreview();
        
        setMode(newMode);
        setText('');
        setMedia(null);
        setPreviewUrl(null);
        setSelectedMusic(null);
        setBackground(bgColors[0]);
        setShowMusicSearch(false);
        setMusicSearchQuery("");
        setSearchResults([]);
        setSelectedDuration(15);
        setShowLyrics(false);
        setCurrentLyric("");
        setMusicPosition({ x: 50, y: 20 });
        setFavoritePartStart(0);
        setCardSize("medium");
        setCardStyle("default");
        setCompressing(false);
        setCompressionProgress(0);
        setCurrentCompressingFile("");
        
        if (newMode !== "camera" && streamRef.current) {
            stopCamera();
        }
    }

    const isFormValid = () => {
        if (mode === 'text') {
            return text.trim().length > 0;
        } else if (mode === 'media' || mode === 'camera') {
            return !!media;
        }
        return false;
    }

    // Load trending songs
    const loadTrendingSongs = async () => {
        try {
            const token = await getToken();
            const { data } = await api.get('/api/music/trending', {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (data.success) {
                const safeSongs = (data.songs || []).map(song => ({
                    id: song.id,
                    name: getSongName(song),
                    artists: song.artists,
                    primaryArtists: getArtistName(song),
                    image: getBestImage(song),
                    duration: song.duration || '3:00',
                    downloadUrl: getBestDownloadUrl(song),
                    language: song.language || 'hindi'
                }));
                setTrendingSongs(safeSongs);
            }
        } catch (error) {
            console.error('Failed to load trending songs:', error);
            setTrendingSongs([]);
        }
    }

    return (
        <>
            {/* Main Modal */}
            <div 
                className='fixed inset-0 z-[1000] h-[100dvh] bg-black/90 flex items-center justify-center p-4'
                onClick={(e) => {
                    if (e.target === e.currentTarget) {
                        handleCloseModal();
                    }
                }}
            >
                <div className='w-full max-w-sm bg-[#1a1a1a] rounded-xl shadow-2xl p-5 border border-[#333]'>
                    
                    {/* Header */}
                    <div className='flex items-center justify-center pb-4 mb-4 relative border-b border-[#333]'>
                        <div className="absolute top-0 w-full h-0.5 bg-gradient-to-r from-[#c32aa3] via-[#f46f30] to-[#ffd600]"></div>
                        <h2 className='text-lg font-semibold text-white'>Create Story</h2>
                        <button 
                            onClick={handleCloseModal} 
                            className='absolute right-0 text-gray-400 hover:text-white p-1 rounded-full hover:bg-[#333] transition-colors'
                        >
                            <X className='w-5 h-5'/>
                        </button>
                    </div>

                    {/* Compression Progress Bar */}
                    {compressing && (
                        <div className="mb-4 p-3 bg-[#222] rounded-lg border border-[#333]">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-sm font-medium text-white">Compressing Video</span>
                                <span className="text-sm text-gray-400">{compressionProgress}%</span>
                            </div>
                            <div className="w-full bg-[#333] rounded-full h-1.5">
                                <div 
                                    className="bg-gradient-to-r from-[#c32aa3] to-[#f46f30] h-1.5 rounded-full transition-all duration-300"
                                    style={{ width: `${compressionProgress}%` }}
                                />
                            </div>
                            <p className="text-xs text-gray-400 mt-1.5 truncate">
                                {currentCompressingFile}
                            </p>
                        </div>
                    )}

                    {/* Story Preview Area */}
                    <div 
                        ref={containerRef}
                        data-story-preview
                        className='w-full aspect-[9/16] rounded-lg flex items-center justify-center relative overflow-hidden bg-[#000] mb-4' 
                        style={{backgroundColor: background}}
                    >
                        {/* Camera Mode */}
                        {mode === 'camera' && (
                            <div className='w-full h-full relative'>
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className='w-full h-full object-cover'
                                />
                                <canvas ref={canvasRef} className='hidden' />
                                <button
                                    onClick={capturePhoto}
                                    className='absolute bottom-5 left-1/2 transform -translate-x-1/2 w-16 h-16 bg-white rounded-full border-4 border-[#1a1a1a] shadow-lg hover:scale-110 transition-transform active:scale-95'
                                />
                            </div>
                        )}
                        
                        {/* Text Mode */}
                        {mode === 'text' && (
                            <textarea 
                                className='bg-transparent text-white w-full h-full p-5 text-2xl sm:text-3xl font-semibold text-center resize-none focus:outline-none placeholder-gray-400/70 leading-snug' 
                                placeholder="Type something amazing..." 
                                onChange={(e)=>setText(e.target.value)} 
                                value={text}
                                maxLength={150}
                            />
                        )}
                        
                        {/* Media Mode */}
                        {
                            (mode === 'media' || mode === 'camera') && previewUrl && (
                                <>
                                    {media?.type.startsWith('image') ? (
                                        <img src={previewUrl} alt="Media Preview" className='object-cover w-full h-full'/>
                                    ) : (
                                        <video src={previewUrl} className='object-cover w-full h-full' autoPlay muted loop/>
                                    )}
                                    
                                    {/* DRAGGABLE MUSIC STICKER */}
                                    {selectedMusic && (
                                        <div 
                                            ref={musicStickerRef}
                                            className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ${
                                                isDragging 
                                                    ? 'cursor-grabbing scale-105 z-50 shadow-2xl' 
                                                    : 'cursor-grab scale-100 z-40'
                                            }`}
                                            style={{
                                                left: `${musicPosition.x}%`,
                                                top: `${musicPosition.y}%`,
                                                touchAction: 'none'
                                            }}
                                            onMouseDown={startDragging}
                                            onTouchStart={startDragging}
                                        >
                                            <div className={`${getCardStyleClasses()} transition-all duration-200 ${
                                                isDragging ? 'border-[#c32aa3] shadow-lg' : ''
                                            }`}>
                                                {/* Drag Handle */}
                                                <div className='flex items-center justify-between mb-2'>
                                                    <div className='flex items-center gap-1 flex-1'>
                                                        <GripHorizontal className={`w-3 h-3 ${isDragging ? 'text-[#c32aa3]' : 'text-gray-400'}`} />
                                                        <span className={`text-xs ${isDragging ? 'text-[#c32aa3]' : 'text-gray-400'}`}>
                                                            {isDragging ? 'Dragging...' : 'Drag to move'}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setShowMusicOptions(!showMusicOptions);
                                                        }}
                                                        className='text-gray-300 hover:text-white p-0.5 transition'
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                                            <circle cx="12" cy="12" r="1.5"/>
                                                            <circle cx="12" cy="5" r="1.5"/>
                                                            <circle cx="12" cy="19" r="1.5"/>
                                                        </svg>
                                                    </button>
                                                </div>

                                                <div className='flex items-center gap-2'>
                                                    {/* Album Art with Play/Pause Button */}
                                                    <div className='relative flex-shrink-0'>
                                                        <img 
                                                            src={selectedMusic.image} 
                                                            alt={selectedMusic.name}
                                                            className={`${
                                                                cardSize === 'small' ? 'w-8 h-8' :
                                                                cardSize === 'medium' ? 'w-10 h-10' :
                                                                'w-12 h-12'
                                                            } rounded-lg object-cover`}
                                                        />
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                togglePlayPause();
                                                            }}
                                                            className='absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg transition-all duration-200 hover:bg-black/60'
                                                        >
                                                            {isPlaying ? (
                                                                <Pause size={cardSize === 'small' ? 10 : 12} className='text-white' />
                                                            ) : (
                                                                <Play size={cardSize === 'small' ? 10 : 12} className='text-white ml-0.5' />
                                                            )}
                                                        </button>
                                                    </div>
                                                    
                                                    {/* Song Info */}
                                                    <div className='flex-1 min-w-0'>
                                                        <p className={`${
                                                            cardSize === 'small' ? 'text-xs' :
                                                            cardSize === 'medium' ? 'text-sm' :
                                                            'text-sm'
                                                        } font-medium text-white truncate`}>
                                                            {selectedMusic.name}
                                                        </p>
                                                        <p className={`${
                                                            cardSize === 'small' ? 'text-xs' :
                                                            'text-xs'
                                                        } text-gray-300 truncate`}>
                                                            {selectedMusic.primaryArtists}
                                                        </p>
                                                        {cardSize === 'large' && (
                                                            <p className="text-xs text-[#c32aa3] mt-0.5">
                                                                Favorite part: {Math.floor(favoritePartStart / 60)}:{(favoritePartStart % 60).toString().padStart(2, '0')}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                {/* Progress Bar */}
                                                {isPlaying && (
                                                    <div className='mt-1.5'>
                                                        <div className='h-0.5 bg-white/30 rounded-full overflow-hidden'>
                                                            <div 
                                                                className='h-full bg-gradient-to-r from-[#c32aa3] to-[#f46f30] rounded-full transition-all duration-100'
                                                                style={{ width: `${audioProgress}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Lyrics Display */}
                                                {showLyrics && currentLyric && (
                                                    <div className='mt-1.5 p-1.5 bg-black/60 rounded-lg'>
                                                        <p className='text-xs text-white text-center font-medium'>
                                                            {currentLyric}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Music Options Dropdown */}
                                                {showMusicOptions && (
                                                    <div className='absolute top-full left-0 right-0 mt-1.5 bg-[#1a1a1a] backdrop-blur-lg rounded-lg p-2 border border-white/20 shadow-2xl z-50'>
                                                        <div className='space-y-1'>
                                                            {/* Favorite Part Selection */}
                                                            <button
                                                                onClick={() => {
                                                                    setShowFavoriteSelector(true);
                                                                    setShowMusicOptions(false);
                                                                }}
                                                                className='w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-[#333] transition text-xs font-medium'
                                                            >
                                                                <Heart className='w-3.5 h-3.5' />
                                                                Select Favorite Part
                                                            </button>
                                                            
                                                            {/* Lyrics Toggle */}
                                                            <button
                                                                onClick={() => {
                                                                    setShowLyrics(!showLyrics);
                                                                    setShowMusicOptions(false);
                                                                }}
                                                                className='w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-[#333] transition text-xs font-medium'
                                                            >
                                                                <AlignLeft className='w-3.5 h-3.5' />
                                                                {showLyrics ? 'Hide Lyrics' : 'Show Lyrics'}
                                                            </button>
                                                            
                                                            {/* Card Size Options */}
                                                            <div className="border-t border-white/10 pt-1">
                                                                <p className="text-xs text-gray-400 px-2 py-1">Card Size</p>
                                                                <div className="flex gap-1 px-1">
                                                                    {['small', 'medium', 'large'].map((size) => (
                                                                        <button
                                                                            key={size}
                                                                            onClick={() => setCardSize(size)}
                                                                            className={`flex-1 py-1 rounded text-xs ${
                                                                                cardSize === size
                                                                                    ? 'bg-gradient-to-r from-[#c32aa3] to-[#f46f30] text-white'
                                                                                    : 'bg-[#333] text-gray-300 hover:bg-[#444]'
                                                                            }`}
                                                                        >
                                                                            {size === 'small' ? 'S' : size === 'medium' ? 'M' : 'L'}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            
                                                            {/* Card Style Options */}
                                                            <div className="border-t border-white/10 pt-1">
                                                                <p className="text-xs text-gray-400 px-2 py-1">Style</p>
                                                                <div className="grid grid-cols-2 gap-1 px-1">
                                                                    {[
                                                                        { id: 'default', name: 'Default' },
                                                                        { id: 'minimal', name: 'Minimal' },
                                                                        { id: 'classic', name: 'Classic' },
                                                                        { id: 'modern', name: 'Modern' }
                                                                    ].map((style) => (
                                                                        <button
                                                                            key={style.id}
                                                                            onClick={() => setCardStyle(style.id)}
                                                                            className={`py-1 rounded text-xs ${
                                                                                cardStyle === style.id
                                                                                    ? 'bg-gradient-to-r from-[#c32aa3] to-[#f46f30] text-white'
                                                                                    : 'bg-[#333] text-gray-300 hover:bg-[#444]'
                                                                            }`}
                                                                        >
                                                                            {style.name}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            
                                                            {/* Watermark Toggle */}
                                                            <button
                                                                onClick={() => {
                                                                    setHideWatermark(!hideWatermark);
                                                                    setShowMusicOptions(false);
                                                                    toast.success(hideWatermark ? 'Watermark shown' : 'Watermark hidden');
                                                                }}
                                                                className='w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-[#333] transition text-xs font-medium'
                                                            >
                                                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                                                    <path d="M18 10.48l4-3.98v11l-4-3.98V18c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2h12c1.1 0 2 .9 2 2v4.48z"/>
                                                                </svg>
                                                                {hideWatermark ? 'Show Watermark' : 'Hide Watermark'}
                                                            </button>
                                                            
                                                            {/* Remove Music */}
                                                            <button
                                                                onClick={() => {
                                                                    handleRemoveMusic();
                                                                    setShowMusicOptions(false);
                                                                }}
                                                                className='w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-red-500/20 text-red-400 transition text-xs font-medium'
                                                            >
                                                                <X className='w-3.5 h-3.5' />
                                                                Remove Music
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Text overlay */}
                                    {text && (
                                        <div className='absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent'>
                                            <p className='text-sm font-medium text-white text-center'>{text}</p>
                                        </div>
                                    )}

                                    {/* Hidden Watermark */}
                                    {!hideWatermark && (
                                        <div className='absolute bottom-2 right-2'>
                                            <div className='bg-black/60 px-2 py-1 rounded text-xs text-white/90'>
                                                PixoStory
                                            </div>
                                        </div>
                                    )}
                                </>
                            )
                        }

                        {mode === 'media' && !previewUrl && (
                            <label className='flex flex-col items-center justify-center w-full h-full bg-[#222] hover:bg-[#2a2a2a] transition-all duration-300 cursor-pointer p-6 text-gray-300 border-2 border-dashed border-[#444] rounded-lg'>
                                <Upload className='w-10 h-10 mb-2.5 text-gray-400'/>
                                <span className='font-medium text-center text-white text-sm'>Select Photo or Video</span>
                                <span className='text-xs mt-1.5 text-gray-400 text-center'>Max 1 min video, 50MB file size</span>
                                <input 
                                    onChange={handleMediaUpload} 
                                    type="file" 
                                    accept='image/*, video/*' 
                                    className='hidden'
                                />
                            </label>
                        )}
                    </div>

                    {mode === 'text' && (
                        <div className='flex justify-center mt-3 gap-1.5 mb-4'>
                            {bgColors.map((color)=>(
                                <button 
                                    key={color} 
                                    className={`w-6 h-6 rounded-full transition-all duration-200 ${background === color ? 'ring-2 ring-white scale-110' : 'hover:scale-105'}`} 
                                    style={{backgroundColor: color}} 
                                    onClick={()=> setBackground(color)}
                                />
                            ))}
                        </div>
                    )}
                    
                    {(mode === 'media' || mode === 'camera') && previewUrl && (
                        <div className='mt-3 mb-3'>
                            <input
                                type="text"
                                placeholder="Add text to your story..."
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                className='w-full p-3 bg-[#222] rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#c32aa3] border border-[#444] transition-all duration-200 text-sm'
                                maxLength={100}
                            />
                        </div>
                    )}

                    {/* Music Duration Selection */}
                    {selectedMusic && (
                        <div className='mt-3 mb-3'>
                            <p className='text-xs text-gray-400 mb-1.5'>Music Duration:</p>
                            <div className='flex gap-2'>
                                {[15, 30, 60].map((duration) => (
                                    <button
                                        key={duration}
                                        onClick={() => {
                                            setSelectedDuration(duration);
                                            if (isPlaying && selectedMusic) {
                                                setTimeout(() => {
                                                    playSongPreview(selectedMusic);
                                                }, 100);
                                            }
                                        }}
                                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 border ${
                                            selectedDuration === duration
                                                ? 'bg-gradient-to-r from-[#c32aa3] to-[#f46f30] text-white border-transparent'
                                                : 'bg-[#222] text-gray-300 hover:bg-[#333] border-[#444]'
                                        }`}
                                    >
                                        {duration}s
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className={`flex gap-2 mt-4 ${(mode === 'media' || mode === 'camera') && previewUrl ? 'flex-col' : 'flex-row'}`}>
                        
                        {(mode === 'media' || mode === 'camera') && previewUrl && (
                            <div className='flex gap-2'>
                                <button 
                                    onClick={() => resetState("media")} 
                                    className='flex-1 flex items-center justify-center gap-1.5 p-2.5 rounded-lg bg-[#222] text-white hover:bg-[#333] transition-all duration-200 border border-[#444] text-sm font-medium'
                                >
                                    <ArrowLeft size={16}/> Change Media
                                </button>
                                
                                <button
                                    onClick={() => setShowMusicSearch(true)}
                                    className={`flex items-center justify-center gap-1.5 p-2.5 rounded-lg transition-all duration-200 border ${
                                        selectedMusic 
                                            ? 'bg-gradient-to-r from-[#c32aa3] to-[#f46f30] text-white border-transparent' 
                                            : 'bg-[#222] text-white hover:bg-[#333] border-[#444]'
                                    }`}
                                >
                                    <Music size={16}/>
                                </button>
                            </div>
                        )}

                        {!previewUrl && (
                            <>
                                <button 
                                    onClick={() => resetState("text")} 
                                    className={`flex-1 flex items-center justify-center gap-1.5 p-2.5 rounded-lg font-medium transition-all duration-200 border ${
                                        mode === "text" 
                                            ? "bg-gradient-to-r from-[#c32aa3] to-[#f46f30] text-white border-transparent" 
                                            : "bg-[#222] text-gray-300 hover:bg-[#333] border-[#444]"
                                    }`}
                                >
                                    <TextIcon size={16}/> Text
                                </button>
                                
                                <button 
                                    onClick={startCamera}
                                    className={`flex-1 flex items-center justify-center gap-1.5 p-2.5 rounded-lg font-medium transition-all duration-200 border ${
                                        mode === "camera" 
                                            ? "bg-gradient-to-r from-[#c32aa3] to-[#f46f30] text-white border-transparent" 
                                            : "bg-[#222] text-gray-300 hover:bg-[#333] border-[#444]"
                                    }`}
                                >
                                    <Camera size={16}/> Camera
                                </button>
                                
                                <label className={`flex-1 flex items-center justify-center gap-1.5 p-2.5 rounded-lg font-medium transition-all duration-200 border ${
                                    mode === "media" && !previewUrl 
                                        ? "bg-gradient-to-r from-[#c32aa3] to-[#f46f30] text-white border-transparent" 
                                        : "bg-[#222] text-gray-300 hover:bg-[#333] border-[#444]"
                                }`}>
                                    <input 
                                        onChange={handleMediaUpload} 
                                        type="file" 
                                        accept='image/*, video/*' 
                                        className='hidden'
                                    />
                                    <Upload size={16}/> Upload
                                </label>
                            </>
                        )}
                    </div>
                    
                    <button 
                        onClick={()=> toast.promise(handleCreateStory(), {
                            loading: 'Creating story...',
                            success: 'Story created!',
                            error: (err) => err.message || 'Failed to create story.',
                        })} 
                        disabled={loading || !isFormValid() || compressing}
                        className='flex items-center justify-center gap-1.5 text-white py-3 mt-3 w-full rounded-lg bg-gradient-to-r from-[#c32aa3] to-[#f46f30] hover:opacity-90 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] font-semibold text-sm shadow-lg'
                    >
                        {loading ? 'Creating...' : compressing ? 'Compressing...' : (
                            <>
                                <Sparkle size={16} className='text-white'/> 
                                Share Story
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Music Search Modal */}
            {showMusicSearch && (
                <div className='fixed inset-0 z-[1001] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4'>
                    <div className='w-full max-w-md bg-[#1a1a1a] rounded-xl p-0 max-h-[80vh] overflow-hidden flex flex-col border border-[#333] shadow-2xl'>
                        {/* Header */}
                        <div className='flex items-center justify-between p-3.5 border-b border-[#333]'>
                            <div className='flex items-center gap-2'>
                                <button 
                                    onClick={() => {
                                        stopSongPreview();
                                        setShowMusicSearch(false);
                                        setMusicSearchQuery("");
                                        setSearchResults([]);
                                    }}
                                    className='text-white p-1 hover:bg-[#333] rounded-full transition-colors'
                                >
                                    <ArrowLeft size={18}/>
                                </button>
                                <h3 className='text-base font-semibold text-white'>Add Music</h3>
                            </div>
                        </div>
                        
                        {/* Search Bar */}
                        <div className='p-3.5 border-b border-[#333]'>
                            <div className='relative'>
                                <input
                                    type="text"
                                    placeholder="Search for songs..."
                                    value={musicSearchQuery}
                                    onChange={(e) => {
                                        setMusicSearchQuery(e.target.value)
                                        if (e.target.value.length > 2) {
                                            const timeoutId = setTimeout(() => {
                                                searchMusic(e.target.value)
                                            }, 500)
                                            return () => clearTimeout(timeoutId)
                                        } else {
                                            setSearchResults([])
                                        }
                                    }}
                                    className='w-full p-3 bg-[#222] rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#c32aa3] border border-[#444] transition-all duration-200 text-sm'
                                    autoFocus
                                />
                                <Music className='absolute right-3 top-3 text-gray-400' size={18}/>
                            </div>
                        </div>

                        {/* Content */}
                        <div className='flex-1 overflow-y-auto'>
                            {searchLoading ? (
                                <div className='text-center py-8'>
                                    <div className='animate-spin rounded-full h-7 w-7 border-b-2 border-[#c32aa3] mx-auto'></div>
                                    <p className='text-gray-400 mt-2 text-sm'>Searching songs...</p>
                                </div>
                            ) : searchResults.length > 0 ? (
                                <div className='p-2'>
                                    {searchResults.map((song) => (
                                        <div
                                            key={song.id}
                                            className={`flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all duration-200 ${
                                                selectedMusic?.id === song.id 
                                                    ? 'bg-gradient-to-r from-[#c32aa3]/10 to-[#f46f30]/10' 
                                                    : 'hover:bg-[#222]'
                                            }`}
                                            onClick={() => handleMusicSelect(song)}
                                        >
                                            <div className='relative flex-shrink-0'>
                                                <img 
                                                    src={song.image} 
                                                    alt={song.name}
                                                    className='w-11 h-11 rounded-lg object-cover'
                                                />
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        playSongPreview(song);
                                                    }}
                                                    className='absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg opacity-0 hover:opacity-100 transition-opacity duration-200'
                                                >
                                                    {playingSong?.id === song.id && isPlaying ? (
                                                        <Pause size={14} className='text-white' />
                                                    ) : (
                                                        <Play size={14} className='text-white ml-0.5' />
                                                    )}
                                                </button>
                                            </div>
                                            
                                            <div className='flex-1 min-w-0'>
                                                <p className='font-medium truncate text-white text-sm'>{song.name}</p>
                                                <p className='text-xs text-gray-300 truncate'>{song.primaryArtists}</p>
                                                <p className='text-xs text-gray-400'>{song.duration}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : musicSearchQuery.length > 2 ? (
                                <div className='text-center py-8 text-gray-400'>
                                    <Music size={40} className='mx-auto mb-3 opacity-50' />
                                    <p className='text-sm'>No songs found for "{musicSearchQuery}"</p>
                                    <p className='text-xs mt-1'>Try different keywords</p>
                                </div>
                            ) : (
                                <div className='p-3'>
                                    <h4 className='text-xs font-semibold text-gray-400 mb-2 px-2'>Trending Now</h4>
                                    <div className='space-y-1.5'>
                                        {trendingSongs.map((song) => (
                                            <div
                                                key={song.id}
                                                className={`flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all duration-200 ${
                                                    selectedMusic?.id === song.id 
                                                        ? 'bg-gradient-to-r from-[#c32aa3]/10 to-[#f46f30]/10' 
                                                        : 'hover:bg-[#222]'
                                                }`}
                                                onClick={() => handleMusicSelect(song)}
                                            >
                                                <div className='relative flex-shrink-0'>
                                                    <img 
                                                        src={song.image} 
                                                        alt={song.name}
                                                        className='w-11 h-11 rounded-lg object-cover'
                                                    />
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            playSongPreview(song);
                                                        }}
                                                        className='absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg opacity-0 hover:opacity-100 transition-opacity duration-200'
                                                    >
                                                        {playingSong?.id === song.id && isPlaying ? (
                                                            <Pause size={14} className='text-white' />
                                                        ) : (
                                                            <Play size={14} className='text-white ml-0.5' />
                                                        )}
                                                    </button>
                                                </div>
                                                <div className='flex-1 min-w-0'>
                                                    <p className='font-medium truncate text-white text-sm'>{song.name}</p>
                                                    <p className='text-xs text-gray-300 truncate'>{song.primaryArtists}</p>
                                                    <p className='text-xs text-gray-400'>{song.duration}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Favorite Part Selector Modal */}
            {showFavoriteSelector && <FavoritePartSelector />}
        </>
    )
}

export default StoryModal