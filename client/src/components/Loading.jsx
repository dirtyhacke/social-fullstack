import React from "react";
import PropTypes from 'prop-types';

/**
 * A loading screen styled to resemble the clean, colorful aesthetic of Instagram.
 * Uses the signature gradient on the icon and the continuous loading bar.
 * * @param {string} height - The height of the container (default: 100vh).
 */
export default function SiteLoadingMinimal({ height = "100vh" }) {
    
    // Define the primary Instagram Gradient colors for the logo and loading bar
    const GRADIENT_START = '#f09433'; // Orange
    const GRADIENT_MIDDLE = '#dc2743'; // Red
    const GRADIENT_END = '#bc1888';   // Purple

  return (
    <>
      <style>{`
        /* --- Gradient Text/Icon CSS --- */
        /* This applies the gradient as the stroke color for the SVG icon */
        .instagram-gradient-text {
            /* Note: Using linear-gradient() in CSS background property */
            background: linear-gradient(45deg, ${GRADIENT_START}, ${GRADIENT_MIDDLE}, ${GRADIENT_END});
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            color: transparent; /* Fallback */
        }

        /* --- Loading Bar Animation --- */
        /* This creates a continuous back-and-forth loading effect */
        @keyframes line-progress {
            0% { transform: scaleX(0); transform-origin: left; }
            50% { transform: scaleX(1); transform-origin: left; }
            51% { transform: scaleX(1); transform-origin: right; }
            100% { transform: scaleX(0); transform-origin: right; }
        }
      `}</style>

      <div
        style={{ height }}
        className="bg-white flex flex-col items-center justify-center p-6 relative"
      >
        <div className="max-w-xs w-full text-center">
            
            {/* Instagram-Style Logo/Icon - Uses the CSS Gradient */}
            <svg 
                className="mx-auto w-24 h-24 mb-4" 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                aria-hidden="true"
            >
                {/* Path for a simple camera/app icon, stroked with the gradient class */}
                <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth="1.5" 
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.218A2 2 0 0110.404 4h3.192a2 2 0 011.664.89l.812 1.218A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" 
                    className="instagram-gradient-text" // Apply gradient to stroke
                />
                <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth="1.5" 
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" 
                    className="instagram-gradient-text" // Apply gradient to stroke
                />
            </svg>

            {/* Brand Name - Simple, subtle text below the icon */}
            <h1 className="text-3xl font-extrabold tracking-wide mb-8 text-gray-900">
                PIXO Connect
            </h1>
          
            {/* Loading Indicator: Continuous Gradient Line */}
            <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                <div 
                    className="h-full rounded-full"
                    style={{
                        // Apply the gradient as the bar color
                        background: `linear-gradient(90deg, ${GRADIENT_START}, ${GRADIENT_MIDDLE}, ${GRADIENT_END})`,
                        animation: `line-progress 2s infinite ease-in-out`,
                    }}
                ></div>
            </div>

            {/* Status Text */}
            <p className="text-sm text-gray-500 font-medium mt-6 animate-pulse">
                Loading your feed...
            </p>
        </div>
      </div>
    </>
  );
}

SiteLoadingMinimal.propTypes = {
    height: PropTypes.string,
};