import React from "react";

/**
 * Loading.jsx
 * Moon slightly lower, router lights blinking, moving background stars, and small network icon above PIXO name.
 */

export default function Loading({ height = "100vh" }) {
  const letters = ["P", "I", "X", "O"];

  const STAR_POSITIONS = React.useMemo(() => {
    const arr = [];
    for (let i = 0; i < 80; i++) {
      arr.push({
        cx: Math.floor(Math.random() * 1440),
        cy: Math.floor(Math.random() * 900),
        r: (Math.random() * 1.2 + 0.2).toFixed(2),
        o: (Math.random() * 0.7 + 0.18).toFixed(2),
        dur: 5 + Math.random() * 5
      });
    }
    return arr;
  }, []);

  return (
    <div style={{ height }} className="relative overflow-hidden bg-[#02030a] text-white flex items-center justify-center">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden>
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

        {STAR_POSITIONS.map((s, i) => (
          <circle key={`star-${i}`} cx={s.cx} cy={s.cy} r={s.r} fill={`rgba(255,255,255,${s.o})`}>
            <animate attributeName="cx" values={`${s.cx};${s.cx+Math.random()*40-20};${s.cx}`} dur={`${s.dur}s`} repeatCount="indefinite" />
            <animate attributeName="cy" values={`${s.cy};${s.cy+Math.random()*40-20};${s.cy}`} dur={`${s.dur}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values={`${s.o}; ${Math.max(0.12, Number(s.o) + 0.3)}; ${s.o}`} dur={`${s.dur}s`} repeatCount="indefinite" />
          </circle>
        ))}

        <g className="moon-rot" transform="translate(220,270)" style={{ transformOrigin: '220px 220px' }} filter="url(#softGlowSm)">
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

      <div className="absolute inset-0 flex items-start justify-center pointer-events-none z-30">
        <svg width="86%" height="360" viewBox="0 0 900 260" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="cableMoon" x1="0" x2="1">
              <stop offset="0%" stopColor="#9fb9d9" />
              <stop offset="50%" stopColor="#e6eef7" />
              <stop offset="100%" stopColor="#9fb9d9" />
            </linearGradient>
            <filter id="pulseGlow" x="-40%" y="-40%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6"/>
              <feMerge><feMergeNode /><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          <path id="spaceCable" d="M120 140 C 300 60, 520 60, 740 110" stroke="url(#cableMoon)" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.98"/>

          <g>
            <circle r="7.2" fill="#eaf7ff" filter="url(#pulseGlow)">
              <animateMotion dur="3.2s" repeatCount="indefinite" path="M120 140 C 300 60, 520 60, 740 110" />
            </circle>
          </g>

          {/* realistic router with blinking lights */}
          <g transform="translate(740,110)">
            <rect x="-20" y="-16" width="60" height="40" rx="6" fill="#1a1f27" stroke="#cdd6e0" strokeOpacity="0.25" filter="url(#pulseGlow)" />
            <circle cx="12" cy="0" r="4" fill="#00ffea">
              <animate attributeName="opacity" values="1;0.2;1" dur="1.2s" repeatCount="indefinite" />
            </circle>
            <circle cx="-12" cy="0" r="4" fill="#ffec00">
              <animate attributeName="opacity" values="1;0.2;1" dur="1.4s" repeatCount="indefinite" />
            </circle>
            <rect x="-18" y="-14" width="36" height="2" fill="#4f5d6c" />
          </g>
        </svg>
      </div>

      {/* PIXO logo & mini animation with top center network icon */}
      <div className="z-40 relative flex flex-col items-center justify-center pointer-events-none px-4">
        <svg width="24" height="24" className="mb-2 animate-ping" viewBox="0 0 24 24" fill="none" stroke="#00faff" strokeWidth="2">
          <path d="M12 18a3 3 0 100-6 3 3 0 000 6z" />
          <path d="M12 6v2M6.343 9.343l1.414 1.414M17.243 9.343l-1.414 1.414M4 12h2M18 12h2M6.343 14.657l1.414-1.414M17.243 14.657l-1.414-1.414M12 16v2" />
        </svg>
        <div className="flex items-center gap-4 select-none" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
          {letters.map((l, idx) => (
            <span key={l} className="pixo-letter" style={{
              background: 'linear-gradient(90deg,#f1f7ff,#d8e8ff)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              fontWeight: 900,
              fontSize: 'clamp(2rem, 6.1vw, 4rem)',
              lineHeight: 1,
              display: 'inline-block',
              transformOrigin: 'center',
              willChange: 'transform, filter',
              animationDelay: `${idx * 0.08}s`,
            }}>{l}</span>
          ))}
        </div>
        <p className="pixo-msg" style={{ marginTop: 12 }}>Establishing Lunar PIXO Link...</p>
      </div>

      <style>{`
        .moon-rot { animation: moon-rotate 60s linear infinite; transform-box: fill-box; }
        @keyframes moon-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .pixo-letter { animation: pixo-ripple 3.2s ease-in-out infinite; }
        @keyframes pixo-ripple { 0% { transform: translateY(0) scale(1); opacity: 0.94; } 45% { transform: translateY(-6px) scale(1.035); opacity: 1; } 100% { transform: translateY(0) scale(1); opacity: 0.94; } }

        .pixo-msg { color: #dfeeff; opacity: 0.92; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace; letter-spacing: 1.5px; font-size: clamp(0.9rem, 2.2vw, 1rem); animation: msgPulse 2.8s ease-in-out infinite; }
        @keyframes msgPulse { 0% { opacity: 0.88; transform: translateY(0px); } 50% { opacity: 1; transform: translateY(-4px); } 100% { opacity: 0.88; transform: translateY(0px); } }

        .animate-ping { animation: ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite; }
        @keyframes ping { 0% { transform: scale(0.7); opacity: 0.5; } 50% { transform: scale(1); opacity: 1; } 100% { transform: scale(0.7); opacity: 0.5; } }
      `}</style>
    </div>
  );
}