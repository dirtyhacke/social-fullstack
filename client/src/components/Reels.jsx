import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Heart, MessageCircle, Send, Bookmark, MoreVertical, X, Music, Heart as HeartSolid, Send as SendSolid, ChevronLeft, Flag, Copy, Link, Download as DownloadIcon, User, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import ReelComment from './ReelComment';

const Reels = ({ onClose }) => {
    const { getToken, userId } = useAuth();
    const navigate = useNavigate();
    
    // State management
    const [reels, setReels] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);
    const [likedReels, setLikedReels] = useState({});
    const [savedReels, setSavedReels] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [showDoubleTapHeart, setShowDoubleTapHeart] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [currentComments, setCurrentComments] = useState([]);
    const [commentText, setCommentText] = useState('');
    const [loadingComments, setLoadingComments] = useState(false);
    const [showShareMenu, setShowShareMenu] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [isLiking, setIsLiking] = useState({});
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [showDownloadProgress, setShowDownloadProgress] = useState(false);
    const [downloadedReels, setDownloadedReels] = useState({});
    
    const videoRefs = useRef([]);
    const lastTapTime = useRef(0);
    const commentInputRef = useRef(null);
    const containerRef = useRef(null);
    const observerRef = useRef(null);
    const canvasRef = useRef(null);

    // Fetch reels from API
    const fetchReels = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = await getToken();
            
            const { data } = await api.get('/api/post/feed', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data.success && Array.isArray(data.posts)) {
                // Filter only video posts (reels)
                const videoPosts = data.posts.filter(post => 
                    post.media_urls?.some(media => media.type === 'video')
                ).map(post => {
                    const videoMedia = post.media_urls.find(media => media.type === 'video');
                    const imageMedia = post.media_urls.find(media => media.type === 'image');
                    
                    // Count user's total reels (for display)
                    const userReelsCount = data.posts.filter(p => 
                        p.user?._id === post.user?._id && 
                        p.media_urls?.some(m => m.type === 'video')
                    ).length;
                    
                    return {
                        id: post._id,
                        videoUrl: videoMedia?.url,
                        thumbnail: imageMedia?.url,
                        username: post.user?.username || '@user',
                        fullName: post.user?.full_name || 'User',
                        caption: post.content || '',
                        likes: Array.isArray(post.likes_count) ? post.likes_count.length : (post.likes_count || 0),
                        comments: post.comments_count || 0,
                        shares: post.shares_count || 0,
                        userProfile: post.user?.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.user?.full_name || 'User')}&background=random`,
                        music: 'Original Sound',
                        timestamp: post.createdAt ? 
                            new Date(post.createdAt).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric' 
                            }) : 'Just now',
                        isVerified: false,
                        location: post.location,
                        createdAt: post.createdAt,
                        user: post.user,
                        userId: post.user?._id,
                        // Store if current user has liked this post
                        userHasLiked: Array.isArray(post.likes_count) ? post.likes_count.includes(userId) : false,
                        // User's reel count
                        userReelsCount: userReelsCount
                    };
                });
                
                setReels(videoPosts);
                
                // Initialize liked state from backend data
                const initialLikedState = {};
                videoPosts.forEach(reel => {
                    if (reel.userHasLiked) {
                        initialLikedState[reel.id] = true;
                    }
                });
                setLikedReels(initialLikedState);
                
                console.log(`✅ Loaded ${videoPosts.length} reels`);
            } else {
                toast.error(data.message || 'Failed to load reels');
                setReels([]);
            }
        } catch (error) {
            console.error('Error fetching reels:', error);
            toast.error('Failed to load reels');
            setReels([]);
        } finally {
            setIsLoading(false);
        }
    }, [getToken, userId]);

    useEffect(() => {
        fetchReels();
    }, [fetchReels]);

    // Setup Intersection Observer for auto-play
    useEffect(() => {
        if (reels.length === 0) return;

        const options = {
            root: containerRef.current,
            rootMargin: '0px',
            threshold: 0.5 // 50% of video should be visible
        };

        const handleIntersection = (entries) => {
            entries.forEach(entry => {
                const index = parseInt(entry.target.dataset.index);
                
                if (entry.isIntersecting) {
                    // This video is now in view
                    setCurrentIndex(index);
                    setIsPlaying(true);
                    
                    // Play the video
                    const video = videoRefs.current[index];
                    if (video) {
                        video.muted = false; // Unmute by default
                        video.play().catch(error => {
                            console.log('Auto-play failed:', error);
                            // If autoplay fails, try muted
                            video.muted = true;
                            video.play().catch(e => console.log('Muted autoplay also failed:', e));
                        });
                    }
                } else {
                    // Pause video that's out of view
                    const video = videoRefs.current[index];
                    if (video) {
                        video.pause();
                        video.muted = true; // Mute when not visible
                    }
                }
            });
        };

        observerRef.current = new IntersectionObserver(handleIntersection, options);

        // Observe all video containers
        const videoContainers = document.querySelectorAll('.video-container');
        videoContainers.forEach(container => {
            if (observerRef.current) {
                observerRef.current.observe(container);
            }
        });

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [reels]);

    // Manual play/pause control
    useEffect(() => {
        const currentVideo = videoRefs.current[currentIndex];
        if (!currentVideo) return;

        if (isPlaying) {
            currentVideo.muted = false;
            currentVideo.play().catch(error => {
                console.log('Manual play failed:', error);
                // Try muted play if audio play is blocked
                currentVideo.muted = true;
                currentVideo.play().catch(e => console.log('Muted play also failed:', e));
            });
        } else {
            currentVideo.pause();
        }
    }, [currentIndex, isPlaying]);

    // Stop all videos when component unmounts
    useEffect(() => {
        return () => {
            videoRefs.current.forEach(video => {
                if (video) {
                    video.pause();
                    video.currentTime = 0;
                    video.muted = true;
                }
            });
        };
    }, []);

    // Handle download functionality
    const handleDownload = async () => {
        const currentReel = reels[currentIndex];
        if (!currentReel || isDownloading || downloadedReels[currentReel.id]) return;

        setIsDownloading(true);
        setShowDownloadProgress(true);
        setDownloadProgress(0);

        try {
            // Show initial progress
            setDownloadProgress(10);
            
            // Fetch the video
            const response = await fetch(currentReel.videoUrl);
            if (!response.ok) throw new Error('Failed to fetch video');
            
            const contentLength = response.headers.get('content-length');
            const total = parseInt(contentLength || '0');
            const reader = response.body.getReader();
            let received = 0;
            let chunks = [];

            // Stream and track progress
            while (true) {
                setDownloadProgress(20);
                const { done, value } = await reader.read();
                
                if (done) break;
                
                chunks.push(value);
                received += value.length;
                
                // Update progress
                if (total > 0) {
                    const progress = Math.min(20 + (received / total * 70), 90);
                    setDownloadProgress(progress);
                }
            }

            // Combine chunks
            setDownloadProgress(90);
            const blob = new Blob(chunks, { type: 'video/mp4' });
            const blobUrl = URL.createObjectURL(blob);

            // Create video element to draw on canvas
            const video = document.createElement('video');
            video.src = blobUrl;
            
            await new Promise((resolve, reject) => {
                video.onloadedmetadata = resolve;
                video.onerror = reject;
            });

            // Load video
            await video.play();
            video.pause();
            video.currentTime = 0;

            // Wait for video to be ready
            await new Promise((resolve) => {
                video.oncanplay = resolve;
            });

            // Create canvas for watermark
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set canvas dimensions
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Draw video frame
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Add watermark
            ctx.font = 'bold 48px Arial';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Add "pixo" watermark in the center
            ctx.fillText('pixo', canvas.width / 2, canvas.height / 2);
            
            // Add smaller watermark in corner
            ctx.font = 'bold 24px Arial';
            ctx.fillText('pixo', canvas.width - 60, canvas.height - 30);

            // Convert canvas to blob
            setDownloadProgress(95);
            canvas.toBlob(async (canvasBlob) => {
                if (!canvasBlob) {
                    throw new Error('Failed to create watermarked video');
                }

                // Create download link
                const downloadUrl = URL.createObjectURL(canvasBlob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = `pixo_reel_${currentReel.id}.mp4`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                // Clean up
                URL.revokeObjectURL(downloadUrl);
                URL.revokeObjectURL(blobUrl);

                // Mark as downloaded
                setDownloadedReels(prev => ({
                    ...prev,
                    [currentReel.id]: true
                }));

                setDownloadProgress(100);
                toast.success('Reel downloaded with watermark!');
                
                // Close progress after delay
                setTimeout(() => {
                    setShowDownloadProgress(false);
                    setIsDownloading(false);
                    setDownloadProgress(0);
                }, 1500);

            }, 'video/mp4');

        } catch (error) {
            console.error('Download error:', error);
            toast.error('Failed to download reel');
            setIsDownloading(false);
            setShowDownloadProgress(false);
            setDownloadProgress(0);
        }
    };

    // Update share options to include download
    const shareOptions = [
        { icon: <Copy className="w-5 h-5" />, label: 'Copy Link', action: () => handleCopyLink() },
        { icon: <SendSolid className="w-5 h-5" />, label: 'Send to', action: () => toast('Send to feature coming soon') },
        { icon: <Link className="w-5 h-5" />, label: 'Share to', action: () => toast('Share to feature coming soon') },
        { 
            icon: downloadedReels[reels[currentIndex]?.id] ? 
                <CheckCircle className="w-5 h-5 text-green-500" /> : 
                <DownloadIcon className="w-5 h-5" />, 
            label: downloadedReels[reels[currentIndex]?.id] ? 'Downloaded' : 'Download', 
            action: () => handleDownload() 
        },
    ];

    // Handle scroll/swipe
    const handleScroll = (direction) => {
        if (direction === 'down' && currentIndex < reels.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setIsPlaying(true);
        } else if (direction === 'up' && currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
            setIsPlaying(true);
        }
        
        // Close all menus when scrolling
        setShowComments(false);
        setShowShareMenu(false);
        setShowMoreMenu(false);
        setShowDownloadProgress(false);
    };

    // Handle wheel scroll
    const handleWheel = (e) => {
        if (Math.abs(e.deltaY) > 10) {
            handleScroll(e.deltaY > 0 ? 'down' : 'up');
            e.preventDefault();
        }
    };

    // Touch handling for mobile
    let touchStartY = 0;
    const handleTouchStart = (e) => {
        touchStartY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e) => {
        const touchEndY = e.changedTouches[0].clientY;
        const diffY = touchStartY - touchEndY;
        
        if (Math.abs(diffY) > 50) {
            handleScroll(diffY > 0 ? 'down' : 'up');
        }
    };

    // Handle profile click
    const handleProfileClick = (userId, username) => {
        // Stop all videos before navigating
        videoRefs.current.forEach(video => {
            if (video) {
                video.pause();
                video.currentTime = 0;
            }
        });
        
        // Close reels first
        onClose();
        // Navigate to profile page
        navigate(`/profile/${userId || username}`);
    };

    // Handle single tap for play/pause
    const handleSingleTap = () => {
        setIsPlaying(!isPlaying);
    };

    // Handle double tap for like
    const handleDoubleTap = () => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTapTime.current;
        
        if (tapLength < 300 && tapLength > 0) {
            handleLike();
            setShowDoubleTapHeart(true);
            setTimeout(() => setShowDoubleTapHeart(false), 1000);
            lastTapTime.current = 0; // Reset after successful double tap
        } else {
            lastTapTime.current = currentTime;
            
            // Set a timeout to detect single tap if no double tap occurs
            setTimeout(() => {
                if (lastTapTime.current === currentTime) {
                    // This was a single tap
                    handleSingleTap();
                }
            }, 300);
        }
    };

    // Like functionality
    const handleLike = async () => {
        const currentReel = reels[currentIndex];
        if (!currentReel || isLiking[currentReel.id]) return;

        setIsLiking(prev => ({ ...prev, [currentReel.id]: true }));
        
        try {
            const token = await getToken();
            console.log('Liking post:', currentReel.id);
            
            const { data } = await api.post(`/api/post/like`, { 
                postId: currentReel.id 
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            console.log('Like response:', data);

            if (data.success) {
                const isNowLiked = data.liked;
                setLikedReels(prev => ({
                    ...prev,
                    [currentReel.id]: isNowLiked
                }));
                
                // Update likes count
                setReels(prev => prev.map((reel, index) => 
                    index === currentIndex 
                        ? { 
                            ...reel, 
                            likes: isNowLiked ? reel.likes + 1 : Math.max(0, reel.likes - 1) 
                        }
                        : reel
                ));
                
                toast.success(isNowLiked ? 'Liked!' : 'Unliked');
            } else {
                toast.error(data.message || 'Failed to like');
            }
        } catch (error) {
            console.error('Error liking:', error);
            console.error('Error response:', error.response?.data);
            toast.error(error.response?.data?.message || 'Failed to like');
        } finally {
            setIsLiking(prev => ({ ...prev, [currentReel.id]: false }));
        }
    };

    // Save functionality
    const handleSave = async () => {
        const currentReel = reels[currentIndex];
        if (!currentReel) return;

        try {
            // Implement save functionality here
            setSavedReels(prev => ({
                ...prev,
                [currentReel.id]: !prev[currentReel.id]
            }));
            
            toast.success(savedReels[currentReel.id] ? 'Unsaved' : 'Saved!');
        } catch (error) {
            console.error('Error saving:', error);
            toast.error('Failed to save');
        }
    };

    // Load comments
    const loadComments = async (reelId) => {
        if (!reelId) return;
        
        setLoadingComments(true);
        try {
            const token = await getToken();
            const { data } = await api.get(`/api/post/comments/${reelId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data.success) {
                setCurrentComments(data.comments || []);
                setShowComments(true);
                
                // Focus comment input
                setTimeout(() => {
                    if (commentInputRef.current) {
                        commentInputRef.current.focus();
                    }
                }, 100);
            }
        } catch (error) {
            console.error('Error loading comments:', error);
            toast.error('Failed to load comments');
        } finally {
            setLoadingComments(false);
        }
    };

    // Close comments properly
    const handleCloseComments = () => {
        setShowComments(false);
        setCurrentComments([]);
        setCommentText('');
    };

    // Add comment
    const handleAddComment = async () => {
        if (!commentText.trim() || !reels[currentIndex]) return;

        try {
            const token = await getToken();
            const { data } = await api.post('/api/post/comment', {
                postId: reels[currentIndex].id,
                content: commentText.trim()
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data.success && data.comment) {
                // Add new comment to list
                const newComment = {
                    ...data.comment,
                    user: reels[currentIndex].user
                };
                setCurrentComments(prev => [newComment, ...prev]);
                
                // Update comments count
                setReels(prev => prev.map((reel, index) => 
                    index === currentIndex 
                        ? { ...reel, comments: reel.comments + 1 }
                        : reel
                ));
                
                setCommentText('');
                toast.success('Comment added');
            }
        } catch (error) {
            console.error('Error adding comment:', error);
            toast.error('Failed to add comment');
        }
    };

    // Delete comment
    const handleDeleteComment = async (commentId) => {
        try {
            const token = await getToken();
            const { data } = await api.delete(`/api/post/comment/${commentId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data.success) {
                setCurrentComments(prev => prev.filter(comment => comment._id !== commentId));
                
                // Update comments count
                setReels(prev => prev.map((reel, index) => 
                    index === currentIndex 
                        ? { ...reel, comments: Math.max(0, reel.comments - 1) }
                        : reel
                ));
                
                toast.success('Comment deleted');
            }
        } catch (error) {
            console.error('Error deleting comment:', error);
            toast.error('Failed to delete comment');
        }
    };

    // Update comment
    const handleUpdateComment = async (commentId, newContent) => {
        try {
            const token = await getToken();
            const { data } = await api.put(`/api/post/comment/${commentId}`, {
                content: newContent
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data.success) {
                setCurrentComments(prev => prev.map(comment => 
                    comment._id === commentId 
                        ? { ...comment, content: newContent, updatedAt: new Date().toISOString() }
                        : comment
                ));
                
                toast.success('Comment updated');
            }
        } catch (error) {
            console.error('Error updating comment:', error);
            toast.error('Failed to update comment');
        }
    };

    // Reply to comment
    const handleReplyComment = async (commentId, replyText, username) => {
        if (!replyText.trim()) return;

        try {
            const token = await getToken();
            const { data } = await api.post('/api/post/comment', {
                postId: reels[currentIndex].id,
                content: `@${username} ${replyText.trim()}`,
                parentCommentId: commentId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data.success && data.comment) {
                // Add new reply to comments list
                const newReply = {
                    ...data.comment,
                    user: reels[currentIndex].user
                };
                setCurrentComments(prev => [newReply, ...prev]);
                
                // Update comments count
                setReels(prev => prev.map((reel, index) => 
                    index === currentIndex 
                        ? { ...reel, comments: reel.comments + 1 }
                        : reel
                ));
                
                toast.success('Reply added');
            }
        } catch (error) {
            console.error('Error replying to comment:', error);
            toast.error('Failed to add reply');
        }
    };

    // Share functionality
    const handleShare = async () => {
        const currentReel = reels[currentIndex];
        if (!currentReel) return;

        try {
            const token = await getToken();
            const { data } = await api.post('/api/post/share', {
                postId: currentReel.id
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data.success) {
                // Update shares count
                setReels(prev => prev.map((reel, index) => 
                    index === currentIndex 
                        ? { ...reel, shares: reel.shares + 1 }
                        : reel
                ));
                
                // Copy link to clipboard
                const shareUrl = `${window.location.origin}/reel/${currentReel.id}`;
                await navigator.clipboard.writeText(shareUrl);
                toast.success('Link copied to clipboard!');
            }
        } catch (error) {
            console.error('Error sharing:', error);
            toast.error('Failed to share');
        }
    };

    // More menu options
    const moreOptions = [
        { icon: <Flag className="w-5 h-5" />, label: 'Report', action: () => toast('Report feature coming soon') },
        { icon: <X className="w-5 h-5" />, label: 'Not Interested', action: () => toast('Not interested feature coming soon') },
    ];

    const handleCopyLink = async () => {
        const currentReel = reels[currentIndex];
        if (!currentReel) return;
        
        const shareUrl = `${window.location.origin}/reel/${currentReel.id}`;
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied to clipboard!');
        setShowShareMenu(false);
    };

    // Handle back from comments
    const handleBackFromComments = () => {
        handleCloseComments();
    };

    // Handle closing reels - stop all audio
    const handleCloseReels = () => {
        // Stop all videos
        videoRefs.current.forEach(video => {
            if (video) {
                video.pause();
                video.currentTime = 0;
                video.muted = true;
            }
        });
        
        // Call parent's onClose
        onClose();
    };

    // Handle clicking outside menus
    useEffect(() => {
        const handleClickOutside = (e) => {
            // Close share menu if clicked outside
            if (showShareMenu && !e.target.closest('.share-menu')) {
                setShowShareMenu(false);
            }
            // Close more menu if clicked outside
            if (showMoreMenu && !e.target.closest('.more-menu')) {
                setShowMoreMenu(false);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [showShareMenu, showMoreMenu]);

    // Skeleton Loading Component
    const SkeletonLoader = () => {
        return (
            <div className="fixed inset-0 z-50 bg-black">
                <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4">
                    <div className="w-10 h-10 bg-gray-800 rounded-full animate-pulse"></div>
                    <div className="w-24 h-6 bg-gray-800 rounded animate-pulse"></div>
                    <div className="w-10 h-10 bg-gray-800 rounded-full animate-pulse"></div>
                </div>
                
                <div className="h-full flex items-center justify-center">
                    <div className="relative w-full max-w-md mx-auto">
                        {/* Video skeleton */}
                        <div className="relative w-full h-[80vh] bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 animate-pulse rounded-lg overflow-hidden">
                            {/* Gradient overlay skeleton */}
                            <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/90 via-black/50 to-transparent"></div>
                            
                            {/* Left side content skeleton */}
                            <div className="absolute bottom-4 left-4 right-4 z-10">
                                <div className="flex items-end">
                                    <div className="flex-1 pr-24">
                                        {/* User info skeleton */}
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-10 h-10 bg-gray-700 rounded-full animate-pulse"></div>
                                            <div className="space-y-2">
                                                <div className="w-32 h-4 bg-gray-700 rounded animate-pulse"></div>
                                                <div className="w-24 h-3 bg-gray-800 rounded animate-pulse"></div>
                                            </div>
                                        </div>
                                        
                                        {/* Caption skeleton */}
                                        <div className="space-y-2 mb-3">
                                            <div className="w-full h-3 bg-gray-700 rounded animate-pulse"></div>
                                            <div className="w-2/3 h-3 bg-gray-700 rounded animate-pulse"></div>
                                        </div>
                                        
                                        {/* Music skeleton */}
                                        <div className="flex items-center gap-3">
                                            <div className="w-24 h-3 bg-gray-800 rounded animate-pulse"></div>
                                            <div className="w-16 h-3 bg-gray-800 rounded animate-pulse"></div>
                                        </div>
                                    </div>
                                    
                                    {/* Right side actions skeleton */}
                                    <div className="absolute right-4 bottom-0 flex flex-col items-center gap-5">
                                        {[...Array(5)].map((_, i) => (
                                            <div key={i} className="flex flex-col items-center gap-2">
                                                <div className="w-12 h-12 bg-gray-800 rounded-full animate-pulse"></div>
                                                <div className="w-8 h-3 bg-gray-800 rounded animate-pulse"></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* Navigation hint skeletons */}
                        <div className="absolute top-1/2 left-4">
                            <div className="w-8 h-8 bg-gray-800 rounded-full animate-pulse"></div>
                        </div>
                        <div className="absolute top-1/2 right-4">
                            <div className="w-8 h-8 bg-gray-800 rounded-full animate-pulse"></div>
                        </div>
                        
                        {/* Position indicator skeleton */}
                        <div className="absolute top-20 left-1/2 transform -translate-x-1/2">
                            <div className="w-16 h-6 bg-gray-800 rounded-full animate-pulse"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const currentReel = reels[currentIndex];

    // Loading state
    if (isLoading) {
        return <SkeletonLoader />;
    }

    // No reels state
    if (reels.length === 0 && !isLoading) {
        return (
            <div className="fixed inset-0 z-50 bg-black">
                <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4">
                    <button
                        onClick={handleCloseReels}
                        className="p-2 rounded-full bg-black/50 text-white hover:bg-white/20 transition-colors"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-white text-xl font-bold">Reels</h1>
                    <div className="w-10"></div>
                </div>
                
                <div className="h-full flex flex-col items-center justify-center text-white p-8">
                    <div className="text-8xl mb-6">🎬</div>
                    <h2 className="text-2xl font-bold mb-2">No reels yet</h2>
                    <p className="text-gray-400 text-center mb-6 max-w-md">
                        Create or watch video posts to see them here
                    </p>
                    <button
                        onClick={fetchReels}
                        className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-full font-semibold transition-colors"
                    >
                        Refresh
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div 
            ref={containerRef}
            className="fixed inset-0 z-50 bg-black"
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onClick={handleDoubleTap} // Handle both single and double tap
        >
            {/* Download Progress Overlay */}
            {showDownloadProgress && (
                <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center">
                    <div className="bg-gray-900 rounded-2xl p-8 max-w-md w-full mx-4 flex flex-col items-center">
                        {downloadProgress === 100 ? (
                            <>
                                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                                    <CheckCircle className="w-12 h-12 text-green-500" />
                                </div>
                                <h3 className="text-white text-xl font-bold mb-2">Download Complete!</h3>
                                <p className="text-gray-300 text-center mb-6">
                                    Reel downloaded with "pixo" watermark
                                </p>
                                <button
                                    onClick={() => setShowDownloadProgress(false)}
                                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-full font-semibold text-white transition-colors"
                                >
                                    Continue Watching
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
                                    <DownloadIcon className="w-12 h-12 text-blue-500 animate-bounce" />
                                </div>
                                <h3 className="text-white text-xl font-bold mb-6">Downloading Reel</h3>
                                
                                {/* Progress bar */}
                                <div className="w-full bg-gray-800 rounded-full h-3 mb-4 overflow-hidden">
                                    <div 
                                        className="bg-blue-500 h-full rounded-full transition-all duration-300 ease-out"
                                        style={{ width: `${downloadProgress}%` }}
                                    />
                                </div>
                                
                                <div className="flex justify-between w-full text-sm mb-2">
                                    <span className="text-gray-300">Adding watermark...</span>
                                    <span className="text-white font-semibold">{Math.round(downloadProgress)}%</span>
                                </div>
                                
                                <p className="text-gray-400 text-sm text-center">
                                    The reel will include "pixo" watermark
                                </p>
                                
                                {/* Cancel button */}
                                <button
                                    onClick={() => {
                                        setIsDownloading(false);
                                        setShowDownloadProgress(false);
                                        setDownloadProgress(0);
                                    }}
                                    className="mt-6 px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
                                >
                                    Cancel Download
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Header - Only show when not in comments */}
            {!showComments && (
                <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4">
                    <button
                        onClick={handleCloseReels}
                        className="p-2 rounded-full bg-black/50 text-white hover:bg-white/20 transition-colors"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-white text-xl font-bold">Reels</h1>
                    <div className="flex items-center gap-2">
                        <User className="w-5 h-5 text-white" />
                        <span className="text-white text-sm">{reels.length}</span>
                    </div>
                </div>
            )}

            {/* Video Container */}
            {reels.map((reel, index) => (
                <div
                    key={reel.id}
                    className={`video-container absolute inset-0 transition-transform duration-300 ease-in-out ${
                        index === currentIndex ? 'translate-y-0' : index < currentIndex ? '-translate-y-full' : 'translate-y-full'
                    }`}
                    data-index={index}
                >
                    {/* Double tap heart animation */}
                    {showDoubleTapHeart && index === currentIndex && (
                        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                            <HeartSolid className="w-32 h-32 text-white fill-current animate-ping" />
                        </div>
                    )}

                    {/* Video */}
                    <video
                        ref={el => videoRefs.current[index] = el}
                        src={reel.videoUrl}
                        className="w-full h-full object-cover"
                        loop
                        playsInline
                        preload="auto"
                        muted={index !== currentIndex} // Only mute if not current video
                    />
                    
                    {/* Play/Pause overlay - Only show when paused */}
                    {!isPlaying && index === currentIndex && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-5 pointer-events-none">
                            <div className="p-6 rounded-full bg-black/60 border-2 border-white/20">
                                <Pause className="w-20 h-20 text-white" />
                            </div>
                        </div>
                    )}

                    {/* Bottom gradient overlay */}
                    {!showComments && (
                        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none" />
                    )}

                    {/* User info and caption - LEFT SIDE - Hide in comments */}
                    {!showComments && (
                        <div className="absolute bottom-4 left-4 right-4 z-10 pointer-events-none">
                            <div className="flex items-end">
                                {/* Left side - Content */}
                                <div className="flex-1 pr-24">
                                    {/* User info with profile click */}
                                    <div className="flex items-center gap-3 mb-3">
                                        <button
                                            onClick={() => handleProfileClick(reel.userId, reel.username)}
                                            className="flex items-center gap-3 pointer-events-auto hover:opacity-80 transition-opacity"
                                        >
                                            <img
                                                src={reel.userProfile}
                                                alt={reel.username}
                                                className="w-8 h-8 rounded-full border-2 border-white object-cover"
                                            />
                                            <div className="flex flex-col items-start">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-white font-semibold text-sm">
                                                        {reel.username}
                                                    </span>
                                                    {reel.isVerified && (
                                                        <span className="text-blue-400 text-xs">✓</span>
                                                    )}
                                                </div>
                                                {/* Reels count badge */}
                                                {reel.userReelsCount > 0 && (
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                                                            <Play className="w-2 h-2 text-white" />
                                                        </div>
                                                        <span className="text-white/70 text-xs">
                                                            {reel.userReelsCount} reel{reel.userReelsCount !== 1 ? 's' : ''}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    </div>
                                    
                                    {/* Caption */}
                                    <p className="text-white text-sm mb-2 line-clamp-2">
                                        {reel.caption}
                                    </p>
                                    
                                    {/* Music and location */}
                                    <div className="flex items-center gap-3 text-white/80 text-xs">
                                        <div className="flex items-center gap-1">
                                            <Music className="w-3 h-3" />
                                            <span>{reel.music}</span>
                                        </div>
                                        {reel.location && (
                                            <span>• {reel.location}</span>
                                        )}
                                    </div>
                                </div>

                                {/* Right side - Actions */}
                                <div className="absolute right-4 bottom-0 flex flex-col items-center gap-5 pointer-events-auto">
                                    {/* Like */}
                                    <div className="flex flex-col items-center">
                                        <button
                                            onClick={handleLike}
                                            disabled={isLiking[reel.id]}
                                            className={`p-2 rounded-full transition-colors ${likedReels[reel.id] ? 'bg-red-500/20' : 'bg-black/50 hover:bg-white/20'} ${isLiking[reel.id] ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            {likedReels[reel.id] ? (
                                                <HeartSolid className="w-7 h-7 text-red-500 fill-current" />
                                            ) : (
                                                <Heart className="w-7 h-7 text-white" />
                                            )}
                                        </button>
                                        <span className="text-white text-xs mt-1 font-semibold">
                                            {reel.likes > 1000 ? `${(reel.likes / 1000).toFixed(1)}k` : reel.likes}
                                        </span>
                                    </div>

                                    {/* Comment */}
                                    <div className="flex flex-col items-center">
                                        <button
                                            onClick={() => loadComments(reel.id)}
                                            className="p-2 rounded-full bg-black/50 hover:bg-white/20 transition-colors"
                                        >
                                            <MessageCircle className="w-7 h-7 text-white" />
                                        </button>
                                        <span className="text-white text-xs mt-1 font-semibold">
                                            {reel.comments > 1000 ? `${(reel.comments / 1000).toFixed(1)}k` : reel.comments}
                                        </span>
                                    </div>

                                    {/* Share */}
                                    <div className="flex flex-col items-center relative share-menu">
                                        <button
                                            onClick={() => setShowShareMenu(!showShareMenu)}
                                            className="p-2 rounded-full bg-black/50 hover:bg-white/20 transition-colors"
                                        >
                                            <Send className="w-7 h-7 text-white" />
                                        </button>
                                        <span className="text-white text-xs mt-1 font-semibold">
                                            {reel.shares > 1000 ? `${(reel.shares / 1000).toFixed(1)}k` : reel.shares}
                                        </span>
                                        
                                        {/* Share menu */}
                                        {showShareMenu && index === currentIndex && (
                                            <div className="absolute bottom-full right-0 mb-2 bg-gray-900 rounded-xl shadow-xl py-2 min-w-[180px] z-20">
                                                {shareOptions.map((option, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={option.action}
                                                        disabled={isDownloading && option.label === 'Download'}
                                                        className={`w-full px-4 py-3 text-left text-white hover:bg-gray-800 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed`}
                                                    >
                                                        {option.icon}
                                                        <span className="text-sm">{option.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Save */}
                                    <div className="flex flex-col items-center">
                                        <button
                                            onClick={handleSave}
                                            className={`p-2 rounded-full transition-colors ${savedReels[reel.id] ? 'bg-yellow-500/20' : 'bg-black/50 hover:bg-white/20'}`}
                                        >
                                            <Bookmark className={`w-7 h-7 ${savedReels[reel.id] ? 'fill-yellow-500 text-yellow-500' : 'text-white'}`} />
                                        </button>
                                    </div>

                                    {/* More */}
                                    <div className="flex flex-col items-center relative more-menu">
                                        <button
                                            onClick={() => setShowMoreMenu(!showMoreMenu)}
                                            className="p-2 rounded-full bg-black/50 hover:bg-white/20 transition-colors"
                                        >
                                            <MoreVertical className="w-7 h-7 text-white" />
                                        </button>
                                        
                                        {/* More menu */}
                                        {showMoreMenu && index === currentIndex && (
                                            <div className="absolute bottom-full right-0 mb-2 bg-gray-900 rounded-xl shadow-xl py-2 min-w-[180px] z-20">
                                                {moreOptions.map((option, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={option.action}
                                                        className="w-full px-4 py-3 text-left text-white hover:bg-gray-800 flex items-center gap-3"
                                                    >
                                                        {option.icon}
                                                        <span className="text-sm">{option.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Thumbnail of next video */}
                                    {index < reels.length - 1 && (
                                        <div className="mt-4 relative">
                                            <img
                                                src={reels[index + 1].userProfile}
                                                alt="Next"
                                                className="w-10 h-10 rounded-full border-2 border-white object-cover"
                                            />
                                            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-white animate-spin"></div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Comments Sidebar */}
                    {showComments && index === currentIndex && (
                        <div className="absolute inset-0 z-30 bg-black">
                            {/* Comments header */}
                            <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black to-transparent p-4">
                                <div className="flex items-center justify-between">
                                    <button
                                        onClick={handleBackFromComments}
                                        className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
                                    >
                                        <ChevronLeft className="w-6 h-6" />
                                    </button>
                                    <h2 className="text-white text-lg font-semibold">Comments</h2>
                                    <div className="w-10"></div>
                                </div>
                            </div>

                            {/* Comments list */}
                            <div className="absolute top-16 bottom-20 left-0 right-0 overflow-y-auto px-4">
                                {loadingComments ? (
                                    <div className="flex flex-col gap-4 p-4">
                                        {[...Array(3)].map((_, i) => (
                                            <div key={i} className="flex gap-3 animate-pulse">
                                                <div className="w-10 h-10 bg-gray-800 rounded-full"></div>
                                                <div className="flex-1 space-y-2">
                                                    <div className="h-4 bg-gray-800 rounded w-1/4"></div>
                                                    <div className="h-3 bg-gray-800 rounded w-3/4"></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : currentComments.length > 0 ? (
                                    <div className="pb-4">
                                        {currentComments.map(comment => (
                                            <ReelComment
                                                key={comment._id}
                                                comment={comment}
                                                currentUserId={userId}
                                                onDeleteComment={handleDeleteComment}
                                                onUpdateComment={handleUpdateComment}
                                                onReplyComment={handleReplyComment}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-white/60">
                                        <MessageCircle className="w-16 h-16 mb-4 opacity-30" />
                                        <p className="text-lg">No comments yet</p>
                                        <p className="text-sm mt-1">Be the first to comment</p>
                                    </div>
                                )}
                            </div>

                            {/* Comment input */}
                            <div className="absolute bottom-0 left-0 right-0 bg-black border-t border-gray-800 p-4">
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => handleProfileClick(userId, 'profile')}
                                        className="flex-shrink-0"
                                    >
                                        <img
                                            src={reel.userProfile}
                                            alt="Your profile"
                                            className="w-8 h-8 rounded-full object-cover"
                                        />
                                    </button>
                                    <div className="flex-1 flex items-center bg-gray-800 rounded-full px-4 py-2">
                                        <input
                                            ref={commentInputRef}
                                            type="text"
                                            value={commentText}
                                            onChange={(e) => setCommentText(e.target.value)}
                                            placeholder="Add a comment..."
                                            className="flex-1 bg-transparent text-white placeholder-gray-400 focus:outline-none"
                                            onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                                        />
                                        {commentText.trim() && (
                                            <button
                                                onClick={handleAddComment}
                                                className="text-blue-500 font-semibold text-sm hover:text-blue-400 px-2"
                                            >
                                                Post
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ))}

            {/* Current position indicator */}
            {!showComments && (
                <div className="absolute top-20 left-1/2 transform -translate-x-1/2 text-white/70 text-sm">
                    {currentIndex + 1} / {reels.length}
                </div>
            )}

            {/* Navigation hints */}
            {!showComments && currentIndex > 0 && (
                <div className="absolute top-1/2 left-4 transform -translate-y-1/2 animate-bounce pointer-events-none">
                    <ChevronLeft className="w-8 h-8 text-white rotate-90 opacity-50" />
                </div>
            )}
            {!showComments && currentIndex < reels.length - 1 && (
                <div className="absolute top-1/2 right-4 transform -translate-y-1/2 animate-bounce pointer-events-none">
                    <ChevronLeft className="w-8 h-8 text-white -rotate-90 opacity-50" />
                </div>
            )}
        </div>
    );
};

export default Reels;