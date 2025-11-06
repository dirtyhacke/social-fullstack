import { Calendar, MapPin, PenBox, Verified, X, ZoomIn, ZoomOut, RotateCw } from 'lucide-react'
import moment from 'moment'
import React, { useState } from 'react'

const UserProfileInfo = ({ user, posts, profileId, setShowEdit, onProfilePictureClick }) => {
    const [showProfilePicture, setShowProfilePicture] = useState(false)
    const [imageZoom, setImageZoom] = useState(1)
    const [rotation, setRotation] = useState(0)

    // Fallback for user data
    const followerCount = user.followers?.length || 0;
    const followingCount = user.following?.length || 0;
    const postCount = posts?.length || 0;

    const handleProfilePictureClick = () => {
        setShowProfilePicture(true)
        setImageZoom(1)
        setRotation(0)
    }

    const handleCloseProfilePicture = () => {
        setShowProfilePicture(false)
        setImageZoom(1)
        setRotation(0)
    }

    const zoomIn = () => {
        setImageZoom(prev => Math.min(prev + 0.25, 3))
    }

    const zoomOut = () => {
        setImageZoom(prev => Math.max(prev - 0.25, 0.5))
    }

    const rotateImage = () => {
        setRotation(prev => (prev + 90) % 360)
    }

    const resetImage = () => {
        setImageZoom(1)
        setRotation(0)
    }

    // Profile Picture Popup Component
    const ProfilePicturePopup = () => {
        if (!showProfilePicture || !user?.profile_picture) return null

        return (
            <div className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="relative max-w-4xl max-h-[90vh] w-full">
                    {/* Close Button */}
                    <button
                        onClick={handleCloseProfilePicture}
                        className="absolute top-4 right-4 z-10 bg-white/20 hover:bg-white/30 text-white p-2 rounded-full transition-colors backdrop-blur-sm"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    {/* Image Container */}
                    <div className="flex flex-col items-center">
                        {/* Image with zoom and rotation - Square shape like Instagram */}
                        <div className="bg-black rounded-lg overflow-hidden max-w-full max-h-[70vh] w-96 h-96 flex items-center justify-center">
                            <img
                                src={user.profile_picture}
                                alt={`${user.full_name || user.username}'s profile`}
                                className="max-w-full max-h-full object-contain transition-transform duration-300"
                                style={{
                                    transform: `scale(${imageZoom}) rotate(${rotation}deg)`,
                                    cursor: imageZoom > 1 ? 'grab' : 'default'
                                }}
                                draggable={false}
                            />
                        </div>

                        {/* User Info */}
                        <div className="mt-4 text-center text-white">
                            <h3 className="text-xl font-semibold">{user.full_name || user.username}</h3>
                            <p className="text-gray-300">@{user.username}</p>
                        </div>

                        {/* Controls */}
                        <div className="mt-6 flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-full px-6 py-3">
                            {/* Zoom Out */}
                            <button
                                onClick={zoomOut}
                                disabled={imageZoom <= 0.5}
                                className="p-2 text-white hover:bg-white/20 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Zoom Out"
                            >
                                <ZoomOut className="w-5 h-5" />
                            </button>

                            {/* Zoom Level */}
                            <span className="text-white text-sm font-medium min-w-[60px] text-center">
                                {Math.round(imageZoom * 100)}%
                            </span>

                            {/* Zoom In */}
                            <button
                                onClick={zoomIn}
                                disabled={imageZoom >= 3}
                                className="p-2 text-white hover:bg-white/20 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Zoom In"
                            >
                                <ZoomIn className="w-5 h-5" />
                            </button>

                            {/* Rotate */}
                            <button
                                onClick={rotateImage}
                                className="p-2 text-white hover:bg-white/20 rounded-full transition-colors"
                                title="Rotate"
                            >
                                <RotateCw className="w-5 h-5" />
                            </button>

                            {/* Reset */}
                            <button
                                onClick={resetImage}
                                className="px-3 py-1 text-white hover:bg-white/20 rounded-full transition-colors text-sm border border-white/30"
                                title="Reset"
                            >
                                Reset
                            </button>
                        </div>

                        {/* Instructions */}
                        <div className="mt-4 text-center text-white/70 text-sm">
                            <p>Click and drag to move zoomed image • Use controls to adjust</p>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <>
            {/* Main Profile Info */}
            <div className='relative py-6 px-4 md:px-8 bg-white border-b border-gray-200 shadow-sm'>
                <div className='flex flex-col items-start gap-4'>

                    {/* Profile Picture Container - Now Clickable */}
                    <div 
                        className="w-28 h-28 sm:w-32 sm:h-32 border-4 border-white shadow-xl absolute -top-14 sm:-top-16 left-4 md:left-8 rounded-full overflow-hidden z-10 cursor-pointer group"
                        onClick={handleProfilePictureClick}
                    >
                        <img
                            src={user.profile_picture || '/default-profile.png'}
                            alt={`${user.full_name}'s profile`}
                            className="w-full h-full object-cover bg-gray-200 transition-transform duration-300 group-hover:scale-110"
                        />
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-white text-xs font-medium">
                                View Photo
                            </div>
                        </div>
                    </div>

                    {/* Content Area */}
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

            {/* Profile Picture Popup */}
            <ProfilePicturePopup />
        </>
    )
}

export default UserProfileInfo