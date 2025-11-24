import { Calendar, MapPin, PenBox, Verified, Settings, UserPlus, UserMinus, Send, Plus, Clock, LockIcon, Lock, LucideAlarmClockMinus, Locate } from 'lucide-react'
import moment from 'moment'
import React from 'react'
import { useSelector } from 'react-redux'

const UserProfileInfo = ({ 
    user, 
    posts, 
    profileId, 
    setShowEdit, 
    setShowSettings,
    isOwnProfile,
    isFollowing,
    isConnected,
    hasPendingRequest,
    followRequestStatus = 'none', // Add this prop: 'none', 'requested', 'accepted'
    onFollow,
    onUnfollow,
    onConnectionRequest,
    isLoading
}) => {
    const currentUser = useSelector((state) => state.user.value)
    
    // Check if this is the current user's profile
    const isOwnProfileLocal = !profileId || profileId === currentUser?._id

    // Check if this is a private account that the current user doesn't have access to
    const isPrivateAndNoAccess = user?.settings?.profilePrivacy === 'private' && 
                                !isOwnProfileLocal && 
                                !user?.followers?.includes(currentUser?._id) &&
                                followRequestStatus !== 'accepted'

    const getConnectionButtonProps = () => {
        if (isConnected) {
            return {
                icon: <Send className="w-4 h-4" />,
                style: 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200',
                title: 'Message'
            }
        }
        if (hasPendingRequest) {
            return {
                icon: <Clock className="w-4 h-4" />,
                style: 'bg-amber-100 text-amber-600 hover:bg-amber-200',
                title: 'Accept Request'
            }
        }
        return {
            icon: <Plus className="w-4 h-4" />,
            style: 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            title: 'Connect'
        }
    }

    const connectionButton = getConnectionButtonProps()

    // Get follow button based on account type and request status
    const getFollowButton = () => {
        // For private accounts that current user doesn't have access to
        if (isPrivateAndNoAccess) {
            if (followRequestStatus === 'requested') {
                return (
                    <button 
                        onClick={onUnfollow}
                        disabled={isLoading}
                        className='flex items-center gap-2 bg-gray-500 text-white hover:bg-gray-600 px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                        <Clock className='w-4 h-4' />
                        Requested
                    </button>
                )
            } else {
                return (
                    <button 
                        onClick={onFollow}
                        disabled={isLoading}
                        className='flex items-center gap-2 bg-green-600 text-white hover:bg-green-700 px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                        <UserPlus className='w-4 h-4' />
                        Follow
                    </button>
                )
            }
        }

        // For public accounts or private accounts that current user has access to
        if (isFollowing) {
            return (
                <button 
                    onClick={onUnfollow}
                    disabled={isLoading}
                    className='flex items-center gap-2 bg-red-500 text-white hover:bg-red-600 px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
                >
                    <UserMinus className='w-4 h-4' />
                    Unfollow
                </button>
            )
        } else {
            return (
                <button 
                    onClick={onFollow}
                    disabled={isLoading}
                    className='flex items-center gap-2 bg-green-600 text-white hover:bg-green-700 px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
                >
                    <UserPlus className='w-4 h-4' />
                    Follow
                </button>
            )
        }
    }

    return (
        <div className='relative py-4 px-6 md:px-8 bg-white'>
            <div className='flex flex-col md:flex-row items-start gap-6'>

                <div className="w-32 h-32 border-4 border-white shadow-lg absolute -top-16 rounded-full overflow-hidden">
                    <img
                        src={user.profile_picture || '/default-avatar.png'}
                        alt=""
                        className="w-full h-full object-cover"
                    />
                </div>

                <div className='w-full pt-16 md:pt-0 md:pl-36'>
                    <div className='flex flex-col md:flex-row items-start justify-between'>
                        <div>
                            <div className='flex items-center gap-3'>
                                <h1 className='text-2xl font-bold text-gray-900'>{user.full_name}</h1>
                                <Verified className='w-6 h-6 text-blue-500' />
                            </div>
                            <p className='text-gray-600'>{user.username ? `@${user.username}` : 'Add a username'}</p>
                            
                            {/* Private Account Badge */}
                            {user?.settings?.profilePrivacy === 'private' && (
                                <div className="flex items-center gap-1 mt-1">
                                    <div className="w-3 h-3  rounded-full flex items-center justify-center">
                                       <Lock/>
                                    </div>
                                    <span className="text-xs text-gray-500 font-medium">Private Account</span>
                                </div>
                            )}
                        </div>
                        
                        {/* Action Buttons */}
                        <div className='flex space-x-3 mt-4 md:mt-0'>
                            {/* Edit Profile Button - Only show on own profile */}
                            {isOwnProfileLocal && (
                                <>
                                    <button 
                                        onClick={() => setShowEdit(true)} 
                                        className='flex items-center gap-2 border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer'
                                    >
                                        <PenBox className='w-4 h-4' />
                                        Edit
                                    </button>
                                    
                                    {/* Settings Button */}
                                    <button 
                                        onClick={() => setShowSettings(true)} 
                                        className='flex items-center gap-2 border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer'
                                        title='Profile Settings'
                                    >
                                        <Settings className='w-4 h-4' />
                                        Settings
                                    </button>
                                </>
                            )}
                            
                            {/* Follow/Connection buttons for other users */}
                            {!isOwnProfileLocal && (
                                <>
                                    {/* Follow/Unfollow/Requested Button */}
                                    {getFollowButton()}
                                    
                                    {/* Connection Button - Only show if user has access to the profile */}
                                    {!isPrivateAndNoAccess && (
                                        <button 
                                            onClick={onConnectionRequest}
                                            disabled={isLoading}
                                            className={`w-12 h-12 flex items-center justify-center rounded-lg border transition-all duration-200 ${connectionButton.style} hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
                                            title={connectionButton.title}
                                        >
                                            {isLoading ? (
                                                <div className="w-4 h-4 border-2 border-gray-300 border-t-current rounded-full animate-spin"></div>
                                            ) : (
                                                connectionButton.icon
                                            )}
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                    
                    <p className='text-gray-700 text-sm max-w-md mt-4'>{user.bio}</p>

                    <div className='flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-500 mt-4'>
                        <span className='flex items-center gap-1.5'>
                            <MapPin className='w-4 h-4' />
                            {user.location ? user.location : 'Add location'}
                        </span>
                        <span className='flex items-center gap-1.5'>
                            <Calendar className='w-4 h-4' />
                            Joined <span className='font-medium'>{moment(user.createdAt).fromNow()}</span>
                        </span>
                    </div>

                    <div className='flex items-center gap-6 mt-6 border-t border-gray-200 pt-4'>
                        <div>
                            <span className='sm:text-xl font-bold text-gray-900'>
                                {isPrivateAndNoAccess ? '-' : posts.length}
                            </span>
                            <span className='text-xs sm:text-sm text-gray-500 ml-1.5'>Posts</span>
                        </div>
                        <div>
                            <span className='sm:text-xl font-bold text-gray-900'>
                                {isPrivateAndNoAccess ? '-' : (user.followers?.length || 0)}
                            </span>
                            <span className='text-xs sm:text-sm text-gray-500 ml-1.5'>Followers</span>
                        </div>
                        <div>
                            <span className='sm:text-xl font-bold text-gray-900'>
                                {isPrivateAndNoAccess ? '-' : (user.following?.length || 0)}
                            </span>
                            <span className='text-xs sm:text-sm text-gray-500 ml-1.5'>Following</span>
                        </div>
                    </div>

                    {/* Follow Request Status Message */}
                    {!isOwnProfileLocal && followRequestStatus === 'requested' && (
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-sm text-blue-700 flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                Your follow request is pending approval
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default UserProfileInfo