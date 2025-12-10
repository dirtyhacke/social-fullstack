import React, { useState, useEffect, useMemo } from 'react';
import { assets } from '../assets/assets';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { CirclePlus, LogOut, Home, Users, Compass, MessageCircle, Shuffle, User, Bot, GamepadIcon, Film, Sun, X, Menu, Search, Clapperboard } from 'lucide-react';
import { UserButton, useClerk } from '@clerk/clerk-react';
import { useSelector } from 'react-redux';
import Reels from './Reels'; // Import the Reels component

// --- STAR DATA GENERATION (for the welcome animation only) ---
const STAR_POSITIONS = () => {
    const arr = [];
    // Generating more stars for the full screen background
    for (let i = 0; i < 100; i++) {
        arr.push({
            // Coordinates based on a full screen context (approx 1440x900)
            cx: Math.floor(Math.random() * 1440),
            cy: Math.floor(Math.random() * 900), 
            r: (Math.random() * 1.2 + 0.2).toFixed(2),
            o: (Math.random() * 0.7 + 0.18).toFixed(2),
            dur: 5 + Math.random() * 5,
        });
    }
    return arr;
};
// -----------------------------------------------------------

const Sidebar = ({ sidebarOpen, setSidebarOpen }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const user = useSelector((state) => state.user.value);
    const { signOut } = useClerk();
    
    const [showWelcome, setShowWelcome] = useState(false);
    const [welcomeText, setWelcomeText] = useState('');
    const [showReels, setShowReels] = useState(false); // State for Reels modal

    const welcomeStarPositions = useMemo(() => STAR_POSITIONS(), []);

    // --- LOGIC REMAINS UNCHANGED ---
    useEffect(() => {
        if (user?.full_name) {
            setShowWelcome(true);
            animateWelcomeText(user.full_name);
            
            document.body.style.overflow = 'hidden';

            const timer = setTimeout(() => {
                setShowWelcome(false);
                document.body.style.overflow = 'unset';
            }, 3000);

            return () => {
                clearTimeout(timer);
                document.body.style.overflow = 'unset';
            };
        }
    }, [user?.full_name]);

    const animateWelcomeText = (fullName) => {
        const text = `Welcome, ${fullName}!`;
        let currentText = '';
        let index = 0;

        const typingInterval = setInterval(() => {
            if (index < text.length) {
                currentText += text[index];
                setWelcomeText(currentText);
                index++;
            } else {
                clearInterval(typingInterval);
            }
        }, 60);
    }

    const handleNavigation = (path, customHandler = null) => {
        if (customHandler) {
            customHandler();
        } else {
            navigate(path);
        }
        if (window.innerWidth < 640) {
            setSidebarOpen(false);
        }
    }

    const handleRandomChat = () => handleNavigation('/random-chat', () => navigate('/random-chat'));
    const handleChatBot = () => handleNavigation('/chat-bot', () => navigate('/chat-bot'));
    const handlePixoGames = () => handleNavigation('/pixo-games', () => navigate('/pixo-games'));
    const handlePixoMovies = () => handleNavigation('/pixo-music', () => navigate('/pixo-music'));
    
    const handleViewProfile = () => {
        navigate('/profile');
        if (window.innerWidth < 640) {
            setSidebarOpen(false);
        }
    }

    const handleCloseSidebar = () => {
        setSidebarOpen(false);
    }

    const handleReelsClick = () => {
        setShowReels(true);
        setSidebarOpen(false);
        document.body.style.overflow = 'hidden';
    }

    const handleCloseReels = () => {
        setShowReels(false);
        document.body.style.overflow = 'unset';
    }
    // --- END LOGIC UNCHANGED ---

    const menuItems = [
        { icon: <Home className='w-5 h-5'/>, name: "Home", path: "/" },
        { icon: <Users className='w-5 h-5'/>, name: "Connections", path: "/connections" },
        { icon: <Compass className='w-5 h-5'/>, name: "Discover", path: "/discover" },
        { icon: <MessageCircle className='w-5 h-5'/>, name: "Messages", path: "/messages" },
        { icon: <Clapperboard className='w-5 h-5'/>, name: "Reels", onClick: handleReelsClick }, // Added Reels to sidebar
        { isSeparator: true },
        { icon: <Shuffle className='w-5 h-5'/>, name: "Random Chat", path: "/random-chat", onClick: handleRandomChat, },
        { icon: <Bot className='w-5 h-5'/>, name: "AI Chat Bot", path: "/chat-bot", onClick: handleChatBot, },
        { icon: <GamepadIcon className='w-5 h-5'/>, name: "Pixo Games", path: "/pixo-games", onClick: handlePixoGames, },
        { icon: <Film className='w-5 h-5'/>, name: "Pixo Music", path: "/pixo-music", onClick: handlePixoMovies, },
        { isSeparator: true },
        { icon: <User className='w-5 h-5'/>, name: "My Profile", onClick: handleViewProfile, path: '/profile' }
    ];

    // Mobile bottom navigation items - Updated with Reels
    const mobileNavItems = [
        { icon: <Home className='w-6 h-6'/>, name: "Home", path: "/" },
        { icon: <Clapperboard className='w-6 h-6'/>, name: "Reels", onClick: handleReelsClick }, // Added Reels
        { icon: <Search className='w-6 h-6'/>, name: "Discover", path: "/discover" },
        { icon: <CirclePlus className='w-6 h-6'/>, name: "Create", path: "/create-post" },
        { icon: <MessageCircle className='w-6 h-6'/>, name: "Messages", path: "/messages" },
        { icon: <Menu className='w-6 h-6'/>, name: "More", onClick: () => setSidebarOpen(true) }
    ];

    // --- UPDATED WELCOME SCREEN UI FOR PROFESSIONAL DARK MODE ---
    if (showWelcome) {
        return (
            <>
                <style jsx="true">{`
                    /* Global CSS definition for the moon rotation animation */
                    .moon-rot-welcome { 
                        animation: moon-rotate-welcome 90s linear infinite; 
                        transform-box: fill-box;
                        transform-origin: 50% 50%;
                    }
                    @keyframes moon-rotate-welcome { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

                    /* Add smooth fade-in animation */
                    @keyframes fade-in {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }

                    /* Define the custom floating animation for the Alien Head */
                    @keyframes alien-float {
                        0% { transform: translateY(0) rotate(0deg); }
                        50% { transform: translateY(-12px) rotate(1deg); }
                        100% { transform: translateY(0) rotate(0deg); }
                    }

                    .animate-alien-float {
                        animation: alien-float 3.5s ease-in-out infinite;
                    }

                    /* Ensure cursor pulse is defined if not in global Tailwind config */
                    @keyframes pulse {
                        0%, 100% { opacity: 1; }
                        50% { opacity: 0; }
                    }
                    .animate-pulse { animation: pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
                    
                    /* Custom Text Shadow for better contrast */
                    .text-glow { 
                        text-shadow: 0 0 5px rgba(255, 255, 255, 0.3), 0 0 10px rgba(0, 255, 255, 0.2); 
                    }
                `}</style>
                
                {/* Welcome Animation Overlay (FULLSCREEN) */}
                {/* CHANGE: Deeper BG color (near-black with blue undertones) */}
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#010510] animate-fade-in">
                    
                    {/* --- FULLSCREEN Animated Space Background --- */}
                    <svg
                        className="absolute inset-0 w-full h-full"
                        viewBox="0 0 1440 900"
                        preserveAspectRatio="xMidYMid slice"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden
                    >
                        <defs>
                            <radialGradient id="nebulaWelcome" cx="50%" cy="50%">
                                {/* CHANGE: Richer gradient stops */}
                                <stop offset="0%" stopColor="#0a1a36" /> 
                                <stop offset="100%" stopColor="#010510" /> 
                            </radialGradient>
                            <filter id="glowWelcome" x="-40%" y="-40%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="6" result="blur" />
                                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                            </filter>
                        </defs>

                        <rect width="100%" height="100%" fill="url(#nebulaWelcome)" />

                        {welcomeStarPositions.map((s, i) => (
                            <circle
                                key={`star-w-${i}`}
                                cx={s.cx} cy={s.cy} r={s.r}
                                fill={`rgba(255,255,255,${s.o})`}
                            >
                                <animate
                                    attributeName="opacity"
                                    values={`${s.o}; ${Math.max(0.12, Number(s.o) + 0.3)}; ${s.o}`}
                                    dur={`${s.dur}s`}
                                    repeatCount="indefinite"
                                />
                            </circle>
                        ))}

                        <g
                            className="moon-rot-welcome"
                            transform="translate(1000, 200)"
                            filter="url(#glowWelcome)"
                        >
                            {/* Moon/Planet color updated for better dark mode contrast */}
                            <circle cx="0" cy="0" r="150" fill="#aab8c9" />
                            <circle cx="-25" cy="-15" r="100" fill="#93a2b3" opacity="0.82" />
                        </g>
                    </svg>
                    {/* --- END SVG Background --- */}


                    {/* Content Overlay */}
                    <div className="relative z-10 text-center text-white max-w-xl w-full p-6">

                        {/* Alien Head Icon with Floating Animation (Sharper, more integrated) */}
                        <div className="w-24 h-24 flex items-center justify-center mx-auto mb-8 animate-alien-float">
                            {/* Custom Alien Head SVG: Used a strong cyan glow for high contrast */}
                            <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                width="96" 
                                height="96" 
                                viewBox="0 0 32 32"
                                // CHANGE: Increased glow intensity
                                className="text-cyan-300 filter drop-shadow-[0_0_12px_rgba(0,255,255,0.9)]"
                            >
                                {/* Triangle Head */}
                                <polygon 
                                    points="16,4 28,28 4,28" 
                                    style={{fill:'none', stroke:'#00FFFF', strokeWidth:'1.5'}} 
                                />
                                {/* Eye/Cockpit */}
                                <circle cx="16" cy="19" r="4" style={{fill:'#00FFFF'}} />
                            </svg>
                        </div>
                        
                        <h2 className="text-6xl font-extrabold mb-4 min-h-[60px] text-white tracking-widest text-shadow-lg text-glow">
                            {welcomeText}
                            {/* Cursor Blinker */}
                            <span className="ml-1 w-1 h-12 bg-cyan-400 inline-block animate-pulse rounded-sm"></span>
                        </h2>
                        
                        <p className="text-indigo-300 mb-10 text-xl font-light tracking-wider">
                            Mission received. You are now connected to the Pixo network.
                        </p>
                        
                        {/* Status Bar */}
                        <div className="w-2/3 mx-auto bg-gray-800 rounded-full h-2.5 shadow-inner">
                            <div 
                                // CHANGE: Richer gradient for the progress fill
                                className="bg-gradient-to-r from-cyan-400 to-indigo-500 h-2.5 rounded-full shadow-lg shadow-cyan-500/30 transition-all duration-[3000ms] ease-out"
                                style={{ width: '100%' }}
                            ></div>
                        </div>
                    </div>
                </div>
            </>
        );
    }
    // --- END UPDATED WELCOME SCREEN UI FOR PROFESSIONAL DARK MODE ---

    // Show Reels modal
    if (showReels) {
        return <Reels onClose={handleCloseReels} />;
    }

    return (
        <>
            {/* The global CSS definitions need to remain available for the animation to work if it's triggered later */}
            <style jsx="true">{`
                .moon-rot-welcome { animation: moon-rotate-welcome 90s linear infinite; transform-box: fill-box; transform-origin: 50% 50%; }
                @keyframes moon-rotate-welcome { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
                @keyframes alien-float { 0% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-10px) rotate(1deg); } 100% { transform: translateY(0) rotate(0deg); } }
                .animate-alien-float { animation: alien-float 3s ease-in-out infinite; }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
                .animate-pulse { animation: pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
            `}</style>

            {/* --- Mobile Bottom Navigation (Refined) --- */}
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 sm:hidden shadow-lg">
                <div className="flex justify-around items-center py-2">
                    {mobileNavItems.map((item, index) => {
                        const isActive = location.pathname === item.path || (item.path === '/profile' && location.pathname.startsWith('/profile'));
                        
                        // Special handling for Reels since it's a modal
                        const isReelsActive = item.name === 'Reels' && showReels;
                        
                        return (
                            <button
                                key={index}
                                onClick={() => item.onClick ? item.onClick() : handleNavigation(item.path)}
                                className={`flex flex-col items-center p-2 rounded-xl transition-all duration-300 ${
                                    isActive || isReelsActive
                                        ? 'text-purple-600 bg-purple-50 shadow-sm' 
                                        : 'text-gray-500 hover:text-purple-500 hover:bg-gray-50'
                                }`}
                            >
                                <div className={`${isActive || isReelsActive ? 'scale-105' : 'scale-100'} transition-transform`}>
                                    {item.icon}
                                </div>
                                <span className="text-xs mt-1 font-medium">{item.name}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* --- Desktop Sidebar & Mobile Full Menu --- */}
            <div className={`fixed top-0 left-0 h-screen w-64 xl:w-72 bg-white border-r border-gray-100 flex flex-col justify-between z-[51] shadow-2xl overflow-y-auto
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
                sm:translate-x-0 
                transition-transform duration-300 ease-in-out`}>
                
                <div className='w-full'>
                    {/* Header with Logo and Close Button */}
                    <div className='flex items-center justify-between p-4 border-b border-gray-100 shadow-sm'>
                        <div onClick={() => navigate('/')} className='flex items-center gap-3 cursor-pointer'>
                            <img src={assets.logo} className='w-8 h-8' alt="Pixo Logo" />
                            <h1 className='text-xl font-extrabold text-gray-900'>
                                <span className="text-green-600">Pixo</span>Net
                            </h1>
                        </div>
                        
                        {/* X Button - Visible on mobile, closes full menu */}
                        <button
                            onClick={handleCloseSidebar}
                            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all duration-200 sm:hidden"
                            aria-label="Close menu"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    
                    {/* Create Post Button (Desktop/Tablet) */}
                    <div className='mt-4 px-4'>
                        <Link to='/create-post' className='flex items-center justify-center gap-3 w-full py-3 rounded-xl bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 active:scale-[0.99] transition-all duration-200 text-white font-bold shadow-lg shadow-green-200 hover:shadow-xl'>
                            <CirclePlus className='w-5 h-5'/>
                            Create New Post
                        </Link>
                    </div>

                    {/* Navigation Links */}
                    <div className='px-3 pt-4 space-y-1.5'>
                        {menuItems.map((item, index) => {
                            if (item.isSeparator) {
                                return <div key={index} className='h-px bg-gray-200 my-4 mx-2' />;
                            }
                            
                            const isActive = location.pathname === item.path || (item.path === '/profile' && location.pathname.startsWith('/profile'));
                            const isReelsActive = item.name === 'Reels' && showReels;
                            
                            return (
                                <div 
                                    key={index}
                                    onClick={() => handleNavigation(item.path, item.onClick)}
                                    className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all duration-200 group
                                                ${isActive || isReelsActive
                                                    // New Pill Style Active State
                                                    ? item.name === 'Reels' 
                                                        ? 'bg-purple-50 text-purple-700 font-semibold shadow-sm ring-2 ring-purple-100'
                                                        : 'bg-green-50 text-green-700 font-semibold shadow-sm ring-2 ring-green-100'
                                                    // Hover State
                                                    : item.name === 'Reels'
                                                        ? 'hover:bg-purple-50 text-gray-700 hover:text-purple-600 font-medium'
                                                        : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900 font-medium'
                                                } 
                                                active:scale-[0.99]`}
                                >
                                    <div className={`${
                                        isActive || isReelsActive 
                                            ? item.name === 'Reels' ? 'text-purple-600' : 'text-green-600'
                                            : 'text-gray-500 group-hover:text-green-600'
                                        } transition-colors ${item.name === 'Reels' ? 'group-hover:text-purple-600' : ''}`}>
                                        {item.icon}
                                    </div>
                                    <p className={`transition-colors tracking-wide ${
                                        isActive || isReelsActive 
                                            ? item.name === 'Reels' ? 'text-purple-800 font-bold' : 'text-green-800 font-bold'
                                            : 'text-gray-700 group-hover:text-gray-900'
                                        }`}>{item.name}</p>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Footer Section: User, Theme, Sign Out */}
                <div className='w-full border-t border-gray-100 p-4 flex flex-col gap-4 flex-shrink-0'> 
                    {/* User Profile Summary */}
                    <div 
                        className='flex gap-3 items-center cursor-pointer p-2 rounded-xl hover:bg-gray-100 transition duration-200'
                        onClick={handleViewProfile}
                    >
                        {/* Clerk UserButton provides its own styling and logic */}
                        <UserButton afterSignOutUrl='/' appearance={{ elements: { userButtonAvatarBox: "w-9 h-9" } }} />
                        <div className="flex-1 min-w-0">
                            <h1 className='text-sm font-semibold text-gray-800 truncate'>{user?.full_name || 'Pixo User'}</h1>
                            <p className='text-xs text-gray-500 truncate'>@{user?.username || 'username'}</p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className='flex justify-between items-center px-1'>
                        <button className='p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition' title='Toggle Theme'>
                            <Sun className='w-5 h-5'/>
                        </button>
                        <button
                            onClick={signOut} 
                            className='flex items-center gap-2 text-red-600 hover:text-white transition font-medium text-sm px-3 py-1.5 rounded-full hover:bg-red-500 active:scale-[0.98]'
                            title='Sign Out'
                        >
                            <LogOut className='w-5 h-5'/>
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}

export default Sidebar;