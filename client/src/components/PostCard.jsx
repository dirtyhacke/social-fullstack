import React, { useState, useEffect, useRef } from 'react'
import { BadgeCheck, Heart, MessageCircle, Share2, Send, X, Edit, Trash2, MoreVertical, Loader2, Link, Shield } from 'lucide-react'
import moment from 'moment'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useAuth } from '@clerk/clerk-react'
import api from '../api/axios'
import toast from 'react-hot-toast'

// ----------------------------------------------------------------------
// --- Post Modal Component (Enhanced with Protection) ---
// ----------------------------------------------------------------------

const PostModal = ({ 
    post, 
    postWithHashtags, 
    isPostOwner, 
    handleEditPost, 
    handleDeletePost, 
    onClose,
    currentUser,
    getToken,
    navigate
}) => {

    const [comments, setComments] = useState([]);
    const [commentsCount, setCommentsCount] = useState(post?.comments_count || 0);
    const [isFetchingComments, setIsFetchingComments] = useState(true);
    const [commentText, setCommentText] = useState('');
    const [isCommenting, setIsCommenting] = useState(false);
    const [editingComment, setEditingComment] = useState(null);
    const [editCommentText, setEditCommentText] = useState('');
    const [showMenu, setShowMenu] = useState(null);
    const [showPostOptionsMenu, setShowPostOptionsMenu] = useState(false);

    const modalRef = useRef(null);
    const imageRefs = useRef([]);

    // Enhanced protection functions
    const preventDefaultActions = (e) => {
        e.preventDefault();
        return false;
    };

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

    // Anti-screenshot protection
    useEffect(() => {
        if (modalRef.current) {
            // Add protective overlay
            const addProtectiveOverlay = () => {
                const overlay = document.createElement('div');
                overlay.id = 'post-modal-protection';
                overlay.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: repeating-linear-gradient(
                        45deg,
                        transparent,
                        transparent 5px,
                        rgba(255,255,255,0.01) 5px,
                        rgba(255,255,255,0.01) 10px
                    );
                    pointer-events: none;
                    z-index: 10001;
                    opacity: 0;
                `;
                document.body.appendChild(overlay);
            };

            // Block keyboard shortcuts
            const handleKeyDown = (e) => {
                if (
                    e.key === 'PrintScreen' ||
                    e.keyCode === 44 ||
                    (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) ||
                    e.key === 'F12' ||
                    (e.ctrlKey && e.key === 'p')
                ) {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                }
            };

            addProtectiveOverlay();
            document.addEventListener('keydown', handleKeyDown);

            return () => {
                document.removeEventListener('keydown', handleKeyDown);
                const overlay = document.getElementById('post-modal-protection');
                if (overlay) {
                    document.body.removeChild(overlay);
                }
            };
        }
    }, []);

    // Protection Overlay Component
    const ProtectionOverlay = () => (
        <div 
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.02) 3px, rgba(255,255,255,0.02) 6px)',
                pointerEvents: 'none',
                zIndex: 1,
                opacity: 0.2
            }}
            onContextMenu={preventDefaultActions}
        />
    );

    const fetchComments = async () => {
        setIsFetchingComments(true)
        try {
            const token = await getToken();
            const response = await api.get(`/api/post/comments/${post?._id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const { data } = response;
            
            if (data.success) {
                setComments(data.comments)
                setCommentsCount(data.comments.length)
            }  
        } catch (error) {
            console.error('Error fetching comments:', error)
            toast.error('Failed to load comments.')
        } finally {
            setIsFetchingComments(false)
        }
    }

    const handleAddComment = async () => {
        if (!commentText.trim()) return

        setIsCommenting(true)
        try {
            const token = await getToken();
            const { data } = await api.post(`/api/post/comment`,  
                { postId: post?._id, content: commentText },  
                { headers: { Authorization: `Bearer ${token}` }}
            )

            if (data.success) {
                toast.success('Comment added!')
                setCommentsCount(prev => prev + 1)
                setCommentText('')
                await fetchComments()
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        } finally {
            setIsCommenting(false)
        }
    }

    const isCurrentUserComment = (comment) => {
        return comment?.user?._id === currentUser?._id
    }

    const handleEditComment = (comment) => {
        setEditingComment(comment?._id)
        setEditCommentText(comment?.content)
        setShowMenu(null)
    }

    const handleUpdateComment = async (commentId) => {
        if (!editCommentText.trim()) return

        try {
            const token = await getToken();
            await api.put(`/api/post/comment/${commentId}`, { content: editCommentText }, { headers: { Authorization: `Bearer ${token}` } })
            toast.success('Comment updated!')
            setEditingComment(null)
            setEditCommentText('')
            await fetchComments() 
        } catch (error) {
            toast.error('Failed to update comment.')
        }
    }

    const handleDeleteComment = async (commentId) => {
        if (!window.confirm('Are you sure you want to delete this comment?')) return;
        try {
            const token = await getToken();
            await api.delete(`/api/post/comment/${commentId}`, { headers: { Authorization: `Bearer ${token}` } })
            toast.success('Comment deleted!')
            setCommentsCount(prev => Math.max(0, prev - 1))
            setShowMenu(null)
            await fetchComments()
        } catch (error) {
            toast.error('Failed to delete comment.')
        }
    }

    const cancelEdit = () => {
        setEditingComment(null)
        setEditCommentText('')
    }
    
    useEffect(() => {
        if (post?._id) {
            fetchComments();
        }
    }, [post?._id]);

    const handleAction = (action) => {
        setShowPostOptionsMenu(false);
        onClose();
        if (action === 'edit') {
            handleEditPost();
        } else if (action === 'delete') {
            handleDeletePost();
        }
    }

    if (!post) return null;

    return (
        <div 
            ref={modalRef}
            className='fixed inset-0 bg-black bg-opacity-90 backdrop-blur-md flex items-start lg:items-center justify-center z-50 p-0 sm:p-4'
            onClick={onClose}
            onContextMenu={preventDefaultActions}
            style={{ WebkitUserSelect: 'none' }}
        >
           

            <ProtectionOverlay />
            
            <div 
                className='bg-white rounded-none sm:rounded-xl shadow-2xl w-full max-w-4xl h-full max-h-full sm:max-h-[90vh] flex flex-col lg:flex-row overflow-hidden relative'
                onClick={(e) => e.stopPropagation()} 
            >
                
                {/* 1. Post Content & Images */}
                <div className='w-full lg:w-3/5 flex flex-col overflow-y-auto custom-scrollbar-lg border-b lg:border-r lg:border-b-0 border-gray-100'> 

                    {/* Sticky Header */}
                    <div className='sticky top-0 bg-white z-20 p-4 border-b border-gray-100 flex items-center justify-between'>
                        {/* Protected User Info */}
                        <div 
                            className='flex items-center gap-3 cursor-pointer' 
                            onClick={()=> navigate('/profile/' + (post?.user?._id || ''))}
                            onContextMenu={preventDefaultActions}
                        >
                            <img
                                src={post?.user?.profile_picture || '/default-avatar.png'}
                                alt={post?.user?.full_name || 'User'}
                                className='w-10 h-10 rounded-full object-cover shadow-sm'
                                style={protectiveStyles}
                                onContextMenu={preventDefaultActions}
                                onDragStart={preventDefaultActions}
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

                        {/* Actions */}
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
                                    <button onClick={() => handleAction('edit')} className='flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 rounded-t-lg transition'>
                                        <Edit className='w-4 h-4' /> Edit Post
                                    </button>
                                    <button onClick={() => handleAction('delete')} className='flex items-center gap-2 w-full px-4 py-2 text-sm text-red-500 hover:bg-red-50 rounded-b-lg transition'>
                                        <Trash2 className='w-4 h-4' /> Delete Post
                                    </button>
                                </div>
                            )}

                            <button onClick={onClose} className='p-1 rounded-full text-gray-500 hover:text-red-500 hover:bg-red-50 transition' title="Close">
                                <X className='w-6 h-6' />
                            </button>
                        </div>
                    </div>
                    
                    {/* Protected Post Content */}
                    <div className='p-4 sm:p-6 space-y-4' onContextMenu={preventDefaultActions}>
                        
                        <div className='text-gray-400 text-xs'>
                            {moment(post?.createdAt).format('MMM D, YYYY HH:mm')}
                        </div>

                        {post?.content && (
                            <div
                                className='text-gray-800 text-lg leading-relaxed whitespace-pre-line'
                                dangerouslySetInnerHTML={{ __html: postWithHashtags }}
                                style={protectiveStyles}
                                onContextMenu={preventDefaultActions}
                            />
                        )}

                        {/* Protected Images */}
                        {post?.image_urls && post.image_urls.length > 0 && (
                            <div 
                                className={`grid gap-3 ${post.image_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}
                                onContextMenu={preventDefaultActions}
                            >
                                {post.image_urls.map((img, index) => (
                                    <div key={index} className="relative">
                                        <ProtectionOverlay />
                                        <img
                                            src={img}
                                            ref={el => imageRefs.current[index] = el}
                                            className='w-full rounded-lg shadow-md object-contain border border-gray-100 relative z-0'
                                            alt={`Post image ${index + 1}`}
                                            style={protectiveStyles}
                                            onContextMenu={preventDefaultActions}
                                            onDragStart={preventDefaultActions}
                                            draggable={false}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Comments Section */}
                <div className='w-full lg:w-2/5 flex flex-col flex-shrink-0'>
                    
                    <h3 className='font-bold text-gray-800 text-lg p-4 border-b border-gray-100 flex-shrink-0'>
                        Comments ({commentsCount})
                    </h3>
                    
                    {/* Protected Comments List */}
                    <div 
                        className='flex-1 p-4 space-y-4 overflow-y-auto custom-scrollbar'
                        onContextMenu={preventDefaultActions}
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
                                    onContextMenu={preventDefaultActions}
                                >
                                    <img
                                        src={comment?.user?.profile_picture || '/default-avatar.png'}
                                        alt={comment?.user?.full_name || 'User'}
                                        className='w-8 h-8 rounded-full cursor-pointer flex-shrink-0 object-cover'
                                        onClick={() => navigate('/profile/' + (comment?.user?._id || ''))}
                                        style={protectiveStyles}
                                        onContextMenu={preventDefaultActions}
                                        onDragStart={preventDefaultActions}
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
                                                onContextMenu={preventDefaultActions}
                                            >
                                                {comment?.content}
                                            </p>
                                        )}
                                    </div>
                                    
                                    {isCurrentUserComment(comment) && (
                                        <div className='absolute right-2 top-3'>
                                            <MoreVertical
                                                className='w-4 h-4 cursor-pointer text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition'
                                                onClick={(e) => { e.stopPropagation(); setShowMenu(showMenu === comment?._id ? null : comment?._id); }}
                                            />
                                            
                                            {showMenu === comment?._id && (
                                                <div className='absolute right-0 top-6 bg-white shadow-xl rounded-lg border border-gray-100 z-20 min-w-32 divide-y divide-gray-100'>
                                                    <button onClick={() => handleEditComment(comment)} className='flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 rounded-t-lg transition'>
                                                        <Edit className='w-3 h-3' /> Edit
                                                    </button>
                                                    <button onClick={() => handleDeleteComment(comment?._id)} className='flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-b-lg transition'>
                                                        <Trash2 className='w-3 h-3' /> Delete
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className='text-center py-6 bg-gray-50 rounded-xl m-4'>
                                <p className='text-gray-500 text-sm'>No comments yet. Be the first to comment! 🚀</p>
                            </div>
                        )}
                    </div>

                    {/* Comment Input */}
                    <div className='p-4 border-t border-gray-100 flex-shrink-0 bg-white sticky bottom-0 z-20'>
                        <div className='flex items-center gap-2'>
                            <img
                                src={currentUser?.profile_picture || '/default-avatar.png'}
                                alt="Your Profile"
                                className='w-8 h-8 rounded-full flex-shrink-0'
                                style={protectiveStyles}
                                onContextMenu={preventDefaultActions}
                                onDragStart={preventDefaultActions}
                                draggable={false}
                            />
                            <input
                                type="text"
                                placeholder='Add a comment...'
                                className='flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-shadow'
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
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

            {/* Privacy Warning */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-red-500/20 backdrop-blur-sm text-white px-4 py-2 rounded-full text-xs border border-red-500/30">
                <div className="flex items-center gap-2">
                    <Shield className="w-3 h-3" />
                    <span>Protected: Screenshots & downloads disabled</span>
                </div>
            </div>
             
             <style jsx="true">{`
                .backdrop-blur-bg {
                    backdrop-filter: blur(8px);
                }
                .custom-scrollbar-lg::-webkit-scrollbar {
                    width: 8px; 
                }
                .custom-scrollbar-lg::-webkit-scrollbar-track {
                    background: #f9f9f9;
                    border-radius: 10px;
                }
                .custom-scrollbar-lg::-webkit-scrollbar-thumb {
                    background: #e0e0e0;
                    border-radius: 10px;
                }
                .custom-scrollbar-lg::-webkit-scrollbar-thumb:hover {
                    background: #c0c0c0;
                }
             `}</style>
        </div>
    )
}

// ----------------------------------------------------------------------
// --- Main PostCard Component (Enhanced with Protection) ---
// ----------------------------------------------------------------------

const PostCard = ({ post, onEdit, onDelete }) => {
    if (!post) {
        console.warn('PostCard received null or undefined post');
        return null;
    }

    const postWithHashtags = post?.content?.replace(/(#\w+)/g, '<span class="text-indigo-600 font-medium hover:underline cursor-pointer">$1</span>') || ''

    const [likes, setLikes] = useState(post?.likes_count || [])
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

    const currentUser = useSelector((state) => state.user.value)
    const { getToken } = useAuth()
    const navigate = useNavigate()
    const postCardRef = useRef(null)

    const isPostOwner = post?.user?._id === currentUser?._id;

    // Enhanced protection functions
    const preventDefaultActions = (e) => {
        e.preventDefault();
       
        return false;
    };

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

    // Rest of your existing functions remain the same...
    const fetchSharesCount = async () => { 
        try {
            const token = await getToken();
            const { data } = await api.get(`/api/post/shares/count/${post?._id}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            if (data.success) {
                setSharesCount(data.count)
            }
        } catch (error) {
            console.log('Error fetching shares count:', error)
        }
    }

    const fetchComments = async () => { 
        setIsFetchingComments(true)
        try {
            const token = await getToken();
            const { data } = await api.get(`/api/post/comments/${post?._id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data.success) {
                setComments(data.comments)
                setCommentsCount(data.comments.length)
            }
        } catch (error) {
            console.error('Error fetching comments:', error)
            toast.error('Failed to load comments.')
        } finally {
            setIsFetchingComments(false)
        }
    }

    const handleLike = async () => { 
        try {
            const token = await getToken();
            const { data } = await api.post(`/api/post/like`, { postId: post?._id }, { headers: { Authorization: `Bearer ${token}` } })
            if (data.success){
               toast.success(data.message)
               setLikes(prev =>{
                if(prev.includes(currentUser?._id)){
                    return prev.filter(id=> id !== currentUser?._id)
                }else{
                    return [...prev, currentUser?._id]
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
        if (!commentText.trim()) return

        setIsCommenting(true)
        try {
            const token = await getToken();
            const { data } = await api.post(`/api/post/comment`, { postId: post?._id, content: commentText }, { headers: { Authorization: `Bearer ${token}` } })
            if (data.success) {
                toast.success('Comment added!')
                setCommentsCount(prev => prev + 1)
                setCommentText('')
                setShowCommentBox(false)
                await fetchComments()
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        } finally {
            setIsCommenting(false)
        }
    }
    
    const handleEditComment = (comment) => { 
        setEditingComment(comment?._id)
        setEditCommentText(comment?.content)
        setShowMenu(null)
    }

    const handleUpdateComment = async (commentId) => {
        if (!editCommentText.trim()) return

        try {
            const token = await getToken();
            await api.put(`/api/post/comment/${commentId}`, { content: editCommentText }, { headers: { Authorization: `Bearer ${token}` } })
            toast.success('Comment updated!')
            setEditingComment(null)
            setEditCommentText('')
            await fetchComments()
        } catch (error) {
            toast.error('Failed to update comment.')
        }
    }

    const handleDeleteComment = async (commentId) => { 
        if (!window.confirm('Are you sure you want to delete this comment?')) return;

        try {
            const token = await getToken();
            await api.delete(`/api/post/comment/${commentId}`, { headers: { Authorization: `Bearer ${token}` } })
            toast.success('Comment deleted!')
            setCommentsCount(prev => Math.max(0, prev - 1))
            setShowMenu(null)
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
        try {
            const token = await getToken();
            const { data } = await api.post(`/api/post/share`, { postId: post?._id }, { headers: { Authorization: `Bearer ${token}` } })
            if (data.success) {
                toast.success('Post shared successfully!')
                setSharesCount(prev => prev + 1)
                const postUrl = `${window.location.origin}/post/${post?._id}`
                navigator.clipboard.writeText(postUrl)
                toast('Post link copied to clipboard!')
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        }
    }

    const isCurrentUserComment = (comment) => {
        return comment?.user?._id === currentUser?._id
    }
    
    const handleEditPost = () => {
        setShowPostMenu(false);
        if (onEdit) {
            onEdit(post);
        } else {
            toast.info('Edit functionality placeholder triggered.');
        }
    }

    const handleDeletePost = async () => {
        setShowPostMenu(false);
        if (!window.confirm('Are you absolutely sure you want to delete this post?')) {
            return;
        }

        toast.promise(
            new Promise(async (resolve, reject) => {
                try {
                    setTimeout(() => {
                        if (post?._id) { 
                            if(onDelete) onDelete(post._id); 
                            resolve('Post deleted successfully!');
                        } else {
                            reject(new Error('Failed to delete post.'));
                        }
                    }, 1000);
                } catch (error) {
                    reject(error);
                }
            }),
            {
                loading: 'Deleting post...',
                success: (message) => message,
                error: (err) => err.message,
            }
        );
    }

    return (
        <div 
            ref={postCardRef}
            className='bg-white rounded-xl shadow-lg p-5 space-y-4 w-full max-w-2xl border border-gray-100 relative'
            onContextMenu={preventDefaultActions}
            style={{ WebkitUserSelect: 'none' }}>

            {/* Post Modal */}
            {showPostModal && (
                <PostModal 
                    post={post} 
                    postWithHashtags={postWithHashtags}
                    isPostOwner={isPostOwner}
                    handleEditPost={handleEditPost}
                    handleDeletePost={handleDeletePost}
                    onClose={() => setShowPostModal(false)}
                    currentUser={currentUser}
                    getToken={getToken}
                    navigate={navigate}
                />
            )}

            {/* Protected User Info Header */}
            <div className='flex items-center justify-between'>
                <div 
                    onClick={()=> navigate('/profile/' + (post?.user?._id || ''))} 
                    className='inline-flex items-center gap-3 cursor-pointer'
                    onContextMenu={preventDefaultActions}
                >
                    <img
                        src={post?.user?.profile_picture || '/default-avatar.png'}
                        alt={post?.user?.full_name || 'User'}
                        className='w-12 h-12 rounded-full object-cover shadow-md ring-2 ring-indigo-50'
                        style={protectiveStyles}
                        onContextMenu={preventDefaultActions}
                        onDragStart={preventDefaultActions}
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
            
            {/* Protected Content */}
            {post?.content && (
                <div
                    className='text-gray-800 text-base leading-relaxed whitespace-pre-line cursor-pointer hover:bg-gray-50 p-2 -m-2 rounded-lg transition'
                    dangerouslySetInnerHTML={{__html: postWithHashtags}}
                    onClick={() => setShowPostModal(true)}
                    style={protectiveStyles}
                    onContextMenu={preventDefaultActions}
                />
            )}

            {/* Protected Images */}
            {post?.image_urls && post.image_urls.length > 0 && (
                <div 
                    className={`grid gap-2 cursor-pointer ${
                        post.image_urls.length === 1 ? 'grid-cols-1' :
                        post.image_urls.length === 2 ? 'grid-cols-2' :
                        'grid-cols-2 grid-rows-2'
                    }`}
                    onClick={() => setShowPostModal(true)}
                    onContextMenu={preventDefaultActions}
                >
                    {post.image_urls.slice(0, 4).map((img, index) => (
                        <div key={index} className="relative">
                            <img
                                src={img}
                                className={`w-full object-cover rounded-lg shadow-sm transition-transform duration-300 hover:scale-[1.01] ${
                                    post.image_urls.length === 1 ? 'h-auto max-h-96' :
                                    post.image_urls.length === 2 ? 'h-48 sm:h-64' :
                                    'h-40 sm:h-48'
                                }`}
                                alt={`Post image ${index + 1}`}
                                style={protectiveStyles}
                                onContextMenu={preventDefaultActions}
                                onDragStart={preventDefaultActions}
                                draggable={false}
                            />
                        </div>
                    ))}
                    {post.image_urls.length > 4 && (
                         <div className='w-full h-40 sm:h-48 bg-gray-200 rounded-lg flex items-center justify-center text-lg font-bold text-gray-600'>
                            +{post.image_urls.length - 4} more
                         </div>
                    )}
                </div>
            )}

            {/* Actions Bar */}
            <div className='flex items-center justify-between text-gray-600 text-sm pt-3 border-t border-gray-100'>
                <div className='flex items-center gap-3'>
                    <button onClick={handleLike} className='flex items-center gap-1.5 p-2 rounded-full transition-colors hover:bg-red-50 hover:text-red-500' title="Like">
                        <Heart className={`w-5 h-5 ${likes.includes(currentUser?._id) ? 'text-red-500 fill-red-500' : 'text-gray-500'}`} />
                        <span className='font-medium text-sm'>{likes.length}</span>
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
                        onContextMenu={preventDefaultActions}
                        onDragStart={preventDefaultActions}
                        draggable={false}
                    />
                    <input 
                        type="text" 
                        placeholder='Add a comment...' 
                        className='flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition-shadow' 
                        value={commentText} 
                        onChange={(e) => setCommentText(e.target.value)} 
                        onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
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
                                    onContextMenu={preventDefaultActions}
                                >
                                    <img 
                                        src={comment?.user?.profile_picture || '/default-avatar.png'} 
                                        alt={comment?.user?.full_name || 'User'} 
                                        className='w-8 h-8 rounded-full cursor-pointer flex-shrink-0 object-cover'
                                        onClick={() => navigate('/profile/' + (comment?.user?._id || ''))}
                                        style={protectiveStyles}
                                        onContextMenu={preventDefaultActions}
                                        onDragStart={preventDefaultActions}
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
                                                onContextMenu={preventDefaultActions}
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

            <style jsx="true">{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #f1f1f1;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #ccc;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #a8a8a8;
                }
            `}</style>
        </div>
    )
}

export default PostCard