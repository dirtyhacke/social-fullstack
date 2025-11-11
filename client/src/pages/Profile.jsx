import React, { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { dummyPostsData, dummyUserData } from '../assets/assets'
import { useEffect } from 'react'
import Loading from '../components/Loading'
import UserProfileInfo from '../components/UserProfileInfo'
import PostCard from '../components/PostCard'
import moment from 'moment'
import ProfileModal from '../components/ProfileModal'
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

  const fetchUser = async (profileId) => {
    const token = await getToken()
    try {
      const { data } = await api.post(`/api/user/profiles`, {profileId}, {
        headers: {Authorization: `Bearer ${token}`}
      })
      if(data.success){
        setUser(data.profile)
        setPosts(data.posts)
      }else{
        toast.error(data.message)
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
          <UserProfileInfo user={user} posts={posts} profileId={profileId} setShowEdit={setShowEdit}/>
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
              {posts.map((post)=> <PostCard key={post._id} post={post}/>)}
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
    </div>
  ) : (<Loading />)
}

export default Profile