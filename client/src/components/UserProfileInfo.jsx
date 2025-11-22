import { Calendar, MapPin, PenBox, Verified, Settings } from 'lucide-react'
import moment from 'moment'
import React from 'react'
import { useSelector } from 'react-redux'

const UserProfileInfo = ({ user, posts, profileId, setShowEdit, setShowSettings }) => {
    const currentUser = useSelector((state) => state.user.value)
    
    // Check if this is the current user's profile
    const isOwnProfile = !profileId || profileId === currentUser?._id

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
                        </div>
                        
                        {/* Action Buttons */}
                        <div className='flex space-x-3 mt-4 md:mt-0'>
                            {/* Edit Profile Button - Only show on own profile */}
                            {isOwnProfile && (
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
                            
                            {/* Follow/Message buttons for other users */}
                            {!isOwnProfile && (
                                <>
                                    <button className='flex items-center gap-2 bg-green-600 text-white hover:bg-green-700 px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer'>
                                        Follow
                                    </button>
                                    <button className='flex items-center gap-2 border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer'>
                                        Message
                                    </button>
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
                            <span className='sm:text-xl font-bold text-gray-900'>{posts.length}</span>
                            <span className='text-xs sm:text-sm text-gray-500 ml-1.5'>Posts</span>
                        </div>
                        <div>
                            <span className='sm:text-xl font-bold text-gray-900'>
                                {user.followers?.length || 0}</span>
                            <span className='text-xs sm:text-sm text-gray-500 ml-1.5'>Followers</span>
                        </div>
                        <div>
                            <span className='sm:text-xl font-bold text-gray-900'>
                                {user.following?.length || 0}</span>
                            <span className='text-xs sm:text-sm text-gray-500 ml-1.5'>Following</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default UserProfileInfo