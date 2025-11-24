import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { BadgeCheck, Heart, MessageCircle, Share2, Send, X, Edit, Trash2, MoreVertical, Loader2, Link, Play, Volume2, VolumeX, AlertCircle } from 'lucide-react'
import moment from 'moment'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useAuth } from '@clerk/clerk-react'
import api from '../api/axios'
import toast from 'react-hot-toast'

// ----------------------------------------------------------------------
// --- Confirmation Modal Component ---
// ----------------------------------------------------------------------

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Delete", cancelText = "Cancel", type = "delete" }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 transform transition-all">
                <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2 rounded-full ${type === 'delete' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-gray-900">{title}</h3>
                        <p className="text-gray-600 text-sm mt-1">{message}</p>
                    </div>
                </div>
                
                <div className="flex gap-3 justify-end mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                            type === 'delete' 
                                ? 'bg-red-600 hover:bg-red-700' 
                                : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ----------------------------------------------------------------------
// --- Post Modal Component ---
// ----------------------------------------------------------------------

const PostModal = React.memo(({ 
    post, 
    isPostOwner, 
    handleEditPost, 
    handleDeletePost, 
    onClose,
    currentUser,
    getToken,
    navigate
}) => {
    // Safety check at the beginning
    if (!post || !post.user) {
        console.warn('PostModal received invalid post data');
        onClose?.();
        return null;
    }

    const [comments, setComments] = useState([]);
    const [commentsCount, setCommentsCount] = useState(post?.comments_count || 0);
    const [isFetchingComments, setIsFetchingComments] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [isCommenting, setIsCommenting] = useState(false);
    const [editingComment, setEditingComment] = useState(null);
    const [editCommentText, setEditCommentText] = useState('');
    const [showMenu, setShowMenu] = useState(null);
    const [showPostOptionsMenu, setShowPostOptionsMenu] = useState(false);
    const [mutedVideos, setMutedVideos] = useState({});
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [commentToDelete, setCommentToDelete] = useState(null);

    const modalRef = useRef(null);
    const videoRefs = useRef({});
    const commentsFetched = useRef(false);

    // Memoized values for performance
    const postWithHashtags = useMemo(() => 
        post?.content ? 
            post.content.replace(/(#\w+)/g, '<span class="text-indigo-600 font-medium hover:underline cursor-pointer">$1</span>') 
            : ''
    , [post?.content]);

    const mediaData = useMemo(() => {
        if (post?.media_urls && Array.isArray(post.media_urls) && post.media_urls.length > 0) {
            return post.media_urls;
        }
        else if (post?.image_urls && Array.isArray(post.image_urls) && post.image_urls.length > 0) {
            return post.image_urls.map(url => ({
                url: url,
                type: 'image',
                filePath: ''
            }));
        }
        return [];
    }, [post?.media_urls, post?.image_urls]);

    const protectiveStyles = {
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
        WebkitUserDrag: 'none',
        KhtmlUserDrag: 'none',
        MozUserDrag: 'none',
        OUserDrag: 'none',
        userDrag: 'none',
        WebkitTouchCallout: 'none',
        WebkitTapHighlightColor: 'transparent',
        pointerEvents: 'none'
    };

    // Video control functions
    const handleVideoPlay = useCallback((index) => {
        // Pause all other videos
        Object.keys(videoRefs.current).forEach(key => {
            if (key !== index.toString() && videoRefs.current[key]) {
                videoRefs.current[key].pause();
            }
        });
    }, []);

    const toggleMute = useCallback((index, e) => {
        e.stopPropagation();
        setMutedVideos(prev => ({
            ...prev,
            [index]: !prev[index]
        }));
    }, []);

    // Close modal on ESC key
    useEffect(() => {
        const handleEscKey = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscKey);
        return () => {
            document.removeEventListener('keydown', handleEscKey);
        };
    }, [onClose]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
            // Clean up video refs
            Object.values(videoRefs.current).forEach(video => {
                if (video) {
                    video.pause();
                    video.src = '';
                }
            });
        };
    }, []);

    const fetchComments = useCallback(async () => {
        if (!post?._id || commentsFetched.current) {
            return;
        }

        setIsFetchingComments(true);
        try {
            const token = await getToken();
            const response = await api.get(`/api/post/comments/${post._id}`, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 10000 // 10 second timeout
            });
            
            const { data } = response;
            
            if (data.success) {
                setComments(data.comments || []);
                setCommentsCount(data.comments?.length || 0);
                commentsFetched.current = true;
            }  
        } catch (error) {
            console.error('Error fetching comments:', error);
            if (error.code !== 'ECONNABORTED') {
                toast.error('Failed to load comments.');
            }
        } finally {
            setIsFetchingComments(false);
        }
    }, [post?._id, getToken]);

    const handleAddComment = async () => {
        if (!commentText.trim() || !post?._id) return;

        setIsCommenting(true);
        try {
            const token = await getToken();
            const { data } = await api.post(`/api/post/comment`,  
                { postId: post._id, content: commentText },  
                { 
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 10000
                }
            );

            if (data.success) {
                toast.success('Comment added!');
                setCommentsCount(prev => prev + 1);
                setCommentText('');
                commentsFetched.current = false; // Reset cache
                await fetchComments();
            } else {
                toast.error(data.message || 'Failed to add comment');
            }
        } catch (error) {
            console.error('Error adding comment:', error);
            toast.error('Failed to add comment');
        } finally {
            setIsCommenting(false);
        }
    };

    const isCurrentUserComment = useCallback((comment) => {
        return comment?.user?._id === currentUser?._id;
    }, [currentUser?._id]);

    const handleEditComment = useCallback((comment) => {
        if (!comment?._id) return;
        setEditingComment(comment._id);
        setEditCommentText(comment?.content || '');
        setShowMenu(null);
    }, []);

    const handleUpdateComment = async (commentId) => {
        if (!editCommentText.trim() || !commentId) return;

        try {
            const token = await getToken();
            await api.put(`/api/post/comment/${commentId}`, 
                { content: editCommentText }, 
                { 
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 10000
                }
            );
            toast.success('Comment updated!');
            setEditingComment(null);
            setEditCommentText('');
            commentsFetched.current = false; // Reset cache
            await fetchComments();
        } catch (error) {
            console.error('Error updating comment:', error);
            toast.error('Failed to update comment.');
        }
    };

    const handleDeleteComment = async (commentId) => {
        if (!commentId) return;
        
        setShowDeleteConfirm(false);
        try {
            const token = await getToken();
            await api.delete(`/api/post/comment/${commentId}`, 
                { 
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 10000
                }
            );
            toast.success('Comment deleted!');
            setCommentsCount(prev => Math.max(0, prev - 1));
            setShowMenu(null);
            commentsFetched.current = false; // Reset cache
            await fetchComments();
        } catch (error) {
            console.error('Error deleting comment:', error);
            toast.error('Failed to delete comment.');
        }
    };

    const cancelEdit = () => {
        setEditingComment(null);
        setEditCommentText('');
    };
    
    // Fetch comments when modal opens
    useEffect(() => {
        if (post?._id) {
            fetchComments();
        }
    }, [post?._id, fetchComments]);

    const handleEditAction = () => {
        setShowPostOptionsMenu(false);
        onClose();
        handleEditPost?.();
    };

    const handleDeleteAction = () => {
        setShowPostOptionsMenu(false);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = () => {
        setShowDeleteConfirm(false);
        onClose();
        handleDeletePost?.();
    };

    const handleCommentKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleAddComment();
        }
    };

    return (
        <>
            <div 
                ref={modalRef}
                className='fixed inset-0 bg-black bg-opacity-90 backdrop-blur-md flex items-center justify-center z-50 p-4'
                onClick={onClose}
                onContextMenu={(e) => e.preventDefault()}
                style={{ WebkitUserSelect: 'none' }}
            >
                <div 
                    className='bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col lg:flex-row overflow-hidden relative'
                    onClick={(e) => e.stopPropagation()} 
                >
                    
                    {/* Post Content & Media */}
                    <div className='w-full lg:w-3/5 flex flex-col overflow-hidden border-b lg:border-r lg:border-b-0 border-gray-100'> 
                        <div className='sticky top-0 bg-white z-20 p-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0'>
                            <div 
                                className='flex items-center gap-3 cursor-pointer' 
                                onClick={() => {
                                    if (post?.user?._id) {
                                        navigate('/profile/' + post.user._id);
                                    }
                                }}
                                onContextMenu={(e) => e.preventDefault()}
                            >
                                <img
                                    src={post?.user?.profile_picture || '/default-avatar.png'}
                                    alt={post?.user?.full_name || 'User'}
                                    className='w-10 h-10 rounded-full object-cover shadow-sm'
                                    style={protectiveStyles}
                                    onContextMenu={(e) => e.preventDefault()}
                                    draggable={false}
                                />
                                <div>
                                    <span className="font-bold text-gray-800 flex items-center gap-1">
                                        {post?.user?.full_name || 'Unknown User'}
                                        <BadgeCheck className='w-3 h-3 text-blue-500' title="Verified"/>
                                    </span>
                                    <span className="text-gray-500 text-xs">@{post?.user?.username || 'unknown'}</span>
                                </div>
                            </div>

                            <div className='flex items-center gap-2 relative'>
                                {isPostOwner && (
                                    <button
                                        className='p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition'
                                        onClick={(e) => { e.stopPropagation(); setShowPostOptionsMenu(!showPostOptionsMenu); }}
                                        title="More Post Options"
                                    >
                                        <MoreVertical className='w-5 h-5' />
                                    </button>
                                )}

                                {isPostOwner && showPostOptionsMenu && (
                                    <div className='absolute right-0 top-8 bg-white shadow-xl rounded-lg border border-gray-100 z-30 min-w-36 divide-y divide-gray-100'>
                                        <button onClick={handleEditAction} className='flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 rounded-t-lg transition'>
                                            <Edit className='w-4 h-4' /> Edit Post
                                        </button>
                                        <button onClick={handleDeleteAction} className='flex items-center gap-2 w-full px-4 py-2 text-sm text-red-500 hover:bg-red-50 rounded-b-lg transition'>
                                            <Trash2 className='w-4 h-4' /> Delete Post
                                        </button>
                                    </div>
                                )}

                                <button onClick={onClose} className='p-1 rounded-full text-gray-500 hover:text-red-500 hover:bg-red-50 transition' title="Close">
                                    <X className='w-6 h-6' />
                                </button>
                            </div>
                        </div>
                        
                        <div className='flex-1 p-4 sm:p-6 space-y-4 overflow-y-auto' onContextMenu={(e) => e.preventDefault()}>
                            <div className='text-gray-400 text-xs'>
                                {moment(post?.createdAt).format('MMM D, YYYY HH:mm')}
                            </div>

                            {post?.content && (
                                <div
                                    className='text-gray-800 text-lg leading-relaxed whitespace-pre-line'
                                    dangerouslySetInnerHTML={{ __html: postWithHashtags }}
                                    style={protectiveStyles}
                                    onContextMenu={(e) => e.preventDefault()}
                                />
                            )}

                            {/* Media Container */}
                            {mediaData.length > 0 && (
                                <div 
                                    className={`grid gap-3 ${mediaData.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} overflow-hidden`}
                                    onContextMenu={(e) => e.preventDefault()}
                                >
                                    {mediaData.map((media, index) => (
                                        <div key={index} className="relative overflow-hidden rounded-lg bg-black">
                                            {media.type === 'image' ? (
                                                <img
                                                    src={media.url}
                                                    className='w-full h-full max-h-[50vh] object-contain'
                                                    alt={`Post image ${index + 1}`}
                                                    style={protectiveStyles}
                                                    onContextMenu={(e) => e.preventDefault()}
                                                    draggable={false}
                                                />
                                            ) : (
                                                <div className="relative w-full h-0 pb-[56.25%]">
                                                    <video
                                                        ref={el => {
                                                            videoRefs.current[index] = el;
                                                        }}
                                                        src={media.url}
                                                        className='absolute inset-0 w-full h-full object-contain'
                                                        controls
                                                        style={protectiveStyles}
                                                        onContextMenu={(e) => e.preventDefault()}
                                                        onPlay={() => handleVideoPlay(index)}
                                                        muted={mutedVideos[index] || false}
                                                        playsInline
                                                        preload="metadata"
                                                    >
                                                        Your browser does not support the video tag.
                                                    </video>
                                                    <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                                                        VIDEO
                                                    </div>
                                                    <button
                                                        onClick={(e) => toggleMute(index, e)}
                                                        className="absolute top-2 right-2 bg-black/70 text-white p-1 rounded hover:bg-black/90 transition"
                                                    >
                                                        {mutedVideos[index] ? (
                                                            <VolumeX className="w-3 h-3" />
                                                        ) : (
                                                            <Volume2 className="w-3 h-3" />
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Comments Section */}
                    <div className='w-full lg:w-2/5 flex flex-col flex-shrink-0 border-t lg:border-t-0 lg:border-l border-gray-100'>
                        <h3 className='font-bold text-gray-800 text-lg p-4 border-b border-gray-100 flex-shrink-0'>
                            Comments ({commentsCount})
                        </h3>
                        
                        <div 
                            className='flex-1 p-4 space-y-4 overflow-y-auto'
                            onContextMenu={(e) => e.preventDefault()}
                        >
                            {isFetchingComments ? (
                                <div className='flex justify-center py-6'>
                                    <Loader2 className='w-6 h-6 animate-spin text-blue-500' />
                                </div>
                            ) : comments.length > 0 ? (
                                comments.map((comment) => (
                                    <div 
                                        key={comment?._id} 
                                        className='flex gap-3 group relative p-3 -mx-3 rounded-lg hover:bg-gray-50 transition'
                                        onContextMenu={(e) => e.preventDefault()}
                                    >
                                        <img
                                            src={comment?.user?.profile_picture || '/default-avatar.png'}
                                            alt={comment?.user?.full_name || 'User'}
                                            className='w-8 h-8 rounded-full cursor-pointer flex-shrink-0 object-cover'
                                            onClick={() => {
                                                if (comment?.user?._id) {
                                                    navigate('/profile/' + comment.user._id);
                                                }
                                            }}
                                            style={protectiveStyles}
                                            onContextMenu={(e) => e.preventDefault()}
                                            draggable={false}
                                        />
                                        
                                        <div className='flex-1'>
                                            <div className='flex items-center gap-2 mb-1'>
                                                <span className='font-semibold text-sm text-gray-800'>{comment?.user?.full_name || 'Unknown User'}</span>
                                                <span className='text-gray-500 text-xs'>@{comment?.user?.username || 'unknown'}</span>
                                                <span className='text-gray-400 text-xs ml-auto'>• {moment(comment?.createdAt).fromNow()}</span>
                                            </div>
                                            
                                            {editingComment === comment?._id ? (
                                                <div className='space-y-2 pt-1'>
                                                    <input
                                                        type="text"
                                                        value={editCommentText}
                                                        onChange={(e) => setEditCommentText(e.target.value)}
                                                        className='w-full border border-indigo-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400'
                                                        autoFocus
                                                        onKeyPress={(e) => e.key === 'Enter' && handleUpdateComment(comment?._id)}
                                                    />
                                                    <div className='flex gap-2 justify-end'>
                                                        <button onClick={cancelEdit} className='bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-xs font-medium hover:bg-gray-300 transition'>Cancel</button>
                                                        <button onClick={() => handleUpdateComment(comment?._id)} className='bg-indigo-500 text-white px-3 py-1 rounded-full text-xs font-medium hover:bg-indigo-600 transition'>Save</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p 
                                                    className='text-gray-800 text-sm break-words'
                                                    style={protectiveStyles}
                                                    onContextMenu={(e) => e.preventDefault()}
                                                >
                                                    {comment?.content}
                                                </p>
                                            )}
                                        </div>
                                        
                                        {isCurrentUserComment(comment) && (
                                            <div className='absolute right-2 top-3'>
                                                <MoreVertical
                                                    className='w-4 h-4 cursor-pointer text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition'
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        setShowMenu(showMenu === comment?._id ? null : comment?._id); 
                                                    }}
                                                />
                                                
                                                {showMenu === comment?._id && (
                                                    <div className='absolute right-0 top-6 bg-white shadow-xl rounded-lg border border-gray-100 z-20 min-w-32 divide-y divide-gray-100'>
                                                        <button onClick={() => handleEditComment(comment)} className='flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 rounded-t-lg transition'>
                                                            <Edit className='w-3 h-3' /> Edit
                                                        </button>
                                                        <button onClick={() => {
                                                            setCommentToDelete(comment?._id);
                                                            setShowDeleteConfirm(true);
                                                        }} className='flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-b-lg transition'>
                                                            <Trash2 className='w-3 h-3' /> Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className='text-center py-6 bg-gray-50 rounded-xl'>
                                    <p className='text-gray-500 text-sm'>No comments yet. Be the first to comment! 🚀</p>
                                </div>
                            )}
                        </div>

                        <div className='p-4 border-t border-gray-100 flex-shrink-0 bg-white sticky bottom-0'>
                            <div className='flex items-center gap-2'>
                                <img
                                    src={currentUser?.profile_picture || '/default-avatar.png'}
                                    alt="Your Profile"
                                    className='w-8 h-8 rounded-full flex-shrink-0'
                                    style={protectiveStyles}
                                    onContextMenu={(e) => e.preventDefault()}
                                    draggable={false}
                                />
                                <input
                                    type="text"
                                    placeholder='Add a comment...'
                                    className='flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-shadow'
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    onKeyPress={handleCommentKeyPress}
                                />
                                <button
                                    onClick={handleAddComment}
                                    disabled={isCommenting || !commentText.trim()}
                                    className='bg-blue-500 text-white p-2 rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition'
                                    title="Post Comment"
                                >
                                    {isCommenting ? <Loader2 className='w-4 h-4 animate-spin' /> : <Send className='w-4 h-4' />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            <ConfirmationModal
                isOpen={showDeleteConfirm}
                onClose={() => {
                    setShowDeleteConfirm(false);
                    setCommentToDelete(null);
                }}
                onConfirm={() => handleDeleteComment(commentToDelete)}
                title="Delete Comment"
                message="Are you sure you want to delete this comment? This action cannot be undone."
                confirmText="Delete Comment"
                type="delete"
            />
        </>
    );
});

// ----------------------------------------------------------------------
// --- Main PostCard Component ---
// ----------------------------------------------------------------------

const PostCard = React.memo(({ post, onEdit, onDelete }) => {
    // Comprehensive null checking
    if (!post) {
        console.warn('PostCard received null or undefined post');
        return (
            <div className='bg-white rounded-xl shadow-lg p-5 w-full max-w-2xl border border-gray-100'>
                <div className='text-gray-500 text-center py-4'>
                    Post not available
                </div>
            </div>
        );
    }

    if (!post.user) {
        console.warn('PostCard post missing user data:', post);
        return (
            <div className='bg-white rounded-xl shadow-lg p-5 w-full max-w-2xl border border-gray-100'>
                <div className='text-gray-500 text-center py-4'>
                    Invalid post data
                </div>
            </div>
        );
    }

    // Memoized values for performance
    const postWithHashtags = useMemo(() => 
        post?.content ? 
            post.content.replace(/(#\w+)/g, '<span class="text-indigo-600 font-medium hover:underline cursor-pointer">$1</span>') 
            : ''
    , [post?.content]);

    const mediaData = useMemo(() => {
        if (post?.media_urls && Array.isArray(post.media_urls) && post.media_urls.length > 0) {
            return post.media_urls;
        }
        else if (post?.image_urls && Array.isArray(post.image_urls) && post.image_urls.length > 0) {
            return post.image_urls.map(url => ({
                url: url,
                type: 'image',
                filePath: ''
            }));
        }
        return [];
    }, [post?.media_urls, post?.image_urls]);

    const [likes, setLikes] = useState(Array.isArray(post?.likes_count) ? post.likes_count : [])
    const [commentsCount, setCommentsCount] = useState(post?.comments_count || 0)
    const [sharesCount, setSharesCount] = useState(post?.shares_count || 0)
    const [showCommentBox, setShowCommentBox] = useState(false)
    const [showComments, setShowComments] = useState(false)
    const [comments, setComments] = useState([])
    const [commentText, setCommentText] = useState('')
    const [isCommenting, setIsCommenting] = useState(false)
    const [editingComment, setEditingComment] = useState(null)
    const [editCommentText, setEditCommentText] = useState('')
    const [showMenu, setShowMenu] = useState(null) 
    const [isFetchingComments, setIsFetchingComments] = useState(false)
    const [showPostMenu, setShowPostMenu] = useState(false) 
    const [showPostModal, setShowPostModal] = useState(false) 
    const [playingVideo, setPlayingVideo] = useState(null)
    const [mutedVideos, setMutedVideos] = useState({})
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    const currentUser = useSelector((state) => state.user.value)
    const { getToken } = useAuth()
    const navigate = useNavigate()
    const postCardRef = useRef(null)
    const videoRefs = useRef({})
    const observerRef = useRef(null)
    const commentsFetched = useRef(false)

    const isPostOwner = post?.user?._id === currentUser?._id;

    const protectiveStyles = {
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
        WebkitUserDrag: 'none',
        KhtmlUserDrag: 'none',
        MozUserDrag: 'none',
        OUserDrag: 'none',
        userDrag: 'none',
        WebkitTouchCallout: 'none',
        WebkitTapHighlightColor: 'transparent',
    };

    // Video control functions
    const handleVideoPlay = useCallback((index) => {
        setPlayingVideo(index);
        // Pause all other videos
        Object.keys(videoRefs.current).forEach(key => {
            if (key !== index.toString() && videoRefs.current[key]) {
                videoRefs.current[key].pause();
            }
        });
    }, []);

    const handleVideoPause = useCallback((index) => {
        if (playingVideo === index) {
            setPlayingVideo(null);
        }
    }, [playingVideo]);

    const handleVideoClick = useCallback((index, e) => {
        e.stopPropagation();
        const video = videoRefs.current[index];
        if (video) {
            if (video.paused) {
                video.play().catch(console.error);
            } else {
                video.pause();
            }
        }
    }, []);

    const toggleMute = useCallback((index, e) => {
        e.stopPropagation();
        setMutedVideos(prev => ({
            ...prev,
            [index]: !prev[index]
        }));
    }, []);

    // Auto-play/pause videos based on visibility
    useEffect(() => {
        if (!postCardRef.current || mediaData.filter(m => m.type === 'video').length === 0) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        // Auto-play the first video when post comes into view
                        const firstVideoIndex = mediaData.findIndex(m => m.type === 'video');
                        if (firstVideoIndex !== -1) {
                            const video = videoRefs.current[firstVideoIndex];
                            if (video && video.paused && playingVideo === null) {
                                video.play().catch(console.error);
                            }
                        }
                    } else {
                        // Pause all videos when post goes out of view
                        Object.values(videoRefs.current).forEach(video => {
                            if (video && !video.paused) {
                                video.pause();
                            }
                        });
                        setPlayingVideo(null);
                    }
                });
            },
            {
                root: null,
                rootMargin: '0px',
                threshold: 0.7
            }
        );

        observer.observe(postCardRef.current);
        observerRef.current = observer;

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [mediaData, playingVideo]);

    // Clean up videos when component unmounts
    useEffect(() => {
        return () => {
            Object.values(videoRefs.current).forEach(video => {
                if (video) {
                    video.pause();
                    video.src = '';
                    video.load();
                }
            });
        };
    }, []);

    // Add protection to post card
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (
                (e.key === 'PrintScreen' || e.keyCode === 44) &&
                postCardRef.current?.contains(document.activeElement)
            ) {
                e.preventDefault();
                toast.error('🔒 Screenshots are disabled for privacy', {
                    duration: 3000
                });
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    useEffect(() => {
        setCommentsCount(post?.comments_count || 0)
    }, [post?.comments_count])

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showPostMenu && !event.target.closest('.post-menu-button') && !event.target.closest('.post-menu-dropdown')) {
                setShowPostMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showPostMenu]);

    // API functions with null safety
    const fetchSharesCount = async () => { 
        if (!post?._id) return;
        
        try {
            const token = await getToken();
            const { data } = await api.get(`/api/post/shares/count/${post._id}`, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 5000
            })
            if (data.success) {
                setSharesCount(data.count || 0)
            }
        } catch (error) {
            console.log('Error fetching shares count:', error)
        }
    }

    const fetchComments = async () => { 
        if (!post?._id || commentsFetched.current) {
            return;
        }

        setIsFetchingComments(true)
        try {
            const token = await getToken();
            const { data } = await api.get(`/api/post/comments/${post._id}`, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 10000
            });

            if (data.success) {
                setComments(data.comments || [])
                setCommentsCount(data.comments?.length || 0)
                commentsFetched.current = true;
            }
        } catch (error) {
            console.error('Error fetching comments:', error)
            if (error.code !== 'ECONNABORTED') {
                toast.error('Failed to load comments.')
            }
        } finally {
            setIsFetchingComments(false)
        }
    }

    const handleLike = async () => { 
        if (!post?._id) return;

        try {
            const token = await getToken();
            const { data } = await api.post(`/api/post/like`, 
                { postId: post._id }, 
                { 
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 5000
                }
            )
            if (data.success){
               toast.success(data.message)
               setLikes(prev =>{
                if(prev?.includes(currentUser?._id)){
                    return prev.filter(id=> id !== currentUser?._id)
                }else{
                    return [...(prev || []), currentUser?._id]
                }
               })
            }else{
                toast(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        }
    }

    const handleCommentClick = () => {
        setShowCommentBox(!showCommentBox)
    }

    const handleShowComments = async () => {
        if (!showComments) {
            await fetchComments()
        }
        setShowComments(!showComments)
    }

    const handleAddComment = async () => { 
        if (!commentText.trim() || !post?._id) return

        setIsCommenting(true)
        try {
            const token = await getToken();
            const { data } = await api.post(`/api/post/comment`, 
                { postId: post._id, content: commentText }, 
                { 
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 10000
                }
            )
            if (data.success) {
                toast.success('Comment added!')
                setCommentsCount(prev => prev + 1)
                setCommentText('')
                setShowCommentBox(false)
                commentsFetched.current = false;
                await fetchComments()
            } else {
                toast.error(data.message || 'Failed to add comment')
            }
        } catch (error) {
            toast.error(error.message || 'Failed to add comment')
        } finally {
            setIsCommenting(false)
        }
    }
    
    const handleEditComment = (comment) => { 
        if (!comment?._id) return;
        setEditingComment(comment._id)
        setEditCommentText(comment?.content || '')
        setShowMenu(null)
    }

    const handleUpdateComment = async (commentId) => {
        if (!editCommentText.trim() || !commentId) return

        try {
            const token = await getToken();
            await api.put(`/api/post/comment/${commentId}`, 
                { content: editCommentText }, 
                { 
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 10000
                }
            )
            toast.success('Comment updated!')
            setEditingComment(null)
            setEditCommentText('')
            commentsFetched.current = false;
            await fetchComments()
        } catch (error) {
            toast.error('Failed to update comment.')
        }
    }

    const handleDeleteComment = async (commentId) => { 
        if (!commentId) return;

        try {
            const token = await getToken();
            await api.delete(`/api/post/comment/${commentId}`, 
                { 
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 10000
                }
            )
            toast.success('Comment deleted!')
            setCommentsCount(prev => Math.max(0, prev - 1))
            setShowMenu(null)
            commentsFetched.current = false;
            await fetchComments()
        } catch (error) {
            toast.error('Failed to delete comment.')
        }
    }

    const cancelEdit = () => {
        setEditingComment(null)
        setEditCommentText('')
    }

    const handleShare = async () => { 
        if (!post?._id) return;

        try {
            const token = await getToken();
            const { data } = await api.post(`/api/post/share`, 
                { postId: post._id }, 
                { 
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 5000
                }
            )
            if (data.success) {
                toast.success('Post shared successfully!')
                setSharesCount(prev => prev + 1)
                const postUrl = `${window.location.origin}/post/${post._id}`
                navigator.clipboard.writeText(postUrl)
                toast('Post link copied to clipboard!')
            } else {
                toast.error(data.message || 'Failed to share post')
            }
        } catch (error) {
            toast.error(error.message || 'Failed to share post')
        }
    }

    const isCurrentUserComment = (comment) => {
        return comment?.user?._id === currentUser?._id
    }
    
    // Edit Post Functionality
    const handleEditPost = () => {
        setShowPostMenu(false);
        if (onEdit) {
            onEdit(post);
        } else {
            toast.success('Edit post functionality - Replace media option would open here');
        }
    }

    // Delete Post Functionality
    const handleDeletePost = async () => {
        setShowPostMenu(false);
        setShowDeleteConfirm(true);
    }

    const confirmDeletePost = async () => {
        if (!post?._id) {
            toast.error('Cannot delete post: post ID is missing');
            return;
        }

        setIsDeleting(true);
        try {
            const token = await getToken();
            const { data } = await api.delete(`/api/post/${post._id}`, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 10000
            });

            if (data.success) {
                toast.success('Post deleted successfully!');
                if (onDelete) {
                    onDelete(post._id);
                }
            } else {
                throw new Error(data.message || 'Failed to delete post');
            }
        } catch (error) {
            console.error('Error deleting post:', error);
            toast.error(error.message || 'Failed to delete post');
        } finally {
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    // Calculate grid layout
    const getGridClass = () => {
        if (mediaData.length === 1) return 'grid-cols-1';
        if (mediaData.length === 2) return 'grid-cols-2';
        if (mediaData.length === 3) return 'grid-cols-2 grid-rows-2';
        return 'grid-cols-2 grid-rows-2';
    };

    // Get media container height
    const getMediaHeight = (index) => {
        if (mediaData.length === 1) return 'h-96 sm:h-[500px]';
        if (mediaData.length === 2) return 'h-48 sm:h-64';
        return 'h-40 sm:h-48';
    };

    const handleCommentKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleAddComment();
        }
    };

    return (
        <>
            <div 
                ref={postCardRef}
                className='bg-white rounded-xl shadow-lg p-5 space-y-4 w-full max-w-2xl border border-gray-100 relative transition-all duration-300 overflow-hidden'
                onContextMenu={(e) => e.preventDefault()}
                style={{ WebkitUserSelect: 'none' }}>

                {/* Post Modal */}
                {showPostModal && post && (
                    <PostModal 
                        post={post} 
                        isPostOwner={isPostOwner}
                        handleEditPost={handleEditPost}
                        handleDeletePost={confirmDeletePost}
                        onClose={() => setShowPostModal(false)}
                        currentUser={currentUser}
                        getToken={getToken}
                        navigate={navigate}
                    />
                )}

                {/* Delete Confirmation Modal */}
                <ConfirmationModal
                    isOpen={showDeleteConfirm}
                    onClose={() => setShowDeleteConfirm(false)}
                    onConfirm={confirmDeletePost}
                    title="Delete Post"
                    message="Are you sure you want to delete this post? This action cannot be undone and all associated comments will be lost."
                    confirmText={isDeleting ? "Deleting..." : "Delete Post"}
                    cancelText="Cancel"
                    type="delete"
                />

                {/* User Info Header */}
                <div className='flex items-center justify-between'>
                    <div 
                        onClick={() => {
                            if (post?.user?._id) {
                                navigate('/profile/' + post.user._id);
                            }
                        }} 
                        className='inline-flex items-center gap-3 cursor-pointer'
                        onContextMenu={(e) => e.preventDefault()}
                    >
                        <img
                            src={post?.user?.profile_picture || '/default-avatar.png'}
                            alt={post?.user?.full_name || 'User'}
                            className='w-12 h-12 rounded-full object-cover shadow-md ring-2 ring-indigo-50'
                            style={protectiveStyles}
                            onContextMenu={(e) => e.preventDefault()}
                            draggable={false}
                        />
                        <div>
                            <div className='flex items-center space-x-1'>
                                <span className="font-semibold text-gray-800">{post?.user?.full_name || 'Unknown User'}</span>
                                <BadgeCheck className='w-4 h-4 text-blue-500' title="Verified"/>
                            </div>
                            <div className='text-gray-500 text-sm'>
                                @{post?.user?.username || 'unknown'}
                                <span className="mx-1">•</span>
                                <span className="text-xs">{moment(post?.createdAt).fromNow()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Post Menu */}
                    {isPostOwner && (
                        <div className='relative'>
                            <button
                                className='post-menu-button p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition'
                                onClick={() => setShowPostMenu(!showPostMenu)}
                                title="More options"
                            >
                                <MoreVertical className='w-5 h-5' />
                            </button>

                            {showPostMenu && (
                                <div className='post-menu-dropdown absolute right-0 top-8 bg-white shadow-xl rounded-lg border border-gray-100 z-10 min-w-36 divide-y divide-gray-100'>
                                    <button
                                        onClick={handleEditPost}
                                        className='flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 rounded-t-lg transition'
                                    >
                                        <Edit className='w-4 h-4' /> Edit Post
                                    </button>
                                    <button
                                        onClick={handleDeletePost}
                                        className='flex items-center gap-2 w-full px-4 py-2 text-sm text-red-500 hover:bg-red-50 rounded-b-lg transition'
                                    >
                                        <Trash2 className='w-4 h-4' /> Delete Post
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                {/* Content */}
                {post?.content && (
                    <div
                        className='text-gray-800 text-base leading-relaxed whitespace-pre-line cursor-pointer hover:bg-gray-50 p-2 -m-2 rounded-lg transition'
                        dangerouslySetInnerHTML={{__html: postWithHashtags}}
                        onClick={() => setShowPostModal(true)}
                        style={protectiveStyles}
                        onContextMenu={(e) => e.preventDefault()}
                    />
                )}

                {/* Media - Auto Play/Pause */}
                {mediaData.length > 0 && (
                    <div 
                        className={`grid gap-2 cursor-pointer ${getGridClass()} overflow-hidden rounded-lg`}
                        onClick={() => setShowPostModal(true)}
                        onContextMenu={(e) => e.preventDefault()}
                    >
                        {mediaData.slice(0, 4).map((media, index) => (
                            <div 
                                key={index} 
                                className={`relative overflow-hidden rounded-lg ${getMediaHeight(index)}`}
                            >
                                {media.type === 'image' ? (
                                    <img
                                        src={media.url}
                                        className='w-full h-full object-cover transition-transform duration-300 hover:scale-105'
                                        alt={`Post image ${index + 1}`}
                                        style={protectiveStyles}
                                        onContextMenu={(e) => e.preventDefault()}
                                        draggable={false}
                                    />
                                ) : (
                                    <div className="relative w-full h-full overflow-hidden rounded-lg bg-black">
                                        <video
                                            ref={el => {
                                                videoRefs.current[index] = el;
                                            }}
                                            className="w-full h-full object-cover"
                                            style={protectiveStyles}
                                            onContextMenu={(e) => e.preventDefault()}
                                            onPlay={() => handleVideoPlay(index)}
                                            onPause={() => handleVideoPause(index)}
                                            playsInline
                                            preload="metadata"
                                            muted={mutedVideos[index] || false}
                                        >
                                            <source src={media.url} type="video/mp4" />
                                            Your browser does not support the video tag.
                                        </video>
                                        
                                        {/* Play/Pause Overlay */}
                                        {playingVideo !== index && (
                                            <div 
                                                className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity duration-300 cursor-pointer"
                                                onClick={(e) => handleVideoClick(index, e)}
                                            >
                                                <div className="bg-black/60 rounded-full p-3 sm:p-4 hover:bg-black/80 transition">
                                                    <Play className="w-6 h-6 sm:w-8 sm:h-8 text-white fill-white" />
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Video Badge */}
                                        <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                                            VIDEO
                                        </div>

                                        {/* Mute/Unmute Button */}
                                        <button
                                            onClick={(e) => toggleMute(index, e)}
                                            className="absolute top-2 left-2 bg-black/70 text-white p-1.5 rounded hover:bg-black/90 transition"
                                        >
                                            {mutedVideos[index] ? (
                                                <VolumeX className="w-3 h-3 sm:w-4 sm:h-4" />
                                            ) : (
                                                <Volume2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                        {mediaData.length > 4 && (
                            <div className='w-full h-40 sm:h-48 bg-gray-200 rounded-lg flex items-center justify-center text-lg font-bold text-gray-600'>
                                +{mediaData.length - 4} more
                            </div>
                        )}
                    </div>
                )}

                {/* Actions Bar */}
                <div className='flex items-center justify-between text-gray-600 text-sm pt-3 border-t border-gray-100'>
                    <div className='flex items-center gap-3'>
                        <button onClick={handleLike} className='flex items-center gap-1.5 p-2 rounded-full transition-colors hover:bg-red-50 hover:text-red-500' title="Like">
                            <Heart className={`w-5 h-5 ${likes?.includes(currentUser?._id) ? 'text-red-500 fill-red-500' : 'text-gray-500'}`} />
                            <span className='font-medium text-sm'>{likes?.length || 0}</span>
                        </button>
                        
                        <button onClick={handleCommentClick} className='flex items-center gap-1.5 p-2 rounded-full transition-colors hover:bg-blue-50 hover:text-blue-500' title="Comment">
                            <MessageCircle className="w-5 h-5 text-gray-500"/>
                            <span className='font-medium text-sm'>{commentsCount}</span>
                        </button>
                        
                        <button onClick={handleShare} className='flex items-center gap-1.5 p-2 rounded-full transition-colors hover:bg-green-50 hover:text-green-500' title="Share">
                            <Share2 className="w-5 h-5 text-gray-500"/>
                            <span className='font-medium text-sm'>{sharesCount}</span>
                        </button>
                        
                        <button onClick={() => setShowPostModal(true)} className='flex items-center gap-1.5 p-2 rounded-full transition-colors hover:bg-indigo-50 hover:text-indigo-500' title="View Full Post & Comments">
                            <Link className="w-5 h-5 text-gray-500"/>
                        </button>
                    </div>
                    
                    {commentsCount > 0 && !showComments && (
                        <button onClick={handleShowComments} className='text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition p-2'>
                            {`View all ${commentsCount} comments`}
                        </button>
                    )}
                </div>

                {/* Comment Box */}
                {showCommentBox && (
                    <div className='flex items-center gap-2 border-t border-gray-100 pt-3'>
                        <img 
                            src={currentUser?.profile_picture || '/default-avatar.png'} 
                            alt="Your Profile" 
                            className='w-8 h-8 rounded-full flex-shrink-0'
                            style={protectiveStyles}
                            onContextMenu={(e) => e.preventDefault()}
                            draggable={false}
                        />
                        <input 
                            type="text" 
                            placeholder='Add a comment...' 
                            className='flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-shadow' 
                            value={commentText} 
                            onChange={(e) => setCommentText(e.target.value)} 
                            onKeyPress={handleCommentKeyPress}
                        />
                        <button onClick={handleAddComment} disabled={isCommenting || !commentText.trim()} className='bg-blue-500 text-white p-2 rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition' title="Post Comment">
                            {isCommenting ? <Loader2 className='w-4 h-4 animate-spin' /> : <Send className='w-4 h-4' />}
                        </button>
                    </div>
                )}

                {/* Comments List */}
                {showComments && (
                    <div className='border-t border-gray-100 pt-4 space-y-4'>
                        <div className='flex items-center justify-between'>
                            <h3 className='font-bold text-gray-800 text-lg'>Comments</h3>
                            <X className='w-5 h-5 cursor-pointer text-gray-500 hover:text-gray-800 transition' onClick={() => setShowComments(false)} title="Hide Comments"/>
                        </div>
                        
                        {isFetchingComments ? (
                            <div className='flex justify-center py-6'>
                                <Loader2 className='w-6 h-6 animate-spin text-blue-500' />
                            </div>
                        ) : comments.length > 0 ? (
                            <div className='space-y-4 max-h-72 overflow-y-auto pr-2 custom-scrollbar'>
                                {comments.map((comment) => (
                                    <div 
                                        key={comment?._id} 
                                        className='flex gap-3 group relative'
                                        onContextMenu={(e) => e.preventDefault()}
                                    >
                                        <img 
                                            src={comment?.user?.profile_picture || '/default-avatar.png'} 
                                            alt={comment?.user?.full_name || 'User'} 
                                            className='w-8 h-8 rounded-full cursor-pointer flex-shrink-0 object-cover'
                                            onClick={() => {
                                                if (comment?.user?._id) {
                                                    navigate('/profile/' + comment.user._id);
                                                }
                                            }}
                                            style={protectiveStyles}
                                            onContextMenu={(e) => e.preventDefault()}
                                            draggable={false}
                                        />
                                        <div className='flex-1 bg-gray-50 rounded-xl p-3 pb-2 relative'>
                                            <div className='flex items-center gap-2 mb-1'>
                                                <span className='font-bold text-sm text-gray-800'>{comment?.user?.full_name || 'Unknown User'}</span>
                                                <span className='text-gray-500 text-xs'>@{comment?.user?.username || 'unknown'}</span>
                                                <span className='text-gray-400 text-xs ml-auto'>• {moment(comment?.createdAt).fromNow()}</span>
                                            </div>
                                            {editingComment === comment?._id ? (
                                                <div className='space-y-2 pt-1'>
                                                    <input type="text" value={editCommentText} onChange={(e) => setEditCommentText(e.target.value)} className='w-full border border-indigo-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400' autoFocus onKeyPress={(e) => e.key === 'Enter' && handleUpdateComment(comment?._id)}/>
                                                    <div className='flex gap-2 justify-end'>
                                                        <button onClick={cancelEdit} className='bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-xs font-medium hover:bg-gray-300 transition'>Cancel</button>
                                                        <button onClick={() => handleUpdateComment(comment?._id)} className='bg-indigo-500 text-white px-3 py-1 rounded-full text-xs font-medium hover:bg-indigo-600 transition'>Save</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p 
                                                    className='text-gray-800 text-sm break-words'
                                                    style={protectiveStyles}
                                                    onContextMenu={(e) => e.preventDefault()}
                                                >
                                                    {comment?.content}
                                                </p>
                                            )}
                                        </div>
                                        {isCurrentUserComment(comment) && (
                                            <div className='absolute right-2 top-3'>
                                                <MoreVertical className='w-4 h-4 cursor-pointer text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition' onClick={(e) => { e.stopPropagation(); setShowMenu(showMenu === comment?._id ? null : comment?._id); }}/>
                                                {showMenu === comment?._id && (
                                                    <div className='absolute right-0 top-6 bg-white shadow-xl rounded-lg border border-gray-100 z-10 min-w-32 divide-y divide-gray-100'>
                                                        <button onClick={() => handleEditComment(comment)} className='flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 rounded-t-lg transition'><Edit className='w-3 h-3' />Edit</button>
                                                        <button onClick={() => handleDeleteComment(comment?._id)} className='flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-b-lg transition'><Trash2 className='w-3 h-3' />Delete</button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className='text-center py-4 bg-gray-50 rounded-lg'>
                                <p className='text-gray-500 text-sm'>No comments yet. Be the first to comment! 🚀</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    )
})

export default PostCard;