import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Heart, MessageCircle, Send, Bookmark, MoreVertical, X, Music, Heart as HeartSolid, Send as SendSolid, ChevronLeft, Flag, Copy, Link, Download as DownloadIcon, User, CheckCircle, AlertCircle, Image, Video } from 'lucide-react';
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
    const [posts, setPosts] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);
    const [likedReels, setLikedReels] = useState({});
    const [likedPosts, setLikedPosts] = useState({});
    const [savedReels, setSavedReels] = useState({});
    const [savedPosts, setSavedPosts] = useState({});
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
    const [contentType, setContentType] = useState('reels');
    const [isLoadingPosts, setIsLoadingPosts] = useState(false);
    
    const videoRefs = useRef([]);
    const imageRefs = useRef([]);
    const lastTapTime = useRef(0);
    const commentInputRef = useRef(null);
    const containerRef = useRef(null);
    const observerRef = useRef(null);

    // Simple helper functions to get current content
    const getCurrentContent = () => {
        return contentType === 'reels' ? reels : posts;
    };

    const getCurrentItem = () => {
        const content = getCurrentContent();
        return content[currentIndex];
    };

    // Fetch reels from API
    const fetchReels = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = await getToken();
            
            const { data } = await api.get('/api/post/feed', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data.success && Array.isArray(data.posts)) {
                const videoPosts = data.posts.filter(post => 
                    post.media_urls?.some(media => media.type === 'video')
                ).map(post => {
                    const videoMedia = post.media_urls.find(media => media.type === 'video');
                    const imageMedia = post.media_urls.find(media => media.type === 'image');
                    
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
                        userHasLiked: Array.isArray(post.likes_count) ? post.likes_count.includes(userId) : false,
                        userReelsCount: userReelsCount,
                        type: 'video'
                    };
                });
                
                // Shuffle reels for random order
                const shuffledReels = [...videoPosts].sort(() => Math.random() - 0.5);
                setReels(shuffledReels);
                
                // Initialize liked state
                const initialLikedState = {};
                shuffledReels.forEach(reel => {
                    initialLikedState[reel.id] = reel.userHasLiked || false;
                });
                setLikedReels(initialLikedState);
                
                if (posts.length === 0) {
                    fetchPosts();
                }
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
    }, [getToken, userId, posts.length]);

    // Fetch posts from API
    const fetchPosts = useCallback(async () => {
        setIsLoadingPosts(true);
        try {
            const token = await getToken();
            
            const { data } = await api.get('/api/post/feed', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data.success && Array.isArray(data.posts)) {
                const imagePosts = data.posts.filter(post => 
                    post.media_urls?.some(media => media.type === 'image') &&
                    !post.media_urls?.some(media => media.type === 'video')
                ).map(post => {
                    const imageMedia = post.media_urls.find(media => media.type === 'image');
                    
                    const userPostsCount = data.posts.filter(p => 
                        p.user?._id === post.user?._id && 
                        p.media_urls?.some(m => m.type === 'image') &&
                        !p.media_urls?.some(m => m.type === 'video')
                    ).length;
                    
                    return {
                        id: post._id,
                        imageUrl: imageMedia?.url,
                        username: post.user?.username || '@user',
                        fullName: post.user?.full_name || 'User',
                        caption: post.content || '',
                        likes: Array.isArray(post.likes_count) ? post.likes_count.length : (post.likes_count || 0),
                        comments: post.comments_count || 0,
                        shares: post.shares_count || 0,
                        userProfile: post.user?.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.user?.full_name || 'User')}&background=random`,
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
                        userHasLiked: Array.isArray(post.likes_count) ? post.likes_count.includes(userId) : false,
                        userPostsCount: userPostsCount,
                        type: 'image',
                        aspectRatio: imageMedia?.aspect_ratio || 1
                    };
                });
                
                // Shuffle posts for random order
                const shuffledPosts = [...imagePosts].sort(() => Math.random() - 0.5);
                setPosts(shuffledPosts);
                
                // Initialize liked state
                const initialLikedState = {};
                shuffledPosts.forEach(post => {
                    initialLikedState[post.id] = post.userHasLiked || false;
                });
                setLikedPosts(initialLikedState);
                
            } else {
                toast.error(data.message || 'Failed to load posts');
                setPosts([]);
            }
        } catch (error) {
            console.error('Error fetching posts:', error);
            toast.error('Failed to load posts');
            setPosts([]);
        } finally {
            setIsLoadingPosts(false);
        }
    }, [getToken, userId]);

    useEffect(() => {
        fetchReels();
    }, [fetchReels]);

    // Setup Intersection Observer
    useEffect(() => {
        const content = getCurrentContent();
        if (content.length === 0 || !containerRef.current) return;

        const options = {
            root: containerRef.current,
            rootMargin: '0px',
            threshold: 0.5
        };

        const handleIntersection = (entries) => {
            entries.forEach(entry => {
                const index = parseInt(entry.target.dataset.index);
                
                if (entry.isIntersecting) {
                    setCurrentIndex(index);
                    
                    if (contentType === 'reels') {
                        setIsPlaying(true);
                        const video = videoRefs.current[index];
                        if (video && video.paused) {
                            video.play().catch(() => {
                                video.muted = true;
                                video.play().catch(console.log);
                            });
                        }
                    }
                } else {
                    if (contentType === 'reels') {
                        const video = videoRefs.current[index];
                        if (video) {
                            video.pause();
                        }
                    }
                }
            });
        };

        observerRef.current = new IntersectionObserver(handleIntersection, options);
        const contentContainers = document.querySelectorAll('.content-container');
        
        contentContainers.forEach(container => {
            observerRef.current?.observe(container);
        });

        return () => {
            observerRef.current?.disconnect();
        };
    }, [reels.length, posts.length, contentType]);

    // Handle keyboard navigation for desktop
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (showComments || showShareMenu || showMoreMenu || showDownloadProgress) return;
            
            const content = getCurrentContent();
            
            switch(e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    if (currentIndex > 0) {
                        setCurrentIndex(prev => prev - 1);
                        if (contentType === 'reels') setIsPlaying(true);
                    }
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    if (currentIndex < content.length - 1) {
                        setCurrentIndex(prev => prev + 1);
                        if (contentType === 'reels') setIsPlaying(true);
                    }
                    break;
                case ' ':
                    e.preventDefault();
                    if (contentType === 'reels') {
                        setIsPlaying(prev => !prev);
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    onClose();
                    break;
                case 'l':
                case 'L':
                    e.preventDefault();
                    handleLike();
                    break;
                case 'c':
                case 'C':
                    e.preventDefault();
                    const currentItem = getCurrentItem();
                    if (currentItem?.id) loadComments(currentItem.id);
                    break;
                case 's':
                case 'S':
                    e.preventDefault();
                    handleSave();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, contentType, showComments, showShareMenu, showMoreMenu, showDownloadProgress]);

    // Manual play/pause control
    useEffect(() => {
        if (contentType !== 'reels') return;
        
        const currentVideo = videoRefs.current[currentIndex];
        if (!currentVideo) return;

        if (isPlaying) {
            currentVideo.muted = false;
            currentVideo.play().catch(() => {
                currentVideo.muted = true;
                currentVideo.play().catch(console.log);
            });
        } else {
            currentVideo.pause();
        }
    }, [currentIndex, isPlaying, contentType]);

    // Cleanup videos on unmount
    useEffect(() => {
        return () => {
            videoRefs.current.forEach(video => {
                if (video) {
                    video.pause();
                    video.currentTime = 0;
                }
            });
        };
    }, []);

    // Handle download
    const handleDownload = async () => {
        const currentItem = getCurrentItem();
        if (!currentItem || isDownloading || downloadedReels[currentItem.id]) return;

        setIsDownloading(true);
        setShowDownloadProgress(true);
        setDownloadProgress(0);

        try {
            const downloadUrl = contentType === 'reels' ? currentItem.videoUrl : currentItem.imageUrl;
            const response = await fetch(downloadUrl);
            
            if (!response.ok) throw new Error('Failed to fetch content');
            
            const blob = await response.blob();
            setDownloadProgress(50);

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            if (contentType === 'reels') {
                const video = document.createElement('video');
                video.src = URL.createObjectURL(blob);
                
                await new Promise((resolve) => {
                    video.onloadedmetadata = resolve;
                });
                
                video.currentTime = 0;
                await video.play();
                video.pause();
                
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(video.src);
            } else {
                const img = new Image();
                img.src = URL.createObjectURL(blob);
                
                await new Promise((resolve) => {
                    img.onload = resolve;
                });
                
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(img.src);
            }

            // Add watermark
            ctx.font = 'bold 48px Arial';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('pixo', canvas.width / 2, canvas.height / 2);
            
            ctx.font = 'bold 24px Arial';
            ctx.fillText('pixo', canvas.width - 60, canvas.height - 30);

            setDownloadProgress(80);

            const downloadUrlObj = contentType === 'reels' 
                ? canvas.toDataURL('video/mp4')
                : canvas.toDataURL('image/jpeg', 0.9);
            
            const a = document.createElement('a');
            a.href = downloadUrlObj;
            a.download = `pixo_${contentType === 'reels' ? 'reel' : 'post'}_${currentItem.id}.${contentType === 'reels' ? 'mp4' : 'jpg'}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            setDownloadedReels(prev => ({
                ...prev,
                [currentItem.id]: true
            }));

            setDownloadProgress(100);
            toast.success(`${contentType === 'reels' ? 'Reel' : 'Post'} downloaded with watermark!`);
            
            setTimeout(() => {
                setShowDownloadProgress(false);
                setIsDownloading(false);
                setDownloadProgress(0);
            }, 1500);

        } catch (error) {
            console.error('Download error:', error);
            toast.error(`Failed to download ${contentType === 'reels' ? 'reel' : 'post'}`);
            setIsDownloading(false);
            setShowDownloadProgress(false);
            setDownloadProgress(0);
        }
    };

    // Handle scroll/swipe
    const handleScroll = (direction) => {
        const content = getCurrentContent();
        if (direction === 'down' && currentIndex < content.length - 1) {
            setCurrentIndex(prev => prev + 1);
            if (contentType === 'reels') setIsPlaying(true);
        } else if (direction === 'up' && currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
            if (contentType === 'reels') setIsPlaying(true);
        }
        
        setShowComments(false);
        setShowShareMenu(false);
        setShowMoreMenu(false);
        setShowDownloadProgress(false);
    };

    // Handle wheel scroll for desktop
    const handleWheel = (e) => {
        if (Math.abs(e.deltaY) > 10) {
            handleScroll(e.deltaY > 0 ? 'down' : 'up');
            e.preventDefault();
        }
    };

    // Touch handling
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
        videoRefs.current.forEach(video => {
            if (video) {
                video.pause();
                video.currentTime = 0;
            }
        });
        
        onClose();
        navigate(`/profile/${userId || username}`);
    };

    // Handle single tap
    const handleSingleTap = () => {
        if (contentType === 'reels') {
            setIsPlaying(!isPlaying);
        }
    };

    // Handle double tap
    const handleDoubleTap = () => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTapTime.current;
        
        if (tapLength < 300 && tapLength > 0) {
            handleLike();
            setShowDoubleTapHeart(true);
            setTimeout(() => setShowDoubleTapHeart(false), 1000);
            lastTapTime.current = 0;
        } else {
            lastTapTime.current = currentTime;
            
            setTimeout(() => {
                if (lastTapTime.current === currentTime) {
                    handleSingleTap();
                }
            }, 300);
        }
    };

    // Like functionality - FIXED with optimistic updates
    const handleLike = async () => {
        const currentItem = getCurrentItem();
        if (!currentItem || isLiking[currentItem.id]) return;

        // Get current liked state
        const currentLikedState = contentType === 'reels' 
            ? likedReels[currentItem.id] 
            : likedPosts[currentItem.id];
        
        // Optimistically update UI
        if (contentType === 'reels') {
            setLikedReels(prev => ({
                ...prev,
                [currentItem.id]: !currentLikedState
            }));
            
            setReels(prev => prev.map((reel, index) => 
                index === currentIndex 
                    ? { 
                        ...reel, 
                        likes: !currentLikedState ? reel.likes + 1 : Math.max(0, reel.likes - 1) 
                    }
                    : reel
            ));
        } else {
            setLikedPosts(prev => ({
                ...prev,
                [currentItem.id]: !currentLikedState
            }));
            
            setPosts(prev => prev.map((post, index) => 
                index === currentIndex 
                    ? { 
                        ...post, 
                        likes: !currentLikedState ? post.likes + 1 : Math.max(0, post.likes - 1) 
                    }
                    : post
            ));
        }

        setIsLiking(prev => ({ ...prev, [currentItem.id]: true }));
        
        try {
            const token = await getToken();
            
            const { data } = await api.post(`/api/post/like`, { 
                postId: currentItem.id 
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data.success) {
                const isNowLiked = data.liked;
                
                // Sync with server response
                if (contentType === 'reels') {
                    setLikedReels(prev => ({
                        ...prev,
                        [currentItem.id]: isNowLiked
                    }));
                    
                    setReels(prev => prev.map((reel, index) => 
                        index === currentIndex 
                            ? { 
                                ...reel, 
                                likes: isNowLiked ? reel.likes + 1 : Math.max(0, reel.likes - 1) 
                            }
                            : reel
                    ));
                } else {
                    setLikedPosts(prev => ({
                        ...prev,
                        [currentItem.id]: isNowLiked
                    }));
                    
                    setPosts(prev => prev.map((post, index) => 
                        index === currentIndex 
                            ? { 
                                ...post, 
                                likes: isNowLiked ? post.likes + 1 : Math.max(0, post.likes - 1) 
                            }
                            : post
                    ));
                }
                
               // toast.success(isNowLiked ? 'Liked!' : 'Unliked');
            } else {
                //toast.error(data.message || 'Failed to like');
                // Revert optimistic update on error
                revertLikeUpdate(currentLikedState);
            }
        } catch (error) {
            console.error('Error liking:', error);
            toast.error(error.response?.data?.message || 'Failed to like');
            // Revert optimistic update on error
            revertLikeUpdate(currentLikedState);
        } finally {
            setIsLiking(prev => ({ ...prev, [currentItem.id]: false }));
        }
    };

    // Helper function to revert like update
    const revertLikeUpdate = (originalLikedState) => {
        const currentItem = getCurrentItem();
        if (!currentItem) return;

        if (contentType === 'reels') {
            setLikedReels(prev => ({
                ...prev,
                [currentItem.id]: originalLikedState
            }));
            
            setReels(prev => prev.map((reel, index) => 
                index === currentIndex 
                    ? { 
                        ...reel, 
                        likes: originalLikedState ? reel.likes + 1 : Math.max(0, reel.likes - 1) 
                    }
                    : reel
            ));
        } else {
            setLikedPosts(prev => ({
                ...prev,
                [currentItem.id]: originalLikedState
            }));
            
            setPosts(prev => prev.map((post, index) => 
                index === currentIndex 
                    ? { 
                        ...post, 
                        likes: originalLikedState ? post.likes + 1 : Math.max(0, post.likes - 1) 
                    }
                    : post
            ));
        }
    };

    // Save functionality
    const handleSave = async () => {
        const currentItem = getCurrentItem();
        if (!currentItem) return;

        try {
            if (contentType === 'reels') {
                setSavedReels(prev => ({
                    ...prev,
                    [currentItem.id]: !prev[currentItem.id]
                }));
            } else {
                setSavedPosts(prev => ({
                    ...prev,
                    [currentItem.id]: !prev[currentItem.id]
                }));
            }
            
            const isSaved = contentType === 'reels' 
                ? savedReels[currentItem.id] 
                : savedPosts[currentItem.id];
            
            toast.success(isSaved ? 'Unsaved' : 'Saved!');
        } catch (error) {
            console.error('Error saving:', error);
            toast.error('Failed to save');
        }
    };

    // Load comments
    const loadComments = async (itemId) => {
        if (!itemId) return;
        
        setLoadingComments(true);
        try {
            const token = await getToken();
            const { data } = await api.get(`/api/post/comments/${itemId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data.success) {
                setCurrentComments(data.comments || []);
                setShowComments(true);
                
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

    // Close comments
    const handleCloseComments = () => {
        setShowComments(false);
        setCurrentComments([]);
        setCommentText('');
    };

    // Add comment
    const handleAddComment = async () => {
        if (!commentText.trim()) return;
        
        const currentItem = getCurrentItem();
        if (!currentItem) return;

        try {
            const token = await getToken();
            const { data } = await api.post('/api/post/comment', {
                postId: currentItem.id,
                content: commentText.trim()
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data.success && data.comment) {
                const newComment = {
                    ...data.comment,
                    user: currentItem.user
                };
                setCurrentComments(prev => [newComment, ...prev]);
                
                if (contentType === 'reels') {
                    setReels(prev => prev.map((reel, index) => 
                        index === currentIndex 
                            ? { ...reel, comments: reel.comments + 1 }
                            : reel
                    ));
                } else {
                    setPosts(prev => prev.map((post, index) => 
                        index === currentIndex 
                            ? { ...post, comments: post.comments + 1 }
                            : post
                    ));
                }
                
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
                
                if (contentType === 'reels') {
                    setReels(prev => prev.map((reel, index) => 
                        index === currentIndex 
                            ? { ...reel, comments: Math.max(0, reel.comments - 1) }
                            : reel
                    ));
                } else {
                    setPosts(prev => prev.map((post, index) => 
                        index === currentIndex 
                            ? { ...post, comments: Math.max(0, post.comments - 1) }
                            : post
                    ));
                }
                
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

        const currentItem = getCurrentItem();
        if (!currentItem) return;

        try {
            const token = await getToken();
            const { data } = await api.post('/api/post/comment', {
                postId: currentItem.id,
                content: `@${username} ${replyText.trim()}`,
                parentCommentId: commentId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data.success && data.comment) {
                const newReply = {
                    ...data.comment,
                    user: currentItem.user
                };
                setCurrentComments(prev => [newReply, ...prev]);
                
                if (contentType === 'reels') {
                    setReels(prev => prev.map((reel, index) => 
                        index === currentIndex 
                            ? { ...reel, comments: reel.comments + 1 }
                            : reel
                    ));
                } else {
                    setPosts(prev => prev.map((post, index) => 
                        index === currentIndex 
                            ? { ...post, comments: post.comments + 1 }
                            : post
                    ));
                }
                
                toast.success('Reply added');
            }
        } catch (error) {
            console.error('Error replying to comment:', error);
            toast.error('Failed to add reply');
        }
    };

    // Share functionality
    const handleShare = async () => {
        const currentItem = getCurrentItem();
        if (!currentItem) return;

        try {
            const token = await getToken();
            const { data } = await api.post('/api/post/share', {
                postId: currentItem.id
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data.success) {
                if (contentType === 'reels') {
                    setReels(prev => prev.map((reel, index) => 
                        index === currentIndex 
                            ? { ...reel, shares: reel.shares + 1 }
                            : reel
                    ));
                } else {
                    setPosts(prev => prev.map((post, index) => 
                        index === currentIndex 
                            ? { ...post, shares: post.shares + 1 }
                            : post
                    ));
                }
                
                const shareUrl = `${window.location.origin}/post/${currentItem.id}`;
                await navigator.clipboard.writeText(shareUrl);
                toast.success('Link copied to clipboard!');
            }
        } catch (error) {
            console.error('Error sharing:', error);
            toast.error('Failed to share');
        }
    };

    // Toggle content type
    const toggleContentType = (type) => {
        if (contentType !== type) {
            setContentType(type);
            setCurrentIndex(0);
            if (type === 'reels') {
                setIsPlaying(true);
            }
            
            if (type === 'posts' && posts.length === 0 && !isLoadingPosts) {
                fetchPosts();
            }
        }
        setShowMoreMenu(false);
    };

    // Share options
    const shareOptions = [
        { icon: <Copy className="w-5 h-5" />, label: 'Copy Link', action: () => handleCopyLink() },
        { icon: <SendSolid className="w-5 h-5" />, label: 'Send to', action: () => toast('Send to feature coming soon') },
        { icon: <Link className="w-5 h-5" />, label: 'Share to', action: () => toast('Share to feature coming soon') },
        { 
            icon: downloadedReels[getCurrentItem()?.id] ? 
                <CheckCircle className="w-5 h-5 text-green-500" /> : 
                <DownloadIcon className="w-5 h-5" />, 
            label: downloadedReels[getCurrentItem()?.id] ? 'Downloaded' : 'Download', 
            action: () => handleDownload() 
        },
    ];

    const handleCopyLink = async () => {
        const currentItem = getCurrentItem();
        if (!currentItem) return;
        
        const shareUrl = `${window.location.origin}/post/${currentItem.id}`;
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied to clipboard!');
        setShowShareMenu(false);
    };

    // Handle closing reels
    const handleCloseReels = () => {
        videoRefs.current.forEach(video => {
            if (video) {
                video.pause();
                video.currentTime = 0;
            }
        });
        
        onClose();
    };

    // More menu options
    const moreOptions = [
        { 
            icon: contentType === 'reels' ? <Image className="w-5 h-5" /> : <Video className="w-5 h-5" />, 
            label: contentType === 'reels' ? 'Switch to Posts' : 'Switch to Reels', 
            action: () => toggleContentType(contentType === 'reels' ? 'posts' : 'reels') 
        },
        { icon: <Flag className="w-5 h-5" />, label: 'Report', action: () => toast('Report feature coming soon') },
        { icon: <X className="w-5 h-5" />, label: 'Not Interested', action: () => toast('Not interested feature coming soon') },
    ];

    // Handle clicking outside menus
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (showShareMenu && !e.target.closest('.share-menu')) {
                setShowShareMenu(false);
            }
            if (showMoreMenu && !e.target.closest('.more-menu')) {
                setShowMoreMenu(false);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [showShareMenu, showMoreMenu]);

    // Loading state
    if (isLoading && contentType === 'reels') {
        return (
            <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
                <div className="w-full max-w-2xl h-full md:h-[85vh] md:my-auto md:rounded-2xl md:overflow-hidden bg-gray-900 relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 animate-pulse"></div>
                    <div className="absolute top-0 left-0 right-0 z-10 p-4 flex items-center justify-between">
                        <div className="w-8 h-8 bg-gray-800 rounded-full animate-pulse"></div>
                        <div className="w-24 h-6 bg-gray-800 rounded animate-pulse"></div>
                        <div className="w-8 h-8 bg-gray-800 rounded-full animate-pulse"></div>
                    </div>
                    <div className="absolute top-16 bottom-20 left-4 right-4">
                        <div className="h-full bg-gradient-to-r from-gray-800 to-gray-900 animate-pulse rounded-lg"></div>
                    </div>
                    <div className="absolute bottom-4 left-4 right-4">
                        <div className="flex justify-between">
                            <div className="space-y-2">
                                <div className="w-32 h-4 bg-gray-800 rounded animate-pulse"></div>
                                <div className="w-24 h-3 bg-gray-800 rounded animate-pulse"></div>
                            </div>
                            <div className="flex space-x-4">
                                {[...Array(4)].map((_, i) => (
                                    <div key={i} className="w-10 h-10 bg-gray-800 rounded-full animate-pulse"></div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const currentContent = getCurrentContent();
    const currentItem = getCurrentItem();

    // No content state
    if (currentContent.length === 0 && ((contentType === 'reels' && !isLoading) || (contentType === 'posts' && !isLoadingPosts))) {
        return (
            <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
                <div className="w-full max-w-2xl h-full md:h-[85vh] md:my-auto md:rounded-2xl md:overflow-hidden bg-gray-900 relative flex items-center justify-center">
                    <div className="text-center p-8">
                        <div className="text-8xl mb-6">
                            {contentType === 'reels' ? '🎬' : '📷'}
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">
                            {contentType === 'reels' ? 'No reels yet' : 'No posts yet'}
                        </h2>
                        <p className="text-gray-400 mb-6 max-w-md mx-auto">
                            {contentType === 'reels' 
                                ? 'Create or watch video posts to see them here' 
                                : 'Create or view image posts to see them here'}
                        </p>
                        <button
                            onClick={() => contentType === 'reels' ? fetchReels() : fetchPosts()}
                            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-full font-semibold text-white transition-colors"
                        >
                            Refresh
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
            {/* Desktop container */}
            <div 
                ref={containerRef}
                className="relative w-full max-w-2xl h-full md:h-[85vh] md:my-auto md:rounded-2xl md:overflow-hidden bg-black shadow-2xl"
                onWheel={handleWheel}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onClick={handleDoubleTap}
            >
                {/* Download Progress Overlay */}
                {showDownloadProgress && (
                    <div className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center backdrop-blur-sm">
                        <div className="bg-gray-900 rounded-xl p-6 max-w-sm w-full mx-4 flex flex-col items-center border border-gray-800">
                            {downloadProgress === 100 ? (
                                <>
                                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                                        <CheckCircle className="w-8 h-8 text-green-500" />
                                    </div>
                                    <h3 className="text-white text-lg font-semibold mb-2">Download Complete!</h3>
                                    <p className="text-gray-300 text-center text-sm mb-4">
                                        {contentType === 'reels' ? 'Reel' : 'Post'} downloaded with watermark
                                    </p>
                                    <button
                                        onClick={() => setShowDownloadProgress(false)}
                                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium text-white transition-colors w-full"
                                    >
                                        Continue
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
                                        <DownloadIcon className="w-8 h-8 text-blue-500 animate-pulse" />
                                    </div>
                                    <h3 className="text-white text-lg font-semibold mb-4">
                                        Downloading {contentType === 'reels' ? 'Reel' : 'Post'}
                                    </h3>
                                    
                                    <div className="w-full bg-gray-800 rounded-full h-2 mb-3 overflow-hidden">
                                        <div 
                                            className="bg-blue-500 h-full rounded-full transition-all duration-300 ease-out"
                                            style={{ width: `${downloadProgress}%` }}
                                        />
                                    </div>
                                    
                                    <div className="flex justify-between w-full text-sm mb-1">
                                        <span className="text-gray-300">Processing...</span>
                                        <span className="text-white font-medium">{Math.round(downloadProgress)}%</span>
                                    </div>
                                    
                                    <button
                                        onClick={() => {
                                            setIsDownloading(false);
                                            setShowDownloadProgress(false);
                                            setDownloadProgress(0);
                                        }}
                                        className="mt-4 px-3 py-1.5 text-gray-400 hover:text-white transition-colors text-sm"
                                    >
                                        Cancel
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Clean Minimal Header */}
                {!showComments && (
                    <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4">
                        <button
                            onClick={handleCloseReels}
                            className="p-2 rounded-full bg-black/40 text-white hover:bg-white/10 transition-colors backdrop-blur-md"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-lg">
                            <span className="text-white text-sm font-medium">
                                {contentType === 'reels' ? 'Reels' : 'Posts'}
                            </span>
                            {/*<span className="text-white/60 text-xs">
                                • {currentIndex + 1} of {currentContent.length}
                            </span>*/}
                        </div>
                        
                        <div className="w-9 h-9 rounded-full bg-transparent from-purple-500 to-blue-500 flex items-center justify-center ">
                           {/* <User className="w-4 h-4 text-white" /> */}
                        </div>
                    </div>
                )}

                {/* Content Container */}
                {currentContent.map((item, index) => (
                    <div
                        key={item.id}
                        className={`content-container absolute inset-0 transition-transform duration-300 ease-out ${
                            index === currentIndex ? 'translate-y-0' : index < currentIndex ? '-translate-y-full' : 'translate-y-full'
                        }`}
                        data-index={index}
                    >
                        {/* Double tap heart animation */}
                        {showDoubleTapHeart && index === currentIndex && (
                            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                                <div className="relative">
                                    <HeartSolid className="w-24 h-24 text-white/90 fill-current animate-ping" />
                                    <HeartSolid className="absolute inset-0 w-24 h-24 text-white fill-current" />
                                </div>
                            </div>
                        )}

                        {/* Video or Image content */}
                        {contentType === 'reels' ? (
                            <video
                                ref={el => videoRefs.current[index] = el}
                                src={item.videoUrl}
                                className="w-full h-full object-cover"
                                loop
                                playsInline
                                preload="auto"
                                muted={index !== currentIndex}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
                                <img
                                    ref={el => imageRefs.current[index] = el}
                                    src={item.imageUrl}
                                    alt={item.caption}
                                    className="max-w-full max-h-full object-contain"
                                    loading="lazy"
                                />
                            </div>
                        )}
                        
                        {/* Play/Pause overlay - Only for videos */}
                        {contentType === 'reels' && !isPlaying && index === currentIndex && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-5 pointer-events-none">
                                <div className="p-3 rounded-full bg-black/40 backdrop-blur-sm">
                                    <Play className="w-8 h-8 text-white" />
                                </div>
                            </div>
                        )}

                        {/* Bottom gradient overlay */}
                        {!showComments && (
                            <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none" />
                        )}

                        {/* User info and caption - CLEAN UI */}
                        {!showComments && (
                            <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none p-5">
                                <div className="flex items-end justify-between">
                                    {/* Left content */}
                                    <div className="flex-1 pr-20">
                                        {/* User info */}
                                        <div className="flex items-center gap-3 mb-3">
                                            <button
                                                onClick={() => handleProfileClick(item.userId, item.username)}
                                                className="flex items-center gap-3 pointer-events-auto group"
                                            >
                                                <div className="relative">
                                                    <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-blue-500 rounded-full opacity-60 blur group-hover:opacity-100 transition duration-200"></div>
                                                    <img
                                                        src={item.userProfile}
                                                        alt={item.username}
                                                        className="relative w-9 h-9 rounded-full border border-white/20 object-cover"
                                                    />
                                                </div>
                                                <div className="flex flex-col items-start">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-white font-medium text-sm">
                                                            {item.username}
                                                        </span>
                                                        {item.isVerified && (
                                                            <div className="w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
                                                                <span className="text-white text-[8px]">✓</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {contentType === 'reels' && (
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <Music className="w-2.5 h-2.5 text-white/60" />
                                                            <span className="text-white/60 text-xs">{item.music}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </button>
                                        </div>
                                        
                                        {/* Caption */}
                                        <p className="text-white text-sm mb-3 line-clamp-2 font-light">
                                            {item.caption}
                                        </p>
                                        
                                        {/* Location and timestamp */}
                                        <div className="flex items-center gap-2 text-white/60 text-xs">
                                            {item.location && (
                                                <span className="bg-white/10 px-2 py-0.5 rounded-full backdrop-blur-sm">
                                                    {item.location}
                                                </span>
                                            )}
                                            <span>•</span>
                                            <span>{item.timestamp}</span>
                                        </div>
                                    </div>

                                    {/* Right side - Clean Actions */}
                                    <div className="flex flex-col items-center gap-3 pointer-events-auto">
                                        {/* Like */}
                                        <div className="flex flex-col items-center">
                                            <button
                                                onClick={handleLike}
                                                disabled={isLiking[item.id]}
                                                className={`p-2.5 rounded-full transition-all duration-200 ${
                                                    contentType === 'reels' 
                                                        ? (likedReels[item.id] ? 'bg-red-500/20 hover:bg-red-500/30' : 'bg-black/40 hover:bg-white/10')
                                                        : (likedPosts[item.id] ? 'bg-red-500/20 hover:bg-red-500/30' : 'bg-black/40 hover:bg-white/10')
                                                } ${isLiking[item.id] ? 'opacity-50 cursor-not-allowed' : ''} backdrop-blur-md`}
                                            >
                                                {contentType === 'reels' ? (
                                                    likedReels[item.id] ? (
                                                        <HeartSolid className="w-5 h-5 text-red-500 fill-current" />
                                                    ) : (
                                                        <Heart className="w-5 h-5 text-white" />
                                                    )
                                                ) : (
                                                    likedPosts[item.id] ? (
                                                        <HeartSolid className="w-5 h-5 text-red-500 fill-current" />
                                                    ) : (
                                                        <Heart className="w-5 h-5 text-white" />
                                                    )
                                                )}
                                            </button>
                                            <span className="text-white text-xs mt-1 font-medium">
                                                {item.likes > 1000 ? `${(item.likes / 1000).toFixed(1)}k` : item.likes}
                                            </span>
                                        </div>

                                        {/* Comment */}
                                        <div className="flex flex-col items-center">
                                            <button
                                                onClick={() => loadComments(item.id)}
                                                className="p-2.5 rounded-full bg-black/40 hover:bg-white/10 transition-all duration-200 backdrop-blur-md"
                                            >
                                                <MessageCircle className="w-5 h-5 text-white" />
                                            </button>
                                            <span className="text-white text-xs mt-1 font-medium">
                                                {item.comments > 1000 ? `${(item.comments / 1000).toFixed(1)}k` : item.comments}
                                            </span>
                                        </div>

                                        {/* Share */}
                                        <div className="flex flex-col items-center relative share-menu">
                                            <button
                                                onClick={() => setShowShareMenu(!showShareMenu)}
                                                className="p-2.5 rounded-full bg-black/40 hover:bg-white/10 transition-all duration-200 backdrop-blur-md"
                                            >
                                                <Send className="w-5 h-5 text-white" />
                                            </button>
                                            <span className="text-white text-xs mt-1 font-medium">
                                                {item.shares > 1000 ? `${(item.shares / 1000).toFixed(1)}k` : item.shares}
                                            </span>
                                            
                                            {/* Share menu */}
                                            {showShareMenu && index === currentIndex && (
                                                <div className="absolute bottom-full right-0 mb-2 bg-gray-900/95 backdrop-blur-md rounded-lg shadow-xl py-1.5 min-w-[140px] z-20 border border-gray-800">
                                                    {shareOptions.map((option, idx) => (
                                                        <button
                                                            key={idx}
                                                            onClick={option.action}
                                                            disabled={isDownloading && option.label === 'Download'}
                                                            className={`w-full px-3 py-2 text-left text-white hover:bg-gray-800/80 flex items-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors`}
                                                        >
                                                            {option.icon}
                                                            <span className="text-xs">{option.label}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Save */}
                                        <div className="flex flex-col items-center">
                                            <button
                                                onClick={handleSave}
                                                className={`p-2.5 rounded-full transition-all duration-200 backdrop-blur-md ${
                                                    contentType === 'reels'
                                                        ? (savedReels[item.id] ? 'bg-yellow-500/20 hover:bg-yellow-500/30' : 'bg-black/40 hover:bg-white/10')
                                                        : (savedPosts[item.id] ? 'bg-yellow-500/20 hover:bg-yellow-500/30' : 'bg-black/40 hover:bg-white/10')
                                                }`}
                                            >
                                                <Bookmark className={`w-5 h-5 ${
                                                    contentType === 'reels'
                                                        ? (savedReels[item.id] ? 'fill-yellow-500 text-yellow-500' : 'text-white')
                                                        : (savedPosts[item.id] ? 'fill-yellow-500 text-yellow-500' : 'text-white')
                                                }`} />
                                            </button>
                                        </div>

                                        {/* More */}
                                        <div className="flex flex-col items-center relative more-menu">
                                            <button
                                                onClick={() => setShowMoreMenu(!showMoreMenu)}
                                                className="p-2.5 rounded-full bg-black/40 hover:bg-white/10 transition-all duration-200 backdrop-blur-md"
                                            >
                                                <MoreVertical className="w-5 h-5 text-white" />
                                            </button>
                                            
                                            {/* More menu */}
                                            {showMoreMenu && index === currentIndex && (
                                                <div className="absolute bottom-full right-0 mb-2 bg-gray-900/95 backdrop-blur-md rounded-lg shadow-xl py-1.5 min-w-[140px] z-20 border border-gray-800">
                                                    {moreOptions.map((option, idx) => (
                                                        <button
                                                            key={idx}
                                                            onClick={option.action}
                                                            className="w-full px-3 py-2 text-left text-white hover:bg-gray-800/80 flex items-center gap-2.5 text-sm transition-colors"
                                                        >
                                                            {option.icon}
                                                            <span className="text-xs">{option.label}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Comments Sidebar - Professional Design */}
                        {showComments && index === currentIndex && (
                            <div className="absolute inset-0 z-30 bg-black/95 backdrop-blur-sm">
                                {/* Comments header */}
                                <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black to-transparent p-4">
                                    <div className="flex items-center justify-between">
                                        <button
                                            onClick={handleCloseComments}
                                            className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
                                        >
                                            <ChevronLeft className="w-5 h-5" />
                                        </button>
                                        <div className="flex flex-col items-center">
                                            <h2 className="text-white text-base font-medium">Comments</h2>
                                            <span className="text-white/60 text-xs">{currentComments.length} comments</span>
                                        </div>
                                        <div className="w-10"></div>
                                    </div>
                                </div>

                                {/* Comments list */}
                                <div className="absolute top-16 bottom-20 left-0 right-0 overflow-y-auto px-4">
                                    {loadingComments ? (
                                        <div className="flex flex-col gap-3 p-4">
                                            {[...Array(3)].map((_, i) => (
                                                <div key={i} className="flex gap-3 animate-pulse">
                                                    <div className="w-8 h-8 bg-gray-800 rounded-full"></div>
                                                    <div className="flex-1 space-y-2">
                                                        <div className="h-3 bg-gray-800 rounded w-1/4"></div>
                                                        <div className="h-2.5 bg-gray-800 rounded w-3/4"></div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : currentComments.length > 0 ? (
                                        <div className="pb-4 space-y-3">
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
                                        <div className="flex flex-col items-center justify-center h-full text-white/50">
                                            <MessageCircle className="w-12 h-12 mb-3 opacity-30" />
                                            <p className="text-base font-light">No comments yet</p>
                                            <p className="text-sm mt-1 font-light">Be the first to comment</p>
                                        </div>
                                    )}
                                </div>

                                {/* Comment input */}
                                <div className="absolute bottom-0 left-0 right-0 bg-black/95 border-t border-gray-800/50 p-4">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => handleProfileClick(userId, 'profile')}
                                            className="flex-shrink-0"
                                        >
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                                                <User className="w-3.5 h-3.5 text-white" />
                                            </div>
                                        </button>
                                        <div className="flex-1 flex items-center bg-gray-800/40 backdrop-blur-sm rounded-full px-4 py-2.5 border border-gray-700/50">
                                            <input
                                                ref={commentInputRef}
                                                type="text"
                                                value={commentText}
                                                onChange={(e) => setCommentText(e.target.value)}
                                                placeholder="Add a comment..."
                                                className="flex-1 bg-transparent text-white placeholder-gray-400 focus:outline-none text-sm font-light"
                                                onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                                            />
                                            {commentText.trim() && (
                                                <button
                                                    onClick={handleAddComment}
                                                    className="text-blue-400 font-medium text-sm hover:text-blue-300 px-2 transition-colors"
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

                {/* Navigation arrows - Clean Design */}
                {!showComments && currentIndex > 0 && (
                    <div className="absolute top-1/2 left-3 transform -translate-y-1/2 pointer-events-none">
                        <div className="p-1.5 rounded-full bg-black/40 backdrop-blur-sm">
                            <ChevronLeft className="w-4 h-4 text-white/80 rotate-90" />
                        </div>
                    </div>
                )}
                {!showComments && currentIndex < currentContent.length - 1 && (
                    <div className="absolute top-1/2 right-3 transform -translate-y-1/2 pointer-events-none">
                        <div className="p-1.5 rounded-full bg-black/40 backdrop-blur-sm">
                            <ChevronLeft className="w-4 h-4 text-white/80 -rotate-90" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Reels;