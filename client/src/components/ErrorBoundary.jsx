// components/ErrorBoundary.jsx
import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Music Player Error:', error, errorInfo);
        this.setState({
            error: error,
            errorInfo: errorInfo
        });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gradient-to-br from-purple-900 to-indigo-900 flex items-center justify-center p-6">
                    <div className="text-center text-white">
                        <div className="text-6xl mb-4">😿</div>
                        <h1 className="text-2xl font-bold mb-2">Oops! Music Player Crashed</h1>
                        <p className="text-purple-200 mb-4">Something went wrong while loading music</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-2 bg-pink-500 hover:bg-pink-400 rounded-lg transition"
                        >
                            Reload Player
                        </button>
                        <details className="mt-4 text-left max-w-md mx-auto">
                            <summary className="cursor-pointer text-purple-300">Error Details</summary>
                            <pre className="text-xs mt-2 p-2 bg-purple-800 rounded overflow-auto">
                                {this.state.error && this.state.error.toString()}
                            </pre>
                        </details>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;