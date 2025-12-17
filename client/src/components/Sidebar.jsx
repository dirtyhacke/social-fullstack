import React, { useState, useEffect } from 'react';
import { assets } from '../assets/assets';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { CirclePlus, LogOut, Home, Users, Compass, MessageCircle, Shuffle, User, Bot, GamepadIcon, Film, Sun, X, Menu, Search, Clapperboard, Phone } from 'lucide-react';
import { UserButton, useClerk } from '@clerk/clerk-react';
import { useSelector } from 'react-redux';
import Reels from './Reels';
import WelcomeAnimation from './WelcomeAnimation';
import Calling from './Calling';

const Sidebar = ({ sidebarOpen, setSidebarOpen }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const user = useSelector((state) => state.user.value);
    const { signOut } = useClerk();
    
    const [showWelcome, setShowWelcome] = useState(false);
    const [welcomeText, setWelcomeText] = useState('');
    const [showReels, setShowReels] = useState(false);
    const [showCalling, setShowCalling] = useState(false);

    useEffect(() => {
        if (user?.full_name) {
            setShowWelcome(true);
            animateWelcomeText(user.full_name);
            
            document.body.style.overflow = 'hidden';

            return () => {
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

    const handleAnimationComplete = () => {
        setShowWelcome(false);
        document.body.style.overflow = 'unset';
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

    const handleCallingClick = () => {
        setShowCalling(true);
        setSidebarOpen(false);
        document.body.style.overflow = 'hidden';
    }

    const handleCloseCalling = () => {
        setShowCalling(false);
        document.body.style.overflow = 'unset';
    }

    const menuItems = [
        { icon: <Home className='w-5 h-5'/>, name: "Home", path: "/" },
        { icon: <Users className='w-5 h-5'/>, name: "Connections", path: "/connections" },
        { icon: <Compass className='w-5 h-5'/>, name: "Discover", path: "/discover" },
        { icon: <Clapperboard className='w-5 h-5'/>, name: "Reels", onClick: handleReelsClick },
        { icon: <Phone className='w-5 h-5'/>, name: "Calls", onClick: handleCallingClick },
        { isSeparator: true },
        { icon: <Shuffle className='w-5 h-5'/>, name: "Random Chat", path: "/random-chat", onClick: handleRandomChat, },
        { icon: <Bot className='w-5 h-5'/>, name: "AI Chat Bot", path: "/chat-bot", onClick: handleChatBot, },
        { icon: <GamepadIcon className='w-5 h-5'/>, name: "Pixo Games", path: "/pixo-games", onClick: handlePixoGames, },
        { icon: <Film className='w-5 h-5'/>, name: "Pixo Music", path: "/pixo-music", onClick: handlePixoMovies, },
        { isSeparator: true },
        { icon: <User className='w-5 h-5'/>, name: "My Profile", onClick: handleViewProfile, path: '/profile' }
    ];

    // Instagram-style bottom navigation items (icons only, no text)
    const mobileNavItems = [
        { icon: <Home className='w-6 h-6'/>, name: "Home", path: "/" },
        { icon: <Search className='w-6 h-6'/>, name: "Discover", path: "/discover" },
        { icon: <CirclePlus className='w-6 h-6'/>, name: "Create", path: "/create-post" },
        { icon: <Clapperboard className='w-6 h-6'/>, name: "Reels", onClick: handleReelsClick },
        { icon: <Phone className='w-6 h-6'/>, name: "Calls", onClick: handleCallingClick },
        { icon: <Menu className='w-6 h-6'/>, name: "More", onClick: () => setSidebarOpen(true) }
    ];

    // Show Welcome Animation
    if (showWelcome) {
        return (
            <WelcomeAnimation 
                fullName={user?.full_name}
                welcomeText={welcomeText}
                onAnimationComplete={handleAnimationComplete}
            />
        );
    }

    // Show Reels modal
    if (showReels) {
        return <Reels onClose={handleCloseReels} />;
    }

    // Show Calling modal
    if (showCalling) {
        return <Calling onClose={handleCloseCalling} />;
    }

    return (
        <>
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

            {/* --- Instagram-style Bottom Navigation (Icons only) --- */}
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 sm:hidden shadow-lg py-2">
                <div className="flex justify-around items-center">
                    {mobileNavItems.map((item, index) => {
                        const isActive = location.pathname === item.path || 
                                       (item.name === "Profile" && location.pathname.startsWith('/profile'));
                        
                        const isMoreActive = item.name === "More" && sidebarOpen;
                        
                        return (
                            <button
                                key={index}
                                onClick={() => item.onClick ? item.onClick() : handleNavigation(item.path)}
                                className={`p-3 rounded-full transition-all duration-200 ${
                                    isActive || isMoreActive
                                        ? 'text-green-600' 
                                        : 'text-gray-500 hover:text-green-500'
                                }`}
                                title={item.name}
                            >
                                {item.icon}
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
                            
                            const isActive = location.pathname === item.path || 
                                           (item.path === '/profile' && location.pathname.startsWith('/profile'));
                            
                            return (
                                <div 
                                    key={index}
                                    onClick={() => handleNavigation(item.path, item.onClick)}
                                    className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all duration-200 group
                                                ${isActive
                                                    ? 'bg-green-50 text-green-700 font-semibold shadow-sm ring-2 ring-green-100'
                                                    : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900 font-medium'
                                                } 
                                                active:scale-[0.99]`}
                                >
                                    <div className={`${
                                        isActive 
                                            ? 'text-green-600'
                                            : 'text-gray-500 group-hover:text-green-600'
                                        } transition-colors`}>
                                        {item.icon}
                                    </div>
                                    <p className={`transition-colors tracking-wide ${
                                        isActive 
                                            ? 'text-green-800 font-bold'
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
                    <div className='flex gap-3 items-center cursor-pointer p-2 rounded-xl hover:bg-gray-100 transition duration-200'>
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
                            onClick={() => signOut(() => navigate('/'))} 
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