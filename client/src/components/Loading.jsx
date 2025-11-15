import React from "react";

/**
 * SiteLoadingV2.jsx
 * A clean, simple, full-screen loading page maintaining the dark, high-tech aesthetic
 * with a PIXO logo and tired character.
 * The cat and rat animation has been removed as requested.
 */

export default function SiteLoadingV2({ height = "100vh" }) {
  const letters = ["P", "I", "X", "O"];

  // Classy color palette
  const accentColor = "#40e0d0"; // Mint/Teal
  const gradientStart = "#40e0d0";
  const gradientEnd = "#7fffd4"; // Aquamarine

  return (
    <div
      style={{ height }}
      className="relative overflow-hidden bg-[#1a1a2e] text-white flex flex-col items-center justify-center p-6"
    >
      {/* Background Grid - Dark and Subtle (Full Screen) */}
      <div className="absolute inset-0 z-0 opacity-20" style={{ backgroundImage: "linear-gradient(to right, #333 1px, transparent 1px), linear-gradient(to bottom, #333 1px, transparent 1px)", backgroundSize: "20px 20px" }} />

      {/* Content Area - Centered (z-20 ensures it's above the grid) */}
      <div className="z-20 relative flex flex-col items-center justify-center pointer-events-none w-full max-w-lg p-6">

        {/* --- CARTOON CHARACTER (TOP) --- */}
        <div className="mb-8" style={{ transformOrigin: 'center' }}>
          <svg width="60" height="60" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Sleeping Blob Body - Mint/Teal */}
            <path d="M50 85 C 30 95, 15 70, 20 50 C 30 30, 70 30, 80 50 C 85 70, 70 95, 50 85 Z" fill={accentColor} />
            
            {/* Network Cable (held in hand) - Mint/Teal - Cable is now static */}
            <path d="M78 50 C 75 40, 85 30, 80 20" stroke={accentColor} strokeWidth="4" strokeLinecap="round" fill="none" />
            
            {/* Tired Eyes - Darker color on Mint/Teal body */}
            <path d="M40 52 L 45 52" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
            <path d="M55 52 L 60 52" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
            
            {/* Dark Circles/Bags - Subtle darker mint outline */}
            <path d="M38 52 C 40 54, 45 54, 47 52" stroke="#008080" strokeOpacity="0.5" strokeWidth="1" fill="none" strokeLinecap="round"/>
            <path d="M53 52 C 55 54, 60 54, 62 52" stroke="#008080" strokeOpacity="0.5" strokeWidth="1" fill="none" strokeLinecap="round"/>

            {/* Zzz's (floating) - Mint/Teal */}
            <text x="35" y="30" fontSize="12" fill={accentColor} className="zzz-float" style={{ transformOrigin: '35px 30px', animationDelay: '0s' }}>Z</text>
            <text x="45" y="25" fontSize="12" fill={accentColor} className="zzz-float" style={{ transformOrigin: '45px 25px', animationDelay: '0.6s' }}>z</text>
            <text x="55" y="20" fontSize="12" fill={accentColor} className="zzz-float" style={{ transformOrigin: '55px 20px', animationDelay: '1.2s' }}>z</text>
          </svg>
        </div>
        {/* --- END CARTOON CHARACTER --- */}


        {/* --- PIXO LOGO --- */}
        <div className="flex items-center gap-4 select-none mb-8">
          {letters.map((l, idx) => (
            <span key={l} className="pixo-letter" style={{
              background: `linear-gradient(90deg, ${gradientStart}, ${gradientEnd})`, // Mint gradient
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              fontWeight: 900,
              fontSize: 'clamp(3rem, 7.5vw, 5rem)',
              lineHeight: 1,
              display: 'inline-block',
              willChange: 'transform, filter, opacity',
              // Staggering the animation start
              animationDelay: `${idx * 0.1}s`,
            }}>{l}</span>
          ))}
        </div>
        {/* --- END PIXO LOGO --- */}
        
        <p className="mt-4 text-sm text-gray-400">LOADING. STAND BY...</p>
      </div>
      
      {/* The cat/rat animation block has been completely removed. */}


      {/* --- CSS STYLES AND ANIMATIONS --- */}
      <style>{`
        /* PIXO Letter Animation (Staggered Loop) */
        .pixo-letter { 
          animation: staggeredLoop 1.5s ease-in-out infinite; 
          opacity: 0;
        }

        /* Staggered Loop Animation (Faster Speed) */
        @keyframes staggeredLoop {
          /* Disappear/Start State */
          0%, 10% { 
            transform: translateY(20px) scale(0.8) skewX(0deg); 
            opacity: 0;
          }
          /* Fast Appear (Reveal) */
          20% { 
            transform: translateY(0) scale(1) skewX(0deg); 
            opacity: 1;
          }
          /* Hold and Subtle Scan Shift */
          50% { 
            transform: translateX(2px) skewX(1deg); 
            opacity: 0.95; 
          }
          /* Hold and Return to Center */
          80% { 
            transform: translateY(0) scale(1) skewX(0deg); 
            opacity: 1;
          }
          /* Fast Disappear (Reset for loop) */
          90%, 100% {
            transform: translateY(20px) scale(0.8) skewX(0deg);
            opacity: 0;
          }
        }

        /* Character Animations */
        /* Zzz's Animation */
        .zzz-float { 
          animation: zzz-float 2.5s ease-out infinite;
          opacity: 0;
        }
        @keyframes zzz-float {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          40% { opacity: 1; }
          100% { transform: translateY(-20px) scale(1.2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}