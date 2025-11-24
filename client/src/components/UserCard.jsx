import React, { useState, useEffect } from 'react'
import { MapPin, UserPlus, UserMinus, Send, Plus, Clock, Lock } from 'lucide-react'
import { useDispatch, useSelector } from 'react-redux'
import { useAuth } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { fetchUser } from '../features/user/userSlice'

const UserCard = ({ user }) => {
    const currentUser = useSelector((state) => state.user.value)
    const { getToken } = useAuth()
    const dispatch = useDispatch()
    const navigate = useNavigate()
    
    const [hasPendingRequest, setHasPendingRequest] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [followRequestStatus, setFollowRequestStatus] = useState('none') // 'none', 'requested', 'accepted'

    // Safe data extraction with fallbacks
    const safeUser = user || {};
    const userId = safeUser._id || '';
    const username = safeUser.username || 'Unknown User';
    const fullName = safeUser.full_name || 'No Name';
    const profilePicture = safeUser.profile_picture || 'https://via.placeholder.com/150?text=User';
    const location = safeUser.location || '';
    const bio = safeUser.bio || '';
    const followers = Array.isArray(safeUser.followers) ? safeUser.followers : [];
    const following = Array.isArray(safeUser.following) ? safeUser.following : [];
    const connections = Array.isArray(safeUser.connections) ? safeUser.connections : [];
    const profilePrivacy = safeUser.settings?.profilePrivacy || 'public';

    // Safe current user data
    const currentUserId = currentUser?._id || '';
    const currentUserFollowing = Array.isArray(currentUser?.following) ? currentUser.following : [];
    const currentUserConnections = Array.isArray(currentUser?.connections) ? currentUser.connections : [];

    const isFollowing = currentUserFollowing.includes(userId);
    const isConnected = currentUserConnections.includes(userId);
    const isOwnProfile = userId === currentUserId;

    // Check if profile is private and user doesn't have access
    const isPrivateProfile = profilePrivacy === 'private' && 
                           !isOwnProfile && 
                           !followers.includes(currentUserId) &&
                           followRequestStatus !== 'accepted'

    // Check for pending connection and follow requests
    useEffect(() => {
        const checkPendingRequests = async () => {
            try {
                if (!userId || !currentUserId) return;
                
                // Check connection status
                const { data: connectionData } = await api.get(`/api/user/check-connection/${userId}`, {
                    headers: { Authorization: `Bearer ${await getToken()}` }
                })
                setHasPendingRequest(connectionData.isPending || false)
                
                // Check follow request status for private accounts
                if (profilePrivacy === 'private' && !isOwnProfile && !followers.includes(currentUserId)) {
                    const { data: followRequests } = await api.get(`/api/user/follow-requests`, {
                        headers: { Authorization: `Bearer ${await getToken()}` }
                    })
                    if (followRequests.success) {
                        const hasPendingFollow = followRequests.requests.some(req => 
                            req.fromUserId === currentUserId && req.toUserId === userId && req.status === 'pending'
                        )
                        setFollowRequestStatus(hasPendingFollow ? 'requested' : 'none')
                    }
                } else {
                    setFollowRequestStatus('accepted')
                }
            } catch (error) {
                console.log('Error checking request status:', error)
                setHasPendingRequest(false)
                setFollowRequestStatus('none')
            }
        }
        
        if (currentUser && userId) {
            checkPendingRequests()
        }
    }, [currentUser, userId, getToken, currentUserId, profilePrivacy, isOwnProfile, followers])

    const handleFollow = async () => {
        if (!userId) {
            toast.error('Invalid user');
            return;
        }

        try {
            setIsLoading(true);
            const token = await getToken()
            
            // For private accounts, send follow request instead of immediate follow
            if (profilePrivacy === 'private' && !isOwnProfile) {
                const { data } = await api.post('/api/user/follow-request', {targetUserId: userId}, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                
                if (data.success) {
                    toast.success('Follow request sent!')
                    setFollowRequestStatus('requested')
                } else {
                    toast.error(data.message)
                }
            } else {
                // For public accounts or own profile, follow immediately
                const { data } = await api.post('/api/user/follow', {id: userId}, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                if (data.success) {
                    toast.success(data.message)
                    setFollowRequestStatus('accepted')
                    // Refresh current user data to update following list
                    await dispatch(fetchUser(token))
                } else {
                    toast.error(data.message)
                }
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message)
        } finally {
            setIsLoading(false)
        }
    }

    const handleUnfollow = async () => {
        if (!userId) return
        
        setIsLoading(true)
        try {
            const token = await getToken()
            
            // For private accounts with pending requests, cancel the request
            if (followRequestStatus === 'requested') {
                const { data } = await api.post('/api/user/cancel-follow-request', {targetUserId: userId}, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                
                if (data.success) {
                    toast.success('Follow request cancelled!')
                    setFollowRequestStatus('none')
                } else {
                    toast.error(data.message)
                }
            } else {
                // Regular unfollow
                const { data } = await api.post('/api/user/unfollow', {id: userId}, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                if (data.success) {
                    toast.success(data.message)
                    setFollowRequestStatus('none')
                    // Refresh current user data to update following list
                    await dispatch(fetchUser(token))
                } else {
                    toast.error(data.message)
                }
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message)
        } finally {
            setIsLoading(false)
        }
    }

    const handleConnectionRequest = async () => {
        if (isLoading || !userId) return;
        
        setIsLoading(true)

        if (isConnected) {
            setIsLoading(false)
            return navigate('/messages/' + userId)
        }

        if (hasPendingRequest) {
            // Accept the pending request
            try {
                const token = await getToken()
                const { data } = await api.post('/api/user/accept-request', { id: userId }, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                if (data.success) {
                    toast.success('Connection accepted!')
                    setHasPendingRequest(false)
                    dispatch(fetchUser(await getToken()))
                } else {
                    toast.error(data.message)
                }
            } catch (error) {
                toast.error(error.response?.data?.message || error.message)
            } finally {
                setIsLoading(false)
            }
            return
        }

        try {
            const token = await getToken()
            const { data } = await api.post('/api/user/connect', { id: userId }, {
                headers: { Authorization: `Bearer ${token}` }
            })
            if (data.success) {
                toast.success(data.message)
                setHasPendingRequest(true) // Set pending state after sending request
                dispatch(fetchUser(await getToken()))
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message)
        } finally {
            setIsLoading(false)
        }
    }

    // Handle profile picture click to navigate to user profile
    const handleProfilePictureClick = (e) => {
        e.stopPropagation();
        if (userId) {
            navigate(`/profile/${userId}`);
        }
    }

    // Handle user name click to navigate to user profile
    const handleNameClick = (e) => {
        e.stopPropagation();
        if (userId) {
            navigate(`/profile/${userId}`);
        }
    }

    // Handle view private profile button
    const handleViewPrivateProfile = (e) => {
        e.stopPropagation();
        if (userId) {
            navigate(`/profile/${userId}`);
        }
    }

    const getConnectionButtonProps = () => {
        if (isConnected) {
            return {
                icon: <Send className="w-5 h-5" />,
                style: 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200',
                title: 'Message'
            }
        }
        if (hasPendingRequest) {
            return {
                icon: <Clock className="w-5 h-5" />,
                style: 'bg-amber-100 text-amber-600 hover:bg-amber-200',
                title: 'Accept Request'
            }
        }
        return {
            icon: <Plus className="w-5 h-5" />,
            style: 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            title: 'Connect'
        }
    }

    const connectionButton = getConnectionButtonProps()

    return (
        <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 overflow-hidden group">
            {/* Status indicator bar */}
            <div className={`h-1 ${
                isConnected ? 'bg-green-500' : 
                hasPendingRequest ? 'bg-amber-500' : 
                isPrivateProfile ? 'bg-gray-400' :
                'bg-gradient-to-r from-indigo-500 to-purple-600'
            }`}></div>
            
            <div className="p-6">
                {/* Header with avatar and basic info */}
                <div className="flex items-start space-x-4">
                    <div className="relative">
                        <img 
                            src={profilePicture} 
                            alt={fullName} 
                            className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-lg group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                            onClick={handleProfilePictureClick}
                        />
                        {/* Status badge */}
                        {(isConnected || hasPendingRequest || isPrivateProfile) && (
                            <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center ${
                                isConnected ? 'bg-green-500' : 
                                hasPendingRequest ? 'bg-amber-500' : 
                                'bg-gray-400'
                            }`}>
                                {hasPendingRequest && <Clock className="w-3 h-3 text-white" />}
                                {isPrivateProfile && <Lock className="w-3 h-3 text-white" />}
                            </div>
                        )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                            <h3 
                                className="font-bold text-gray-900 text-lg truncate cursor-pointer hover:text-indigo-600 transition-colors"
                                onClick={handleNameClick}
                            >
                                {fullName}
                            </h3>
                            {hasPendingRequest && (
                                <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-full font-medium">
                                    Pending
                                </span>
                            )}
                            {isPrivateProfile && !isOwnProfile && (
                                <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full font-medium flex items-center gap-1">
                                    <Lock className="w-3 h-3" />
                                    Private
                                </span>
                            )}
                        </div>
                        {username && username !== 'Unknown User' && (
                            <p 
                                className="text-indigo-600 font-medium text-sm truncate cursor-pointer hover:text-indigo-800 transition-colors"
                                onClick={handleNameClick}
                            >
                                @{username}
                            </p>
                        )}
                        
                        <div className="flex items-center space-x-3 mt-2">
                            <div className="flex items-center space-x-1 text-xs text-gray-500">
                                <span className="font-semibold text-gray-900">
                                    {isPrivateProfile && !isOwnProfile ? '-' : followers.length}
                                </span>
                                <span>Followers</span>
                            </div>
                            {location && (
                                <div className="flex items-center space-x-1 text-xs text-gray-500">
                                    <MapPin className="w-3 h-3" />
                                    <span className="truncate max-w-[100px]">{location}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {bio && !isPrivateProfile && (
                    <p className="mt-4 text-gray-600 text-sm leading-relaxed line-clamp-2">
                        {bio}
                    </p>
                )}

                {isPrivateProfile && !isOwnProfile && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2 text-gray-600">
                            <Lock className="w-4 h-4" />
                            <p className="text-sm font-medium">This account is private</p>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            Follow to see their content
                        </p>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-3 mt-6">
                    {/* Follow/Unfollow Button or View Profile for private accounts */}
                    {isPrivateProfile && !isOwnProfile ? (
                        <button 
                            onClick={handleViewPrivateProfile}
                            className="flex-1 py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center space-x-2 bg-gray-600 text-white hover:bg-gray-700 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                        >
                            <Lock className="w-4 h-4" />
                            <span>View Profile</span>
                        </button>
                    ) : isFollowing ? (
                        <button 
                            onClick={handleUnfollow}
                            disabled={isLoading}
                            className={`flex-1 py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center space-x-2 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 hover:shadow-md transform hover:-translate-y-0.5 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <UserMinus className="w-4 h-4" />
                            <span>Unfollow</span>
                        </button>
                    ) : (
                        <button 
                            onClick={handleFollow}
                            disabled={isLoading}
                            className={`flex-1 py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center space-x-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md hover:shadow-lg transform hover:-translate-y-0.5 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {followRequestStatus === 'requested' ? (
                                <>
                                    <Clock className="w-4 h-4" />
                                    <span>Requested</span>
                                </>
                            ) : (
                                <>
                                    <UserPlus className="w-4 h-4" />
                                    <span>Follow</span>
                                </>
                            )}
                        </button>
                    )}
                    
                    {/* Connection Button - Hide for private profiles if not following */}
                    {(!isPrivateProfile || isFollowing || isOwnProfile) && (
                        <button 
                            onClick={handleConnectionRequest}
                            disabled={isLoading}
                            className={`w-12 h-12 flex items-center justify-center rounded-xl border transition-all duration-200 ${connectionButton.style} hover:shadow-md active:scale-95 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title={connectionButton.title}
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-gray-300 border-t-current rounded-full animate-spin"></div>
                            ) : (
                                connectionButton.icon
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

export default UserCard