import React, { useState } from 'react';
import { Heart, MoreVertical, Trash2, Edit2, Check, X, CornerDownLeft, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ReelComment = ({ 
    comment, 
    currentUserId, 
    onLikeComment, 
    onDeleteComment, 
    onUpdateComment,
    onReplyComment 
}) => {
    const navigate = useNavigate();
    const [isLiked, setIsLiked] = useState(false);
    const [showOptions, setShowOptions] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(comment.content);
    const [showReplyInput, setShowReplyInput] = useState(false);
    const [replyText, setReplyText] = useState('');

    const handleLike = () => {
        setIsLiked(!isLiked);
        if (onLikeComment) onLikeComment(comment._id, !isLiked);
    };

    const handleDelete = () => {
        if (onDeleteComment) onDeleteComment(comment._id);
        setShowOptions(false);
    };

    const handleUpdate = () => {
        if (editText.trim() && editText !== comment.content) {
            if (onUpdateComment) onUpdateComment(comment._id, editText);
        }
        setIsEditing(false);
    };

    const handleReply = () => {
        if (replyText.trim() && onReplyComment) {
            onReplyComment(comment._id, replyText, comment.user?.username);
            setReplyText('');
            setShowReplyInput(false);
        }
    };

    const handleProfileClick = () => {
        if (comment.user?._id) {
            navigate(`/profile/${comment.user._id}`);
        }
    };

    const isOwner = comment.user?._id === currentUserId;

    return (
        <div className="py-3">
            <div className="flex gap-3 group">
                <button
                    onClick={handleProfileClick}
                    className="flex-shrink-0 hover:opacity-80 transition-opacity"
                >
                    <img
                        src={comment.user?.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.user?.full_name || 'User')}&background=random`}
                        alt={comment.user?.username}
                        className="w-8 h-8 rounded-full object-cover"
                    />
                </button>
                
                <div className="flex-1 min-w-0">
                    {isEditing ? (
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                className="flex-1 bg-gray-800 text-white px-3 py-1 rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500"
                                autoFocus
                                onKeyPress={(e) => e.key === 'Enter' && handleUpdate()}
                            />
                            <button
                                onClick={handleUpdate}
                                className="p-1 text-green-500 hover:text-green-400"
                            >
                                <Check className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => {
                                    setIsEditing(false);
                                    setEditText(comment.content);
                                }}
                                className="p-1 text-red-500 hover:text-red-400"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="inline-block bg-gray-800 rounded-2xl px-4 py-2">
                                    <button
                                        onClick={handleProfileClick}
                                        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                                    >
                                        <span className="font-semibold text-white text-sm">
                                            {comment.user?.username || 'user'}
                                        </span>
                                        {comment.user?.verified && (
                                            <span className="text-blue-400 text-xs">✓</span>
                                        )}
                                    </button>
                                    <p className="text-white text-sm mt-1">{comment.content}</p>
                                </div>
                                
                                <div className="flex items-center gap-4 mt-2 ml-2">
                                    <span className="text-gray-400 text-xs">
                                        {new Date(comment.createdAt).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </span>
                                    <button
                                        onClick={handleLike}
                                        className="text-gray-400 hover:text-white text-xs font-medium"
                                    >
                                        {isLiked ? 'Liked' : 'Like'}
                                    </button>
                                    <button 
                                        onClick={() => setShowReplyInput(!showReplyInput)}
                                        className="text-gray-400 hover:text-white text-xs font-medium"
                                    >
                                        Reply
                                    </button>
                                </div>
                            </div>
                            
                            <div className="relative">
                                <button
                                    onClick={() => setShowOptions(!showOptions)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-white"
                                >
                                    <MoreVertical className="w-4 h-4" />
                                </button>
                                
                                {showOptions && (
                                    <div className="absolute right-0 top-6 bg-gray-900 rounded-lg shadow-lg py-1 min-w-[120px] z-10">
                                        {isOwner ? (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        setIsEditing(true);
                                                        setShowOptions(false);
                                                    }}
                                                    className="w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-800 flex items-center gap-2"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={handleDelete}
                                                    className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-gray-800 flex items-center gap-2"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                    Delete
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button className="w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-800 flex items-center gap-2">
                                                    <User className="w-4 h-4" />
                                                    View Profile
                                                </button>
                                                <button className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-gray-800">
                                                    Report
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                
                <button
                    onClick={handleLike}
                    className="self-start pt-2"
                >
                    <Heart className={`w-4 h-4 ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                </button>
            </div>

            {/* Reply input */}
            {showReplyInput && (
                <div className="ml-11 mt-2 flex items-center gap-2">
                    <CornerDownLeft className="w-4 h-4 text-gray-400" />
                    <div className="flex-1 flex items-center bg-gray-800 rounded-full px-4 py-1">
                        <input
                            type="text"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder={`Reply to ${comment.user?.username || 'user'}...`}
                            className="flex-1 bg-transparent text-white placeholder-gray-400 focus:outline-none text-sm"
                            onKeyPress={(e) => e.key === 'Enter' && handleReply()}
                            autoFocus
                        />
                        {replyText.trim() && (
                            <button
                                onClick={handleReply}
                                className="text-blue-500 font-semibold text-xs hover:text-blue-400 px-2"
                            >
                                Reply
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReelComment;