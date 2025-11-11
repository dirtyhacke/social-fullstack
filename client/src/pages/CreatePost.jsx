import React, { useState, useRef, useEffect } from 'react'
import { Image, Video, X, Send, Loader } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSelector } from "react-redux";
import { useAuth } from '@clerk/clerk-react';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';

const CreatePost = () => {
  const navigate = useNavigate()
  const [content, setContent] = useState('')
  const [media, setMedia] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)

  const user = useSelector((state) => state.user.value)
  const { getToken } = useAuth()

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [content])

  const handleContentChange = (e) => {
    setContent(e.target.value)
  }

  // Handle media selection (images + videos)
  const handleMediaSelect = (e) => {
    const files = Array.from(e.target.files)
    
    // Check total media count
    if (media.length + files.length > 4) {
      toast.error('Maximum 4 media files allowed per post.')
      return
    }

    // Validate file types and sizes
    const validFiles = files.filter(file => {
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        if (file.size > 50 * 1024 * 1024) { // 50MB limit
          toast.error(`File "${file.name}" is too large. Max 50MB.`)
          return false
        }
        return true
      } else {
        toast.error(`File "${file.name}" is not a supported image or video.`)
        return false
      }
    })

    setMedia([...media, ...validFiles])
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Handle media removal
  const handleMediaRemove = (index) => {
    setMedia(media.filter((_, i) => i !== index))
  }

  // Get media type for styling
  const getMediaType = (file) => {
    return file.type.startsWith('video/') ? 'video' : 'image'
  }

  // Submit function with progress tracking
  const handleSubmit = async () => {
    if (!media.length && !content.trim()) {
      toast.error('Please add some content or media to your post.')
      return
    }

    setLoading(true)
    setUploadProgress(0)

    const postType = media.length && content.trim() 
      ? 'text_with_media' 
      : media.length 
        ? 'media' 
        : 'text'

    try {
      const formData = new FormData()
      formData.append('content', content)
      formData.append('post_type', postType)
      
      media.forEach((file) => {
        formData.append('media', file) // Changed from 'images' to 'media'
      })

      const token = await getToken()
      
      const { data } = await api.post('/api/post/add', formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          )
          setUploadProgress(progress)
        }
      })

      if (data.success) {
        toast.success('Post published successfully! 🎉')
        // Reset form
        setContent('')
        setMedia([])
        setUploadProgress(0)
        // Navigate after a short delay for better UX
        setTimeout(() => navigate('/'), 1000)
      } else {
        throw new Error(data.message)
      }
    } catch (error) {
      console.error('Error publishing post:', error)
      toast.error(error.message || 'Failed to publish post. Please try again.')
    } finally {
      setLoading(false)
      setUploadProgress(0)
    }
  }

  // Group media by type for better layout
  const hasVideos = media.some(file => getMediaType(file) === 'video')
  const mediaLayoutClass = media.length === 1 
    ? 'grid-cols-1' 
    : media.length === 2 || (media.length === 3 && hasVideos)
      ? 'grid-cols-2'
      : 'grid-cols-2 sm:grid-cols-3'

  return (
    <div className='min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 pb-12'>
      <div className='max-w-6xl mx-auto p-4 sm:p-6'>
        {/* Header with Back Button */}
        <div className='mb-8 mt-4 flex items-center justify-between'>
          <div>
            <button 
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition mb-2"
            >
              <X className="w-5 h-5" />
              <span>Back</span>
            </button>
            <h1 className='text-3xl font-extrabold text-gray-800 mb-1'>Create Post</h1>
            <p className='text-gray-500'>Share your thoughts, photos, and videos.</p>
          </div>
        </div>

        {/* Form Card */}
        <div className='max-w-2xl mx-auto bg-white p-6 sm:p-8 rounded-2xl shadow-xl border border-gray-100 space-y-6'>
          {/* User Info Header */}
          <div className='flex items-center gap-3 pb-4 border-b border-gray-100'>
            <img 
              src={user.profile_picture || '/default-avatar.png'}
              alt={user.full_name} 
              className='w-14 h-14 rounded-full shadow-lg border-2 border-indigo-500 object-cover'
            />
            <div>
              <h2 className='font-bold text-lg text-gray-800'>{user.full_name}</h2>
              <p className='text-sm text-indigo-500'>@{user.username}</p>
            </div>
          </div>

          {/* Text Area */}
          <textarea 
            ref={textareaRef}
            className='w-full resize-none min-h-[120px] text-lg font-medium outline-none placeholder-gray-400 p-2 rounded-lg transition-all duration-300 border border-transparent focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100'
            placeholder="What's on your mind?..."
            onChange={handleContentChange}
            value={content}
            disabled={loading}
          />

          {/* Media Preview */}
          {media.length > 0 && (
            <div className={`grid gap-3 ${mediaLayoutClass} transition-all duration-300`}>
              {media.map((file, index) => (
                <div 
                  key={index} 
                  className={`relative overflow-hidden rounded-xl shadow-lg transition-transform duration-300 hover:scale-[1.02] ${
                    getMediaType(file) === 'video' ? 'aspect-video' : 'aspect-square'
                  }`}
                >
                  {getMediaType(file) === 'image' ? (
                    <img 
                      src={URL.createObjectURL(file)} 
                      className='w-full h-full object-cover'
                      alt={`Preview ${index}`}
                    />
                  ) : (
                    <video 
                      src={URL.createObjectURL(file)}
                      className='w-full h-full object-cover'
                      controls
                    >
                      Your browser does not support the video tag.
                    </video>
                  )}
                  
                  {/* Delete Button */}
                  <button 
                    onClick={() => handleMediaRemove(index)}
                    className='absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-600 transition-all duration-200 rounded-full text-white shadow-xl backdrop-blur-sm hover:scale-110'
                    disabled={loading}
                  >
                    <X className="w-4 h-4"/>
                  </button>
                  
                  {/* File Type Badge */}
                  <div className='absolute top-2 left-2 px-2 py-1 bg-black/50 text-white text-xs rounded-full backdrop-blur-sm'>
                    {getMediaType(file).toUpperCase()}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Upload Progress */}
          {loading && uploadProgress > 0 && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
              <p className="text-xs text-gray-500 text-center mt-1">
                Uploading... {uploadProgress}%
              </p>
            </div>
          )}

          {/* Media Limit Info */}
          {media.length < 4 && (
            <p className='text-xs text-gray-400 text-right'>
              {media.length}/4 media files • Images & Videos
            </p>
          )}

          {/* Bottom Action Bar */}
          <div className='flex items-center justify-between pt-4 border-t border-gray-100'>
            
            {/* Media Upload Button */}
            <div className="flex items-center gap-2">
              <label 
                htmlFor="media" 
                className={`flex items-center gap-2 text-md transition-all duration-200 cursor-pointer p-3 rounded-xl hover:shadow-md ${
                  media.length >= 4 
                    ? 'text-gray-400 cursor-not-allowed' 
                    : 'text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50'
                }`}
                title={media.length >= 4 ? "Maximum 4 files" : "Add photos & videos"}
              >
                <div className="flex gap-1">
                  <Image className='w-5 h-5'/>
                  <Video className='w-5 h-5'/>
                </div>
                <span className='hidden sm:inline font-medium'>Add Media</span>
              </label>

              <input 
                ref={fileInputRef}
                type="file" 
                id="media" 
                accept='image/*,video/*' 
                hidden 
                multiple 
                onChange={handleMediaSelect}
                disabled={media.length >= 4 || loading}
              />
            </div>

            {/* Publish Button */}
            <button 
              disabled={loading || (!media.length && !content.trim())} 
              onClick={() => handleSubmit()}
              className='flex items-center gap-2 text-md bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 active:scale-[0.98] transition-all duration-200 text-white font-semibold px-6 py-3 rounded-full shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none'
            >
              {loading ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Send className='w-4 h-4'/>
              )}
              {loading ? 'Publishing...' : 'Publish Post'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CreatePost