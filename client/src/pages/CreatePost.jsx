import React, { useState, useRef } from 'react'
import { Image, X, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSelector } from "react-redux";
import { useAuth } from '@clerk/clerk-react';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';

const CreatePost = () => {

  const navigate = useNavigate()
  const [content, setContent] = useState('')
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(false)
  
  // Ref for auto-sizing textarea
  const textareaRef = useRef(null)

  const user = useSelector((state)=>state.user.value)

  const  { getToken } = useAuth()
  
  // Handle content change and resize textarea
  const handleContentChange = (e) => {
    setContent(e.target.value)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto' // Reset height to recalculate
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }

  // Handle image selection
  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    // Limit to 4 images total
    if (images.length + files.length > 4) {
        toast.error('Maximum 4 images allowed per post.');
        return;
    }
    setImages([...images, ...files])
  }

  // Handle image removal
  const handleImageRemove = (index) => {
    setImages(images.filter((_, i) => i !== index));
  }
  
  // Submit function (unchanged core logic)
  const handleSubmit = async () => {
    if(!images.length && !content.trim()){ // Use trim for content check
      return toast.error('Please add at least one image or some text.')
    }
    setLoading(true)

    const postType = images.length && content.trim() ? 'text_with_image' : images.length ? 'image' : 'text'

    try {
      const formData = new FormData();
      formData.append('content', content)
      formData.append('post_type', postType)
      images.forEach((image) =>{ // Use forEach for clarity
        formData.append('images', image)
      })

      const token = await getToken();
      const { data } = await api.post('/api/post/add', formData, {headers: { Authorization: `Bearer ${token}`}})

      if (data.success) {
        navigate('/')
      }else{
        console.error(data.message)
        throw new Error(data.message)
      }
    } catch (error) {
      console.error(error.message)
      throw new Error(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='min-h-screen bg-gray-50 pb-12'>
      <div className='max-w-6xl mx-auto p-4 sm:p-6'>
         {/* Header Title */}
         <div className='mb-8 mt-4'>
          <h1 className='text-3xl font-extrabold text-gray-800 mb-1'>New Post</h1>
          <p className='text-gray-500'>Share your thoughts, photos, and updates.</p>
         </div>

         {/* Form Card */}
         <div className='max-w-xl mx-auto bg-white p-6 sm:p-8 rounded-2xl shadow-xl border border-gray-100 space-y-5'>
            {/* User Info Header */}
            <div className='flex items-center gap-3 pb-4 border-b border-gray-100'>
              <img 
                src={user.profile_picture || '/default-avatar.png'} // Added fallback
                alt={user.full_name} 
                className='w-14 h-14 rounded-full shadow-lg border-2 border-indigo-500'
              />
              <div>
                <h2 className='font-bold text-lg text-gray-800'>{user.full_name}</h2>
                <p className='text-sm text-indigo-500'>@{user.username}</p>
              </div>
            </div>

            {/* Text Area (Self-resizing, clean focus) */}
            <textarea 
                ref={textareaRef}
                className='w-full resize-none min-h-[5rem] max-h-[15rem] text-lg font-medium outline-none placeholder-gray-400 focus:ring-2 focus:ring-indigo-200 p-2 rounded-lg transition-shadow duration-300' 
                placeholder="What's on your mind?..." 
                onChange={handleContentChange} 
                value={content}
            />

             {/* Images Preview */}
             {
              images.length > 0 && (
                <div className={`grid gap-3 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} ${images.length > 2 && 'sm:grid-cols-3'}`}>
                  {images.map((image, i)=>(
                    <div key={i} className='relative aspect-square overflow-hidden rounded-xl shadow-lg'>
                      <img 
                        src={URL.createObjectURL(image)} 
                        className='w-full h-full object-cover transition-transform duration-300 hover:scale-[1.03]' 
                        alt={`Preview ${i}`} 
                      />
                      {/* Stylish Delete Button */}
                      <button 
                        onClick={() => handleImageRemove(i)} 
                        className='absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-600 transition rounded-full text-white shadow-xl backdrop-blur-sm'
                        title="Remove image"
                      >
                        <X className="w-4 h-4"/>
                      </button>
                    </div>
                  ))}
                </div>
              )
             }
             {/* Image Limit Info */}
             {images.length < 4 && (
                <p className='text-xs text-gray-400 text-right'>
                    {images.length}/4 images selected
                </p>
             )}


              {/* Bottom Action Bar */}
              <div className='flex items-center justify-between pt-4'>
                
                {/* Image Upload Button */}
                <label 
                    htmlFor="images" 
                    className='flex items-center gap-2 text-md text-indigo-600 hover:text-indigo-800 transition cursor-pointer p-2 rounded-lg hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed'
                    title={images.length >= 4 ? "Maximum 4 images" : "Add photos"}
                >
                  <Image className='size-6'/>
                  <span className='hidden sm:inline font-medium'>Add Photos</span>
                </label>

                <input 
                    type="file" 
                    id="images" 
                    accept='image/*' 
                    hidden 
                    multiple 
                    onChange={handleImageSelect}
                    disabled={images.length >= 4}
                />

                {/* Publish Button */}
                <button 
                    disabled={loading || (!images.length && !content.trim())} 
                    onClick={() => toast.promise(
                        handleSubmit(), 
                        {
                            loading: 'Publishing post...',
                            success: 'Post published successfully! 🎉',
                            error: 'Failed to publish post. Try again.',
                        }
                    )} 
                    className='flex items-center gap-2 text-md bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 active:scale-[0.98] transition text-white font-semibold px-6 py-2.5 rounded-full shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed'
                >
                    <Send className='w-4 h-4'/>
                    {loading ? 'Publishing...' : 'Publish Post'}
                </button>
              </div>
         </div>
      </div>
    </div>
  )
}

export default CreatePost