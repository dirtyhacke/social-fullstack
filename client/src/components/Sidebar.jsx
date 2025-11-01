import React from 'react'
import { assets, dummyUserData } from '../assets/assets'
import { Link, useNavigate } from 'react-router-dom'
import MenuItems from './MenuItems'
import { CirclePlus, LogOut, Home, Users, Compass, MessageCircle, Shuffle } from 'lucide-react'
import {UserButton, useClerk} from '@clerk/clerk-react'
import { useSelector } from 'react-redux';

const Sidebar = ({sidebarOpen, setSidebarOpen}) => {

    const navigate = useNavigate()
    const user = useSelector((state) => state.user.value)
    const {signOut} = useClerk()

    const handleRandomChat = () => {
        // Navigate to random chat page
        navigate('/random-chat');
        
        // Close sidebar on mobile
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
        {
            icon: <Shuffle className='w-5 h-5'/>,
            name: "Random Chat",
            path: "/random-chat",
            onClick: handleRandomChat
        }
    ]

  return (
    <div className={`w-60 xl:w-72 bg-white border-r border-gray-200 flex flex-col justify-between items-center max-sm:absolute top-0 bottom-0 z-20 ${sidebarOpen ? 'translate-x-0' : 'max-sm:-translate-x-full'} transition-all duration-300 ease-in-out`}>
      <div className='w-full'>
            <img onClick={()=> navigate('/')} src={assets.logo} className='w-16 ml-7 my-2 cursor-pointer' alt="" />
            <hr className='border-gray-300 mb-8'/>

            {/* Menu Items */}
            <div className='px-4 space-y-2'>
                {menuItems.map((item, index)=>(
                    <div 
                        key={index}
                        onClick={() => {
                            if (item.onClick) {
                                item.onClick();
                            } else {
                                navigate(item.path);
                                if (window.innerWidth < 640) {
                                    setSidebarOpen(false);
                                }
                            }
                        }}
                        className='flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-gray-100 active:scale-95 transition-all duration-200 group'
                    >
                        <div className='text-gray-600 group-hover:text-indigo-600 transition-colors'>
                            {item.icon}
                        </div>
                        <p className='text-gray-700 group-hover:text-indigo-700 font-medium transition-colors'>{item.name}</p>
                    </div>
                ))}
            </div>

            {/* Create Post Button */}
            <Link to='/create-post' className='flex items-center justify-center gap-2 py-2.5 mt-6 mx-6 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-700 hover:to-purple-800 active:scale-95 transition text-white cursor-pointer'>
                <CirclePlus className='w-5 h-5'/>
                Create Post
            </Link>
      </div>

        <div className='w-full border-t border-gray-200 p-4 px-7 flex items-center justify-between'>
            <div className='flex gap-2 items-center cursor-pointer'>
                <UserButton />
                <div>
                    <h1 className='text-sm font-medium'>{user.full_name}</h1>
                    <p className='text-xs text-gray-500'>@{user.username}</p>
                </div>
            </div>
            <LogOut onClick={signOut} className='w-4.5 text-gray-400 hover:text-gray-700 transition cursor-pointer'/>
        </div>

    </div>
  )
}

export default Sidebar