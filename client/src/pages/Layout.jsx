import React, { useState } from 'react'
import Sidebar from '../components/Sidebar'
import { Outlet, useNavigate } from 'react-router-dom' // Added useNavigate
import { Menu, X } from 'lucide-react'
import { assets } from '../assets/assets' // Assuming assets has the logo
import Loading from '../components/Loading'
import { useSelector } from 'react-redux'

const Layout = () => {

    const user = useSelector((state)=>state.user.value)
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const navigate = useNavigate(); // Initialize navigate

    // Use Z-50 for elements that must be on top (sidebar, overlay, toggle)
    const zIndexTop = 'z-50'; 

    // Function to close the sidebar
    const handleToggle = () => setSidebarOpen(!sidebarOpen);

    // --- Mobile Header Component ---
    const MobileHeader = () => (
        // Fixed top bar visible only on small screens
        <div className={`fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:hidden ${zIndexTop}`}>
            
            {/* Menu Toggle Button (always on the left) */}
            <button onClick={handleToggle} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-700 transition">
                <Menu className='w-6 h-6'/>
            </button>

            {/* Logo/Title in Center */}
            <div onClick={() => navigate('/')} className='flex items-center gap-2 cursor-pointer'>
                {/* Assuming assets.logo exists */}
                <img src={assets.logo || '/default-logo.png'} className='w-7 h-7' alt="Pixo Logo" />
                <h1 className='text-xl font-bold text-indigo-700'>Pixo</h1>
            </div>
            
            {/* Spacer/User Icon Placeholder (optional) */}
            <div className="w-8 h-8 opacity-0"></div> 
            {/* You could place a quick-access UserButton here if desired */}
        </div>
    );
    // ---------------------------------

  return user ? (
    // Main Wrapper
    <div className='relative w-full min-h-screen flex bg-slate-50'>
        
        {/* 1. Mobile Header Bar (New Addition) */}
        <MobileHeader />

        {/* 2. Fixed Sidebar */}
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}/>
        
        {/* 3. Main Content Area */}
        <div 
            // Key Fix: Add padding-left for desktop sidebar clearance
            // **New:** Add padding-top for mobile header clearance (h-16 = pt-16)
            className='flex-1 transition-all duration-300 sm:pl-64 xl:pl-72 pt-16 sm:pt-0' 
        >
            {/* The Outlet content starts here */}
            <Outlet />
        </div>

        {/* 4. Mobile Sidebar Overlay */}
        {sidebarOpen && (
            <div 
                className={`fixed inset-0 bg-black/50 ${zIndexTop} sm:hidden`}
                onClick={() => setSidebarOpen(false)}
            />
        )}
        
        {/* 5. Sidebar Close Button (Only visible inside the sidebar's shadow area on mobile) */}
        {sidebarOpen && (
            <button 
                className={`absolute top-3 right-3 p-2 ${zIndexTop} bg-white rounded-full shadow-lg w-10 h-10 text-gray-600 sm:hidden cursor-pointer`}
                onClick={handleToggle}
            >
                <X className='w-6 h-6' />
            </button>
        )}
        
    </div>
  ) : (
    <Loading />
  )
}

export default Layout