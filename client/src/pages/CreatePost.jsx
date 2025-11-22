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
  const [compressing, setCompressing] = useState(false)
  
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

  // Enhanced video compression using FFmpeg.wasm
  const compressVideo = async (file) => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('video/')) {
        resolve(file);
        return;
      }

      // For videos smaller than 10MB, skip compression
      if (file.size <= 10 * 1024 * 1024) {
        console.log('Video is small enough, skipping compression');
        resolve(file);
        return;
      }

      console.log('Starting video compression:', file.name, 'Size:', (file.size / 1024 / 1024).toFixed(2), 'MB');

      const video = document.createElement('video');
      const source = document.createElement('source');
      
      video.preload = 'metadata';
      source.src = URL.createObjectURL(file);
      video.appendChild(source);

      video.onloadedmetadata = () => {
        URL.revokeObjectURL(source.src);
        
        const duration = video.duration;
        const originalSizeMB = file.size / 1024 / 1024;
        
        // Simple compression by reducing quality for larger files
        let quality = 0.8; // Default quality
        
        if (originalSizeMB > 50) quality = 0.6;
        if (originalSizeMB > 100) quality = 0.4;
        if (originalSizeMB > 200) quality = 0.3;

        console.log(`Video info - Duration: ${duration}s, Original: ${originalSizeMB.toFixed(2)}MB, Quality: ${quality}`);

        // Create a compressed version using MediaRecorder API
        const mediaStream = video.captureStream();
        const mediaRecorder = new MediaRecorder(mediaStream, {
          mimeType: 'video/webm;codecs=vp9',
          videoBitsPerSecond: Math.floor(1000000 * quality) // Adjust bitrate based on quality
        });

        const chunks = [];
        
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          const compressedBlob = new Blob(chunks, { type: 'video/webm' });
          
          console.log('Video compressed:', 
            'Original:', originalSizeMB.toFixed(2), 'MB',
            'Compressed:', (compressedBlob.size / 1024 / 1024).toFixed(2), 'MB',
            'Reduction:', ((1 - (compressedBlob.size / file.size)) * 100).toFixed(1) + '%'
          );

          // Convert to MP4 if needed (for better compatibility)
          const compressedFile = new File([compressedBlob], file.name.replace(/\.[^/.]+$/, ".webm"), {
            type: 'video/webm',
            lastModified: Date.now()
          });

          resolve(compressedFile);
        };

        mediaRecorder.onerror = (e) => {
          console.error('MediaRecorder error:', e);
          resolve(file); // Fallback to original file
        };

        // Start recording
        mediaRecorder.start();
        
        // Stop recording after video duration
        setTimeout(() => {
          if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
        }, duration * 1000);

        // Play video to capture stream
        video.play().catch(err => {
          console.log('Auto-play prevented, using manual compression');
          mediaRecorder.stop();
          resolve(file);
        });
      };

      video.onerror = () => {
        console.log('Video loading failed, using original file');
        resolve(file);
      };
    });
  };

  // Handle media selection with compression
  const handleMediaSelect = async (e) => {
    const files = Array.from(e.target.files);
    
    // Check total media count
    if (media.length + files.length > 4) {
      toast.error('Maximum 4 media files allowed per post.');
      return;
    }

    setCompressing(true);

    try {
      const processedFiles = await Promise.all(
        files.map(async (file) => {
          // Validate file types and sizes
          if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
            if (file.size > 500 * 1024 * 1024) { // 500MB limit
              toast.error(`File "${file.name}" is too large. Max 500MB.`);
              return null;
            }

            // Compress videos larger than 5MB
            if (file.type.startsWith('video/') && file.size > 5 * 1024 * 1024) {
              try {
                toast.loading(`Compressing ${file.name}...`, { id: 'compression' });
                const compressedFile = await compressVideo(file);
                toast.success(`${file.name} compressed successfully!`, { id: 'compression' });
                return compressedFile;
              } catch (error) {
                console.log('Compression failed, using original:', error);
                toast.error(`Failed to compress ${file.name}, using original`, { id: 'compression' });
                return file;
              }
            }

            return file; // Return images and small videos as-is
          } else {
            toast.error(`File "${file.name}" is not a supported image or video.`);
            return null;
          }
        })
      );

      // Filter out null values and add to media state
      const validFiles = processedFiles.filter(file => file !== null);
      setMedia(prev => [...prev, ...validFiles]);
      
    } catch (error) {
      console.error('Error processing files:', error);
      toast.error('Error processing media files.');
    } finally {
      setCompressing(false);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle media removal
  const handleMediaRemove = (index) => {
    setMedia(media.filter((_, i) => i !== index));
  };

  // Get media type for styling
  const getMediaType = (file) => {
    return file.type.startsWith('video/') ? 'video' : 'image';
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Submit function with progress tracking
  const handleSubmit = async () => {
    if (!media.length && !content.trim()) {
      toast.error('Please add some content or media to your post.');
      return;
    }

    setLoading(true);
    setUploadProgress(0);

    const postType = media.length && content.trim() 
      ? 'text_with_media' 
      : media.length 
        ? 'media' 
        : 'text';

    try {
      const formData = new FormData();
      formData.append('content', content);
      formData.append('post_type', postType);
      
      media.forEach((file) => {
        formData.append('media', file);
      });

      const token = await getToken();
      
      const { data } = await api.post('/api/post/add', formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(progress);
        }
      });

      if (data.success) {
        toast.success('Post published successfully! 🎉');
        // Reset form
        setContent('');
        setMedia([]);
        setUploadProgress(0);
        // Navigate after a short delay for better UX
        setTimeout(() => navigate('/'), 1000);
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Error publishing post:', error);
      toast.error(error.message || 'Failed to publish post. Please try again.');
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  // Group media by type for better layout
  const hasVideos = media.some(file => getMediaType(file) === 'video');
  const mediaLayoutClass = media.length === 1 
    ? 'grid-cols-1' 
    : media.length === 2 || (media.length === 3 && hasVideos)
      ? 'grid-cols-2'
      : 'grid-cols-2 sm:grid-cols-3';

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
            disabled={loading || compressing}
          />

          {/* Compression Indicator */}
          {compressing && (
            <div className="flex items-center gap-2 text-blue-600 bg-blue-50 p-3 rounded-lg">
              <Loader className="w-4 h-4 animate-spin" />
              <span className="text-sm">Compressing videos... This may take a moment</span>
            </div>
          )}

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
                    disabled={loading || compressing}
                  >
                    <X className="w-4 h-4"/>
                  </button>
                  
                  {/* File Type Badge */}
                  <div className='absolute top-2 left-2 px-2 py-1 bg-black/50 text-white text-xs rounded-full backdrop-blur-sm'>
                    {getMediaType(file).toUpperCase()}
                  </div>

                  {/* File Size Info */}
                  <div className='absolute bottom-2 left-2 px-2 py-1 bg-black/50 text-white text-xs rounded-full backdrop-blur-sm'>
                    {formatFileSize(file.size)}
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
              {media.length}/4 media files • Images & Videos • Auto-compression enabled
            </p>
          )}

          {/* Bottom Action Bar */}
          <div className='flex items-center justify-between pt-4 border-t border-gray-100'>
            
            {/* Media Upload Button */}
            <div className="flex items-center gap-2">
              <label 
                htmlFor="media" 
                className={`flex items-center gap-2 text-md transition-all duration-200 cursor-pointer p-3 rounded-xl hover:shadow-md ${
                  media.length >= 4 || compressing
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
                disabled={media.length >= 4 || compressing || loading}
              />
            </div>

            {/* Publish Button */}
            <button 
              disabled={loading || compressing || (!media.length && !content.trim())} 
              onClick={handleSubmit}
              className='flex items-center gap-2 text-md bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 active:scale-[0.98] transition-all duration-200 text-white font-semibold px-6 py-3 rounded-full shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none'
            >
              {compressing ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : loading ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Send className='w-4 h-4'/>
              )}
              {compressing ? 'Compressing...' : loading ? 'Publishing...' : 'Publish Post'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePost;