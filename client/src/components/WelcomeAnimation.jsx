import React, { useEffect } from 'react';

const ProfessionalWelcomeScreen = ({ welcomeText, onAnimationComplete }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            if (onAnimationComplete) onAnimationComplete();
        }, 1800);
        return () => clearTimeout(timer);
    }, [onAnimationComplete]);

    return (
        <>
            <style jsx="true">{`
                @keyframes logo-pop {
                    0% { opacity: 0; transform: scale(0.8); }
                    100% { opacity: 1; transform: scale(1); }
                }
                @keyframes simple-fade-in {
                    from { opacity: 0; transform: translateY(5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-logo-pop { animation: logo-pop 0.5s ease-out forwards; }
                .animate-simple-fade-in { 
                    animation: simple-fade-in 0.4s ease-out forwards; 
                    animation-delay: 0.3s; 
                }
                .bw-gradient {
                    background: linear-gradient(180deg, #2c2c2c 0%, #000000 100%);
                }
            `}</style>
            
            <div className="fixed inset-0 z-[60] flex items-center justify-center bw-gradient">
                <div className="relative z-10 text-center max-w-lg w-full p-6 text-white">
                    <svg className="mx-auto mb-6 w-20 h-20 text-white animate-logo-pop" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.218A2 2 0 0110.404 4h3.192a2 2 0 011.664.89l.812 1.218A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>

                    <h2 className="text-4xl font-extrabold mb-2 animate-simple-fade-in">
                        {welcomeText} 
                    </h2>
                    <p className="text-lg font-medium text-gray-400 animate-simple-fade-in" style={{ animationDelay: '0.4s' }}>
                        Securing your connection...
                    </p>
                    
                    <div className="mt-8 w-1/4 mx-auto h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-1 bg-white rounded-full transition-all duration-[1800ms] ease-linear" style={{ width: '100%' }}></div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default ProfessionalWelcomeScreen;