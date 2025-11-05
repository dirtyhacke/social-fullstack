import React, { useState } from 'react'
import { Pencil, X } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { updateUser } from '../features/user/userSlice';
import { useAuth } from '@clerk/clerk-react';
import toast from 'react-hot-toast';

const ProfileModal = ({setShowEdit}) => {
    const dispatch = useDispatch();
    const {getToken} = useAuth()
    const user = useSelector((state) => state.user.value)
    
    console.log("🎯 ProfileModal rendered - setShowEdit:", typeof setShowEdit);

    const [editForm, setEditForm] = useState({
        username: user.username || '',
        bio: user.bio || '',
        location: user.location || '',
        profile_picture: null,
        cover_photo: null,
        full_name: user.full_name || '',
    })

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        try {
            const userData = new FormData();
            const {full_name, username, bio, location, profile_picture, cover_photo} = editForm

            if (!full_name.trim() || !username.trim()) {
                throw new Error('Name and Username are required.');
            }

            userData.append('username', username);
            userData.append('bio', bio);
            userData.append('location', location);
            userData.append('full_name', full_name);
            profile_picture && userData.append('profile', profile_picture)
            cover_photo && userData.append('cover', cover_photo)

            const token = await getToken()
            await dispatch(updateUser({userData, token})) 

            setShowEdit(false)
            toast.success('Profile saved successfully!');
        } catch (error) {
            const message = error.message || (error.payload ? error.payload.message : 'Failed to save profile.');
            toast.error(message);
        }
    }

    const getImageUrl = (file, fallbackUrl) => {
        if (file instanceof File) {
            return URL.createObjectURL(file);
        }
        return fallbackUrl;
    }

    return (
        <div className='fixed inset-0 z-[9999] h-[100dvh] overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start pt-8 sm:pt-16 pb-8'>
            <div className='max-w-xl w-full mx-4 sm:mx-auto transition-all duration-300 transform'>
                <div className='bg-white rounded-xl shadow-2xl p-6 sm:p-8 relative'>

                    {/* Modal Header */}
                    <div className='flex justify-between items-center border-b border-gray-100 pb-4 mb-6'>
                        <h1 className='text-2xl font-bold text-gray-800'>Edit Profile</h1>
                        <button 
                            onClick={()=> {
                                console.log("🔴 Close button clicked");
                                setShowEdit(false);
                            }} 
                            type='button' 
                            className='text-gray-500 hover:text-gray-800 p-2 rounded-full hover:bg-gray-100 transition'
                            aria-label="Close modal"
                        >
                            <X className='w-6 h-6' />
                        </button>
                    </div>

                    <form className='space-y-6' onSubmit={(e) => {
                        e.preventDefault();
                        toast.promise(
                            handleSaveProfile(e), 
                            {
                                loading: 'Saving changes...',
                                success: () => 'Profile updated!',
                                error: (err) => err.message || 'Error saving profile',
                            }
                        );
                    }}>
                        
                        {/* Image Upload Area */}
                        <div className='space-y-6'>
                            
                            {/* Cover Photo Input */}
                            <div className='relative'>
                                <label htmlFor="cover_photo" className="block text-sm font-semibold text-gray-700 mb-2 cursor-pointer">
                                    Cover Photo
                                </label>
                                <input 
                                    hidden 
                                    type="file" 
                                    accept="image/*" 
                                    id="cover_photo" 
                                    onChange={(e)=>setEditForm({...editForm, cover_photo: e.target.files[0]})}
                                />
                                <label htmlFor="cover_photo" className='cursor-pointer'>
                                    <div className='group/cover relative w-full h-40 bg-gray-100 rounded-xl overflow-hidden shadow-inner border border-gray-200'>
                                        <img 
                                            src={getImageUrl(editForm.cover_photo, user.cover_photo)} 
                                            alt="Cover Preview" 
                                            className='w-full h-full object-cover transition-opacity duration-300 group-hover/cover:opacity-80'
                                            onError={(e) => { e.target.src = 'https://via.placeholder.com/600x200?text=Select+Cover+Photo'; }}
                                        />
                                        <div className='absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-opacity duration-300'>
                                            <Pencil className="w-6 h-6 text-white"/>
                                        </div>
                                    </div>
                                </label>
                            </div>

                            {/* Profile Picture Input */}
                            <div className='relative -mt-16 ml-6'>
                                <label htmlFor="profile_picture" className='block cursor-pointer'>
                                    <input 
                                        hidden 
                                        type="file" 
                                        accept="image/*" 
                                        id="profile_picture" 
                                        onChange={(e)=>setEditForm({...editForm, profile_picture: e.target.files[0]})}
                                    />
                                    <div className='group/profile relative w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg transition-transform hover:scale-105'>
                                        <img 
                                            src={getImageUrl(editForm.profile_picture, user.profile_picture)} 
                                            alt="Profile Preview" 
                                            className='w-full h-full object-cover'
                                            onError={(e) => { e.target.src = 'https://via.placeholder.com/100?text=P'; }}
                                        />
                                        <div className='absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover/profile:opacity-100 transition-opacity duration-300'>
                                            <Pencil className="w-5 h-5 text-white"/>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">Click to change</p>
                                </label>
                            </div>

                        </div>

                        {/* Form Fields */}
                        <div className="pt-4 space-y-4">
                            {/* Full Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                <input 
                                    type="text" 
                                    className='w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors' 
                                    placeholder='Enter your full name' 
                                    onChange={(e)=>setEditForm({...editForm, full_name: e.target.value})} 
                                    value={editForm.full_name}
                                    required
                                />
                            </div>

                            {/* Username */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                                <input 
                                    type="text" 
                                    className='w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors' 
                                    placeholder='Enter a unique username' 
                                    onChange={(e)=>setEditForm({...editForm, username: e.target.value})} 
                                    value={editForm.username}
                                    required
                                />
                            </div>

                            {/* Bio */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                                <textarea 
                                    rows={3} 
                                    className='w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none transition-colors' 
                                    placeholder='Share a short bio about yourself' 
                                    onChange={(e)=>setEditForm({...editForm, bio: e.target.value})} 
                                    value={editForm.bio}
                                    maxLength={160}
                                />
                                <p className='text-xs text-gray-500 text-right'>{editForm.bio.length}/160</p>
                            </div>

                            {/* Location */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                                <input 
                                    type="text" 
                                    className='w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors' 
                                    placeholder='e.g., San Francisco, CA' 
                                    onChange={(e)=>setEditForm({...editForm, location: e.target.value})} 
                                    value={editForm.location}
                                />
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className='flex justify-end space-x-3 pt-4 border-t border-gray-100'>
                            <button 
                                onClick={()=> setShowEdit(false)} 
                                type='button' 
                                className='px-5 py-2.5 border border-gray-300 rounded-full text-gray-700 font-medium hover:bg-gray-100 transition-colors shadow-sm'
                            >
                                Cancel
                            </button>

                            <button 
                                type='submit' 
                                className='px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-700 text-white rounded-full font-semibold hover:from-indigo-700 hover:to-purple-800 transition shadow-lg active:scale-95'
                            >
                                Save Changes
                            </button>
                        </div>

                    </form>
                </div>
            </div>
        </div>
    )
}

export default ProfileModal