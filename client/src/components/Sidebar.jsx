import React, { useState, useEffect, useMemo } from 'react';
import { assets } from '../assets/assets';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { CirclePlus, LogOut, Home, Users, Compass, MessageCircle, Shuffle, User, Bot, GamepadIcon, Film, Sun, Check } from 'lucide-react';
import { UserButton, useClerk } from '@clerk/clerk-react';
import { useSelector } from 'react-redux';
import ProfileModal from './ProfileModal';

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
    
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showWelcome, setShowWelcome] = useState(false);
    const [welcomeText, setWelcomeText] = useState('');

    const welcomeStarPositions = useMemo(() => STAR_POSITIONS(), []);

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
    
    const handleEditProfile = () => {
        setShowProfileModal(true);
        if (window.innerWidth < 640) {
            setSidebarOpen(false);
        }
    }

    const menuItems = [
        { icon: <Home className='w-5 h-5'/>, name: "Home", path: "/" },
        { icon: <Users className='w-5 h-5'/>, name: "Connections", path: "/connections" },
        { icon: <Compass className='w-5 h-5'/>, name: "Discover", path: "/discover" },
        { icon: <MessageCircle className='w-5 h-5'/>, name: "Messages", path: "/messages" },
        { isSeparator: true },
        { icon: <Shuffle className='w-5 h-5'/>, name: "Random Chat", path: "/random-chat", onClick: handleRandomChat, },
        { icon: <Bot className='w-5 h-5'/>, name: "AI Chat Bot", path: "/chat-bot", onClick: handleChatBot, },
        { icon: <GamepadIcon className='w-5 h-5'/>, name: "Pixo Games", path: "/pixo-games", onClick: handlePixoGames, },
        { icon: <Film className='w-5 h-5'/>, name: "Pixo Music", path: "/pixo-music", onClick: handlePixoMovies, },
        { isSeparator: true },
        { icon: <User className='w-5 h-5'/>, name: "Edit Profile", onClick: handleEditProfile, path: '#profile' }
    ];

    // --- FIX: Return null early if the welcome screen is active ---
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
                        50% { transform: translateY(-10px) rotate(1deg); }
                        100% { transform: translateY(0) rotate(0deg); }
                    }

                    .animate-alien-float {
                        animation: alien-float 3s ease-in-out infinite;
                    }

                    /* Ensure cursor pulse is defined if not in global Tailwind config */
                    @keyframes pulse {
                        0%, 100% { opacity: 1; }
                        50% { opacity: 0; }
                    }
                    .animate-pulse { animation: pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
                `}</style>
                
                {/* Welcome Animation Overlay (FULLSCREEN) - Only render this part */}
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#02030a] animate-fade-in">
                    
                    {/* --- FULLSCREEN Animated Space Background (KEPT) --- */}
                    <svg
                        className="absolute inset-0 w-full h-full"
                        viewBox="0 0 1440 900"
                        preserveAspectRatio="xMidYMid slice"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden
                    >
                        <defs>
                            <radialGradient id="nebulaWelcome" cx="50%" cy="50%">
                                <stop offset="0%" stopColor="#08152e" />
                                <stop offset="100%" stopColor="#02030a" />
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
                            <circle cx="0" cy="0" r="150" fill="#dbe7f5" />
                            <circle cx="-25" cy="-15" r="100" fill="#c9d8e8" opacity="0.82" />
                        </g>
                    </svg>
                    {/* --- END SVG Background --- */}


                    {/* Content Overlay */}
                    <div className="relative z-10 text-center text-white max-w-xl w-full">

                        {/* Alien Head Icon with Floating Animation */}
                        <div className="w-24 h-24 flex items-center justify-center mx-auto mb-8 animate-alien-float">
                            {/* Custom Alien Head SVG to match the cursor style (Cyan glow) */}
                            <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                width="96" 
                                height="96" 
                                viewBox="0 0 32 32"
                                className="text-cyan-400 filter drop-shadow-lg shadow-cyan-500/50"
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
                        
                        <h2 className="text-5xl font-extrabold mb-4 min-h-[50px] text-white tracking-wider">
                            {welcomeText}
                            <span className="ml-1 w-1 h-10 bg-cyan-400 inline-block animate-pulse"></span>
                        </h2>
                        
                        <p className="text-indigo-200 mb-8 text-2xl font-light">
                            Mission received. You are now connected to the Pixo network.
                        </p>
                        
                        <div className="w-2/3 mx-auto bg-indigo-900/50 rounded-full h-2">
                            <div 
                                className="bg-gradient-to-r from-cyan-400 to-indigo-500 h-2 rounded-full transition-all duration-3000 ease-out"
                                style={{ width: '100%' }}
                            ></div>
                        </div>
                    </div>
                </div>
                {showProfileModal && <ProfileModal setShowEdit={setShowProfileModal} />}
            </>
        );
    }
    // --- END FIX ---

    return (
        <>
            <style jsx="true">{`
                /* Global CSS definitions are necessary here for the entire component */
                .moon-rot-welcome { animation: moon-rotate-welcome 90s linear infinite; transform-box: fill-box; transform-origin: 50% 50%; }
                @keyframes moon-rotate-welcome { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
                @keyframes alien-float { 0% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-10px) rotate(1deg); } 100% { transform: translateY(0) rotate(0deg); } }
                .animate-alien-float { animation: alien-float 3s ease-in-out infinite; }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
                .animate-pulse { animation: pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
            `}</style>

            {/* --- Original Sidebar Content (ONLY renders if showWelcome is false) --- */}
            <div className={`fixed top-0 left-0 h-screen w-64 xl:w-72 bg-white border-r border-gray-200 flex flex-col justify-between z-[51] shadow-2xl overflow-y-auto
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
                sm:translate-x-0 
                transition-transform duration-300 ease-in-out`}>
                
                <div className='w-full'>
                    <div onClick={() => navigate('/')} className='flex items-center gap-3 p-4 border-b border-gray-100 cursor-pointer'>
                        <img src={assets.logo} className='w-10' alt="Pixo Logo" />
                        <h1 className='text-xl font-bold text-indigo-700'>Pixo</h1>
                    </div>
                    
                    <div className='px-4 pt-4 space-y-1.5'>
                        {menuItems.map((item, index) => {
                            if (item.isSeparator) {
                                return <div key={index} className='h-px bg-gray-200 my-4 mx-2' />;
                            }
                            
                            const isActive = location.pathname === item.path;
                            
                            return (
                                <div 
                                    key={index}
                                    onClick={() => handleNavigation(item.path, item.onClick)}
                                    className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all duration-200 group
                                                ${isActive 
                                                    ? 'bg-indigo-50 text-indigo-700 font-bold shadow-sm'
                                                    : 'hover:bg-gray-100 text-gray-700 hover:text-indigo-600 font-medium'
                                                } 
                                                active:scale-[0.98]`}
                                >
                                    <div className={`${isActive ? 'text-indigo-600' : 'text-gray-500 group-hover:text-indigo-500'} transition-colors`}>
                                        {item.icon}
                                    </div>
                                    <p className={`transition-colors ${isActive ? 'text-indigo-800 font-bold' : 'text-gray-700 group-hover:text-indigo-700'}`}>{item.name}</p>
                                </div>
                            )
                        })}
                    </div>

                    <div className='mt-6 px-4'>
                        <Link to='/create-post' className='flex items-center justify-center gap-3 w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 active:scale-[0.98] transition-all duration-200 text-white font-bold shadow-lg hover:shadow-xl'>
                            <CirclePlus className='w-5 h-5'/>
                            Create New Post
                        </Link>
                    </div>
                </div>

                <div className='w-full border-t border-gray-200 p-4 flex flex-col gap-4 flex-shrink-0'> 
                    <div 
                        className='flex gap-3 items-center cursor-pointer p-2 rounded-lg hover:bg-gray-100 transition duration-200'
                        onClick={handleEditProfile}
                    >
                        <UserButton />
                        <div>
                            <h1 className='text-md font-semibold text-gray-800'>{user?.full_name || 'Pixo User'}</h1>
                            <p className='text-xs text-gray-500'>@{user?.username || 'username'}</p>
                        </div>
                    </div>

                    <div className='flex justify-between items-center px-2'>
                        <button className='text-gray-500 hover:text-gray-700 transition' title='Toggle Theme'>
                            <Sun className='w-5 h-5'/>
                        </button>
                        <button
                            onClick={signOut} 
                            className='flex items-center gap-2 text-red-500 hover:text-red-700 transition font-medium text-sm p-1.5 rounded-lg hover:bg-red-50'
                            title='Sign Out'
                        >
                            <LogOut className='w-5 h-5'/>
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>

            {showProfileModal && <ProfileModal setShowEdit={setShowProfileModal} />}
        </>
    )
}

export default Sidebar