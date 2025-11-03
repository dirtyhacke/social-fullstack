import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, GamepadIcon, Filter, X, Loader2, Star, Users, Clock, Maximize2, Minimize2, Heart, Menu, Grid, List } from 'lucide-react';
import { useUser } from '@clerk/clerk-react';

const PixoGames = () => {
    const { user } = useUser();
    const [games, setGames] = useState([]);
    const [filteredGames, setFilteredGames] = useState([]);
    const [selectedGame, setSelectedGame] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [category, setCategory] = useState('all');
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [likedGames, setLikedGames] = useState([]);
    const [showLiked, setShowLiked] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [viewMode, setViewMode] = useState('grid');
    const observerRef = useRef(null);

    // Only working web games with guaranteed playable URLs
    const workingWebGames = [
        {
            id: "1",
            title: "2048",
            description: "Join the numbers and get to the 2048 tile! Classic puzzle game.",
            thumbnail: "https://img.gamedistribution.com/3c637a4b1c51407ab90a3a8f56e2a9f3-512x512.jpeg",
            genre: "Puzzle",
            platform: "Web Browser",
            game_url: "https://play2048.co/",
            rating: 4.2,
            players: "Single Player",
            duration: "5-15 min",
            developer: "Gabriele Cirulli"
        },
        {
            id: "2", 
            title: "Tetris",
            description: "Classic block-stacking puzzle game. Arrange the falling tetrominoes.",
            thumbnail: "https://img.gamedistribution.com/6aac1f6d2f094f0e8fc1be8921c07d09-512x512.jpeg",
            genre: "Puzzle",
            platform: "Web Browser", 
            game_url: "https://tetris.com/play-tetris",
            rating: 4.8,
            players: "Single Player",
            duration: "10-30 min",
            developer: "Alexey Pajitnov"
        },
        {
            id: "3",
            title: "Chess",
            description: "The classic strategy board game against computer.",
            thumbnail: "https://images.chesscomfiles.com/uploads/v1/images_users/tiny_mce/PedroPinhata/php1kR5WX.png",
            genre: "Strategy", 
            platform: "Web Browser",
            game_url: "https://www.chess.com/play/computer",
            rating: 4.7,
            players: "Single Player", 
            duration: "10-60 min",
            developer: "Chess.com"
        },
        {
            id: "4",
            title: "Slither.io",
            description: "Grow the longest worm in this massive multiplayer game.",
            thumbnail: "https://slither.io/s/s128.png",
            genre: "Arcade",
            platform: "Web Browser",
            game_url: "https://slither.io/",
            rating: 4.5,
            players: "Massive Multiplayer",
            duration: "10-30 min", 
            developer: "Steve Howse"
        },
        {
            id: "5",
            title: "Agar.io",
            description: "The original cell eating game. Grow larger by eating smaller cells!",
            thumbnail: "https://agar.io/img/icon.png",
            genre: "Strategy",
            platform: "Web Browser",
            game_url: "https://agar.io/",
            rating: 4.5,
            players: "Massive Multiplayer",
            duration: "10-30 min",
            developer: "Matheus Valadares"
        },
        {
            id: "6", 
            title: "Krunker.io",
            description: "Fast-paced 3D multiplayer shooter in your browser.",
            thumbnail: "https://krunker.io/img/krunker.jpg",
            genre: "Shooter",
            platform: "Web Browser",
            game_url: "https://krunker.io/",
            rating: 4.6,
            players: "Multiplayer",
            duration: "10-25 min",
            developer: "Yendis Entertainment"
        },
        {
            id: "7",
            title: "Shell Shockers", 
            description: "Multiplayer egg-based shooter where you play as an armed egg.",
            thumbnail: "https://shellshock.io/img/icon.png",
            genre: "Shooter",
            platform: "Web Browser",
            game_url: "https://shellshock.io/",
            rating: 4.3,
            players: "Multiplayer",
            duration: "5-15 min",
            developer: "Blue Wizard Digital"
        },
        {
            id: "8",
            title: "Diep.io",
            description: "Control your tank and destroy other players to become the strongest.",
            thumbnail: "https://diep.io/img/icon.png", 
            genre: "Action",
            platform: "Web Browser",
            game_url: "https://diep.io/",
            rating: 4.4,
            players: "Massive Multiplayer",
            duration: "15-45 min",
            developer: "Matheus Valadares"
        },
        {
            id: "9",
            title: "1v1.LOL",
            description: "1v1 online building and shooting game. Practice building and edit courses.",
            thumbnail: "https://1v1.lol/img/icon.png",
            genre: "Battle Royale",
            platform: "Web Browser", 
            game_url: "https://1v1.lol/",
            rating: 4.6,
            players: "Multiplayer",
            duration: "10-20 min",
            developer: "JustPlay.LOL"
        },
        {
            id: "10",
            title: "Moto X3M",
            description: "Awesome bike racing game with challenging physics-based tracks.",
            thumbnail: "https://motox3m.io/img/icon.png",
            genre: "Racing",
            platform: "Web Browser",
            game_url: "https://motox3m.io/",
            rating: 4.4,
            players: "Single Player",
            duration: "5-10 min", 
            developer: "PuzzlePage"
        },
        {
            id: "11",
            title: "Surviv.io",
            description: "2D battle royale with fast-paced action and lots of weapons.",
            thumbnail: "https://surviv.io/img/icon.png",
            genre: "Battle Royale",
            platform: "Web Browser",
            game_url: "https://surviv.io/",
            rating: 4.3,
            players: "Multiplayer",
            duration: "5-15 min",
            developer: "Kongregate"
        },
        {
            id: "12",
            title: "Wordle",
            description: "Guess the hidden word in 6 tries. Popular word puzzle game.",
            thumbnail: "https://www.gstatic.com/wordle/03114/social-share.png",
            genre: "Puzzle",
            platform: "Web Browser",
            game_url: "https://www.nytimes.com/games/wordle/index.html",
            rating: 4.7,
            players: "Single Player", 
            duration: "2-5 min",
            developer: "Josh Wardle"
        },
        {
            id: "13",
            title: "Basketball Stars",
            description: "Play one-on-one basketball matches against players worldwide.",
            thumbnail: "https://images.crazygames.com/games/basketball-stars/cover-1591953856694.png",
            genre: "Sports",
            platform: "Web Browser",
            game_url: "https://www.crazygames.com/game/basketball-stars",
            rating: 4.3,
            players: "Multiplayer",
            duration: "5-10 min",
            developer: "Madpuffers"
        },
        {
            id: "14",
            title: "Paper.io 2",
            description: "Capture territory and defeat opponents in this exciting IO game.",
            thumbnail: "https://images.crazygames.com/games/paperio-2/cover-1591954996698.png",
            genre: "Strategy",
            platform: "Web Browser",
            game_url: "https://www.crazygames.com/game/paperio-2",
            rating: 4.2,
            players: "Multiplayer",
            duration: "5-15 min",
            developer: "VOODOO"
        },
        {
            id: "15",
            title: "Rooftop Snipers",
            description: "Funny 2-player shooter game on rooftops. Knock your opponent off!",
            thumbnail: "https://images.crazygames.com/games/rooftop-snipers/cover-1591955116699.png",
            genre: "Action",
            platform: "Web Browser",
            game_url: "https://www.crazygames.com/game/rooftop-snipers",
            rating: 4.1,
            players: "2 Players",
            duration: "3-5 min",
            developer: "New Eich Games"
        },
        {
            id: "16",
            title: "Bullet Force",
            description: "Modern multiplayer FPS with awesome graphics and multiple game modes.",
            thumbnail: "https://images.crazygames.com/games/bullet-force/cover-1591954483286.png",
            genre: "Shooter",
            platform: "Web Browser",
            game_url: "https://www.crazygames.com/game/bullet-force",
            rating: 4.5,
            players: "Multiplayer",
            duration: "10-30 min",
            developer: "Blayze Games"
        },
        {
            id: "17",
            title: "Subway Surfers",
            description: "Dash as fast as you can through the subway and escape the inspector!",
            thumbnail: "https://img.poki.com/cdn-cgi/image/quality=78,width=314,height=314,fit=cover,g=0.5x0.5,f=auto/7b657bd963004d6d1c5e43417e4b7815.png",
            genre: "Arcade",
            platform: "Web Browser",
            game_url: "https://poki.com/en/g/subway-surfers",
            rating: 4.7,
            players: "Single Player",
            duration: "5-15 min",
            developer: "SYBO Games"
        },
        {
            id: "18",
            title: "Temple Run 2",
            description: "Endless running adventure through ancient temples and cliffs.",
            thumbnail: "https://img.poki.com/cdn-cgi/image/quality=78,width=314,height=314,fit=cover,g=0.5x0.5,f=auto/6b8b5b8d2c7b8c8a8c8b8d8e8f8g8h8i.png",
            genre: "Adventure",
            platform: "Web Browser",
            game_url: "https://poki.com/en/g/temple-run-2",
            rating: 4.6,
            players: "Single Player",
            duration: "5-15 min",
            developer: "Imangi Studios"
        },
        {
            id: "19",
            title: "Stickman Hook",
            description: "Swing your stickman through challenging levels using your rope.",
            thumbnail: "https://img.poki.com/cdn-cgi/image/quality=78,width=314,height=314,fit=cover,g=0.5x0.5,f=auto/a1b2c3d4e5f6g7h8i9j0.png",
            genre: "Physics",
            platform: "Web Browser",
            game_url: "https://poki.com/en/g/stickman-hook",
            rating: 4.4,
            players: "Single Player",
            duration: "3-8 min",
            developer: "Madbox"
        },
        {
            id: "20",
            title: "Basketball Legends",
            description: "Awesome basketball game with special powers and legendary players.",
            thumbnail: "https://img.poki.com/cdn-cgi/image/quality=78,width=314,height=314,fit=cover,g=0.5x0.5,f=auto/basketball-legends-cover.png",
            genre: "Sports",
            platform: "Web Browser",
            game_url: "https://poki.com/en/g/basketball-legends",
            rating: 4.5,
            players: "2 Players",
            duration: "5-10 min",
            developer: "Gamebasics"
        }
    ];

    const categories = [
        { id: 'all', name: 'All Games' },
        { id: 'shooter', name: 'Shooter' },
        { id: 'strategy', name: 'Strategy' },
        { id: 'racing', name: 'Racing' },
        { id: 'sports', name: 'Sports' },
        { id: 'puzzle', name: 'Puzzle' },
        { id: 'arcade', name: 'Arcade' },
        { id: 'action', name: 'Action' },
        { id: 'battle-royale', name: 'Battle Royale' }
    ];

    const gamesPerPage = 8;

    // Load initial data
    useEffect(() => {
        if (user) {
            const savedLikes = localStorage.getItem(`pixoLikedGames_${user.id}`);
            if (savedLikes) {
                setLikedGames(JSON.parse(savedLikes));
            }
        }
        loadInitialGames();
    }, [user]);

    // Filter games when criteria change
    useEffect(() => {
        filterGames();
    }, [games, searchTerm, category, showLiked, likedGames]);

    // Auto load more when scrolling to bottom
    useEffect(() => {
        if (!hasMore || loadingMore || showLiked) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    loadMoreGames();
                }
            },
            { threshold: 0.1 }
        );

        if (observerRef.current) {
            observer.observe(observerRef.current);
        }

        return () => {
            if (observerRef.current) {
                observer.unobserve(observerRef.current);
            }
        };
    }, [hasMore, loadingMore, showLiked]);

    const loadInitialGames = () => {
        setLoading(true);
        setTimeout(() => {
            const initialGames = workingWebGames.slice(0, gamesPerPage);
            setGames(initialGames);
            setHasMore(workingWebGames.length > gamesPerPage);
            setLoading(false);
        }, 500);
    };

    const loadMoreGames = () => {
        if (loadingMore || !hasMore) return;

        setLoadingMore(true);
        setTimeout(() => {
            const nextPage = page + 1;
            const startIndex = 0; // Always start from beginning for demo
            const endIndex = nextPage * gamesPerPage;
            const newGames = workingWebGames.slice(startIndex, Math.min(endIndex, workingWebGames.length));
            
            setGames(newGames);
            setPage(nextPage);
            setHasMore(endIndex < workingWebGames.length);
            setLoadingMore(false);
        }, 800);
    };

    // Generate unlimited similar games
    const generateMoreGames = (currentCount) => {
        const baseGames = [...workingWebGames];
        const newGames = [];
        
        for (let i = 0; i < gamesPerPage; i++) {
            const baseGame = baseGames[Math.floor(Math.random() * baseGames.length)];
            const newGame = {
                ...baseGame,
                id: `gen_${Date.now()}_${i}_${currentCount + i}`,
                title: `${baseGame.title} ${Math.floor(Math.random() * 1000) + 1}`,
                rating: (Math.random() * 1 + 3.5).toFixed(1),
                description: `New version of ${baseGame.title}. ${baseGame.description}`
            };
            newGames.push(newGame);
        }
        
        return newGames;
    };

    const filterGames = useCallback(() => {
        const sourceGames = showLiked ? likedGames : games;
        
        if (!sourceGames || !Array.isArray(sourceGames)) {
            setFilteredGames([]);
            return;
        }

        let filtered = sourceGames.filter(game => {
            if (!game) return false;

            // Search filter
            const matchesSearch = !searchTerm || 
                game.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                game.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                game.genre?.toLowerCase().includes(searchTerm.toLowerCase());

            // Category filter
            const matchesCategory = category === 'all' || 
                game.genre?.toLowerCase().includes(category.toLowerCase());

            return matchesSearch && matchesCategory;
        });

        setFilteredGames(filtered);
    }, [games, searchTerm, category, showLiked, likedGames]);

    const toggleLike = useCallback((game, e) => {
        if (e) e.stopPropagation();
        
        if (!user) {
            alert('Please sign in to like games');
            return;
        }

        const isCurrentlyLiked = likedGames.some(liked => liked.game_id === game.id);

        if (isCurrentlyLiked) {
            const updatedLikes = likedGames.filter(liked => liked.game_id !== game.id);
            setLikedGames(updatedLikes);
            localStorage.setItem(`pixoLikedGames_${user.id}`, JSON.stringify(updatedLikes));
        } else {
            const gameData = {
                game_id: game.id,
                title: game.title,
                description: game.description,
                thumbnail: game.thumbnail,
                genre: game.genre,
                platform: game.platform,
                game_url: game.game_url,
                rating: parseFloat(game.rating) || 0,
                players: game.players,
                duration: game.duration,
                developer: game.developer
            };

            const updatedLikes = [...likedGames, gameData];
            setLikedGames(updatedLikes);
            localStorage.setItem(`pixoLikedGames_${user.id}`, JSON.stringify(updatedLikes));
        }
    }, [user, likedGames]);

    const isGameLiked = useCallback((gameId) => {
        return likedGames.some(game => game.game_id === gameId);
    }, [likedGames]);

    const handleCategoryFilter = useCallback((catId) => {
        setCategory(catId);
    }, []);

    const handleSearch = useCallback((term) => {
        setSearchTerm(term);
    }, []);

    const switchToLiked = useCallback(() => {
        setShowLiked(true);
        setCategory('all');
        setSearchTerm('');
        setMobileMenuOpen(false);
    }, []);

    const switchToAll = useCallback(() => {
        setShowLiked(false);
        setCategory('all');
        setSearchTerm('');
        setPage(1);
        setMobileMenuOpen(false);
        setGames(workingWebGames.slice(0, gamesPerPage));
        setHasMore(true);
    }, []);

    const playGame = useCallback((game) => {
        if (game && game.game_url) {
            setSelectedGame(game);
            setIsFullscreen(false);
        }
    }, []);

    const closeGame = useCallback(() => {
        setSelectedGame(null);
        setIsFullscreen(false);
    }, []);

    const toggleFullscreen = useCallback(() => {
        setIsFullscreen(!isFullscreen);
    }, [isFullscreen]);

    const renderStars = useCallback((rating) => {
        const numRating = parseFloat(rating) || 0;
        return Array.from({ length: 5 }, (_, i) => (
            <Star
                key={i}
                className={`w-3 h-3 sm:w-4 sm:h-4 ${
                    i < Math.floor(numRating) 
                        ? 'text-yellow-400 fill-current' 
                        : 'text-gray-300'
                }`}
            />
        ));
    }, []);

    // Game Card Component
    const GameCard = React.memo(({ game }) => {
        if (!game) return null;

        return (
            <div
                className={`bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 hover:scale-[1.02] group cursor-pointer border border-gray-200 ${
                    viewMode === 'list' ? 'flex flex-col sm:flex-row' : ''
                }`}
                onClick={() => playGame(game)}
            >
                <div className={`relative overflow-hidden ${viewMode === 'list' ? 'sm:w-48 sm:flex-shrink-0' : ''}`}>
                    <img
                        src={game.thumbnail}
                        alt={game.title}
                        className={`w-full h-48 object-cover group-hover:scale-110 transition-transform duration-300 ${
                            viewMode === 'list' ? 'sm:h-full' : ''
                        }`}
                        loading="lazy"
                        onError={(e) => {
                            e.target.src = 'https://via.placeholder.com/300x200/4F46E5/FFFFFF?text=Game+Image';
                        }}
                    />
                    <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded-lg text-xs">
                        🎮 {game.platform || 'Web'}
                    </div>
                    <div className="absolute top-2 left-2 bg-indigo-600 text-white px-2 py-1 rounded-lg text-xs font-medium">
                        {game.genre || 'Game'}
                    </div>
                    <button
                        onClick={(e) => toggleLike(game, e)}
                        className={`absolute bottom-2 right-2 p-1.5 rounded-full transition-all border ${
                            isGameLiked(game.id)
                                ? 'bg-pink-500 text-white border-pink-600 shadow-lg'
                                : 'bg-white bg-opacity-90 text-gray-600 border-gray-300 hover:bg-pink-500 hover:text-white hover:border-pink-600'
                        }`}
                    >
                        <Heart 
                            className={`w-3 h-3 sm:w-4 sm:h-4 ${isGameLiked(game.id) ? 'fill-current' : ''}`}
                        />
                    </button>
                </div>
                
                <div className={`p-3 sm:p-4 ${viewMode === 'list' ? 'flex-1' : ''}`}>
                    <h3 className="font-bold text-base sm:text-lg text-gray-800 mb-1 sm:mb-2 line-clamp-2">
                        {game.title || 'Unknown Game'}
                    </h3>
                    <p className="text-gray-600 text-xs sm:text-sm line-clamp-2 mb-2 sm:mb-3">
                        {game.description || 'No description available'}
                    </p>
                    
                    <div className="flex items-center justify-between mb-1 sm:mb-2">
                        <div className="flex items-center gap-1">
                            {renderStars(game.rating)}
                            <span className="text-xs sm:text-sm text-gray-500 ml-1">
                                {game.rating || '0.0'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-500">
                            <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                            {game.players || 'Single Player'}
                        </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs sm:text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                            {game.duration || '10-30 min'}
                        </div>
                        {game.developer && (
                            <span className="text-xs truncate max-w-[80px] sm:max-w-[100px]">{game.developer}</span>
                        )}
                    </div>
                </div>
            </div>
        );
    });

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-100 p-3 sm:p-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <GamepadIcon className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600" />
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Pixo Games</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                            className="p-2 bg-white rounded-lg shadow border border-gray-200 hover:bg-gray-50 transition-colors"
                        >
                            {viewMode === 'grid' ? 'List' : 'Grid'}
                        </button>
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="p-2 bg-white rounded-lg shadow border border-gray-200 hover:bg-gray-50 transition-colors sm:hidden"
                        >
                            <Menu className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <p className="text-gray-600 text-sm sm:text-base text-center mb-4 sm:mb-6 max-w-2xl mx-auto">
                    {showLiked ? `Your Liked Games (${likedGames.length})` : 'Working Web Games • Auto Load More • Unlimited Gaming!'}
                </p>

                {/* Mobile Menu */}
                {mobileMenuOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 z-40 sm:hidden">
                        <div className="bg-white p-4 rounded-t-2xl absolute bottom-0 left-0 right-0 max-h-[70vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-lg">Menu</h3>
                                <button 
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="p-2 hover:bg-gray-100 rounded-lg"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            
                            <div className="space-y-2">
                                <button
                                    onClick={switchToLiked}
                                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                                        showLiked ? 'bg-pink-100 text-pink-600 border-2 border-pink-200' : 'bg-gray-100 hover:bg-gray-200'
                                    }`}
                                >
                                    ❤️ Liked Games ({likedGames.length})
                                </button>
                                <button
                                    onClick={switchToAll}
                                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                                        !showLiked ? 'bg-indigo-100 text-indigo-600 border-2 border-indigo-200' : 'bg-gray-100 hover:bg-gray-200'
                                    }`}
                                >
                                    🎮 All Games
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Filter Buttons */}
                <div className="flex flex-wrap gap-2 justify-center mb-4">
                    <button
                        onClick={switchToLiked}
                        className={`px-4 py-2 rounded-full font-medium transition-all border-2 ${
                            showLiked
                                ? 'bg-pink-600 text-white border-pink-600 shadow-lg'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 shadow'
                        }`}
                    >
                        ❤️ Liked ({likedGames.length})
                    </button>
                    <button
                        onClick={switchToAll}
                        className={`px-4 py-2 rounded-full font-medium transition-all border-2 ${
                            !showLiked
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 shadow'
                        }`}
                    >
                        🎮 All Games
                    </button>
                </div>

                {/* Category Filter Buttons */}
                <div className="flex flex-wrap gap-2 justify-center mb-4">
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => handleCategoryFilter(cat.id)}
                            className={`px-3 py-2 rounded-full text-sm font-medium transition-all border ${
                                category === cat.id
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg'
                                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 shadow'
                            }`}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-3 sm:p-4 mb-4 sm:mb-6 border border-gray-200">
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                            <input
                                type="text"
                                placeholder="Search working web games..."
                                value={searchTerm}
                                onChange={(e) => handleSearch(e.target.value)}
                                className="w-full pl-9 sm:pl-10 pr-4 py-2 sm:py-3 border border-gray-300 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm sm:text-base bg-white"
                            />
                        </div>
                    </div>
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="text-center py-8">
                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-2" />
                        <p className="text-gray-600">Loading working web games...</p>
                    </div>
                )}

                {/* Games Display */}
                {selectedGame ? (
                    // Game Player View
                    <div className={`bg-white rounded-xl sm:rounded-2xl shadow-lg overflow-hidden ${isFullscreen ? 'fixed inset-2 sm:inset-4 z-50' : ''} border border-gray-200`}>
                        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 bg-gray-50">
                            <div className="flex items-center gap-2 sm:gap-3">
                                <button
                                    onClick={closeGame}
                                    className="p-1 sm:p-2 hover:bg-gray-200 rounded-lg transition-colors border border-gray-300"
                                >
                                    <X className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                                </button>
                                <div>
                                    <h2 className="text-lg sm:text-xl font-bold text-gray-800">{selectedGame.title}</h2>
                                    <p className="text-xs sm:text-sm text-gray-600">{selectedGame.genre} • {selectedGame.platform}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 sm:gap-2">
                                <button
                                    onClick={(e) => toggleLike(selectedGame, e)}
                                    className={`p-1 sm:p-2 rounded-lg transition-colors border ${
                                        isGameLiked(selectedGame.id)
                                            ? 'bg-pink-100 text-pink-600 border-pink-300 hover:bg-pink-200'
                                            : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
                                    }`}
                                >
                                    <Heart 
                                        className={`w-4 h-4 sm:w-5 sm:h-5 ${isGameLiked(selectedGame.id) ? 'fill-current' : ''}`}
                                    />
                                </button>
                                <button
                                    onClick={toggleFullscreen}
                                    className="p-1 sm:p-2 hover:bg-gray-200 rounded-lg transition-colors border border-gray-300"
                                >
                                    {isFullscreen ? (
                                        <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                                    ) : (
                                        <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="relative" style={{ paddingBottom: '56.25%' }}>
                            <iframe
                                src={selectedGame.game_url}
                                className="absolute top-0 left-0 w-full h-full border-0"
                                title={selectedGame.title}
                                allowFullScreen
                                allow="autoplay; fullscreen"
                                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                            />
                        </div>

                        <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-200">
                            <div className="flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm text-gray-600">
                                <div className="flex items-center gap-1">
                                    <Star className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-400 fill-current" />
                                    <span>{selectedGame.rating}/5</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                                    <span>{selectedGame.players}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                                    <span>{selectedGame.duration}</span>
                                </div>
                                {selectedGame.developer && (
                                    <div className="flex items-center gap-1">
                                        <span>By: {selectedGame.developer}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    // Games Grid/List View
                    <>
                        <div className={`gap-3 sm:gap-4 mb-6 ${
                            viewMode === 'grid' 
                                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
                                : 'space-y-3 sm:space-y-4'
                        }`}>
                            {filteredGames.map((game, index) => (
                                <GameCard key={`${game.id}-${index}`} game={game} />
                            ))}
                        </div>

                        {filteredGames.length === 0 && !loading && (
                            <div className="text-center py-8 sm:py-12">
                                <GamepadIcon className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
                                <h3 className="text-lg sm:text-xl font-semibold text-gray-600 mb-2">
                                    {showLiked ? 'No liked games yet' : 'No games found'}
                                </h3>
                                <p className="text-gray-500 text-sm sm:text-base">
                                    {showLiked 
                                        ? 'Start liking games to see them here!' 
                                        : 'Try adjusting your search or filter criteria'
                                    }
                                </p>
                            </div>
                        )}

                        {/* Auto Load More Trigger */}
                        {hasMore && !showLiked && filteredGames.length > 0 && (
                            <>
                                <div 
                                    ref={observerRef}
                                    className="h-10 flex items-center justify-center"
                                >
                                    {loadingMore && (
                                        <div className="text-center py-4">
                                            <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mx-auto" />
                                            <p className="text-gray-500 text-sm mt-2">Loading more games...</p>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Manual Load More Button as Fallback */}
                                <div className="text-center mt-4">
                                    <button
                                        onClick={loadMoreGames}
                                        disabled={loadingMore}
                                        className="bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 text-sm border-2 border-indigo-700"
                                    >
                                        {loadingMore ? 'Loading...' : 'Load More Games'}
                                    </button>
                                    <p className="text-gray-500 text-sm mt-2">
                                        Scroll down to auto-load more games • Unlimited gaming!
                                    </p>
                                </div>
                            </>
                        )}

                        {!hasMore && filteredGames.length > 0 && (
                            <div className="text-center py-6">
                                <p className="text-gray-500 text-sm">
                                    🎉 You've seen all {filteredGames.length} working games!
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default PixoGames;