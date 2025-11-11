// pages/pixoMusic.jsx
import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  Heart, 
  Search,
  Loader,
  Music,
  ListMusic,
  Plus,
  Trash2,
  Clock
} from 'lucide-react';
import { useSelector } from 'react-redux';
import ErrorBoundary from '../components/ErrorBoundary';

// Safe component wrapper
function PixoMusicWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <PixoMusic />
    </ErrorBoundary>
  );
}

function PixoMusic() {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [volume, setVolume] = useState(50);
    const [currentSongIndex, setCurrentSongIndex] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [currentSong, setCurrentSong] = useState(null);
    const [playlist, setPlaylist] = useState([]);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('search');
    const [trendingSongs, setTrendingSongs] = useState([]);
    const [likedSongs, setLikedSongs] = useState([]);
    const [userLikedSongs, setUserLikedSongs] = useState([]);
    const [userPlaylistSongs, setUserPlaylistSongs] = useState([]);
    const [playlistSongIds, setPlaylistSongIds] = useState([]);
    
    const audioRef = useRef(new Audio());
    const progressRef = useRef(null);

    // Your backend API base URL
    const BACKEND_API = 'https://social-server-nine.vercel.app/api';
    const user = useSelector((state) => state.user.value);

    // Initialize component
    useEffect(() => {
        console.log('🎵 Component mounted, initializing...');
        loadTrendingSongs();
        if (user?._id) {
            loadLikedSongs();
            loadPlaylistSongs();
        }
    }, [user?._id]);

    // Load user's playlist songs
    const loadPlaylistSongs = async () => {
        if (!user?._id) return;
        
        try {
            console.log('📋 Loading playlist songs for user:', user._id);
            const response = await fetch(`${BACKEND_API}/music-playlist/user/${user._id}`);
            
            console.log('📋 Playlist response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('📋 Playlist response data:', data);
            
            if (data.success) {
                setUserPlaylistSongs(data.playlistSongs);
                const playlistSongIds = data.playlistSongs.map(song => song.songId);
                setPlaylistSongIds(playlistSongIds);
                
                // Also populate the local playlist for playback
                const localPlaylist = data.playlistSongs.map(song => ({
                    id: song.songId,
                    title: song.name,
                    artist: song.primaryArtists,
                    cover: song.image,
                    duration: song.duration,
                    audioUrl: song.downloadUrl
                }));
                setPlaylist(localPlaylist);
                console.log('✅ Loaded playlist songs:', data.playlistSongs.length);
            }
        } catch (err) {
            console.error('❌ Failed to load playlist songs:', err);
            setError('Failed to load playlist: ' + err.message);
        }
    };

    // Load user's liked songs
    const loadLikedSongs = async () => {
        if (!user?._id) return;
        
        try {
            const response = await fetch(`${BACKEND_API}/music-likes/user/${user._id}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                setUserLikedSongs(data.likedSongs);
                const likedSongIds = data.likedSongs.map(song => song.songId);
                setLikedSongs(likedSongIds);
            }
        } catch (err) {
            console.error('❌ Failed to load liked songs:', err);
        }
    };

    // Like/Unlike song
    const toggleLikeSong = async (song) => {
        if (!user?._id) {
            setError('Please login to like songs');
            return;
        }

        try {
            const isCurrentlyLiked = likedSongs.includes(song.id);
            
            if (isCurrentlyLiked) {
                // Unlike song
                const response = await fetch(`${BACKEND_API}/music-likes/unlike`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        userId: user._id,
                        songId: song.id
                    })
                });

                const data = await response.json();
                
                if (data.success) {
                    setLikedSongs(prev => prev.filter(id => id !== song.id));
                    setUserLikedSongs(prev => prev.filter(s => s.songId !== song.id));
                } else {
                    setError(data.error || 'Failed to unlike song');
                }
            } else {
                // Like song
                const response = await fetch(`${BACKEND_API}/music-likes/like`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        userId: user._id,
                        song: song
                    })
                });

                const data = await response.json();
                
                if (data.success) {
                    setLikedSongs(prev => [...prev, song.id]);
                    setUserLikedSongs(prev => [...prev, data.likedSong]);
                } else {
                    setError(data.error || 'Failed to like song');
                }
            }
        } catch (err) {
            console.error('❤️ Like/unlike error:', err);
            setError('Failed to update like');
        }
    };

    // Add song to playlist (with database storage) - UPDATED WITH BETTER ERROR HANDLING
    const addToPlaylist = async (song) => {
        if (!song?.id) {
            setError('Cannot add invalid song to playlist');
            return;
        }

        if (!user?._id) {
            setError('Please login to add songs to playlist');
            return;
        }

        try {
            console.log('📋 Adding song to playlist:', song.name);
            console.log('📋 User ID:', user._id);
            console.log('📋 Request URL:', `${BACKEND_API}/music-playlist/add`);
            
            const response = await fetch(`${BACKEND_API}/music-playlist/add`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: user._id,
                    song: song
                })
            });

            console.log('📋 Response status:', response.status);
            console.log('📋 Response ok:', response.ok);
            
            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            console.log('📋 Content type:', contentType);
            
            if (!response.ok) {
                // Try to get error message from response
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorData.message || errorMessage;
                } catch (e) {
                    // Response is not JSON, use status text
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();
            console.log('📋 Response data:', data);
            
            if (data.success) {
                // Update local state
                setPlaylistSongIds(prev => [...prev, song.id]);
                setUserPlaylistSongs(prev => [...prev, data.playlistSong]);
                
                // Also update the local playlist for immediate playback
                const songToAdd = {
                    id: song.id,
                    title: song.name || 'Unknown Song',
                    artist: song.primaryArtists || 'Unknown Artist',
                    cover: song.image || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
                    duration: song.duration || '3:45',
                    audioUrl: song.downloadUrl
                };
                
                setPlaylist(prev => {
                    const exists = prev.find(s => s.id === songToAdd.id);
                    if (exists) return prev;
                    return [...prev, songToAdd];
                });
                
                console.log('✅ Song added to playlist successfully');
            } else {
                throw new Error(data.error || 'Failed to add song to playlist');
            }
        } catch (err) {
            console.error('📋 Add to playlist error:', err);
            console.error('📋 Error details:', {
                message: err.message,
                stack: err.stack
            });
            setError('Failed to add song to playlist: ' + err.message);
        }
    };

    // Remove song from playlist
    const removeFromPlaylist = async (songId) => {
        if (!user?._id) {
            setError('Please login to remove songs from playlist');
            return;
        }

        try {
            const response = await fetch(`${BACKEND_API}/music-playlist/remove`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: user._id,
                    songId: songId
                })
            });

            const data = await response.json();
            
            if (data.success) {
                // Update local state
                setPlaylistSongIds(prev => prev.filter(id => id !== songId));
                setUserPlaylistSongs(prev => prev.filter(s => s.songId !== songId));
                
                // Also update the local playlist
                setPlaylist(prev => prev.filter(song => song.id !== songId));
            } else {
                setError(data.error || 'Failed to remove song from playlist');
            }
        } catch (err) {
            console.error('📋 Remove from playlist error:', err);
            setError('Failed to remove song from playlist');
        }
    };

    // Helper function to safely extract artist text
    const getArtistText = (artistData) => {
        if (!artistData) return 'Unknown Artist';
        
        if (typeof artistData === 'string') {
            return artistData;
        }
        
        if (typeof artistData === 'object') {
            if (artistData.primary) {
                return artistData.primary;
            } else if (artistData.all) {
                return artistData.all;
            } else if (artistData.featured) {
                return artistData.featured;
            } else {
                const values = Object.values(artistData).filter(val => val && typeof val === 'string');
                return values.length > 0 ? values.join(', ') : 'Various Artists';
            }
        }
        
        return String(artistData);
    };

    // Load trending songs
    const loadTrendingSongs = async () => {
        try {
            setIsLoading(true);
            const response = await fetch(`${BACKEND_API}/music/trending`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.success && Array.isArray(data.songs)) {
                const processedSongs = data.songs.map(song => ({
                    ...song,
                    primaryArtists: getArtistText(song.primaryArtists || song.artists)
                }));
                
                setTrendingSongs(processedSongs);
            } else {
                setTrendingSongs([]);
            }
        } catch (err) {
            console.error('❌ Trending songs error:', err);
            setError('Failed to load trending songs');
            setTrendingSongs([]);
        } finally {
            setIsLoading(false);
        }
    };

    // Search for songs
    const searchSongs = async (query) => {
        if (!query?.trim()) {
            setError('Please enter a search query');
            return;
        }
        
        setIsLoading(true);
        setError('');
        setSearchResults([]);
        
        try {
            const response = await fetch(`${BACKEND_API}/music/search/${encodeURIComponent(query)}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.success && Array.isArray(data.songs)) {
                const validSongs = data.songs.filter(song => 
                    song && song.id && song.name
                ).map(song => ({
                    id: song.id,
                    name: song.name || 'Unknown Song',
                    primaryArtists: getArtistText(song.primaryArtists || song.artists),
                    image: song.image || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
                    duration: song.duration || '3:45',
                    downloadUrl: song.downloadUrl,
                    language: song.language || 'hindi'
                }));
                
                setSearchResults(validSongs);
                setActiveTab('search');
                
                if (validSongs.length === 0) {
                    setError('No songs found');
                }
            } else {
                throw new Error(data.error || 'Invalid response format');
            }
            
        } catch (err) {
            console.error('❌ Search error:', err);
            setError('Search failed: ' + err.message);
            setSearchResults([]);
        } finally {
            setIsLoading(false);
        }
    };

    // Play selected song
    const playSong = async (song, index = null) => {
        if (!song?.id) {
            setError('Invalid song data');
            return;
        }

        try {
            setIsLoading(true);
            
            const audioUrl = song.downloadUrl;
            
            if (!audioUrl) {
                throw new Error('This song is not available for streaming');
            }

            // Stop current audio safely
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }

            // Set new audio source
            audioRef.current.src = audioUrl;
            audioRef.current.volume = volume / 100;
            
            // Play the audio
            await audioRef.current.play();
            
            const fullSongData = {
                id: song.id,
                title: song.name || 'Unknown Title',
                artist: song.primaryArtists || 'Unknown Artist',
                cover: song.image || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
                duration: song.duration || '3:45',
                audioUrl: audioUrl
            };
            
            setCurrentSong(fullSongData);
            if (index !== null) setCurrentSongIndex(index);
            setIsPlaying(true);
            setError('');
            
        } catch (err) {
            console.error('❌ Play error:', err);
            setError('Cannot play song: ' + err.message);
            setIsPlaying(false);
        } finally {
            setIsLoading(false);
        }
    };

    // Format duration safely
    const formatDuration = (seconds) => {
        if (!seconds) return '0:00';
        try {
            const secs = parseInt(seconds);
            if (isNaN(secs)) return '0:00';
            const mins = Math.floor(secs / 60);
            const remainingSecs = secs % 60;
            return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
        } catch {
            return '0:00';
        }
    };

    // Audio event handlers
    useEffect(() => {
        const audio = audioRef.current;

        const updateProgress = () => {
            try {
                setCurrentTime((audio.currentTime / audio.duration) * 100 || 0);
            } catch (err) {
                console.error('Progress update error:', err);
            }
        };

        const handleEnded = () => {
            try {
                nextSong();
            } catch (err) {
                console.error('Song ended error:', err);
            }
        };

        audio.addEventListener('timeupdate', updateProgress);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', updateProgress);
            audio.removeEventListener('ended', handleEnded);
        };
    }, []);

    // Control functions
    const togglePlay = () => {
        if (!currentSong) {
            setError('No song selected');
            return;
        }

        try {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        } catch (err) {
            console.error('Toggle play error:', err);
            setError('Cannot control playback');
        }
    };

    const nextSong = () => {
        if (playlist.length === 0) {
            setError('Playlist is empty');
            return;
        }
        
        try {
            const nextIndex = (currentSongIndex + 1) % playlist.length;
            setCurrentSongIndex(nextIndex);
            playSong(playlist[nextIndex], nextIndex);
        } catch (err) {
            console.error('Next song error:', err);
            setError('Cannot play next song');
        }
    };

    const prevSong = () => {
        if (playlist.length === 0) {
            setError('Playlist is empty');
            return;
        }
        
        try {
            const prevIndex = currentSongIndex === 0 ? playlist.length - 1 : currentSongIndex - 1;
            setCurrentSongIndex(prevIndex);
            playSong(playlist[prevIndex], prevIndex);
        } catch (err) {
            console.error('Previous song error:', err);
            setError('Cannot play previous song');
        }
    };

    const handleProgressChange = (e) => {
        try {
            const newTime = e.target.value;
            setCurrentTime(newTime);
            
            if (audioRef.current.duration) {
                audioRef.current.currentTime = (newTime / 100) * audioRef.current.duration;
            }
        } catch (err) {
            console.error('Progress change error:', err);
        }
    };

    const handleVolumeChange = (e) => {
        try {
            const newVolume = e.target.value;
            setVolume(newVolume);
            audioRef.current.volume = newVolume / 100;
        } catch (err) {
            console.error('Volume change error:', err);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        searchSongs(searchQuery);
    };

    // Quick search suggestions
    const featuredSongs = [
        { name: "Kesariya", query: "Kesariya" },
        { name: "Malayalam", query: "Malayalam" },
        { name: "Arijit Singh", query: "Arijit Singh" },
        { name: "Diljit Dosanjh", query: "Diljit Dosanjh" },
        { name: "AP Dhillon", query: "AP Dhillon" },
        { name: "Bollywood", query: "Bollywood" }
    ];

    // Safe image renderer
    const SafeImage = ({ src, alt, className, fallback = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop' }) => {
        const [imgSrc, setImgSrc] = useState(src || fallback);
        
        const handleError = () => {
            setImgSrc(fallback);
        };
        
        return (
            <img 
                src={imgSrc} 
                alt={alt} 
                className={className}
                onError={handleError}
            />
        );
    };

    // Safe text renderer
    const SafeText = ({ children, className = '' }) => {
        let text = children;
        
        if (typeof text === 'object') {
            text = getArtistText(text);
        }
        
        return <span className={className}>{text}</span>;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-900 to-indigo-900 text-white p-4">
            <div className="max-w-7xl mx-auto">
                {/* Header & Search */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-4">
                    <div className="flex items-center gap-3">
                        <Music className="w-8 h-8 text-pink-400" />
                        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                            Pixo Music
                        </h1>
                    </div>
                    
                    <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1 min-w-[300px]">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-300 w-4 h-4" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search for songs, artists..."
                                className="w-full pl-10 pr-4 py-3 bg-purple-800 border border-purple-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                            />
                        </div>
                        <button 
                            type="submit"
                            disabled={isLoading}
                            className="px-6 py-3 bg-pink-500 hover:bg-pink-400 disabled:bg-pink-700 rounded-lg transition flex items-center gap-2 justify-center"
                        >
                            {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                            {isLoading ? 'Searching...' : 'Search'}
                        </button>
                    </form>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-200">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                            {error}
                        </div>
                    </div>
                )}

                {/* User Info */}
                {user && (
                    <div className="mb-6 p-4 bg-purple-800 rounded-lg">
                        <p className="text-purple-200 text-sm">
                            Welcome, <span className="font-semibold text-white">{user.full_name}</span>! 
                            {likedSongs.length > 0 && ` ❤️ ${likedSongs.length} liked songs`}
                            {userPlaylistSongs.length > 0 && ` 📋 ${userPlaylistSongs.length} in playlist`}
                        </p>
                    </div>
                )}

                {/* Quick Search Suggestions */}
                <div className="mb-8">
                    <h3 className="text-lg font-semibold mb-3 text-purple-200">
                        Try these popular searches:
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {featuredSongs.map((song, index) => (
                            <button
                                key={index}
                                onClick={() => {
                                    setSearchQuery(song.query);
                                    searchSongs(song.query);
                                }}
                                className="px-4 py-2 bg-purple-700 hover:bg-purple-600 rounded-lg transition text-sm flex items-center gap-2"
                            >
                                <Music className="w-3 h-3" />
                                {song.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 mb-6 border-b border-purple-600">
                    {[
                        { id: 'search', icon: Search, label: 'Search Results' },
                        { id: 'trending', icon: Music, label: 'Trending' },
                        { id: 'liked', icon: Heart, label: 'Liked Songs' },
                        { id: 'saved-playlist', icon: ListMusic, label: 'Saved Playlist' }
                    ].map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`pb-3 px-4 transition ${
                                    activeTab === tab.id 
                                        ? 'border-b-2 border-pink-400 text-pink-400' 
                                        : 'text-purple-300 hover:text-purple-200'
                                }`}
                            >
                                <Icon className="w-4 h-4 inline mr-2" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Now Playing & Content */}
                    <div className="xl:col-span-2 space-y-6">
                        {/* Now Playing */}
                        {currentSong && (
                            <div className="bg-purple-800 rounded-2xl p-6 border border-purple-600">
                                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    <Music className="w-5 h-5 text-pink-400" />
                                    Now Playing
                                </h2>
                                <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6 mb-6">
                                    <SafeImage 
                                        src={currentSong.cover} 
                                        alt="Album Cover" 
                                        className="w-24 h-24 sm:w-32 sm:h-32 rounded-xl object-cover"
                                    />
                                    <div className="text-center sm:text-left flex-1">
                                        <h3 className="text-xl sm:text-2xl font-bold mb-2">
                                            <SafeText>{currentSong.title}</SafeText>
                                        </h3>
                                        <p className="text-purple-200 mb-3">
                                            <SafeText>{currentSong.artist}</SafeText>
                                        </p>
                                        <p className="text-purple-300 text-sm mb-4 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {currentSong.duration}
                                        </p>
                                        {currentSong.id && (
                                            <button 
                                                onClick={() => toggleLikeSong({
                                                    id: currentSong.id,
                                                    name: currentSong.title,
                                                    primaryArtists: currentSong.artist,
                                                    image: currentSong.cover,
                                                    duration: currentSong.duration,
                                                    downloadUrl: currentSong.audioUrl
                                                })}
                                                className={`p-2 rounded-full transition ${
                                                    likedSongs.includes(currentSong.id) 
                                                        ? 'text-red-500 bg-red-500/20' 
                                                        : 'text-gray-400 hover:text-red-500 hover:bg-red-500/10'
                                                }`}
                                            >
                                                <Heart 
                                                    className="w-5 h-5" 
                                                    fill={likedSongs.includes(currentSong.id) ? 'currentColor' : 'none'}
                                                />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="mb-4">
                                    <input
                                        ref={progressRef}
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={currentTime}
                                        onChange={handleProgressChange}
                                        className="w-full h-2 bg-purple-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-pink-500"
                                    />
                                    <div className="flex justify-between text-sm text-purple-200 mt-2">
                                        <span>{formatDuration(audioRef.current.currentTime)}</span>
                                        <span>{currentSong.duration}</span>
                                    </div>
                                </div>

                                {/* Controls */}
                                <div className="flex items-center justify-center space-x-4 sm:space-x-8">
                                    <button 
                                        onClick={prevSong}
                                        disabled={playlist.length === 0}
                                        className="p-2 sm:p-3 rounded-full bg-purple-700 hover:bg-purple-600 disabled:bg-purple-800 disabled:opacity-50 transition"
                                    >
                                        <SkipBack className="w-5 h-5 sm:w-6 sm:h-6" />
                                    </button>
                                    <button 
                                        onClick={togglePlay}
                                        disabled={!currentSong}
                                        className="p-3 sm:p-4 rounded-full bg-pink-500 hover:bg-pink-400 disabled:bg-pink-700 transition"
                                    >
                                        {isPlaying ? 
                                            <Pause className="w-6 h-6 sm:w-8 sm:h-8" /> : 
                                            <Play className="w-6 h-6 sm:w-8 sm:h-8" />
                                        }
                                    </button>
                                    <button 
                                        onClick={nextSong}
                                        disabled={playlist.length === 0}
                                        className="p-2 sm:p-3 rounded-full bg-purple-700 hover:bg-purple-600 disabled:bg-purple-800 disabled:opacity-50 transition"
                                    >
                                        <SkipForward className="w-5 h-5 sm:w-6 sm:h-6" />
                                    </button>
                                </div>

                                {/* Volume Control */}
                                <div className="flex items-center gap-3 mt-4 justify-center">
                                    <Volume2 className="w-4 h-4 text-purple-300" />
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={volume}
                                        onChange={handleVolumeChange}
                                        className="w-32 h-1 bg-purple-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-300"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Content Area */}
                        <div className="bg-purple-800 rounded-2xl p-6 border border-purple-600">
                            {/* Loading State */}
                            {isLoading && (
                                <div className="flex justify-center items-center py-12">
                                    <Loader className="w-8 h-8 animate-spin text-pink-400" />
                                    <span className="ml-3 text-purple-200">Loading...</span>
                                </div>
                            )}

                            {/* Search Results */}
                            {!isLoading && activeTab === 'search' && searchResults.length > 0 && (
                                <>
                                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                        <Search className="w-5 h-5 text-pink-400" />
                                        Search Results ({searchResults.length})
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {searchResults.map((song, index) => (
                                            <div 
                                                key={`${song.id}-${index}`}
                                                className="bg-purple-700 rounded-lg p-4 hover:bg-purple-600 transition border border-purple-600"
                                            >
                                                <div className="flex items-center space-x-3 mb-3">
                                                    <SafeImage 
                                                        src={song.image} 
                                                        alt={song.name}
                                                        className="w-12 h-12 rounded-lg object-cover"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-medium truncate text-sm">
                                                            <SafeText>{song.name}</SafeText>
                                                        </h4>
                                                        <p className="text-purple-200 text-xs truncate">
                                                            <SafeText>{song.primaryArtists}</SafeText>
                                                        </p>
                                                        <p className="text-purple-300 text-xs flex items-center gap-1">
                                                            <Clock className="w-2 h-2" />
                                                            {song.duration}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button 
                                                        onClick={() => playSong(song)}
                                                        disabled={isLoading || !song.downloadUrl}
                                                        className="flex-1 px-3 py-2 bg-pink-500 hover:bg-pink-400 disabled:bg-pink-700 rounded-lg transition text-xs flex items-center gap-1 justify-center"
                                                    >
                                                        <Play className="w-3 h-3" />
                                                        Play
                                                    </button>
                                                    <button 
                                                        onClick={() => addToPlaylist(song)}
                                                        disabled={playlistSongIds.includes(song.id)}
                                                        className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-700 disabled:opacity-50 rounded-lg transition text-xs flex items-center gap-1 justify-center"
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                        {playlistSongIds.includes(song.id) ? 'Added' : 'Add'}
                                                    </button>
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleLikeSong(song);
                                                        }}
                                                        className={`p-2 rounded-full transition ${
                                                            likedSongs.includes(song.id) 
                                                                ? 'text-red-500 bg-red-500/20' 
                                                                : 'text-gray-400 hover:text-red-500 hover:bg-red-500/10'
                                                        }`}
                                                    >
                                                        <Heart 
                                                            className="w-3 h-3" 
                                                            fill={likedSongs.includes(song.id) ? 'currentColor' : 'none'}
                                                        />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* Trending Songs */}
                            {!isLoading && activeTab === 'trending' && trendingSongs.length > 0 && (
                                <>
                                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                        <Music className="w-5 h-5 text-pink-400" />
                                        Trending Now ({trendingSongs.length})
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {trendingSongs.map((song, index) => (
                                            <div 
                                                key={`${song.id}-${index}`}
                                                className="bg-purple-700 rounded-lg p-4 hover:bg-purple-600 transition border border-purple-600"
                                            >
                                                <div className="flex items-center space-x-3 mb-3">
                                                    <SafeImage 
                                                        src={song.image} 
                                                        alt={song.name}
                                                        className="w-12 h-12 rounded-lg object-cover"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-medium truncate text-sm">
                                                            <SafeText>{song.name}</SafeText>
                                                        </h4>
                                                        <p className="text-purple-200 text-xs truncate">
                                                            <SafeText>{song.primaryArtists}</SafeText>
                                                        </p>
                                                        <p className="text-purple-300 text-xs flex items-center gap-1">
                                                            <Clock className="w-2 h-2" />
                                                            {song.duration}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button 
                                                        onClick={() => playSong(song)}
                                                        disabled={isLoading || !song.downloadUrl}
                                                        className="flex-1 px-3 py-2 bg-pink-500 hover:bg-pink-400 disabled:bg-pink-700 rounded-lg transition text-xs flex items-center gap-1 justify-center"
                                                    >
                                                        <Play className="w-3 h-3" />
                                                        Play
                                                    </button>
                                                    <button 
                                                        onClick={() => addToPlaylist(song)}
                                                        disabled={playlistSongIds.includes(song.id)}
                                                        className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-700 disabled:opacity-50 rounded-lg transition text-xs flex items-center gap-1 justify-center"
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                        {playlistSongIds.includes(song.id) ? 'Added' : 'Add'}
                                                    </button>
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleLikeSong(song);
                                                        }}
                                                        className={`p-2 rounded-full transition ${
                                                            likedSongs.includes(song.id) 
                                                                ? 'text-red-500 bg-red-500/20' 
                                                                : 'text-gray-400 hover:text-red-500 hover:bg-red-500/10'
                                                        }`}
                                                    >
                                                        <Heart 
                                                            className="w-3 h-3" 
                                                            fill={likedSongs.includes(song.id) ? 'currentColor' : 'none'}
                                                        />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* Liked Songs */}
                            {!isLoading && activeTab === 'liked' && (
                                <>
                                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                        <Heart className="w-5 h-5 text-red-400" />
                                        Your Liked Songs ({userLikedSongs.length})
                                    </h3>
                                    {userLikedSongs.length === 0 ? (
                                        <div className="text-center py-8 text-purple-300">
                                            <p>No liked songs yet</p>
                                            <p className="text-sm mt-2">
                                                {user ? 'Start liking songs to see them here!' : 'Please login to like songs'}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {userLikedSongs.map((song, index) => (
                                                <div 
                                                    key={`${song.songId}-${index}`}
                                                    className="bg-purple-700 rounded-lg p-4 hover:bg-purple-600 transition border border-purple-600"
                                                >
                                                    <div className="flex items-center space-x-3 mb-3">
                                                        <SafeImage 
                                                            src={song.image} 
                                                            alt={song.name}
                                                            className="w-12 h-12 rounded-lg object-cover"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="font-medium truncate text-sm">
                                                                <SafeText>{song.name}</SafeText>
                                                            </h4>
                                                            <p className="text-purple-200 text-xs truncate">
                                                                <SafeText>{song.primaryArtists}</SafeText>
                                                            </p>
                                                            <p className="text-purple-300 text-xs flex items-center gap-1">
                                                                <Clock className="w-2 h-2" />
                                                                {song.duration}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={() => playSong({
                                                                id: song.songId,
                                                                name: song.name,
                                                                primaryArtists: song.primaryArtists,
                                                                image: song.image,
                                                                duration: song.duration,
                                                                downloadUrl: song.downloadUrl
                                                            })}
                                                            disabled={isLoading || !song.downloadUrl}
                                                            className="flex-1 px-3 py-2 bg-pink-500 hover:bg-pink-400 disabled:bg-pink-700 rounded-lg transition text-xs flex items-center gap-1 justify-center"
                                                        >
                                                            <Play className="w-3 h-3" />
                                                            Play
                                                        </button>
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleLikeSong({
                                                                    id: song.songId,
                                                                    name: song.name,
                                                                    primaryArtists: song.primaryArtists,
                                                                    image: song.image,
                                                                    duration: song.duration,
                                                                    downloadUrl: song.downloadUrl
                                                                });
                                                            }}
                                                            className={`p-2 rounded-full transition ${
                                                                likedSongs.includes(song.songId) 
                                                                    ? 'text-red-500 bg-red-500/20' 
                                                                    : 'text-gray-400 hover:text-red-500 hover:bg-red-500/10'
                                                            }`}
                                                        >
                                                            <Heart 
                                                                className="w-3 h-3" 
                                                                fill={likedSongs.includes(song.songId) ? 'currentColor' : 'none'}
                                                            />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Saved Playlist */}
                            {!isLoading && activeTab === 'saved-playlist' && (
                                <>
                                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                        <ListMusic className="w-5 h-5 text-green-400" />
                                        Your Saved Playlist ({userPlaylistSongs.length})
                                    </h3>
                                    {userPlaylistSongs.length === 0 ? (
                                        <div className="text-center py-8 text-purple-300">
                                            <p>No songs in your saved playlist</p>
                                            <p className="text-sm mt-2">Add songs to your playlist to see them here!</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {userPlaylistSongs.map((song, index) => (
                                                <div 
                                                    key={`${song.songId}-${index}`}
                                                    className="bg-purple-700 rounded-lg p-4 hover:bg-purple-600 transition border border-purple-600"
                                                >
                                                    <div className="flex items-center space-x-3 mb-3">
                                                        <SafeImage 
                                                            src={song.image} 
                                                            alt={song.name}
                                                            className="w-12 h-12 rounded-lg object-cover"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="font-medium truncate text-sm">
                                                                <SafeText>{song.name}</SafeText>
                                                            </h4>
                                                            <p className="text-purple-200 text-xs truncate">
                                                                <SafeText>{song.primaryArtists}</SafeText>
                                                            </p>
                                                            <p className="text-purple-300 text-xs flex items-center gap-1">
                                                                <Clock className="w-2 h-2" />
                                                                {song.duration}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={() => playSong({
                                                                id: song.songId,
                                                                name: song.name,
                                                                primaryArtists: song.primaryArtists,
                                                                image: song.image,
                                                                duration: song.duration,
                                                                downloadUrl: song.downloadUrl
                                                            })}
                                                            disabled={isLoading || !song.downloadUrl}
                                                            className="flex-1 px-3 py-2 bg-pink-500 hover:bg-pink-400 disabled:bg-pink-700 rounded-lg transition text-xs flex items-center gap-1 justify-center"
                                                        >
                                                            <Play className="w-3 h-3" />
                                                            Play
                                                        </button>
                                                        <button 
                                                            onClick={() => removeFromPlaylist(song.songId)}
                                                            className="px-3 py-2 bg-red-500 hover:bg-red-400 rounded-lg transition text-xs flex items-center gap-1 justify-center"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                            Remove
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}

                            {/* No Results */}
                            {!isLoading && activeTab === 'search' && searchResults.length === 0 && searchQuery && (
                                <div className="text-center py-8 text-purple-300">
                                    <p>No songs found for "{searchQuery}"</p>
                                    <p className="text-sm mt-2">Try searching for something else!</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Playlist Sidebar */}
                    <div className="bg-purple-800 rounded-2xl p-6 border border-purple-600 h-fit">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <ListMusic className="w-5 h-5 text-pink-400" />
                                Current Playlist
                            </h3>
                            <span className="text-sm text-purple-200 bg-purple-700 px-3 py-1 rounded">
                                {playlist.length} songs
                            </span>
                        </div>
                        
                        {playlist.length === 0 ? (
                            <div className="text-center py-8 text-purple-300">
                                <p>Your playlist is empty</p>
                                <p className="text-sm mt-2">Search for songs and add them to your playlist!</p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                {playlist.map((song, index) => (
                                    <div 
                                        key={`${song.id}-${index}`}
                                        onClick={() => {
                                            setCurrentSongIndex(index);
                                            playSong(song, index);
                                        }}
                                        className={`flex items-center space-x-3 p-3 rounded-lg hover:bg-purple-700 transition cursor-pointer border ${
                                            index === currentSongIndex && currentSong 
                                                ? 'bg-purple-700 border-pink-400' 
                                                : 'border-purple-600'
                                        }`}
                                    >
                                        <SafeImage 
                                            src={song.cover} 
                                            alt={song.title}
                                            className="w-10 h-10 rounded object-cover"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-medium text-sm truncate">
                                                <SafeText>{song.title}</SafeText>
                                            </h4>
                                            <p className="text-purple-200 text-xs truncate">
                                                <SafeText>{song.artist}</SafeText>
                                            </p>
                                        </div>
                                        <span className="text-purple-200 text-xs">
                                            {song.duration}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PixoMusicWithErrorBoundary;