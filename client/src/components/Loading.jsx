import React from "react";

export default function SiteLoadingMinimal({ height = "100vh" }) {
  return (
    <div
      style={{ height }}
      className="bg-white flex flex-col items-center justify-center p-6 relative"
    >
      <div className="max-w-xs w-full">
        {/* Brand */}
        <div className="flex justify-between items-end mb-2">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">PIXO</h1>
          <span className="text-xs font-mono text-gray-400 animate-pulse">LOADING...</span>
        </div>

        {/* Divider Line */}
        <div className="w-full h-px bg-gray-100 mb-6"></div>

        {/* Loading Blocks Animation */}
        <div className="flex gap-1 h-1 mb-8">
          {[0, 1, 2, 3].map((i) => (
             <div 
               key={i}
               className="flex-1 bg-gray-900"
               style={{
                 animation: `blockFade 1s ease-in-out infinite alternate ${i * 0.2}s`
               }}
             ></div>
          ))}
        </div>

        {/* Quote or Context (Optional for Professionalism) */}
        <p className="text-xs text-gray-400 font-medium text-center leading-relaxed">
          "Simplicity is the ultimate sophistication."
        </p>
      </div>

      <style>{`
        @keyframes blockFade {
          0% { opacity: 0.1; transform: scaleY(0.5); }
          100% { opacity: 1; transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}