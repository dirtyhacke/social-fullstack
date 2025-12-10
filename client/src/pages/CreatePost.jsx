import React, { useState, useRef, useEffect } from 'react';
import { 
  Image as ImageIcon, 
  Video, 
  X, 
  Send, 
  Loader, 
  CloudUpload, 
  FileVideo, 
  FileImage, 
  Crop as CropIcon,
  Check,
  RotateCcw,
  Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSelector } from "react-redux";
import { useAuth } from '@clerk/clerk-react';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

// --- HELPER: CANVAS CROP IMAGE GENERATOR ---
async function getCroppedImg(image, crop, fileName) {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext('2d');

    const pixelRatio = window.devicePixelRatio;
    canvas.width = crop.width * pixelRatio;
    canvas.height = crop.height * pixelRatio;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width,
      crop.height,
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        blob.name = fileName;
        const croppedFile = new File([blob], fileName, { type: 'image/jpeg', lastModified: Date.now() });
        resolve(croppedFile);
      }, 'image/jpeg', 0.95);
    });
}

const CreatePost = () => {
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [preparingFiles, setPreparingFiles] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Add Cloudinary video processing state
  const [videoUploadStatus, setVideoUploadStatus] = useState({});

  // --- CROP STATE ---
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [imageToCropSrc, setImageToCropSrc] = useState(null);
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const imgRef = useRef(null);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  const user = useSelector((state) => state.user.value);
  const { getToken } = useAuth();

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  const handleContentChange = (e) => {
    setContent(e.target.value);
  };

  // --- REMOVED: Client-side video compression (Backend handles it now) ---
  
  // --- Get video duration for display ---
  const getVideoDuration = (file) => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      
      video.onerror = () => {
        resolve(0);
      };
      
      video.src = URL.createObjectURL(file);
    });
  };

  // --- UPDATED: File processing WITHOUT client-side compression ---
  const processFiles = async (files) => {
    if (media.length + files.length > 4) {
      toast.error('Maximum 4 media files allowed per post.');
      return;
    }
    
    setPreparingFiles(true);
    try {
      const processedFiles = await Promise.all(
        files.map(async (file) => {
          if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
            // Check file size (100MB limit)
            if (file.size > 100 * 1024 * 1024) {
              toast.error(`File "${file.name}" is too large. Max 100MB.`);
              return null;
            }
            
            // For videos, just check duration and show info
            if (file.type.startsWith('video/')) {
              try {
                const duration = await getVideoDuration(file);
                if (duration > 60) {
                  toast.error(`Video "${file.name}" is too long. Maximum 60 seconds.`);
                  return null;
                }
                
                // Update video status (just for display)
                setVideoUploadStatus(prev => ({
                  ...prev,
                  [file.name]: {
                    duration: Math.round(duration),
                    status: 'ready'
                  }
                }));
                
                // REMOVED: Client-side compression
                // Backend will handle compression with Cloudinary
                return file;
                
              } catch (error) {
                console.error('Error processing video:', error);
                toast.error(`Failed to process "${file.name}"`);
                return null;
              }
            }
            return file;
          } else {
            toast.error(`File "${file.name}" is not a supported image or video.`);
            return null;
          }
        })
      );
      
      const validFiles = processedFiles.filter(file => file !== null);
      setMedia(prev => [...prev, ...validFiles]);
      
      // Show success message
      if (validFiles.length > 0) {
        const hasVideos = validFiles.some(f => f.type.startsWith('video/'));
        const hasImages = validFiles.some(f => f.type.startsWith('image/'));
        
        if (hasVideos && hasImages) {
          toast.success(`${validFiles.length} files added. Videos will be uploaded to Cloudinary.`);
        } else if (hasVideos) {
          toast.success(`${validFiles.length} videos added. They will be uploaded to Cloudinary.`);
        } else {
          toast.success(`${validFiles.length} images added.`);
        }
      }
    } catch (error) {
      toast.error('Error processing media files.');
    } finally {
      setPreparingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // --- HANDLERS ---
  const handleMediaSelect = (e) => {
    const files = Array.from(e.target.files);
    processFiles(files);
  };

  const handleDragEnter = (e) => { 
    e.preventDefault(); 
    e.stopPropagation(); 
    setIsDragging(true); 
  };
  
  const handleDragLeave = (e) => { 
    e.preventDefault(); 
    e.stopPropagation(); 
    setIsDragging(false); 
  };
  
  const handleDragOver = (e) => { 
    e.preventDefault(); 
    e.stopPropagation(); 
    setIsDragging(true); 
  };
  
  const handleDrop = (e) => {
    e.preventDefault(); 
    e.stopPropagation(); 
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) processFiles(files);
  };

  const handleMediaRemove = (index) => {
    const fileToRemove = media[index];
    // Clean up video status tracking
    if (fileToRemove && fileToRemove.type.startsWith('video/')) {
      setVideoUploadStatus(prev => {
        const newStatus = { ...prev };
        delete newStatus[fileToRemove.name];
        return newStatus;
      });
    }
    
    setMedia(media.filter((_, i) => i !== index));
  };

  // --- CROP HANDLERS ---
  const handleStartCrop = (file, index) => {
    setEditingIndex(index);
    setCrop(undefined);
    setCompletedCrop(null);

    const reader = new FileReader();
    reader.addEventListener('load', () =>
      setImageToCropSrc(reader.result?.toString() || '')
    );
    reader.readAsDataURL(file);
    setCropModalOpen(true);
  };

  function onImageLoad(e) {
    const { width, height } = e.currentTarget;
    const cropConfig = centerCrop(
        makeAspectCrop(
          {
            unit: '%',
            width: 80,
          },
          1,
          width,
          height
        ),
        width,
        height
    );
    setCrop(cropConfig);
  }

  const handleApplyCrop = async () => {
    if(completedCrop?.width && completedCrop?.height && imgRef.current && editingIndex !== null) {
        try {
            const originalFile = media[editingIndex];
            const croppedFile = await getCroppedImg(imgRef.current, completedCrop, originalFile.name);
            
            const newMediaArray = [...media];
            newMediaArray[editingIndex] = croppedFile;
            setMedia(newMediaArray);

            handleCloseCropModal();
            toast.success('Image cropped successfully');
        } catch (e) {
            console.error(e);
            toast.error('Failed to crop image');
        }
    }
  };

  const handleCloseCropModal = () => {
    setCropModalOpen(false);
    setImageToCropSrc(null);
    setEditingIndex(null);
  };

  // --- UTILS ---
  const getMediaType = (file) => {
    return file.type.startsWith('video/') ? 'video' : 'image';
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // --- UPDATED: Submit WITHOUT client-side compression ---
  const handleSubmit = async () => {
    if (!media.length && !content.trim()) {
      toast.error('Please add some content or media to your post.');
      return;
    }

    setLoading(true);
    setUploadProgress(0);

    const postType = media.length && content.trim() ? 'text_with_media' : media.length ? 'media' : 'text';

    try {
      const formData = new FormData();
      formData.append('content', content);
      formData.append('post_type', postType);
      media.forEach((file) => { formData.append('media', file); });

      const token = await getToken();
      
      const { data } = await api.post('/api/post/add', formData, {
        headers: { 
          Authorization: `Bearer ${token}`, 
          'Content-Type': 'multipart/form-data' 
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        }
      });

      if (data.success) {
        // Show appropriate success message
        const hasVideos = media.some(f => getMediaType(f) === 'video');
        if (hasVideos) {
          toast.success('Post created! Videos are being processed...', {
            duration: 4000,
            icon: '☁️'
          });
        } else {
          toast.success('Post published successfully! 🎉');
        }
        
        // Reset form
        setContent(''); 
        setMedia([]); 
        setUploadProgress(0);
        setVideoUploadStatus({});
        
        // Navigate back after delay
        setTimeout(() => navigate('/'), 1000);
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Error publishing post:', error);
      
      // Improved error messages
      if (error.response?.data?.message?.includes('Cloudinary')) {
        toast.error('Video upload service is temporarily unavailable. Please try again later.');
      } else if (error.response?.data?.message?.includes('video')) {
        toast.error('Video processing failed. Please try a smaller video.');
      } else if (error.message.includes('Network Error')) {
        toast.error('Network error. Please check your connection.');
      } else {
        toast.error(error.message || 'Failed to publish post. Please try again.');
      }
    } finally {
      setLoading(false); 
      setUploadProgress(0);
    }
  };

  const hasVideos = media.some(file => getMediaType(file) === 'video');
  const mediaLayoutClass = media.length === 1 
    ? 'grid-cols-1' 
    : media.length === 2 || (media.length === 3 && hasVideos)
      ? 'grid-cols-2'
      : 'grid-cols-2 sm:grid-cols-3';

  return (
    <div className='min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 font-sans'>
      {/* Main Container */}
      <div className='max-w-4xl mx-auto'>
        {/* Header */}
        <div className='flex items-center justify-between mb-6'>
          <button 
            onClick={() => navigate(-1)} 
            className="group flex items-center gap-2 px-4 py-2 text-gray-600 bg-white rounded-full hover:bg-gray-100 shadow-sm border border-gray-200 transition-all"
            disabled={loading}
          >
            <X className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> 
            <span className="font-medium text-sm">Cancel</span>
          </button>
          <h1 className="text-xl font-bold text-gray-800">Create New Post</h1>
          <div className="w-24"></div>
        </div>

        {/* Create Post Card */}
        <div className='bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden relative'>
          
          {/* Progress Bar */}
          {(loading || preparingFiles) && (
            <div className="absolute top-0 left-0 w-full bg-gray-100 h-1 z-10">
              <div className={`h-full transition-all duration-300 ${
                preparingFiles ? 'bg-blue-500 w-full' : 
                'bg-gradient-to-r from-indigo-500 to-purple-600'
              }`} style={{ width: preparingFiles ? '100%' : `${uploadProgress}%` }} />
            </div>
          )}

          <div className='p-6 sm:p-8 space-y-6'>
            {/* User Info & Textarea */}
            <div className='flex gap-4'>
              <img 
                src={user.profile_picture || '/default-avatar.png'} 
                alt={user.full_name} 
                className='w-12 h-12 rounded-full ring-2 ring-indigo-50 object-cover' 
              />
              <div className='flex-grow space-y-2'>
                <h2 className='font-bold text-gray-900'>{user.full_name}</h2>
                <textarea 
                  ref={textareaRef} 
                  className='w-full min-h-[100px] text-lg text-gray-700 placeholder-gray-400 bg-transparent border-none focus:ring-0 p-0 resize-none' 
                  placeholder="What would you like to share today?" 
                  onChange={handleContentChange} 
                  value={content} 
                  disabled={loading || preparingFiles} 
                />
              </div>
            </div>

            {/* Drag & Drop Area */}
            <div 
              ref={dropZoneRef} 
              onDragEnter={handleDragEnter} 
              onDragLeave={handleDragLeave} 
              onDragOver={handleDragOver} 
              onDrop={handleDrop}
              className={`relative group rounded-2xl border-2 border-dashed transition-all duration-300 ease-out ${
                isDragging ? 'border-indigo-500 bg-indigo-50 scale-[1.01]' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
              } ${media.length > 0 ? 'p-4' : 'p-10'}`}
            >
              
              <input 
                ref={fileInputRef} 
                type="file" 
                id="media-upload" 
                accept='image/*,video/*' 
                hidden 
                multiple 
                onChange={handleMediaSelect} 
                disabled={media.length >= 4 || preparingFiles || loading} 
              />

              {media.length === 0 && (
                <label htmlFor="media-upload" className="flex flex-col items-center justify-center cursor-pointer text-center">
                  <div className={`p-4 rounded-full mb-4 transition-colors ${
                    isDragging ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-500'
                  }`}>
                    <CloudUpload className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-1">
                    {isDragging ? 'Drop files here' : 'Drag & drop media'}
                  </h3>
                  <p className="text-sm text-gray-400 mb-2">Photos or videos. Max 4 files.</p>
                  <p className="text-xs text-gray-400 mb-4">Videos: Max 60 seconds, 100MB</p>
                  <span className="px-4 py-2 bg-white border border-gray-200 text-gray-600 text-sm font-medium rounded-lg shadow-sm group-hover:border-indigo-200 group-hover:text-indigo-600 transition-all">
                    Browse Files
                  </span>
                </label>
              )}

              {/* Media Previews Grid */}
              {media.length > 0 && (
                <div className="space-y-4">
                  <div className={`grid gap-4 ${mediaLayoutClass}`}>
                    {media.map((file, index) => {
                       const isVideo = getMediaType(file) === 'video';
                       const fileName = file.name;
                       const videoStatus = videoUploadStatus[fileName];
                       
                       return (
                      <div key={index} className={`relative group/item overflow-hidden rounded-xl border border-gray-100 bg-gray-900 shadow-sm ${
                        isVideo ? 'aspect-video' : 'aspect-square'
                      }`}>
                        
                        {/* Media Display */}
                        {isVideo ? (
                          <div className="relative w-full h-full">
                            <video 
                              src={URL.createObjectURL(file)} 
                              className='w-full h-full object-cover' 
                              controls 
                              playsInline
                            >
                              Your browser does not support the video tag.
                            </video>
                          </div>
                        ) : (
                          <img 
                            src={URL.createObjectURL(file)} 
                            className='w-full h-full object-cover transition-opacity group-hover/item:opacity-90' 
                            alt={`Preview ${index}`} 
                          />
                        )}
                        
                        {/* Top Right Controls (Delete & Crop) */}
                        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover/item:opacity-100 transition-opacity duration-200">
                            {/* Crop Button (Images Only) */}
                            {!isVideo && !loading && !preparingFiles && (
                                <button 
                                  onClick={(e) => { e.preventDefault(); handleStartCrop(file, index); }} 
                                  className='p-1.5 bg-black/60 text-white rounded-full backdrop-blur-md hover:bg-indigo-500 transition-colors' 
                                  title="Crop Image"
                                >
                                    <CropIcon className="w-4 h-4"/>
                                </button>
                            )}
                            {/* Delete Button */}
                            <button 
                              onClick={(e) => { e.preventDefault(); handleMediaRemove(index); }} 
                              disabled={loading || preparingFiles} 
                              className='p-1.5 bg-black/60 text-white rounded-full backdrop-blur-md hover:bg-red-500 transition-colors' 
                              title="Remove"
                            >
                                <X className="w-4 h-4"/>
                            </button>
                        </div>

                        {/* File Info Badge */}
                        <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 bg-black/60 backdrop-blur-md rounded-md text-[10px] font-medium text-white pointer-events-none">
                          {isVideo ? <FileVideo className="w-3 h-3" /> : <FileImage className="w-3 h-3" />}
                          <span>{formatFileSize(file.size)}</span>
                          {isVideo && videoStatus?.duration && (
                            <>
                              <span className="mx-1">•</span>
                              <Clock className="w-3 h-3" />
                              <span>{formatDuration(videoStatus.duration)}</span>
                            </>
                          )}
                        </div>

                        {/* Cloudinary Badge for Videos */}
                        {isVideo && (
                          <div className="absolute top-2 left-2 px-2 py-1 bg-blue-600/80 backdrop-blur-md rounded-md text-[10px] font-bold text-white flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4 4 0 003 15z" />
                            </svg>
                            <span>Cloudinary</span>
                          </div>
                        )}
                      </div>
                    )})}
                    
                    {/* Add More Button */}
                    {media.length < 4 && (
                      <label 
                        htmlFor="media-upload" 
                        className={`flex flex-col items-center justify-center aspect-square rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 hover:bg-indigo-50 hover:border-indigo-300 cursor-pointer transition-all text-gray-400 hover:text-indigo-500 ${
                          preparingFiles || loading ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <CloudUpload className="w-6 h-6 mb-2" /> 
                        <span className="text-xs font-semibold">Add More</span>
                      </label>
                    )}
                  </div>
                  
                  {/* Cloudinary Info Message */}
                  {hasVideos && (
                    <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4 4 0 003 15z" />
                      </svg>
                      <span>Videos will be uploaded to Cloudinary (fast video hosting)</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Preparing Files Status */}
            {preparingFiles && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">
                <Loader className="w-4 h-4 animate-spin" /> 
                <span>Preparing files for upload...</span>
              </div>
            )}

            {/* Action Bar */}
            <div className='flex items-center justify-between pt-6 border-t border-gray-100'>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className={content.length > 500 ? 'text-red-500' : ''}>
                  {content.length} chars
                </span>
                <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                <span>{media.length}/4 media</span>
                {hasVideos && (
                  <>
                    <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                    <span className="text-blue-600 flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4 4 0 003 15z" />
                      </svg>
                      Cloudinary
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
                <label 
                  htmlFor="media-upload" 
                  className={`p-3 rounded-full text-gray-500 hover:bg-gray-100 hover:text-indigo-600 transition-colors cursor-pointer sm:hidden ${
                    (media.length >= 4 || preparingFiles || loading) ? 'hidden' : 'block'
                  }`}
                >
                  <ImageIcon className="w-5 h-5" />
                </label>
                <button 
                  disabled={loading || preparingFiles || (!media.length && !content.trim())} 
                  onClick={handleSubmit} 
                  className='flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold text-white shadow-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  {loading || preparingFiles ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : hasVideos ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4 4 0 003 15z" />
                    </svg>
                  ) : (
                    <Send className='w-4 h-4' />
                  )} 
                  <span>
                    {preparingFiles ? 'Preparing' : 
                     loading ? 'Posting' : 
                     hasVideos ? 'Post' : 'Post'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- CROP MODAL OVERLAY --- */}
      {cropModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
           <div className="bg-white rounded-2xl overflow-hidden shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                 <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                   <CropIcon className="w-5 h-5"/> Crop Image
                 </h3>
                 <button onClick={handleCloseCropModal} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
                   <X className="w-5 h-5"/>
                 </button>
              </div>

              {/* Cropper Area */}
              <div className="flex-grow overflow-auto p-4 bg-gray-900 flex items-center justify-center relative">
                 {imageToCropSrc && (
                   <ReactCrop 
                     crop={crop} 
                     onChange={(_, percentCrop) => setCrop(percentCrop)} 
                     onComplete={(c) => setCompletedCrop(c)}
                     aspect={undefined}
                     className="max-h-[70vh]"
                   >
                     <img 
                       ref={imgRef} 
                       src={imageToCropSrc} 
                       alt="Crop target" 
                       onLoad={onImageLoad}
                       style={{ maxHeight: '70vh', maxWidth: '100%', objectFit: 'contain' }} 
                     />
                   </ReactCrop>
                 )}
              </div>

               {/* Modal Footer Actions */}
              <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-gray-50">
                 <button onClick={handleCloseCropModal} className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium">
                    <RotateCcw className="w-4 h-4"/> Cancel
                 </button>
                 <button 
                   onClick={handleApplyCrop} 
                   disabled={!completedCrop?.width || !completedCrop?.height}
                   className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                    <Check className="w-5 h-5"/> Apply Crop
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default CreatePost;