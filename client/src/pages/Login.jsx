import React from 'react'
import { assets } from '../assets/assets'
import { Star } from 'lucide-react'
import { SignIn } from '@clerk/clerk-react'

const Login = () => {
  return (
    <div className='min-h-screen flex flex-col md:flex-row relative font-sans'>
      
      {/* 1. Background Image & Improved Dark Overlay for Contrast */}
      <div className='absolute inset-0 z-0'>
        <img src={assets.bgImage} alt="Abstract Social Background" className='w-full h-full object-cover'/>
        {/* Dark overlay for high contrast */}
        <div className='absolute inset-0 bg-black/70'></div> 
      </div>
      
      {/* 2. Left side: Branding & Marketing Message 
          *** HIDDEN ON MOBILE (sm/xs) SCREENS *** */}
      <div className='hidden md:flex flex-1 flex-col items-start justify-start p-8 md:p-12 lg:pl-20 xl:pl-48 z-10 text-white pb-0 md:pb-12'>
        
        {/* Logo */}
        <img src={assets.logo} alt="PingUp Logo" className='h-12 sm:h-14 md:h-16 object-contain filter brightness-200 contrast-100'/>
        
        {/* Headline & Description */}
        <div className='mt-20 md:mt-0'> 
            <div className='flex items-center gap-4 mb-4'> 
                <img src={assets.group_users} alt="User Group Icon" className='h-8 sm:h-10 md:h-12 object-contain'/>
                <div>
                    {/* Star Rating */}
                    <div className='flex'>
                        {Array(5).fill(0).map((_, i)=>(
                          <Star key={i} className='size-5 text-transparent fill-amber-400'/>
                        ))}
                    </div>
                    <p className='text-sm sm:text-base font-medium text-indigo-200'>Used by 12k+ developers</p>
                </div>
            </div>
            {/* Improved Gradient for Contrast */}
            <h1 className='text-4xl sm:text-6xl md:text-7xl font-extrabold pb-3 
                           bg-gradient-to-r from-white to-indigo-200 bg-clip-text text-transparent leading-tight'>
                More than just friends <br className='hidden md:inline'/> truly **connect**
            </h1>
            <p className='text-lg sm:text-2xl text-indigo-100 max-w-sm sm:max-w-md font-light mt-2'>
                Connect with the global community on **PIXO**.
            </p>
        </div>
        
        {/* Bottom space retainer */}
        <span className='md:h-10 hidden md:block'></span>
      </div>
      
      {/* 3. Right side: Login Form Container 
          *** Uses h-screen on mobile for perfect vertical centering *** */}
      <div className='w-full md:w-2/5 flex items-center justify-center p-6 sm:p-10 z-10 h-screen md:min-h-0'>
          {/* Transparent container for Clerk */}
          <div className='w-full max-w-sm p-6 sm:p-8 rounded-2xl bg-transparent'>
              
              <SignIn appearance={{
                  elements: {
                      rootBox: "w-full",
                      card: "shadow-none bg-transparent", 
                      headerTitle: "text-gray-100 text-2xl font-bold",
                      headerSubtitle: "text-indigo-200",
                      socialButtonsBlockButton: "bg-white/95 text-indigo-900 hover:bg-white transition",
                      formButtonPrimary: "bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition",
                      footerActionText: "text-indigo-200",
                      footerActionLink: "text-white hover:text-indigo-100 underline transition",
                      // Input fields customization
                      formFieldLabel: "text-white/80 font-medium",
                      input: "bg-white/10 border-white/30 text-white placeholder-indigo-200/50 focus:border-indigo-400"
                  }
              }}/>
          </div>
      </div>
    </div>
  )
}

export default Login
