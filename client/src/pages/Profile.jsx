import React, { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
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
import { useSelector, useDispatch } from 'react-redux'
import { fetchConnections } from '../features/connections/connectionsSlice'
import { fetchUser } from '../features/user/userSlice'
import { BluetoothIcon, Lock } from 'lucide-react'

const Profile = () => {

  const currentUser = useSelector((state) => state.user.value)
  const connections = useSelector((state) => state.connections)
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const {getToken} = useAuth()
  const {profileId} = useParams()
  const [user, setUser] = useState(null)
  const [posts, setPosts] = useState([])
  const [activeTab, setActiveTab] = useState('posts')
  const [showEdit, setShowEdit] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [localIsFollowing, setLocalIsFollowing] = useState(false)
  const [followRequestStatus, setFollowRequestStatus] = useState('none') // 'none', 'requested', 'accepted'

  const isOwnProfile = !profileId || profileId === currentUser?._id
  
  // Use local state for immediate UI updates
  const isFollowing = localIsFollowing || currentUser?.following?.includes(user?._id)
  const isConnected = connections.connections?.some(conn => 
    conn._id === user?._id || conn.from_user_id === user?._id || conn.to_user_id === user?._id
  )
  const hasPendingRequest = connections.pendingConnections?.some(conn => 
    conn.from_user_id === user?._id || conn.to_user_id === user?._id
  )

  // Filter posts for different tabs
  const mediaPosts = posts.filter(post => post?.image_urls && post.image_urls.length > 0)
  const likedPosts = posts.filter(post => post?.likes && post.likes.includes(currentUser?._id))

  const fetchUserData = async (profileId) => {
    const token = await getToken()
    try {
      // Fetch user profile
      const { data: profileData } = await api.post(`/api/user/profiles`, {profileId}, {
        headers: {Authorization: `Bearer ${token}`}
      })
      
      if(profileData.success){
        setUser(profileData.profile)
        // Update local following state based on fetched user data
        setLocalIsFollowing(currentUser?.following?.includes(profileData.profile._id))
        
        // Check follow request status for private accounts
        if (profileData.profile.settings?.profilePrivacy === 'private' && 
            profileId !== currentUser?._id &&
            !profileData.profile.followers?.includes(currentUser?._id)) {
          // Check if there's a pending follow request
          const { data: followRequests } = await api.get(`/api/user/follow-requests`, {
            headers: { Authorization: `Bearer ${token}` }
          })
          if (followRequests.success) {
            const hasPendingFollow = followRequests.requests.some(req => 
              req.fromUserId === currentUser?._id && req.toUserId === profileId && req.status === 'pending'
            )
            setFollowRequestStatus(hasPendingFollow ? 'requested' : 'none')
          }
        } else {
          setFollowRequestStatus('accepted')
        }
        
        // Fetch posts with privacy check using the new endpoint
        const { data: postsData } = await api.post('/api/post/profile-posts', { profileId }, {
          headers: { Authorization: `Bearer ${token}` }
        })
        
        if (postsData.success) {
          console.log('Fetched posts:', postsData.posts)
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

  const handleFollow = async () => {
    if (!user?._id) return
    
    setIsLoading(true)
    try {
      const token = await getToken()
      
      // For private accounts, send follow request instead of immediate follow
      if (user.settings?.profilePrivacy === 'private' && !isOwnProfile) {
        const { data } = await api.post('/api/user/follow-request', {targetUserId: user._id}, {
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
        const { data } = await api.post('/api/user/follow', {id: user._id}, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (data.success) {
          toast.success(data.message)
          // Update local state immediately
          setLocalIsFollowing(true)
          setFollowRequestStatus('accepted')
          // Refresh current user data to update following list
          await dispatch(fetchUser(token))
          // Refresh user profile data
          await fetchUserData(user._id)
        } else {
          toast.error(data.message)
        }
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUnfollow = async () => {
    if (!user?._id) return
    
    setIsLoading(true)
    try {
      const token = await getToken()
      
      // For private accounts with pending requests, cancel the request
      if (followRequestStatus === 'requested') {
        const { data } = await api.post('/api/user/cancel-follow-request', {targetUserId: user._id}, {
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
        const { data } = await api.post('/api/user/unfollow', {id: user._id}, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (data.success) {
          toast.success(data.message)
          // Update local state immediately
          setLocalIsFollowing(false)
          setFollowRequestStatus('none')
          // Refresh current user data to update following list
          await dispatch(fetchUser(token))
          // Refresh user profile data
          await fetchUserData(user._id)
        } else {
          toast.error(data.message)
        }
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleConnectionRequest = async () => {
    if (isLoading || !user?._id) return
    
    setIsLoading(true)

    if(isConnected){
      setIsLoading(false)
      // Navigate to messages if connected
      return navigate('/messages/' + user._id)
    }

    if(hasPendingRequest) {
      // Accept the pending request
      try {
        const token = await getToken()
        const { data } = await api.post('/api/user/accept', {id: user._id}, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (data.success) {
          toast.success('Connection accepted!')
          // Refresh connections
          dispatch(fetchConnections(token))
        } else {
          toast.error(data.message)
        }
      } catch (error) {
        toast.error(error.message)
      } finally {
        setIsLoading(false)
      }
      return
    }

    try {
      const token = await getToken()
      const { data } = await api.post('/api/user/connect', {id: user._id}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (data.success) {
        toast.success(data.message)
        // Refresh connections to show pending state
        dispatch(fetchConnections(token))
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(()=>{
    if(profileId){
      fetchUserData(profileId)
    } else if(currentUser?._id) {
      fetchUserData(currentUser._id)
    }
  },[profileId, currentUser])

  // Update local following state when user data changes
  useEffect(() => {
    if (user && currentUser) {
      setLocalIsFollowing(currentUser.following?.includes(user._id))
    }
  }, [user, currentUser])

  // Load connections when component mounts
  useEffect(() => {
    const loadConnections = async () => {
      if (currentUser) {
        const token = await getToken()
        dispatch(fetchConnections(token))
      }
    }
    loadConnections()
  }, [currentUser, dispatch, getToken])

  // Check if profile is private and user doesn't have access
  const isPrivateProfile = user?.settings?.profilePrivacy === 'private' && 
                          profileId && 
                          profileId !== currentUser?._id && 
                          !user?.followers?.includes(currentUser?._id) &&
                          followRequestStatus !== 'accepted'

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
                  {followRequestStatus === 'requested' ? (
                    <button 
                      onClick={handleUnfollow}
                      disabled={isLoading}
                      className='px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200 font-medium text-sm flex items-center gap-2 disabled:opacity-50'
                    >
                      Requested
                    </button>
                  ) : (
                    <button 
                      onClick={handleFollow}
                      disabled={isLoading}
                      className='px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 font-medium text-sm flex items-center gap-2 disabled:opacity-50'
                    >
                      Follow
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Private Account Message */}
          <div className='mt-6 bg-white rounded-2xl shadow p-8 text-center'>
            <div className='text-6xl mb-4'><Lock/></div>
            <h2 className='text-2xl font-bold text-gray-900 mb-2'>This account is private</h2>
            <p className='text-gray-600 mb-4'>Follow this account to see their photos and videos.</p>
            {followRequestStatus === 'requested' ? (
              <div className="space-y-3">
                <button 
                  onClick={handleUnfollow}
                  disabled={isLoading}
                  className='px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200 font-medium flex items-center gap-2 mx-auto disabled:opacity-50'
                >
                  Requested
                </button>
                <p className="text-sm text-gray-500">Waiting for approval</p>
              </div>
            ) : (
              <button 
                onClick={handleFollow}
                disabled={isLoading}
                className='px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 font-medium flex items-center gap-2 mx-auto disabled:opacity-50'
              >
                Follow
              </button>
            )}
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
            isOwnProfile={isOwnProfile}
            isFollowing={isFollowing}
            isConnected={isConnected}
            hasPendingRequest={hasPendingRequest}
            followRequestStatus={followRequestStatus}
            onFollow={handleFollow}
            onUnfollow={handleUnfollow}
            onConnectionRequest={handleConnectionRequest}
            isLoading={isLoading}
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

          {/* Media */}
          {activeTab === 'media' && (
            <div className='mt-6'>
              {mediaPosts.length > 0 ? (
                <div className='flex flex-wrap gap-2 justify-center'>
                  {mediaPosts.map((post) => (
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
                            onError={(e) => {
                              e.target.src = 'https://via.placeholder.com/256x192?text=Image+Not+Found'
                            }}
                          />
                          <p className='absolute bottom-0 right-0 text-xs p-1 px-3 backdrop-blur-xl text-white opacity-0 group-hover:opacity-100 transition duration-300 rounded-tl-lg'>
                            Posted {moment(post.createdAt).fromNow()}
                          </p>
                        </Link>
                      ))}
                    </React.Fragment>
                  ))}
                </div>
              ) : (
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
            <div className='mt-6'>
              {likedPosts.length > 0 ? (
                <div className='flex flex-col items-center gap-6'>
                  {likedPosts.map((post) => <PostCard key={post._id} post={post}/>)}
                </div>
              ) : (
                <div className="w-full text-center py-12 text-gray-500">
                  <div className="text-6xl mb-4">❤️</div>
                  <p className="text-lg font-medium">No liked posts yet</p>
                  <p className="text-sm text-gray-400 mt-2">
                    {isOwnProfile 
                      ? "Posts you like will appear here" 
                      : "This user hasn't liked any posts yet"
                    }
                  </p>
                </div>
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