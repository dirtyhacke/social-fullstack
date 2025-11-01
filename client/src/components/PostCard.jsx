import React, { useState, useEffect } from 'react'
import { BadgeCheck, Heart, MessageCircle, Share2, Send, X, Edit, Trash2, MoreVertical } from 'lucide-react'
import moment from 'moment'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux';
import { useAuth } from '@clerk/clerk-react'
import api from '../api/axios'
import toast from 'react-hot-toast'

const PostCard = ({post}) => {

    const postWithHashtags = post.content.replace(/(#\w+)/g, '<span class="text-indigo-600">$1</span>')
    const [likes, setLikes] = useState(post.likes_count || [])
    const [commentsCount, setCommentsCount] = useState(post.comments_count || 0)
    const [sharesCount, setSharesCount] = useState(post.shares_count || 0)
    const [showCommentBox, setShowCommentBox] = useState(false)
    const [showComments, setShowComments] = useState(false)
    const [comments, setComments] = useState([])
    const [commentText, setCommentText] = useState('')
    const [isCommenting, setIsCommenting] = useState(false)
    const [editingComment, setEditingComment] = useState(null)
    const [editCommentText, setEditCommentText] = useState('')
    const [showMenu, setShowMenu] = useState(null)
    const currentUser = useSelector((state) => state.user.value)

    const { getToken } = useAuth()
    const navigate = useNavigate()

    // Use the post's comments_count directly instead of fetching separately
    useEffect(() => {
        // Initialize with post's comments_count
        setCommentsCount(post.comments_count || 0)
    }, [post.comments_count])

    // Fetch real shares count  
    useEffect(() => {
        fetchSharesCount()
    }, [post._id])

    const fetchSharesCount = async () => {
        try {
            const token = await getToken();
            const { data } = await api.get(`/api/post/shares/count/${post._id}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            if (data.success) {
                setSharesCount(data.count)
            }
        } catch (error) {
            console.log('Error fetching shares count:', error)
        }
    }

    // Fetch comments with user profiles
    const fetchComments = async () => {
        try {
            console.log('🔄 ===== STARTING FETCH COMMENTS =====');
            console.log('🔄 Frontend: Starting to fetch comments for post:', post._id);
            
            const token = await getToken();
            console.log('🔑 Frontend: Token available:', !!token);

            if (!token) {
                console.log('❌ Frontend: No token available for comments API');
                return;
            }

            console.log('🌐 Frontend: Making API call to:', `/api/post/comments/${post._id}`);
            
            // Make the API call with MANUAL Authorization header
            const response = await api.get(`/api/post/comments/${post._id}`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            
            console.log('📨 Frontend: API response status:', response.status);
            
            const { data } = response;
            console.log('📨 Frontend: Full response data:', data);
            
            if (data.success) {
                console.log('✅ Frontend: SUCCESS - Comments data received');
                console.log('✅ Frontend: Number of comments:', data.comments.length);
                
                if (data.comments.length > 0) {
                    data.comments.forEach((comment, index) => {
                        console.log(`   📝 Comment ${index + 1}:`, {
                            id: comment._id,
                            content: comment.content,
                            user: comment.user?.full_name,
                            userId: comment.user?._id
                        });
                    });
                } else {
                    console.log('   ℹ️  No comments found for this post');
                }
                
                setComments(data.comments)
                setCommentsCount(data.comments.length)
                console.log('✅ Frontend: State updated with comments');
            } else {
                console.log('❌ Frontend: API returned success: false');
                console.log('❌ Frontend: Error message:', data.message);
            }
            
            console.log('🔄 ===== FINISHED FETCH COMMENTS =====');
        } catch (error) {
            console.log('💥 ===== ERROR IN FETCH COMMENTS =====');
            console.log('💥 Frontend: Error fetching comments:');
            console.log('💥 Frontend: Error message:', error.message);
            
            if (error.response) {
                console.log('💥 Frontend: Error response status:', error.response.status);
                console.log('💥 Frontend: Error response data:', error.response.data);
            }
            
            console.log('💥 ===== END ERROR =====');
        }
    }

    const handleLike = async () => {
        try {
            const token = await getToken();
            const { data } = await api.post(`/api/post/like`, 
                { postId: post._id }, 
                { headers: { Authorization: `Bearer ${token}` }}
            )

            if (data.success){
               toast.success(data.message) 
               setLikes(prev =>{
                if(prev.includes(currentUser._id)){
                    return prev.filter(id=> id !== currentUser._id)
                }else{
                    return [...prev, currentUser._id]
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
            const { data } = await api.post(`/api/post/comment`, 
                {
                    postId: post._id,
                    content: commentText
                }, 
                { headers: { Authorization: `Bearer ${token}` }}
            )

            if (data.success) {
                toast.success('Comment added!')
                setCommentsCount(prev => prev + 1)
                setCommentText('')
                setShowCommentBox(false)
                // Refresh comments list
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
        setEditingComment(comment._id)
        setEditCommentText(comment.content)
        setShowMenu(null)
    }

    const handleUpdateComment = async (commentId) => {
        if (!editCommentText.trim()) return

        try {
            const token = await getToken();
            const { data } = await api.put(`/api/post/comment/${commentId}`, 
                { content: editCommentText },
                { headers: { Authorization: `Bearer ${token}` }}
            )

            if (data.success) {
                toast.success('Comment updated!')
                setEditingComment(null)
                setEditCommentText('')
                // Refresh comments list
                await fetchComments()
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        }
    }

    const handleDeleteComment = async (commentId) => {
        if (!window.confirm('Are you sure you want to delete this comment?')) return

        try {
            const token = await getToken();
            const { data } = await api.delete(`/api/post/comment/${commentId}`, {
                headers: { Authorization: `Bearer ${token}` }
            })

            if (data.success) {
                toast.success('Comment deleted!')
                setCommentsCount(prev => Math.max(0, prev - 1))
                setShowMenu(null)
                // Refresh comments list
                await fetchComments()
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        }
    }

    const cancelEdit = () => {
        setEditingComment(null)
        setEditCommentText('')
    }

    const handleShare = async () => {
        try {
            const token = await getToken();
            const { data } = await api.post(`/api/post/share`, 
                { postId: post._id },
                { headers: { Authorization: `Bearer ${token}` }}
            )

            if (data.success) {
                toast.success('Post shared successfully!')
                setSharesCount(prev => prev + 1)
                
                // Copy post link to clipboard
                const postUrl = `${window.location.origin}/post/${post._id}`
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
        return comment.user?._id === currentUser._id
    }

  return (
    <div className='bg-white rounded-xl shadow p-4 space-y-4 w-full max-w-2xl'>
        {/* User Info */}
        <div onClick={()=> navigate('/profile/' + post.user._id)} className='inline-flex items-center gap-3 cursor-pointer'>
            <img src={post.user.profile_picture} alt="" className='w-10 h-10 rounded-full shadow'/>
            <div>
                <div className='flex items-center space-x-1'>
                    <span>{post.user.full_name}</span>
                    <BadgeCheck className='w-4 h-4 text-blue-500'/>
                </div>
                <div className='text-gray-500 text-sm'>@{post.user.username} • {moment(post.createdAt).fromNow()}</div>
            </div>
        </div>
         {/* Content */}
         {post.content && <div className='text-gray-800 text-sm whitespace-pre-line' dangerouslySetInnerHTML={{__html: postWithHashtags}}/>}

       {/* Images */}
       <div className='grid grid-cols-2 gap-2'>
            {post.image_urls && post.image_urls.map((img, index)=>(
                <img src={img} key={index} className={`w-full h-48 object-cover rounded-lg ${post.image_urls.length === 1 && 'col-span-2 h-auto'}`} alt="" />
            ))}
       </div>

        {/* Actions */}
        <div className='flex items-center gap-4 text-gray-600 text-sm pt-2 border-t border-gray-300'>
            <div className='flex items-center gap-1'>
                <Heart className={`w-4 h-4 cursor-pointer ${likes.includes(currentUser._id) && 'text-red-500 fill-red-500'}`} onClick={handleLike}/>
                <span>{likes.length}</span>
            </div>
            <div className='flex items-center gap-1'>
                <MessageCircle className="w-4 h-4 cursor-pointer" onClick={handleCommentClick}/>
                <span>{commentsCount}</span>
            </div>
            <div className='flex items-center gap-1 cursor-pointer' onClick={handleShowComments}>
                <span className='text-sm text-blue-500 hover:underline'>View Comments</span>
            </div>
            <div className='flex items-center gap-1'>
                <Share2 className="w-4 h-4 cursor-pointer" onClick={handleShare}/>
                <span>{sharesCount}</span>
            </div>
        </div>

        {/* Comment Box */}
        {showCommentBox && (
            <div className='flex items-center gap-2 border-t border-gray-200 pt-3'>
                <input 
                    type="text" 
                    placeholder='Write a comment...' 
                    className='flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-blue-500'
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                />
                <button 
                    onClick={handleAddComment}
                    disabled={isCommenting || !commentText.trim()}
                    className='bg-blue-500 text-white p-2 rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                    <Send className='w-4 h-4' />
                </button>
            </div>
        )}

        {/* Comments List */}
        {showComments && (
            <div className='border-t border-gray-200 pt-3 space-y-3'>
                <div className='flex items-center justify-between'>
                    <h3 className='font-semibold text-gray-800'>Comments ({comments.length})</h3>
                    <X 
                        className='w-4 h-4 cursor-pointer text-gray-500 hover:text-gray-700' 
                        onClick={() => setShowComments(false)}
                    />
                </div>
                
                {comments.length > 0 ? (
                    <div className='space-y-3 max-h-60 overflow-y-auto'>
                        {comments.map((comment) => (
                            <div key={comment._id} className='flex gap-3 group'>
                                <img
                                    src={comment.user?.profile_picture || '/default-avatar.png'}
                                    alt={comment.user?.full_name}
                                    className='w-8 h-8 rounded-full cursor-pointer flex-shrink-0'
                                    onClick={() => navigate('/profile/' + comment.user?._id)}
                                />
                                
                                <div className='flex-1 bg-gray-50 rounded-lg p-3 relative'>
                                    {/* Comment Menu (only for current user's comments) */}
                                    {isCurrentUserComment(comment) && (
                                        <div className='absolute right-2 top-2'>
                                            <MoreVertical 
                                                className='w-4 h-4 cursor-pointer text-gray-400 hover:text-gray-600'
                                                onClick={() => setShowMenu(showMenu === comment._id ? null : comment._id)}
                                            />
                                            
                                            {showMenu === comment._id && (
                                                <div className='absolute right-0 top-6 bg-white shadow-lg rounded-lg border border-gray-200 z-10 min-w-32'>
                                                    <button 
                                                        onClick={() => handleEditComment(comment)}
                                                        className='flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 rounded-t-lg'
                                                    >
                                                        <Edit className='w-3 h-3' />
                                                        Edit
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteComment(comment._id)}
                                                        className='flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 text-red-500 rounded-b-lg'
                                                    >
                                                        <Trash2 className='w-3 h-3' />
                                                        Delete
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    
                                    <div className='flex items-center gap-2 mb-1'>
                                        <span className='font-medium text-sm'>{comment.user?.full_name}</span>
                                        <span className='text-gray-500 text-xs'>@{comment.user?.username}</span>
                                        <span className='text-gray-400 text-xs'>• {moment(comment.createdAt).fromNow()}</span>
                                    </div>
                                    
                                    {editingComment === comment._id ? (
                                        <div className='space-y-2'>
                                            <input 
                                                type="text" 
                                                value={editCommentText}
                                                onChange={(e) => setEditCommentText(e.target.value)}
                                                className='w-full border border-gray-300 rounded px-3 py-1 text-sm focus:outline-none focus:border-blue-500'
                                                autoFocus
                                            />
                                            <div className='flex gap-2'>
                                                <button 
                                                    onClick={() => handleUpdateComment(comment._id)}
                                                    className='bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600'
                                                >
                                                    Update
                                                </button>
                                                <button 
                                                    onClick={cancelEdit}
                                                    className='bg-gray-300 text-gray-700 px-3 py-1 rounded text-xs hover:bg-gray-400'
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className='text-gray-800 text-sm'>{comment.content}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className='text-center py-4'>
                        <p className='text-gray-500 text-sm'>No comments yet. Be the first to comment!</p>
                    </div>
                )}
            </div>
        )}

    </div>
  )
}

export default PostCard