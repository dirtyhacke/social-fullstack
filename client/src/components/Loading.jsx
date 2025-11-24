import React from "react";

export default function SiteLoadingV2({ height = "100vh" }) {
  return (
    <div
      style={{ height }}
      className="relative overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 text-gray-800 flex flex-col items-center justify-center p-6"
    >
      {/* Realistic Background with Depth */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-50 via-gray-50 to-gray-100"></div>
      
      {/* Subtle Noise Texture */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iLjciIG51bU9jdGF2ZXM9IjEwIiBzdGl0Y2hUaWxlcz0ic3RpdGNoIj48L2ZlVHVyYnVsZW5jZT48ZmVDb2xvck1hdHJpeCB0eXBlPSJzYXR1cmF0ZSIgdmFsdWVzPSIwIj48L2ZlQ29sb3JNYXRyaXg+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSIzMDAiIGZpbHRlcj0idXJsKCNhKSIgb3BhY2l0eT0iMC4wMyI+PC9yZWN0Pjwvc3ZnPg==')] opacity-20"></div>

      {/* Content Area */}
      <div className="z-20 relative flex flex-col items-center justify-center w-full max-w-lg p-8 bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/50">
        
        {/* Realistic 3D Spinner */}
        <div className="mb-8 relative">
          <div className="w-16 h-16 relative">
            {/* Outer Ring with 3D Effect */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-b from-gray-200 to-gray-300 shadow-lg border border-gray-300"></div>
            <div className="absolute inset-1 rounded-full bg-gradient-to-b from-gray-100 to-gray-200 shadow-inner"></div>
            
            {/* Spinning Element */}
            <div className="absolute inset-2 rounded-full">
              <div className="w-full h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-600 animate-spin-slow shadow-md">
                <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-white rounded-full shadow-lg"></div>
              </div>
            </div>
            
            {/* Center Hub */}
            <div className="absolute inset-4 rounded-full bg-gradient-to-b from-gray-100 to-gray-200 border border-gray-300 shadow-inner flex items-center justify-center">
              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
            </div>
          </div>
          
          {/* Subtle Reflection */}
          <div className="absolute -inset-2 rounded-full bg-gradient-to-b from-white/30 to-transparent pointer-events-none"></div>
        </div>

        {/* Realistic Typography */}
        <div className="flex items-center gap-3 mb-6">
          {["P", "I", "X", "O"].map((letter, index) => (
            <div key={letter} className="relative">
              {/* Text Shadow for Depth */}
              <span
                className="text-4xl font-bold text-gray-800 relative z-10 block"
                style={{
                  animation: `typewriter 0.8s ease-out ${index * 0.2}s both`,
                  textShadow: '1px 1px 2px rgba(0,0,0,0.1), -1px -1px 2px rgba(255,255,255,0.8)'
                }}
              >
                {letter}
              </span>
              
              {/* Subtle Background Glow */}
              <div 
                className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-500/20 blur-sm rounded scale-110"
                style={{
                  animation: `glowPulse 2s ease-in-out infinite ${index * 0.3}s`
                }}
              ></div>
            </div>
          ))}
        </div>

        {/* Realistic Progress Indicator */}
        <div className="w-64 mb-6">
          {/* Track */}
          <div className="w-full h-2 bg-gray-200 rounded-full shadow-inner border border-gray-300 overflow-hidden">
            {/* Animated Progress Bar */}
            <div 
              className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-600 rounded-full relative animate-progress-realistic shadow-md"
              style={{
                backgroundSize: '200% 100%'
              }}
            >
              {/* Shine Effect */}
              <div className="absolute top-0 left-0 w-1/3 h-full bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 animate-shine"></div>
            </div>
          </div>
          
          {/* Progress Dots */}
          <div className="flex justify-between mt-2">
            {[0, 25, 50, 75, 100].map((percent) => (
              <div key={percent} className="flex flex-col items-center">
                <div className={`w-1 h-1 rounded-full ${percent === 50 ? 'bg-blue-500' : 'bg-gray-400'} mb-1`}></div>
                <span className="text-xs text-gray-500 font-medium">{percent}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Status Text */}
        <div className="text-center">
          <p className="text-gray-600 text-sm font-medium mb-1">
            Initializing application...
          </p>
          <p className="text-gray-400 text-xs font-light">
            Loading components • Verifying data • Preparing interface
          </p>
        </div>
      </div>

      {/* Subtle Floating Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-gray-400/30 rounded-full animate-float-realistic"
            style={{
              left: `${10 + Math.random() * 80}%`,
              top: `${10 + Math.random() * 80}%`,
              animationDelay: `${Math.random() * 6}s`,
              animationDuration: `${8 + Math.random() * 8}s`
            }}
          />
        ))}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes typewriter {
          0% {
            opacity: 0;
            transform: translateY(10px) scale(0.9);
          }
          70% {
            opacity: 1;
            transform: translateY(-2px) scale(1.02);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        @keyframes glowPulse {
          0%, 100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.1);
          }
        }
        
        @keyframes progress-realistic {
          0% {
            width: 0%;
            background-position: 100% 0;
          }
          50% {
            width: 70%;
            background-position: 0% 0;
          }
          100% {
            width: 100%;
            background-position: 100% 0;
          }
        }
        
        @keyframes shine {
          0% {
            left: -50%;
          }
          100% {
            left: 150%;
          }
        }
        
        @keyframes float-realistic {
          0%, 100% {
            transform: translate3d(0, 0, 0) rotate(0deg);
            opacity: 0.2;
          }
          25% {
            transform: translate3d(10px, -15px, 0) rotate(90deg);
            opacity: 0.4;
          }
          50% {
            transform: translate3d(-5px, -25px, 0) rotate(180deg);
            opacity: 0.6;
          }
          75% {
            transform: translate3d(-15px, -10px, 0) rotate(270deg);
            opacity: 0.4;
          }
        }
        
        .animate-progress-realistic {
          animation: progress-realistic 3s ease-in-out infinite;
        }
        
        .animate-shine {
          animation: shine 2s ease-in-out infinite;
        }
        
        .animate-float-realistic {
          animation: float-realistic linear infinite;
        }
        
        .animate-spin-slow {
          animation: spin 2s linear infinite;
        }
      `}</style>
    </div>
  );
}