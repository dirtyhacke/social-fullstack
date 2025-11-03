import React, { useState } from 'react'
import { assets } from '../assets/assets'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { CirclePlus, LogOut, Home, Users, Compass, MessageCircle, Shuffle, User, Bot, GamepadIcon, Film, Sun } from 'lucide-react'
import { UserButton, useClerk } from '@clerk/clerk-react'
import { useSelector } from 'react-redux';
import ProfileModal from './ProfileModal';

const Sidebar = ({ sidebarOpen, setSidebarOpen }) => {
    const navigate = useNavigate()
    const location = useLocation()
    const user = useSelector((state) => state.user.value)
    const { signOut } = useClerk()
    
    const [showProfileModal, setShowProfileModal] = useState(false);

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
    const handlePixoMovies = () => handleNavigation('/pixo-movies', () => navigate('/pixo-movies'));
    
    const handleEditProfile = () => {
        setShowProfileModal(true);
        if (window.innerWidth < 640) {
            setSidebarOpen(false);
        }
    }

    const menuItems = [
        {
            icon: <Home className='w-5 h-5'/>,
            name: "Home",
            path: "/"
        },
        {
            icon: <Users className='w-5 h-5'/>,
            name: "Connections",
            path: "/connections"
        },
        {
            icon: <Compass className='w-5 h-5'/>,
            name: "Discover",
            path: "/discover"
        },
        {
            icon: <MessageCircle className='w-5 h-5'/>,
            name: "Messages",
            path: "/messages"
        },
        { isSeparator: true },
        {
            icon: <Shuffle className='w-5 h-5'/>,
            name: "Random Chat",
            path: "/random-chat",
            onClick: handleRandomChat,
        },
        {
            icon: <Bot className='w-5 h-5'/>,
            name: "AI Chat Bot",
            path: "/chat-bot",
            onClick: handleChatBot,
        },
        {
            icon: <GamepadIcon className='w-5 h-5'/>,
            name: "Pixo Games",
            path: "/pixo-games",
            onClick: handlePixoGames,
        },
        {
            icon: <Film className='w-5 h-5'/>,
            name: "Pixo Movies",
            path: "/pixo-movies",
            onClick: handlePixoMovies,
        },
        { isSeparator: true },
        {
            icon: <User className='w-5 h-5'/>,
            name: "Edit Profile",
            onClick: handleEditProfile,
            path: '#profile'
        }
    ]

    return (
        <>
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
                            
                            const isActive = item.path && location.pathname === item.path;
                            
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