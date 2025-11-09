import React, { useEffect, useRef, useMemo } from "react";
import { assets } from "../assets/assets";
import { TrendingUp } from "lucide-react";
import { SignIn } from "@clerk/clerk-react";

// --- START SVG BACKGROUND DATA GENERATION (KEPT) ---
const STAR_POSITIONS = () => {
  const arr = [];
  for (let i = 0; i < 80; i++) {
    arr.push({
      cx: Math.floor(Math.random() * 1440),
      cy: Math.floor(Math.random() * 900),
      r: (Math.random() * 1.2 + 0.2).toFixed(2),
      o: (Math.random() * 0.7 + 0.18).toFixed(2),
      dur: 5 + Math.random() * 5,
    });
  }
  return arr;
};
// --- END SVG BACKGROUND DATA GENERATION ---


const Login = () => {
  const audioRef = useRef(null);
  const starPositions = useMemo(() => STAR_POSITIONS(), []);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = 0.08;
      audio.play().catch(() => {});
    }
  }, []);
  
  return (
    <>
      <style jsx="true">{`
        /* --- Styles (KEPT) --- */
        @keyframes blink {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        .router-light {
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #00ffff;
          box-shadow: 0 0 15px 4px rgba(0, 255, 255, 0.5);
          animation: blink 2s infinite;
          z-index: 1;
        }
        .router-light:nth-child(1) { top: 20%; left: 25%; animation-delay: 0s; }
        .router-light:nth-child(2) { top: 40%; left: 50%; animation-delay: 1s; }
        .router-light:nth-child(3) { top: 60%; left: 30%; animation-delay: 1.5s; }
        .router-light:nth-child(4) { top: 75%; left: 70%; animation-delay: 0.5s; }

        .moon-rot { 
            animation: moon-rotate 60s linear infinite; 
            transform-box: fill-box;
            will-change: transform; 
        }
        @keyframes moon-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .custom-cursor {
            cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><polygon points="16,4 28,28 4,28" style="fill:none;stroke:%2300FFFF;stroke-width:2"/><circle cx="16" cy="19" r="4" style="fill:%2300FFFF"/></svg>') 16 16, pointer;
        }

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
        className="min-h-screen flex flex-col md:flex-row relative overflow-hidden bg-black text-white custom-cursor"
      >

        {/* --- Cosmic Background (SVG Content) --- */}
        <div className="absolute inset-0 z-0 overflow-hidden bg-[#02030a]">
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 1440 900"
            preserveAspectRatio="xMidYMid slice"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            <defs>
              <radialGradient id="nebulaMoon" cx="35%" cy="25%">
                <stop offset="0%" stopColor="#061022" />
                <stop offset="35%" stopColor="#030816" />
                <stop offset="75%" stopColor="#00040a" />
                <stop offset="100%" stopColor="#000006" />
              </radialGradient>
              <filter id="softGlowSm" x="-40%" y="-40%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur2" />
                <feMerge>
                  <feMergeNode in="blur2" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <rect width="100%" height="100%" fill="url(#nebulaMoon)" />

            {starPositions.map((s, i) => (
              <circle
                key={`star-${i}`}
                cx={s.cx}
                cy={s.cy}
                r={s.r}
                fill={`rgba(255,255,255,${s.o})`}
              >
                <animate
                  attributeName="cx"
                  values={`${s.cx};${s.cx + Math.random() * 40 - 20};${s.cx}`}
                  dur={`${s.dur}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="cy"
                  values={`${s.cy};${s.cy + Math.random() * 40 - 20};${s.cy}`}
                  dur={`${s.dur}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values={`${s.o}; ${Math.max(0.12, Number(s.o) + 0.3)}; ${s.o}`}
                  dur={`${s.dur}s`}
                  repeatCount="indefinite"
                />
              </circle>
            ))}

            <g
              className="moon-rot"
              transform="translate(220,270)"
              style={{ transformOrigin: "220px 220px" }}
              filter="url(#softGlowSm)"
            >
              <circle cx="0" cy="0" r="120" fill="#dbe7f5" />
              <circle cx="-18" cy="-12" r="90" fill="#c9d8e8" opacity="0.82" />
              <g fill="#98a9bb" opacity="0.95">
                <ellipse cx="-40" cy="-10" rx="12" ry="8" />
                <ellipse cx="10" cy="20" rx="18" ry="12" />
                <ellipse cx="40" cy="-30" rx="9" ry="6" />
                <ellipse cx="-5" cy="-45" rx="7" ry="5" />
                <ellipse cx="60" cy="10" rx="14" ry="9" />
              </g>
            </g>
          </svg>
          {/* --- End SVG Content --- */}


          {/* Router lights and Audio (KEPT) */}
          <div className="router-light"></div>
          <div className="router-light"></div>
          <div className="router-light"></div>
          <div className="router-light"></div>

          <audio
            ref={audioRef}
            autoPlay
            loop
            src="https://cdn.pixabay.com/download/audio/2022/03/15/audio_6b7f6fa82a.mp3?filename=ambient-space-110626.mp3"
          />
        </div>

        {/* LEFT SIDE — Branding (KEPT) */}
        <div className="hidden md:flex flex-1 flex-col items-start justify-center px-12 lg:pl-24 xl:pl-48 z-10 fade-left">
          <div className="flex items-center gap-3 mb-10">
            <img
              src={assets.logo}
              alt="PIXO Logo"
              className="h-14 sm:h-16 object-contain filter brightness-200 transition duration-300 hover:scale-110"
            />
            <h1 className="text-4xl font-extrabold text-white">PIXO</h1>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <TrendingUp className="w-6 h-6 text-emerald-400" />
            <p className="text-indigo-200 font-medium">
              Where connection meets creativity.
            </p>
          </div>

          <h1 className="text-6xl lg:text-7xl font-extrabold leading-tight text-white"> 
            Build your <br /> digital universe.
          </h1>
          <p className="mt-6 text-xl text-indigo-100 max-w-lg leading-relaxed">
            Dive into a world where ideas orbit freely — your identity, your
            story, your space.
          </p>
        </div>

        {/* RIGHT SIDE — Login (KEPT) */}
        <div className="w-full md:w-2/5 flex flex-col items-center justify-center p-6 sm:p-10 z-10 h-screen bg-gradient-to-t from-black/60 via-black/40 to-transparent fade-up">
          <div className="text-center mb-10">
            <h2 className="text-5xl font-extrabold leading-tight text-white"> 
              Welcome Back, Explorer 🚀
            </h2>
            <p className="text-indigo-200 mt-3 text-lg tracking-wide">
              Sign in and continue your cosmic journey.
            </p>
          </div>

          <div className="w-full max-w-sm">
            <SignIn
              appearance={{
                elements: {
                  rootBox: "w-full",
                  // REVERTED: Clerk card is now fully transparent with no shadow/blur
                  card: "bg-transparent shadow-none", 
                  headerTitle: "hidden",
                  headerSubtitle: "hidden",
                  socialButtonsBlockButton:
                    "bg-white/10 text-white hover:bg-white/20 border-white/20 transition duration-300",
                  formButtonPrimary:
                    "bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition duration-300 shadow-md shadow-indigo-500/30",
                  formFieldLabel: "text-white font-medium",
                  input:
                    "bg-white/10 border-white/20 text-white placeholder-white/50 focus:border-indigo-400 focus:bg-white/15 transition duration-300",
                  footerActionText: "text-white/80",
                  footerActionLink: "text-white hover:text-indigo-300 transition",
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