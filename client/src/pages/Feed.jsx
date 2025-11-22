import React, { useEffect, useState } from 'react'
import { assets, dummyPostsData } from '../assets/assets'
import Loading from '../components/Loading'
import StoriesBar from '../components/StoriesBar'
import PostCard from '../components/PostCard'
import RecentMessages from '../components/RecentMessages'
import { useAuth } from '@clerk/clerk-react'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { Zap, CornerDownRight } from 'lucide-react'

const Feed = () => {

  const [feeds, setFeeds] = useState([])
  const [loading, setLoading] = useState(true)
  const {getToken} = useAuth()

  const fetchFeeds = async () => {
    try {
      setLoading(true)
      const {data} = await api.get('/api/post/feed', {
        headers: { Authorization: `Bearer ${await getToken()}` }
      })

      if (data.success){
        setFeeds(data.posts)
        console.log(`✅ Loaded ${data.posts.length} posts in feed`)
      }else{
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    }
    setLoading(false)
  }

  useEffect(()=>{
    fetchFeeds()
  },[])

  return !loading ? (
    <div className='max-w-7xl mx-auto py-6 sm:py-10 px-4 md:px-6 flex justify-center items-start gap-8'>
      
      {/* Main Content Column */}
      <div className='flex flex-col w-full max-w-xl flex-shrink-0'>
        
        {/* Stories Bar */}
        <div className='mb-6'>
            <StoriesBar />
        </div>

        {/* Post Feed */}
        <div className='space-y-6'>
          {feeds.length > 0 ? (
            feeds.map((post)=>(
              <PostCard key={post._id} post={post}/>
            ))
          ) : (
            <div className="p-8 text-center bg-white rounded-xl shadow-lg border border-gray-100 mt-10">
                <p className="text-xl font-semibold text-gray-700">No posts in your feed yet.</p>
                <p className="text-gray-500 mt-2">Follow more people to see content here!</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar */}
      <div className='hidden xl:block w-full max-w-xs'>
        <div className='sticky top-20 flex flex-col gap-6'>
          
          {/* Sponsored Ad Card */}
          <div className='bg-white p-5 rounded-xl border border-indigo-100 shadow-lg'>
            <h3 className='flex items-center gap-2 text-indigo-600 font-bold text-sm mb-3 uppercase'>
                <Zap className='w-4 h-4'/> Sponsored
            </h3>
            
            {/* Ad Image */}
            <img 
                src={assets.sponsored_img} 
                className='w-full h-auto object-cover rounded-lg mb-3 border border-gray-100' 
                alt="Sponsored content" 
            />
            
            {/* Ad Text */}
            <div>
                <p className='text-slate-800 font-semibold text-md mb-1'>Email Marketing Platform</p>
                <p className='text-slate-500 text-sm'>Supercharge your marketing with a powerful, easy-to-use platform built for results.</p>
            </div>

            {/* Call to Action */}
            <button className='mt-4 w-full flex items-center justify-center gap-2 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-semibold transition duration-200'>
                Learn More <CornerDownRight className='w-4 h-4'/>
            </button>
          </div>
          
          {/* Recent Messages Component */}
          <RecentMessages />
          
        </div>
      </div>
    </div>
  ) : <Loading />
}

export default Feed