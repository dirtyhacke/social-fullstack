import React from 'react'
import { MapPin, MessageCircle, Plus, UserPlus, Send } from 'lucide-react'
import { useDispatch, useSelector } from 'react-redux'
import { useAuth } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { fetchUser } from '../features/user/userSlice'

const UserCard = ({user}) => {

    const currentUser = useSelector((state) => state.user.value)
    const {getToken} = useAuth()
    const dispatch = useDispatch()
    const navigate = useNavigate()

    const isFollowing = currentUser?.following.includes(user._id);
    const isConnected = currentUser?.connections.includes(user._id);

    // --- API Handlers (Kept logic stable) ---

    const handleFollow = async () => {
        try {
            const { data } = await api.post('/api/user/follow', {id: user._id}, {
                headers: { Authorization: `Bearer ${await getToken()}` }
            })
            if (data.success) {
                toast.success(data.message)
                dispatch(fetchUser(await getToken())) // Refresh current user's data
            }else{
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        }
    }

    const handleConnectionRequest = async () => {
        if(isConnected){
            // If already connected, navigate to message thread
            return navigate('/messages/' + user._id)
        }

        try {
            const { data } = await api.post('/api/user/connect', {id: user._id}, {
                headers: { Authorization: `Bearer ${await getToken()}` }
            })
            if (data.success) {
                toast.success(data.message)
            }else{
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        }
    }

  return (
    // Card with enhanced styling: wider, rounded, and a cleaner shadow
    <div key={user._id} className='p-6 flex flex-col items-center justify-between w-full max-w-sm mx-auto bg-white shadow-xl border border-gray-100 rounded-2xl transition-all duration-300 hover:shadow-2xl'>
        
        {/* Profile Info Section */}
        <div className='text-center w-full'>
            {/* Avatar - Larger and more prominent with a ring */}
            <img 
                src={user.profile_picture || 'https://via.placeholder.com/150?text=User'} 
                alt={user.full_name} 
                className='rounded-full w-20 h-20 object-cover shadow-lg ring-4 ring-indigo-100 mx-auto'
            />
            
            {/* Name and Username */}
            <p className='mt-4 text-xl font-bold text-gray-800 leading-tight'>{user.full_name}</p>
            {user.username && <p className='text-indigo-600 font-medium'>@{user.username}</p>}
            
            {/* Bio */}
            {user.bio && (
                <p className='text-gray-600 mt-2 text-center text-sm px-2 italic line-clamp-2'>
                    {user.bio}
                </p>
            )}
        </div>

        {/* Details/Stats Section */}
        <div className='flex flex-wrap items-center justify-center gap-3 mt-4 text-xs text-gray-500'>
            {user.location && (
                <div className='flex items-center gap-1 bg-gray-50 text-gray-600 rounded-full px-3 py-1 shadow-sm'>
                    <MapPin className='w-3 h-3'/> {user.location}
                </div>
            )}
            <div className='flex items-center gap-1 bg-gray-50 text-gray-600 rounded-full px-3 py-1 shadow-sm'>
                <span className='font-semibold'>{user.followers.length}</span> Followers
            </div>
        </div>

        {/* Action Buttons */}
        <div className='flex mt-6 gap-3 w-full'>
            
            {/* Follow Button (Primary Action) */}
            <button 
                onClick={handleFollow} 
                disabled={isFollowing} 
                className={`flex-1 py-2 rounded-full flex justify-center items-center gap-2 font-semibold transition text-white shadow-md active:scale-[0.98] ${
                    isFollowing
                        ? 'bg-gray-400 hover:bg-gray-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 cursor-pointer'
                }`}
            >
                {isFollowing ? (
                    'Following'
                ) : (
                    <>
                        <UserPlus className='w-4 h-4'/> Follow
                    </>
                )}
            </button>
            
            {/* Connection/Message Button (Secondary Action) */}
            <button 
                onClick={handleConnectionRequest} 
                className={`w-12 h-12 flex items-center justify-center rounded-full transition shadow-md active:scale-[0.98] ${
                    isConnected
                        ? 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title={isConnected ? "Message" : "Connect"}
            >
                {
                    isConnected ? 
                    <Send className='w-5 h-5'/>
                    :
                    <Plus className='w-5 h-5'/>
                }
            </button>
        </div>
    </div>
  )
}

export default UserCard
