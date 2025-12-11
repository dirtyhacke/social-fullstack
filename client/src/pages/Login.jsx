import React, { useEffect, useRef, useMemo } from "react";
import { assets } from "../assets/assets";
import { Users, Zap } from "lucide-react"; // Using Icons relevant to social networking
import { SignIn } from "@clerk/clerk-react";

const Login = () => {
  const audioRef = useRef(null);
  
  // Configuration to match the Welcome Screen (Deep Black BG, Cyan Accent)
  const PRIMARY_BG_COLOR = '#02030a'; 
  const ACCENT_COLOR = '#00FFFF'; // Cyan/Teal, giving a futuristic/digital feel

  useEffect(() => {
    // We keep the audio removed for the minimalist theme
  }, []);
  
  return (
    <>
      <style jsx="true">{`
        /* --- Styles (Simplified and Reused) --- */
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInLeft {
          from { opacity: 0; transform: translateX(-40px); }
          to { transform: translateX(0); opacity: 1; }
        }
        .fade-up { animation: fadeInUp 1.5s ease-out forwards; }
        .fade-left { animation: fadeInLeft 1.5s ease-out forwards; }
      `}</style>

      <div 
        className="min-h-screen flex flex-col md:flex-row relative overflow-hidden text-white"
        style={{ backgroundColor: PRIMARY_BG_COLOR }}
      >

        {/* --- Simple Black Background --- */}
        <div className="absolute inset-0 z-0 overflow-hidden" style={{ backgroundColor: PRIMARY_BG_COLOR }}>
          {/* Background is solid black */}
        </div>

        {/* LEFT SIDE — Branding (Social Theme) */}
        <div className="hidden md:flex flex-1 flex-col items-start justify-center px-12 lg:pl-24 xl:pl-48 z-10 fade-left">
          
          <div className="flex items-center gap-3 mb-10">
            {/* Logo image kept */}
            <img
              src={assets.logo}
              alt="PIXO Logo"
              className="h-14 sm:h-16 object-contain filter brightness-200 transition duration-300"
            />
            <h1 className="text-4xl font-extrabold text-white">PIXO Connect</h1>
          </div>

          <div className="flex items-center gap-4 mb-6">
            {/* Social media relevant icon (Users) matching the Cyan accent */}
            <Users className="w-6 h-6" style={{ color: ACCENT_COLOR }} /> 
            <p className="text-gray-300 font-medium">
              Join the conversation and connect globally.
            </p>
          </div>

          <h1 className="text-6xl lg:text-7xl font-extrabold leading-tight text-white"> 
            Share your story, <br /> build your feed.
          </h1>
          <p className="mt-6 text-xl text-gray-400 max-w-lg leading-relaxed">
            Log in to see what your friends are posting and start creating.
          </p>
        </div>

        {/* RIGHT SIDE — Login (Social Theme) */}
        <div className="w-full md:w-2/5 flex flex-col items-center justify-center p-6 sm:p-10 z-10 h-screen bg-gradient-to-t from-black/60 via-black/40 to-transparent fade-up">
          <div className="text-center mb-10">
            <h2 className="text-5xl font-extrabold leading-tight text-white"> 
              Welcome to the Feed 
            </h2>
            <p className="text-gray-400 mt-3 text-lg tracking-wide">
              Securely sign in to PIXO Connect.
            </p>
          </div>

          <div className="w-full max-w-sm">
            <SignIn
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "bg-transparent shadow-none", 
                  headerTitle: "hidden",
                  headerSubtitle: "hidden",
                  
                  // Use White/Accent colors
                  socialButtonsBlockButton:
                    "bg-white/10 text-white hover:bg-white/20 border-white/20 transition duration-300",
                  
                  // Primary button uses the ACCENT_COLOR (Cyan)
                  formButtonPrimary:
                    "text-black font-semibold transition duration-300 shadow-md shadow-cyan-500/30",
                    style: { backgroundColor: ACCENT_COLOR }, 

                  formFieldLabel: "text-white font-medium",
                  input:
                    "bg-white/10 border-white/20 text-white placeholder-white/50 focus:border-cyan-400 focus:bg-white/15 transition duration-300",
                  footerActionText: "text-white/80",
                  footerActionLink: "text-white hover:text-cyan-300 transition",
                },
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;