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
    
    // State management - ALL LOGIC SAME
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
    const canvasRef = useRef(null);

    // Fetch reels from API - SAME LOGIC
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
                
                setReels(videoPosts);
                
                const initialLikedState = {};
                videoPosts.forEach(reel => {
                    if (reel.userHasLiked) {
                        initialLikedState[reel.id] = true;
                    }
                });
                setLikedReels(initialLikedState);
                
                console.log(`✅ Loaded ${videoPosts.length} reels`);
                
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
    }, [getToken, userId]);

    // Fetch posts from API - SAME LOGIC
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
                
                setPosts(imagePosts);
                
                const initialLikedState = {};
                imagePosts.forEach(post => {
                    if (post.userHasLiked) {
                        initialLikedState[post.id] = true;
                    }
                });
                setLikedPosts(initialLikedState);
                
                console.log(`✅ Loaded ${imagePosts.length} posts`);
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

    // Get current content - SAME LOGIC
    const getCurrentContent = () => {
        return contentType === 'reels' ? reels : posts;
    };

    const getCurrentItem = () => {
        const content = getCurrentContent();
        return content[currentIndex];
    };

    // Setup Intersection Observer - SAME LOGIC
    useEffect(() => {
        const content = getCurrentContent();
        if (content.length === 0) return;

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
                        if (video) {
                            video.muted = false;
                            video.play().catch(error => {
                                console.log('Auto-play failed:', error);
                                video.muted = true;
                                video.play().catch(e => console.log('Muted autoplay also failed:', e));
                            });
                        }
                    }
                } else {
                    if (contentType === 'reels') {
                        const video = videoRefs.current[index];
                        if (video) {
                            video.pause();
                            video.muted = true;
                        }
                    }
                }
            });
        };

        observerRef.current = new IntersectionObserver(handleIntersection, options);

        const contentContainers = document.querySelectorAll('.content-container');
        contentContainers.forEach(container => {
            if (observerRef.current) {
                observerRef.current.observe(container);
            }
        });

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [reels, posts, contentType]);

    // Manual play/pause - SAME LOGIC
    useEffect(() => {
        if (contentType !== 'reels') return;
        
        const currentVideo = videoRefs.current[currentIndex];
        if (!currentVideo) return;

        if (isPlaying) {
            currentVideo.muted = false;
            currentVideo.play().catch(error => {
                console.log('Manual play failed:', error);
                currentVideo.muted = true;
                currentVideo.play().catch(e => console.log('Muted play also failed:', e));
            });
        } else {
            currentVideo.pause();
        }
    }, [currentIndex, isPlaying, contentType]);

    // Stop all videos - SAME LOGIC
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

    // Handle download - SAME LOGIC
    const handleDownload = async () => {
        const currentItem = getCurrentItem();
        if (!currentItem || isDownloading || downloadedReels[currentItem.id]) return;

        setIsDownloading(true);
        setShowDownloadProgress(true);
        setDownloadProgress(0);

        try {
            setDownloadProgress(10);
            
            const downloadUrl = contentType === 'reels' ? currentItem.videoUrl : currentItem.imageUrl;
            const response = await fetch(downloadUrl);
            if (!response.ok) throw new Error('Failed to fetch content');
            
            const contentLength = response.headers.get('content-length');
            const total = parseInt(contentLength || '0');
            const reader = response.body.getReader();
            let received = 0;
            let chunks = [];

            while (true) {
                setDownloadProgress(20);
                const { done, value } = await reader.read();
                
                if (done) break;
                
                chunks.push(value);
                received += value.length;
                
                if (total > 0) {
                    const progress = Math.min(20 + (received / total * 70), 90);
                    setDownloadProgress(progress);
                }
            }

            setDownloadProgress(90);
            const blob = new Blob(chunks, { 
                type: contentType === 'reels' ? 'video/mp4' : 'image/jpeg' 
            });

            if (contentType === 'reels') {
                const blobUrl = URL.createObjectURL(blob);
                const video = document.createElement('video');
                video.src = blobUrl;
                
                await new Promise((resolve, reject) => {
                    video.onloadedmetadata = resolve;
                    video.onerror = reject;
                });

                await video.play();
                video.pause();
                video.currentTime = 0;

                await new Promise((resolve) => {
                    video.oncanplay = resolve;
                });

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;

                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                ctx.font = 'bold 48px Arial';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('pixo', canvas.width / 2, canvas.height / 2);
                
                ctx.font = 'bold 24px Arial';
                ctx.fillText('pixo', canvas.width - 60, canvas.height - 30);

                canvas.toBlob(async (canvasBlob) => {
                    if (!canvasBlob) {
                        throw new Error('Failed to create watermarked video');
                    }

                    const downloadUrl = URL.createObjectURL(canvasBlob);
                    const a = document.createElement('a');
                    a.href = downloadUrl;
                    a.download = `pixo_reel_${currentItem.id}.mp4`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    
                    URL.revokeObjectURL(downloadUrl);
                    URL.revokeObjectURL(blobUrl);

                    setDownloadedReels(prev => ({
                        ...prev,
                        [currentItem.id]: true
                    }));

                    setDownloadProgress(100);
                    toast.success('Reel downloaded with watermark!');
                    
                    setTimeout(() => {
                        setShowDownloadProgress(false);
                        setIsDownloading(false);
                        setDownloadProgress(0);
                    }, 1500);

                }, 'video/mp4');
            } else {
                const img = new Image();
                img.src = URL.createObjectURL(blob);
                
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                });

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                canvas.width = img.width;
                canvas.height = img.height;

                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                ctx.font = 'bold 48px Arial';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('pixo', canvas.width / 2, canvas.height / 2);
                
                ctx.font = 'bold 24px Arial';
                ctx.fillText('pixo', canvas.width - 60, canvas.height - 30);

                const downloadUrl = canvas.toDataURL('image/jpeg', 0.9);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = `pixo_post_${currentItem.id}.jpg`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                setDownloadedReels(prev => ({
                    ...prev,
                    [currentItem.id]: true
                }));

                setDownloadProgress(100);
                toast.success('Post downloaded with watermark!');
                
                setTimeout(() => {
                    setShowDownloadProgress(false);
                    setIsDownloading(false);
                    setDownloadProgress(0);
                }, 1500);
            }

        } catch (error) {
            console.error('Download error:', error);
            toast.error(`Failed to download ${contentType === 'reels' ? 'reel' : 'post'}`);
            setIsDownloading(false);
            setShowDownloadProgress(false);
            setDownloadProgress(0);
        }
    };

    // Share options - SAME LOGIC
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

    // Handle scroll/swipe - SAME LOGIC
    const handleScroll = (direction) => {
        const content = getCurrentContent();
        if (direction === 'down' && currentIndex < content.length - 1) {
            setCurrentIndex(prev => prev + 1);
            if (contentType === 'reels') {
                setIsPlaying(true);
            }
        } else if (direction === 'up' && currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
            if (contentType === 'reels') {
                setIsPlaying(true);
            }
        }
        
        setShowComments(false);
        setShowShareMenu(false);
        setShowMoreMenu(false);
        setShowDownloadProgress(false);
    };

    // Handle wheel scroll - SAME LOGIC
    const handleWheel = (e) => {
        if (Math.abs(e.deltaY) > 10) {
            handleScroll(e.deltaY > 0 ? 'down' : 'up');
            e.preventDefault();
        }
    };

    // Touch handling - SAME LOGIC
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

    // Handle profile click - SAME LOGIC
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

    // Handle single tap - SAME LOGIC
    const handleSingleTap = () => {
        if (contentType === 'reels') {
            setIsPlaying(!isPlaying);
        }
    };

    // Handle double tap - SAME LOGIC
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

    // Like functionality - SAME LOGIC
    const handleLike = async () => {
        const currentItem = getCurrentItem();
        if (!currentItem || isLiking[currentItem.id]) return;

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
                
                toast.success(isNowLiked ? 'Liked!' : 'Unliked');
            } else {
                toast.error(data.message || 'Failed to like');
            }
        } catch (error) {
            console.error('Error liking:', error);
            toast.error(error.response?.data?.message || 'Failed to like');
        } finally {
            setIsLiking(prev => ({ ...prev, [currentItem.id]: false }));
        }
    };

    // Save functionality - SAME LOGIC
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

    // Load comments - SAME LOGIC
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

    // Close comments - SAME LOGIC
    const handleCloseComments = () => {
        setShowComments(false);
        setCurrentComments([]);
        setCommentText('');
    };

    // Add comment - SAME LOGIC
    const handleAddComment = async () => {
        if (!commentText.trim() || !getCurrentItem()) return;

        try {
            const token = await getToken();
            const { data } = await api.post('/api/post/comment', {
                postId: getCurrentItem().id,
                content: commentText.trim()
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data.success && data.comment) {
                const newComment = {
                    ...data.comment,
                    user: getCurrentItem().user
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

    // Delete comment - SAME LOGIC
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

    // Update comment - SAME LOGIC
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

    // Reply to comment - SAME LOGIC
    const handleReplyComment = async (commentId, replyText, username) => {
        if (!replyText.trim()) return;

        try {
            const token = await getToken();
            const { data } = await api.post('/api/post/comment', {
                postId: getCurrentItem().id,
                content: `@${username} ${replyText.trim()}`,
                parentCommentId: commentId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data.success && data.comment) {
                const newReply = {
                    ...data.comment,
                    user: getCurrentItem().user
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

    // Share functionality - SAME LOGIC
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

    // Toggle content type - SAME LOGIC
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

    // More menu options - SAME LOGIC
    const moreOptions = [
        { 
            icon: contentType === 'reels' ? <Image className="w-5 h-5" /> : <Video className="w-5 h-5" />, 
            label: contentType === 'reels' ? 'Switch to Posts' : 'Switch to Reels', 
            action: () => toggleContentType(contentType === 'reels' ? 'posts' : 'reels') 
        },
        { icon: <Flag className="w-5 h-5" />, label: 'Report', action: () => toast('Report feature coming soon') },
        { icon: <X className="w-5 h-5" />, label: 'Not Interested', action: () => toast('Not interested feature coming soon') },
    ];

    const handleCopyLink = async () => {
        const currentItem = getCurrentItem();
        if (!currentItem) return;
        
        const shareUrl = `${window.location.origin}/post/${currentItem.id}`;
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied to clipboard!');
        setShowShareMenu(false);
    };

    // Handle back from comments - SAME LOGIC
    const handleBackFromComments = () => {
        handleCloseComments();
    };

    // Handle closing reels - SAME LOGIC
    const handleCloseReels = () => {
        videoRefs.current.forEach(video => {
            if (video) {
                video.pause();
                video.currentTime = 0;
                video.muted = true;
            }
        });
        
        onClose();
    };

    // Handle clicking outside menus - SAME LOGIC
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

    // Clean UI: Desktop responsive container
    const currentContent = getCurrentContent();
    const currentItem = getCurrentItem();

    // Loading state - Updated for desktop
    if (isLoading && contentType === 'reels') {
        return (
            <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
                <div className="w-full max-w-2xl h-full md:h-[85vh] md:my-auto md:rounded-2xl md:overflow-hidden bg-gray-900 relative">
                    {/* Loading skeleton */}
                    <div className="absolute inset-0 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 animate-pulse"></div>
                    
                    {/* Top bar skeleton */}
                    <div className="absolute top-0 left-0 right-0 z-10 p-4 flex items-center justify-between">
                        <div className="w-8 h-8 bg-gray-800 rounded-full animate-pulse"></div>
                        <div className="w-24 h-6 bg-gray-800 rounded animate-pulse"></div>
                        <div className="w-8 h-8 bg-gray-800 rounded-full animate-pulse"></div>
                    </div>
                    
                    {/* Content skeleton */}
                    <div className="absolute top-16 bottom-20 left-4 right-4">
                        <div className="h-full bg-gradient-to-r from-gray-800 to-gray-900 animate-pulse rounded-lg"></div>
                    </div>
                    
                    {/* Bottom actions skeleton */}
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

    // No content state - Updated for desktop
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
                    <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center">
                        <div className="bg-gray-900 rounded-2xl p-8 max-w-md w-full mx-4 flex flex-col items-center">
                            {downloadProgress === 100 ? (
                                <>
                                    <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                                        <CheckCircle className="w-12 h-12 text-green-500" />
                                    </div>
                                    <h3 className="text-white text-xl font-bold mb-2">Download Complete!</h3>
                                    <p className="text-gray-300 text-center mb-6">
                                        {contentType === 'reels' ? 'Reel' : 'Post'} downloaded with "pixo" watermark
                                    </p>
                                    <button
                                        onClick={() => setShowDownloadProgress(false)}
                                        className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-full font-semibold text-white transition-colors"
                                    >
                                        Continue Viewing
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
                                        <DownloadIcon className="w-12 h-12 text-blue-500 animate-bounce" />
                                    </div>
                                    <h3 className="text-white text-xl font-bold mb-6">
                                        Downloading {contentType === 'reels' ? 'Reel' : 'Post'}
                                    </h3>
                                    
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
                                        The {contentType === 'reels' ? 'reel' : 'post'} will include "pixo" watermark
                                    </p>
                                    
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
                    <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
                        <button
                            onClick={handleCloseReels}
                            className="p-2 rounded-full bg-black/50 text-white hover:bg-white/20 transition-colors backdrop-blur-sm"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <h1 className="text-white text-lg font-semibold">
                            {contentType === 'reels' ? 'Reels' : 'Posts'}
                        </h1>
                        <div className="flex items-center gap-2 px-3 py-1 bg-black/50 rounded-full backdrop-blur-sm">
                            <User className="w-4 h-4 text-white" />
                            <span className="text-white text-sm font-medium">{currentContent.length}</span>
                        </div>
                    </div>
                )}

                {/* Content Container */}
                {currentContent.map((item, index) => (
                    <div
                        key={item.id}
                        className={`content-container absolute inset-0 transition-transform duration-300 ease-in-out ${
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
                            <div className="w-full h-full flex items-center justify-center bg-black">
                                <img
                                    ref={el => imageRefs.current[index] = el}
                                    src={item.imageUrl}
                                    alt={item.caption}
                                    className="max-w-full max-h-full object-contain"
                                />
                            </div>
                        )}
                        
                        {/* Play/Pause overlay - Only for videos */}
                        {contentType === 'reels' && !isPlaying && index === currentIndex && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-5 pointer-events-none">
                                <div className="p-4 rounded-full bg-black/60 border-2 border-white/20">
                                    {isPlaying ? (
                                        <Pause className="w-16 h-16 text-white" />
                                    ) : (
                                        <Play className="w-16 h-16 text-white" />
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Bottom gradient overlay */}
                        {!showComments && (
                            <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none" />
                        )}

                        {/* User info and caption - LEFT SIDE */}
                        {!showComments && (
                            <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none p-6">
                                <div className="flex items-end justify-between">
                                    {/* Left content */}
                                    <div className="flex-1 pr-24">
                                        {/* User info */}
                                        <div className="flex items-center gap-3 mb-3">
                                            <button
                                                onClick={() => handleProfileClick(item.userId, item.username)}
                                                className="flex items-center gap-3 pointer-events-auto hover:opacity-80 transition-opacity"
                                            >
                                                <img
                                                    src={item.userProfile}
                                                    alt={item.username}
                                                    className="w-10 h-10 rounded-full border-2 border-white object-cover"
                                                />
                                                <div className="flex flex-col items-start">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-white font-semibold">
                                                            {item.username}
                                                        </span>
                                                        {item.isVerified && (
                                                            <span className="text-blue-400 text-sm">✓</span>
                                                        )}
                                                    </div>
                                                    {/* Content count badge */}
                                                    <div className="flex items-center gap-1 mt-1">
                                                        {contentType === 'reels' && item.userReelsCount > 0 && (
                                                            <>
                                                                <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                                                                    <Play className="w-2 h-2 text-white" />
                                                                </div>
                                                                <span className="text-white/80 text-xs">
                                                                    {item.userReelsCount} reel{item.userReelsCount !== 1 ? 's' : ''}
                                                                </span>
                                                            </>
                                                        )}
                                                        {contentType === 'posts' && item.userPostsCount > 0 && (
                                                            <>
                                                                <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                                                    <Image className="w-2 h-2 text-white" />
                                                                </div>
                                                                <span className="text-white/80 text-xs">
                                                                    {item.userPostsCount} post{item.userPostsCount !== 1 ? 's' : ''}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        </div>
                                        
                                        {/* Caption */}
                                        <p className="text-white text-sm mb-3 line-clamp-2">
                                            {item.caption}
                                        </p>
                                        
                                        {/* Music and location */}
                                        <div className="flex items-center gap-3 text-white/80 text-xs">
                                            {contentType === 'reels' && (
                                                <div className="flex items-center gap-2">
                                                    <Music className="w-3 h-3" />
                                                    <span>{item.music}</span>
                                                </div>
                                            )}
                                            {item.location && (
                                                <span>• {item.location}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right side - Actions */}
                                    <div className="flex flex-col items-center gap-4 pointer-events-auto">
                                        {/* Like */}
                                        <div className="flex flex-col items-center">
                                            <button
                                                onClick={handleLike}
                                                disabled={isLiking[item.id]}
                                                className={`p-2 rounded-full transition-colors ${
                                                    contentType === 'reels' 
                                                        ? (likedReels[item.id] ? 'bg-red-500/20' : 'bg-black/50 hover:bg-white/20')
                                                        : (likedPosts[item.id] ? 'bg-red-500/20' : 'bg-black/50 hover:bg-white/20')
                                                } ${isLiking[item.id] ? 'opacity-50 cursor-not-allowed' : ''} backdrop-blur-sm`}
                                            >
                                                {contentType === 'reels' ? (
                                                    likedReels[item.id] ? (
                                                        <HeartSolid className="w-6 h-6 text-red-500 fill-current" />
                                                    ) : (
                                                        <Heart className="w-6 h-6 text-white" />
                                                    )
                                                ) : (
                                                    likedPosts[item.id] ? (
                                                        <HeartSolid className="w-6 h-6 text-red-500 fill-current" />
                                                    ) : (
                                                        <Heart className="w-6 h-6 text-white" />
                                                    )
                                                )}
                                            </button>
                                            <span className="text-white text-xs mt-1 font-semibold">
                                                {item.likes > 1000 ? `${(item.likes / 1000).toFixed(1)}k` : item.likes}
                                            </span>
                                        </div>

                                        {/* Comment */}
                                        <div className="flex flex-col items-center">
                                            <button
                                                onClick={() => loadComments(item.id)}
                                                className="p-2 rounded-full bg-black/50 hover:bg-white/20 transition-colors backdrop-blur-sm"
                                            >
                                                <MessageCircle className="w-6 h-6 text-white" />
                                            </button>
                                            <span className="text-white text-xs mt-1 font-semibold">
                                                {item.comments > 1000 ? `${(item.comments / 1000).toFixed(1)}k` : item.comments}
                                            </span>
                                        </div>

                                        {/* Share */}
                                        <div className="flex flex-col items-center relative share-menu">
                                            <button
                                                onClick={() => setShowShareMenu(!showShareMenu)}
                                                className="p-2 rounded-full bg-black/50 hover:bg-white/20 transition-colors backdrop-blur-sm"
                                            >
                                                <Send className="w-6 h-6 text-white" />
                                            </button>
                                            <span className="text-white text-xs mt-1 font-semibold">
                                                {item.shares > 1000 ? `${(item.shares / 1000).toFixed(1)}k` : item.shares}
                                            </span>
                                            
                                            {/* Share menu */}
                                            {showShareMenu && index === currentIndex && (
                                                <div className="absolute bottom-full right-0 mb-2 bg-gray-900/95 backdrop-blur-sm rounded-xl shadow-2xl py-2 min-w-[160px] z-20 border border-gray-800">
                                                    {shareOptions.map((option, idx) => (
                                                        <button
                                                            key={idx}
                                                            onClick={option.action}
                                                            disabled={isDownloading && option.label === 'Download'}
                                                            className={`w-full px-4 py-2 text-left text-white hover:bg-gray-800/80 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed text-sm`}
                                                        >
                                                            {option.icon}
                                                            <span>{option.label}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Save */}
                                        <div className="flex flex-col items-center">
                                            <button
                                                onClick={handleSave}
                                                className={`p-2 rounded-full transition-colors backdrop-blur-sm ${
                                                    contentType === 'reels'
                                                        ? (savedReels[item.id] ? 'bg-yellow-500/20' : 'bg-black/50 hover:bg-white/20')
                                                        : (savedPosts[item.id] ? 'bg-yellow-500/20' : 'bg-black/50 hover:bg-white/20')
                                                }`}
                                            >
                                                <Bookmark className={`w-6 h-6 ${
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
                                                className="p-2 rounded-full bg-black/50 hover:bg-white/20 transition-colors backdrop-blur-sm"
                                            >
                                                <MoreVertical className="w-6 h-6 text-white" />
                                            </button>
                                            
                                            {/* More menu */}
                                            {showMoreMenu && index === currentIndex && (
                                                <div className="absolute bottom-full right-0 mb-2 bg-gray-900/95 backdrop-blur-sm rounded-xl shadow-2xl py-2 min-w-[160px] z-20 border border-gray-800">
                                                    {moreOptions.map((option, idx) => (
                                                        <button
                                                            key={idx}
                                                            onClick={option.action}
                                                            className="w-full px-4 py-2 text-left text-white hover:bg-gray-800/80 flex items-center gap-3 text-sm"
                                                        >
                                                            {option.icon}
                                                            <span>{option.label}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
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
                                            <ChevronLeft className="w-5 h-5" />
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
                                <div className="absolute bottom-0 left-0 right-0 bg-black/95 border-t border-gray-800 p-4">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => handleProfileClick(userId, 'profile')}
                                            className="flex-shrink-0"
                                        >
                                            <img
                                                src={item.userProfile}
                                                alt="Your profile"
                                                className="w-9 h-9 rounded-full object-cover"
                                            />
                                        </button>
                                        <div className="flex-1 flex items-center bg-gray-800/80 backdrop-blur-sm rounded-full px-4 py-3">
                                            <input
                                                ref={commentInputRef}
                                                type="text"
                                                value={commentText}
                                                onChange={(e) => setCommentText(e.target.value)}
                                                placeholder="Add a comment..."
                                                className="flex-1 bg-transparent text-white placeholder-gray-400 focus:outline-none text-sm"
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
                    <div className="absolute top-20 left-1/2 transform -translate-x-1/2 text-white/70 text-sm bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full">
                        {currentIndex + 1} / {currentContent.length}
                    </div>
                )}

                {/* Navigation hints */}
                {!showComments && currentIndex > 0 && (
                    <div className="absolute top-1/2 left-4 transform -translate-y-1/2 animate-bounce pointer-events-none">
                        <ChevronLeft className="w-8 h-8 text-white rotate-90 opacity-70" />
                    </div>
                )}
                {!showComments && currentIndex < currentContent.length - 1 && (
                    <div className="absolute top-1/2 right-4 transform -translate-y-1/2 animate-bounce pointer-events-none">
                        <ChevronLeft className="w-8 h-8 text-white -rotate-90 opacity-70" />
                    </div>
                )}
            </div>
        </div>
    );
};

export default Reels;