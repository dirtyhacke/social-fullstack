import { Calendar, MapPin, PenBox, Verified } from 'lucide-react'
import moment from 'moment'
import React from 'react'

const UserProfileInfo = ({ user, posts, profileId, setShowEdit }) => {
    
    // Fallback for user data
    const followerCount = user.followers?.length || 0;
    const followingCount = user.following?.length || 0;
    const postCount = posts?.length || 0;

    return (
        // Added bottom border and soft shadow to make the section pop
        <div className='relative py-6 px-4 md:px-8 bg-white border-b border-gray-200 shadow-sm'>
            <div className='flex flex-col items-start gap-4'>

                {/* Profile Picture Container - Positioned and styled more cleanly */}
                <div className="w-28 h-28 sm:w-32 sm:h-32 border-4 border-white shadow-xl absolute -top-14 sm:-top-16 left-4 md:left-8 rounded-full overflow-hidden z-10">
                    <img
                        src={user.profile_picture || '/default-profile.png'} // Added fallback
                        alt={`${user.full_name}'s profile`}
                        className="w-full h-full object-cover bg-gray-200"
                    />
                </div>

                {/* Content Area */}
                {/* Adjusted padding to account for the profile picture offset */}
                <div className='w-full pt-16 sm:pt-16'>
                    <div className='flex items-start justify-between'>
                        
                        {/* Edit Button - Positioned top-right */}
                        {!profileId && (
                            <button 
                                onClick={() => setShowEdit(true)} 
                                className='flex items-center gap-2 text-sm text-indigo-600 border border-indigo-200 hover:bg-indigo-50 px-4 py-1.5 rounded-full font-semibold transition-colors cursor-pointer shadow-sm ml-auto'
                            >
                                <PenBox className='w-4 h-4' />
                                Edit Profile
                            </button>
                        )}
                    </div>
                    
                    {/* Name and Username */}
                    <div className='mt-2'>
                        <div className='flex items-center gap-2'>
                            <h1 className='text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight'>{user.full_name}</h1>
                            {user.isVerified && <Verified className='w-5 h-5 text-blue-500' title="Verified User" />}
                        </div>
                        <p className='text-lg text-gray-500 font-normal mt-0.5'>
                            {user.username ? `@${user.username}` : <span className="italic text-gray-400">Add a username</span>}
                        </p>
                    </div>

                    {/* Bio */}
                    <p className='text-gray-700 text-base max-w-xl mt-3 leading-relaxed'>
                        {user.bio || <span className="italic text-gray-400">No bio added yet.</span>}
                    </p>

                    {/* Details (Location, Joined Date) */}
                    <div className='flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-500 mt-4'>
                        {user.location && (
                            <span className='flex items-center gap-1.5'>
                                <MapPin className='w-4 h-4 text-gray-400' />
                                <span className='font-medium text-gray-600'>{user.location}</span>
                            </span>
                        )}
                        <span className='flex items-center gap-1.5'>
                            <Calendar className='w-4 h-4 text-gray-400' />
                            Joined <span className='font-medium text-gray-600'>{moment(user.createdAt).format('MMMM YYYY')}</span>
                        </span>
                    </div>

                    {/* Stats (Posts, Followers, Following) */}
                    <div className='flex items-center gap-8 mt-5 pt-5 border-t border-gray-100'>
                        {/* Posts */}
                        <div>
                            <span className='text-lg font-bold text-gray-900'>{postCount}</span>
                            <span className='text-sm text-gray-500 ml-1.5 font-medium'>Posts</span>
                        </div>
                        {/* Followers */}
                        <div className="cursor-pointer hover:text-indigo-600 transition-colors">
                            <span className='text-lg font-bold text-gray-900'>{followerCount}</span>
                            <span className='text-sm text-gray-500 ml-1.5 font-medium'>Followers</span>
                        </div>
                        {/* Following */}
                        <div className="cursor-pointer hover:text-indigo-600 transition-colors">
                            <span className='text-lg font-bold text-gray-900'>{followingCount}</span>
                            <span className='text-sm text-gray-500 ml-1.5 font-medium'>Following</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}

export default UserProfileInfo