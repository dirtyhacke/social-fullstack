import React, { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { dummyPostsData, dummyUserData } from '../assets/assets'
import { useEffect } from 'react'
import Loading from '../components/Loading'
import UserProfileInfo from '../components/UserProfileInfo'
import PostCard from '../components/PostCard'
import moment from 'moment'
import ProfileModal from '../components/ProfileModal'
import ProfileSettingsModal from '../components/ProfileSettingsModal'
import { useAuth } from '@clerk/clerk-react'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { useSelector } from 'react-redux'

const Profile = () => {

  const currentUser = useSelector((state) => state.user.value)

  const {getToken} = useAuth()
  const {profileId} = useParams()
  const [user, setUser] = useState(null)
  const [posts, setPosts] = useState([])
  const [activeTab, setActiveTab] = useState('posts')
  const [showEdit, setShowEdit] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const fetchUser = async (profileId) => {
    const token = await getToken()
    try {
      // Fetch user profile
      const { data: profileData } = await api.post(`/api/user/profiles`, {profileId}, {
        headers: {Authorization: `Bearer ${token}`}
      })
      
      if(profileData.success){
        setUser(profileData.profile)
        
        // Fetch posts with privacy check using the new endpoint
        const { data: postsData } = await api.post('/api/post/profile-posts', { profileId }, {
          headers: { Authorization: `Bearer ${token}` }
        })
        
        if (postsData.success) {
          setPosts(postsData.posts)
        } else {
          toast.error(postsData.message)
          setPosts([])
        }
      }else{
        toast.error(profileData.message)
      }
    } catch (error) {
      toast.error(error.message)
    }
  }

  useEffect(()=>{
    if(profileId){
      fetchUser(profileId)
    }else{
      fetchUser(currentUser._id)
    }
  },[profileId, currentUser])

  // Check if profile is private and user doesn't have access
  const isPrivateProfile = user?.settings?.profilePrivacy === 'private' && 
                          profileId && 
                          profileId !== currentUser?._id && 
                          !user?.followers?.includes(currentUser?._id)

  // Show private profile message
  if (isPrivateProfile) {
    return (
      <div className='relative h-full overflow-y-scroll bg-gray-50 p-6'>
        <div className='max-w-3xl mx-auto'>
          <div className='bg-white rounded-2xl shadow overflow-hidden'>
            {/* Cover Photo */}
            <div className='h-40 md:h-56 bg-gradient-to-r from-indigo-200 via-purple-200 to-pink-200'>
              {user.cover_photo && <img src={user.cover_photo} alt='' className='w-full h-full object-cover'/>}
            </div>
            
            {/* Private Profile Message */}
            <div className='px-6 pb-6 -mt-16 relative'>
              <div className='flex flex-col md:flex-row md:items-end md:justify-between'>
                <div className='flex flex-col md:flex-row md:items-end space-y-4 md:space-y-0 md:space-x-6'>
                  {/* Default Avatar */}
                  <div className='relative'>
                    <div className='w-32 h-32 rounded-2xl border-4 border-white shadow-lg bg-gray-200 flex items-center justify-center'>
                      <svg className='w-16 h-16 text-gray-400' fill='currentColor' viewBox='0 0 24 24'>
                        <path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/>
                      </svg>
                    </div>
                  </div>
                  
                  {/* User Details */}
                  <div className='space-y-2'>
                    <h1 className='text-2xl md:text-3xl font-bold text-gray-900'>
                      {user.full_name}
                    </h1>
                    <p className='text-gray-600'>@{user.username}</p>
                    <p className='text-gray-700 max-w-md'>This account is private</p>
                    
                    {/* Stats */}
                    <div className='flex space-x-6 pt-2'>
                      <div className='text-center'>
                        <span className='block font-bold text-gray-900'>-</span>
                        <span className='text-sm text-gray-600'>Posts</span>
                      </div>
                      <div className='text-center'>
                        <span className='block font-bold text-gray-900'>-</span>
                        <span className='text-sm text-gray-600'>Followers</span>
                      </div>
                      <div className='text-center'>
                        <span className='block font-bold text-gray-900'>-</span>
                        <span className='text-sm text-gray-600'>Following</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Follow Button */}
                <div className='flex space-x-3 mt-4 md:mt-0'>
                  <button className='px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 font-medium text-sm'>
                    Follow
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Private Account Message */}
          <div className='mt-6 bg-white rounded-2xl shadow p-8 text-center'>
            <div className='text-6xl mb-4'>🔒</div>
            <h2 className='text-2xl font-bold text-gray-900 mb-2'>This account is private</h2>
            <p className='text-gray-600 mb-4'>Follow this account to see their photos and videos.</p>
            <button className='px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 font-medium'>
              Follow
            </button>
          </div>
        </div>
      </div>
    )
  }

  return user ? (
    <div className='relative h-full overflow-y-scroll bg-gray-50 p-6'>
      <div className='max-w-3xl mx-auto'>
        {/* Profile Card */}
        <div className='bg-white rounded-2xl shadow overflow-hidden'>
          {/* Cover Photo */}
          <div className='h-40 md:h-56 bg-gradient-to-r from-indigo-200 via-purple-200 to-pink-200'>
            {user.cover_photo && <img src={user.cover_photo} alt='' className='w-full h-full object-cover'/>}
          </div>
          {/* User Info */}
          <UserProfileInfo 
            user={user} 
            posts={posts} 
            profileId={profileId} 
            setShowEdit={setShowEdit}
            setShowSettings={setShowSettings}
          />
        </div>

        {/* Tabs */}
        <div className='mt-6'>
          <div className='bg-white rounded-xl shadow p-1 flex max-w-md mx-auto'>
            {["posts", "media", "likes"].map((tab)=>(
              <button 
                onClick={()=> setActiveTab(tab)} 
                key={tab} 
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer ${
                  activeTab === tab 
                    ? "bg-green-600 text-white shadow-md" 
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          
          {/* Posts */}
          {activeTab === 'posts' && (
            <div className='mt-6 flex flex-col items-center gap-6'>
              {posts.length > 0 ? (
                posts.map((post)=> <PostCard key={post._id} post={post}/>)
              ) : (
                <div className="w-full text-center py-12 text-gray-500">
                  <div className="text-6xl mb-4">📝</div>
                  <p className="text-lg font-medium">No posts yet</p>
                  <p className="text-sm text-gray-400 mt-2">When you create posts, they will appear here</p>
                </div>
              )}
            </div>
          )}

          {/* Media - FIXED VERSION */}
          {activeTab === 'media' && (
            <div className='flex flex-wrap mt-6 max-w-6xl gap-2 justify-center'>
              {
                posts
                  .filter((post) => post?.image_urls && post.image_urls.length > 0)
                  .map((post) => (
                    <React.Fragment key={post._id}>
                      {post.image_urls.map((image, index) => (
                        <Link 
                          target='_blank' 
                          to={image} 
                          key={`${post._id}-${index}`} 
                          className='relative group transition-transform duration-200 hover:scale-105'
                        >
                          <img 
                            src={image} 
                            className='w-64 h-48 object-cover rounded-lg shadow-md' 
                            alt={`Post media ${index + 1}`} 
                          />
                          <p className='absolute bottom-0 right-0 text-xs p-1 px-3 backdrop-blur-xl text-white opacity-0 group-hover:opacity-100 transition duration-300 rounded-tl-lg'>
                            Posted {moment(post.createdAt).fromNow()}
                          </p>
                        </Link>
                      ))}
                    </React.Fragment>
                  ))
              }
              {posts.filter((post) => post?.image_urls && post.image_urls.length > 0).length === 0 && (
                <div className="w-full text-center py-12 text-gray-500">
                  <div className="text-6xl mb-4">📷</div>
                  <p className="text-lg font-medium">No media posts yet</p>
                  <p className="text-sm text-gray-400 mt-2">When you post images, they will appear here</p>
                </div>
              )}
            </div>
          )}

          {/* Likes */}
          {activeTab === 'likes' && (
            <div className='mt-6 flex flex-col items-center gap-6'>
              {posts.filter(post => post.likes && post.likes.length > 0).length === 0 ? (
                <div className="w-full text-center py-12 text-gray-500">
                  <div className="text-6xl mb-4">❤️</div>
                  <p className="text-lg font-medium">No liked posts yet</p>
                  <p className="text-sm text-gray-400 mt-2">Posts you like will appear here</p>
                </div>
              ) : (
                posts
                  .filter(post => post.likes && post.likes.length > 0)
                  .map((post) => <PostCard key={post._id} post={post}/>)
              )}
            </div>
          )}
        
        </div>
      </div>
      {/* Edit Profile Modal */}
      {showEdit && <ProfileModal setShowEdit={setShowEdit}/>}
      
      {/* Settings Modal */}
      {showSettings && <ProfileSettingsModal setShowSettings={setShowSettings} user={user} />}
    </div>
  ) : (<Loading />)
}

export default Profile