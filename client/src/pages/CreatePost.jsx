// CreatePost.jsx
import React, { useState, useRef, useEffect } from 'react';
import * as nsfwjs from 'nsfwjs';
import * as tf from '@tensorflow/tfjs';
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
  Clock,
  AlertCircle
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

    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = crop.width * pixelRatio;
    canvas.height = crop.height * pixelRatio;
    const ctx = canvas.getContext('2d');
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

// --- HELPER: COMPRESS / APPLY FILTERS FOR IMAGE FILE ---
async function processImageFileWithFilters(file, { maxDim = 1280, quality = 0.8, filters = {} } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // compute new size maintaining aspect ratio
      let { width, height } = img;
      const max = Math.max(width, height);
      if (max > maxDim) {
        const ratio = maxDim / max;
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      // Compose CSS filter string
      const filterParts = [];
      if (typeof filters.brightness !== 'undefined') filterParts.push(`brightness(${filters.brightness})`);
      if (typeof filters.contrast !== 'undefined') filterParts.push(`contrast(${filters.contrast})`);
      if (typeof filters.saturate !== 'undefined') filterParts.push(`saturate(${filters.saturate})`);
      ctx.filter = filterParts.join(' ') || 'none';

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas returned empty blob'));
          return;
        }
        const newFile = new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() });
        resolve(newFile);
      }, 'image/jpeg', quality);
    };
    img.onerror = (err) => reject(err);
    img.src = URL.createObjectURL(file);
  });
}

const CreatePost = () => {
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [media, setMedia] = useState([]); // array of File objects
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

  // --- NEW: Replace input ref and replace index ---
  const replaceInputRef = useRef(null);
  const [replaceIndex, setReplaceIndex] = useState(null);

  // --- NEW: Filters state per media index (images only) ---
  const [filtersMap, setFiltersMap] = useState({}); // { index: {brightness, contrast, saturate} }

  // --- NEW: preview loaded state for skeletons ---
  const [previewLoaded, setPreviewLoaded] = useState([]); // boolean per media index

  // --- NEW: NSFW blur flags per index ---
  const [blurMap, setBlurMap] = useState({}); // { index: boolean }

  // --- NEW: drag & drop reorder indexes ---
  const dragStartIndex = useRef(null);

  // --- NEW: video trimming settings per file name ---
  const [trimMap, setTrimMap] = useState({}); // { fileName: { start, end } }

  // --- NEW: retry state ---
  const [lastFailedPayload, setLastFailedPayload] = useState(null); // store form data metadata for retry

  // --- NSFW model state ---
  const [nsfwModel, setNsfwModel] = useState(null);
  const [nsfwLoading, setNsfwLoading] = useState(true);

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

  // Load NSFW model once
  useEffect(() => {
    let cancelled = false;
    const loadModel = async () => {
      try {
        setNsfwLoading(true);
        // nsfwjs.load() will download the model — ensure network allowed
        const model = await nsfwjs.load(); // default loads model from CDN
        if (!cancelled) {
          setNsfwModel(model);
        }
      } catch (err) {
        console.error('Failed to load NSFW model', err);
        toast.error('Content safety filter failed to load — uploads will not be scanned.');
      } finally {
        if (!cancelled) setNsfwLoading(false);
      }
    };
    loadModel();
    return () => { cancelled = true; };
  }, []);

  const handleContentChange = (e) => {
    setContent(e.target.value);
  };

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

  // --- NSFW check for images ---
  const isImageNSFW = async (file) => {
    if (!nsfwModel) {
      // if model not loaded, be permissive but warn
      console.warn('NSFW model not ready, skipping check');
      return false;
    }
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = async () => {
        try {
          const predictions = await nsfwModel.classify(img);
          // predictions: [{className, probability}, ...]
          const nsfwProb = predictions.reduce((acc, p) => {
            if (p.className === 'Porn' || p.className === 'Hentai' || p.className === 'Sexy') {
              return acc + p.probability;
            }
            return acc;
          }, 0);
          // If combined NSFW categories exceed threshold (0.7), treat as NSFW
          resolve(nsfwProb >= 0.7);
        } catch (err) {
          console.error('NSFW classify error', err);
          resolve(false);
        }
      };
      img.onerror = () => {
        resolve(false);
      };
      img.src = URL.createObjectURL(file);
    });
  };

  // --- UPDATED: File processing (with NSFW scanning) ---
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
            
            // For images: run NSFW check (if model loaded)
            if (file.type.startsWith('image/')) {
              try {
                if (!nsfwLoading && nsfwModel) {
                  const nsfw = await isImageNSFW(file);
                  if (nsfw) {
                    // Professional NSFW notification
                    toast.custom((t) => (
                      <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex flex-col ring-1 ring-black ring-opacity-5`}>
                        <div className="p-4">
                          <div className="flex items-start">
                            <div className="flex-shrink-0 pt-0.5">
                              <AlertCircle className="h-6 w-6 text-red-600" />
                            </div>
                            <div className="ml-3 w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900">Content Safety Alert</p>
                              <p className="mt-1 text-sm text-gray-500">
                                The image "<span className="font-medium">{file.name}</span>" appears to contain content that doesn't meet our community guidelines.
                              </p>
                              <p className="mt-2 text-xs text-gray-500">
                                Please upload appropriate content that respects our community standards.
                              </p>
                            </div>
                            <div className="ml-4 flex flex-shrink-0">
                              <button
                                onClick={() => toast.dismiss(t.id)}
                                className="inline-flex text-gray-400 hover:text-gray-500 focus:outline-none"
                              >
                                <span className="sr-only">Close</span>
                                <X className="h-5 w-5" />
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="bg-gray-50 px-4 py-3 rounded-b-lg">
                          <div className="text-xs text-gray-500">
                            Our AI detected potentially sensitive content to maintain a safe environment.
                          </div>
                        </div>
                      </div>
                    ), {
                      duration: 6000,
                      position: 'top-center',
                    });
                    return null;
                  }
                }
              } catch (err) {
                console.error('NSFW check error', err);
                // fallback: allow upload but warn
              }
              // set default filter/blur
              return file;
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
                
                // Provide default trimming (full length)
                setTrimMap(prev => ({ ...prev, [file.name]: { start: 0, end: Math.round(duration) } }));
                
                return file;
                
              } catch (error) {
                console.error('Error processing video:', error);
                toast.error(`Failed to process "${file.name}"`);
                return null;
              }
            }
          } else {
            toast.error(`File "${file.name}" is not a supported image or video.`);
            return null;
          }
        })
      );
      
      const validFiles = processedFiles.filter(file => file !== null);
      setMedia(prev => {
        // append files
        const next = [...prev, ...validFiles];
        // ensure previewLoaded and filtersMap arrays grow
        setPreviewLoaded(pl => [...pl, ...validFiles.map(() => false)]);
        validFiles.forEach((f, idx) => {
          const index = prev.length + idx;
          setFiltersMap(m => ({ ...m, [index]: { brightness: 1, contrast: 1, saturate: 1 } }));
          setBlurMap(b => ({ ...b, [index]: false }));
        });
        return next;
      });
      
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

  const handleReplaceSelect = async (e) => {
    const filesArr = Array.from(e.target.files);
    if (!filesArr.length || replaceIndex === null) return;
    const file = filesArr[0];

    // NSFW check if image
    if (file.type.startsWith('image/') && nsfwModel && !nsfwLoading) {
      try {
        const nsfw = await isImageNSFW(file);
        if (nsfw) {
          // Professional NSFW notification
          toast.custom((t) => (
            <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex flex-col ring-1 ring-black ring-opacity-5`}>
              <div className="p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 pt-0.5">
                    <AlertCircle className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="ml-3 w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">Content Safety Alert</p>
                    <p className="mt-1 text-sm text-gray-500">
                      The replacement image appears to contain content that doesn't meet our community guidelines.
                    </p>
                    <p className="mt-2 text-xs text-gray-500">
                      Please upload appropriate content that respects our community standards.
                    </p>
                  </div>
                  <div className="ml-4 flex flex-shrink-0">
                    <button
                      onClick={() => toast.dismiss(t.id)}
                      className="inline-flex text-gray-400 hover:text-gray-500 focus:outline-none"
                    >
                      <span className="sr-only">Close</span>
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ), {
            duration: 5000,
            position: 'top-center',
          });
          if (replaceInputRef.current) replaceInputRef.current.value = '';
          setReplaceIndex(null);
          return;
        }
      } catch (err) {
        console.error('NSFW error on replace', err);
      }
    }

    // Replace file at replaceIndex
    setMedia(prev => {
      const copy = [...prev];
      copy[replaceIndex] = file;
      // reset previewLoaded for that index
      setPreviewLoaded(pl => {
        const p = [...pl];
        p[replaceIndex] = false;
        return p;
      });
      // reset filters/blur for replaced item
      setFiltersMap(m => ({ ...m, [replaceIndex]: { brightness: 1, contrast: 1, saturate: 1 } }));
      setBlurMap(b => ({ ...b, [replaceIndex]: false }));
      if (file.type.startsWith('video/')) {
        getVideoDuration(file).then(d => {
          setVideoUploadStatus(prev => ({ ...prev, [file.name]: { duration: Math.round(d), status: 'ready' } }));
          setTrimMap(prev => ({ ...prev, [file.name]: { start: 0, end: Math.round(d) } }));
        });
      }
      return copy;
    });

    // clear
    setReplaceIndex(null);
    if (replaceInputRef.current) replaceInputRef.current.value = '';
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
      setTrimMap(prev => {
        const copy = { ...prev };
        delete copy[fileToRemove.name];
        return copy;
      });
    }
    
    setMedia(media.filter((_, i) => i !== index));
    setPreviewLoaded(pl => pl.filter((_, i) => i !== index));
    setFiltersMap(m => {
      // rebuild a compacted filters map to keep indexes aligned
      const newMap = {};
      media.filter((_, i) => i !== index).forEach((_, idx) => {
        newMap[idx] = m[i] || { brightness: 1, contrast: 1, saturate: 1 };
      });
      return newMap;
    });
    setBlurMap(b => {
      const newMap = {};
      media.filter((_, i) => i !== index).forEach((_, idx) => {
        newMap[idx] = b[i] || false;
      });
      return newMap;
    });
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

            // reset previewLoaded for this index
            setPreviewLoaded(pl => {
              const copy = [...pl];
              copy[editingIndex] = false;
              return copy;
            });

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

  // --- REORDER HANDLERS (native HTML5 DnD) ---
  const onDragStartThumb = (e, index) => {
    dragStartIndex.current = index;
    try {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
    } catch (err) {
      // some browsers require try/catch for setData
    }
  };

  const onDragOverThumb = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDropThumb = (e, index) => {
    e.preventDefault();
    const fromIndex = dragStartIndex.current !== null ? dragStartIndex.current : parseInt(e.dataTransfer.getData('text/plain'), 10);
    const toIndex = index;
    if (fromIndex === toIndex) return;

    setMedia(prev => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });

    // reorder previewLoaded, filtersMap, blurMap accordingly
    setPreviewLoaded(prev => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });

    setFiltersMap(prev => {
      const arr = Array.from({ length: Object.keys(prev).length }, (_, i) => prev[i] || { brightness: 1, contrast: 1, saturate: 1 });
      const [moved] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, moved);
      const next = {};
      arr.forEach((v, i) => (next[i] = v));
      return next;
    });

    setBlurMap(prev => {
      const arr = Array.from({ length: Object.keys(prev).length }, (_, i) => prev[i] || false);
      const [moved] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, moved);
      const next = {};
      arr.forEach((v, i) => (next[i] = v));
      return next;
    });

    dragStartIndex.current = null;
  };

  // --- FILTER CONTROL HANDLERS ---
  const updateFilterForIndex = (index, newFilters) => {
    setFiltersMap(prev => ({ ...prev, [index]: { ...(prev[index] || { brightness: 1, contrast: 1, saturate: 1 }), ...newFilters } }));
  };

  // --- NSFW BLUR TOGGLE ---
  const toggleBlurForIndex = (index) => {
    setBlurMap(prev => ({ ...prev, [index]: !prev[index] }));
  };

  // --- REPLACE MEDIA ---
  const triggerReplace = (index) => {
    setReplaceIndex(index);
    if (replaceInputRef.current) replaceInputRef.current.click();
  };

  // --- VIDEO TRIM HANDLERS ---
  const updateTrimForFile = (fileName, { start, end }) => {
    setTrimMap(prev => ({ ...prev, [fileName]: { start, end } }));
  };

  // --- PREVIEW ONLOAD HANDLER (skeleton removal) ---
  const handlePreviewLoaded = (index) => {
    setPreviewLoaded(prev => {
      const copy = [...prev];
      copy[index] = true;
      return copy;
    });
  };

  // --- AI CAPTION (backend) ---
  const handleGenerateCaption = async () => {
    if (!media.length) {
      toast.error('Add at least one media to generate caption.');
      return;
    }
    setPreparingFiles(true);
    try {
      const form = new FormData();
      media.forEach((f) => form.append('media', f));
      const token = await getToken();
      const { data } = await api.post('/api/ai/caption', form, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data?.caption) {
        setContent(prev => prev ? `${prev}\n\n${data.caption}` : data.caption);
        toast.success('Caption generated and added to your content.');
      } else {
        toast.error('Caption service returned no caption.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate caption. Make sure /api/ai/caption exists.');
    } finally {
      setPreparingFiles(false);
    }
  };

  // --- NSFW AUTO-DETECT ON DEMAND (server) ---
  const handleAutoDetectNSFW = async (index) => {
    const file = media[index];
    if (!file || !file.type.startsWith('image/')) {
      toast.error('Content safety detection works on images only.');
      return;
    }
    setPreparingFiles(true);
    try {
      const form = new FormData();
      form.append('media', file);
      const token = await getToken();
      const { data } = await api.post('/api/media/nsfw-check', form, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // expects { nsfw: true/false }
      if (data?.nsfw) {
        setBlurMap(prev => ({ ...prev, [index]: true }));
        toast('Image flagged for content safety and blurred.');
      } else {
        toast.success('Image appears appropriate for our community.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Content safety detection failed.');
    } finally {
      setPreparingFiles(false);
    }
  };

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
    if (!seconds && seconds !== 0) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // --- PREPARE MEDIA BEFORE UPLOAD: apply image filters & compression ---
  const prepareMediaForUpload = async (currentMedia) => {
    const prepared = await Promise.all(currentMedia.map(async (file, index) => {
      if (file.type.startsWith('image/')) {
        const filters = filtersMap[index] || { brightness: 1, contrast: 1, saturate: 1 };
        // normalize filter values to CSS-friendly multipliers
        const conv = {
          brightness: filters.brightness ?? 1,
          contrast: filters.contrast ?? 1,
          saturate: filters.saturate ?? 1
        };
        try {
          const processed = await processImageFileWithFilters(file, { maxDim: 1280, quality: 0.8, filters: { brightness: conv.brightness, contrast: conv.contrast, saturate: conv.saturate }});
          return processed;
        } catch (err) {
          console.error('Image processing failed, using original file', err);
          return file;
        }
      } else {
        // videos left as-is; trimming metadata will be sent to server.
        return file;
      }
    }));
    return prepared;
  };

  // --- SUBMIT (with retry support) ---
  const handleSubmit = async () => {
    if (!media.length && !content.trim()) {
      toast.error('Please add some content or media to your post.');
      return;
    }

    setLoading(true);
    setUploadProgress(0);

    const postType = media.length && content.trim() ? 'text_with_media' : media.length ? 'media' : 'text';

    try {
      setPreparingFiles(true);

      // Prepare images (apply filters & compress)
      const mediaToUpload = await prepareMediaForUpload(media);

      const formData = new FormData();
      formData.append('content', content);
      formData.append('post_type', postType);
      // include trim metadata & blur flags and filters map as JSON fields as well
      formData.append('media_meta', JSON.stringify({
        trims: trimMap,
        filters: filtersMap,
        blurred: blurMap
      }));

      mediaToUpload.forEach((file) => { formData.append('media', file); });

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
        setFiltersMap({});
        setBlurMap({});
        setPreviewLoaded([]);
        setTrimMap({});
        setLastFailedPayload(null);
        
        // Navigate back after short delay (kept same)
        setTimeout(() => navigate('/'), 1000);
      } else {
        throw new Error(data.message || 'Server returned failure');
      }
    } catch (error) {
      console.error('Error publishing post:', error);

      // Save retry payload metadata (we can save minimal meta and keep files in memory)
      setLastFailedPayload({
        content,
        media,
        filtersMap,
        blurMap,
        trimMap
      });

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
      setPreparingFiles(false);
    }
  };

  // --- RETRY UPLOAD using lastFailedPayload if available ---
  const handleRetryUpload = async () => {
    if (!lastFailedPayload) {
      toast.error('Nothing to retry.');
      return;
    }
    // restore content & media & maps
    setContent(lastFailedPayload.content || '');
    setMedia(lastFailedPayload.media || []);
    setFiltersMap(lastFailedPayload.filtersMap || {});
    setBlurMap(lastFailedPayload.blurMap || {});
    setTrimMap(lastFailedPayload.trimMap || {});
    // re-call submit (it will re-prepare & upload)
    await handleSubmit();
  };

  const hasVideos = media.some(file => getMediaType(file) === 'video');
  
  // Mobile-friendly media layout
  const getMediaLayoutClass = () => {
    if (media.length === 1) return 'grid-cols-1';
    if (media.length === 2) return 'grid-cols-2';
    if (media.length === 3) return 'grid-cols-2';
    if (media.length === 4) return 'grid-cols-2 sm:grid-cols-2';
    return 'grid-cols-1';
  };

  return (
    <div className='min-h-screen bg-gray-50 py-4 px-3 sm:px-4 md:px-6 lg:px-8 font-sans overflow-x-hidden'>
      {/* Main Container */}
      <div className='max-w-4xl mx-auto'>
        {/* Header - Mobile Optimized */}
        <div className='flex items-center justify-between mb-4 sm:mb-6'>
          <button 
            onClick={() => navigate(-1)} 
            className="group flex items-center gap-1 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 text-gray-600 bg-white rounded-full hover:bg-gray-100 shadow-sm border border-gray-200 transition-all text-sm"
            disabled={loading}
          >
            <X className="w-3 h-3 sm:w-4 sm:h-4 group-hover:-translate-x-0.5 transition-transform" /> 
            <span className="font-medium text-xs sm:text-sm hidden sm:inline">Cancel</span>
          </button>
          <h1 className="text-lg sm:text-xl font-bold text-gray-800 text-center flex-1">Create New Post</h1>
          <div className="w-10 sm:w-24"></div>
        </div>

        {/* Create Post Card */}
        <div className='bg-white rounded-2xl sm:rounded-3xl shadow-lg sm:shadow-xl border border-gray-100 overflow-hidden relative'>
          
          {/* Progress Bar */}
          {(loading || preparingFiles) && (
            <div className="absolute top-0 left-0 w-full bg-gray-100 h-1 z-10">
              <div className={`h-full transition-all duration-300 ${
                preparingFiles ? 'bg-blue-500 w-full' : 
                'bg-gradient-to-r from-indigo-500 to-purple-600'
              }`} style={{ width: preparingFiles ? '100%' : `${uploadProgress}%` }} />
            </div>
          )}

          <div className='p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6'>
            {/* User Info & Textarea */}
            <div className='flex gap-3 sm:gap-4'>
              <img 
                src={user.profile_picture || '/default-avatar.png'} 
                alt={user.full_name} 
                className='w-10 h-10 sm:w-12 sm:h-12 rounded-full ring-2 ring-indigo-50 object-cover flex-shrink-0' 
              />
              <div className='flex-grow space-y-2 min-w-0'>
                <h2 className='font-bold text-gray-900 text-sm sm:text-base'>{user.full_name}</h2>
                <textarea 
                  ref={textareaRef} 
                  className='w-full min-h-[80px] sm:min-h-[100px] text-base sm:text-lg text-gray-700 placeholder-gray-400 bg-transparent border-none focus:ring-0 p-0 resize-none overflow-hidden'
                  placeholder="What would you like to share today?" 
                  onChange={handleContentChange} 
                  value={content} 
                  disabled={loading || preparingFiles} 
                  rows={3}
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
              className={`relative group rounded-xl sm:rounded-2xl border-2 border-dashed transition-all duration-300 ease-out ${
                isDragging ? 'border-indigo-500 bg-indigo-50 scale-[1.01]' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
              } ${media.length > 0 ? 'p-3 sm:p-4' : 'p-6 sm:p-8 md:p-10'}`}
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

              {/* Hidden replace input */}
              <input
                ref={replaceInputRef}
                type="file"
                accept="image/*,video/*"
                hidden
                onChange={handleReplaceSelect}
                disabled={preparingFiles || loading}
              />

              {media.length === 0 && (
                <label htmlFor="media-upload" className="flex flex-col items-center justify-center cursor-pointer text-center">
                  <div className={`p-3 sm:p-4 rounded-full mb-3 sm:mb-4 transition-colors ${
                    isDragging ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-500'
                  }`}>
                    <CloudUpload className="w-6 h-6 sm:w-8 sm:h-8" />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-1">
                    {isDragging ? 'Drop files here' : 'Drag & drop media'}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-400 mb-2">Photos or videos. Max 4 files.</p>
                  <p className="text-xs text-gray-400 mb-4">Videos: Max 60 seconds, 100MB</p>
                  <span className="px-3 sm:px-4 py-1.5 sm:py-2 bg-white border border-gray-200 text-gray-600 text-xs sm:text-sm font-medium rounded-lg shadow-sm group-hover:border-indigo-200 group-hover:text-indigo-600 transition-all">
                    Browse Files
                  </span>
                </label>
              )}

              {/* Media Previews Grid */}
              {media.length > 0 && (
                <div className="space-y-3 sm:space-y-4">
                  <div className={`grid gap-3 sm:gap-4 ${getMediaLayoutClass()}`}>
                    {media.map((file, index) => {
                       const isVideo = getMediaType(file) === 'video';
                       const fileName = file.name;
                       const videoStatus = videoUploadStatus[fileName];
                       const filters = filtersMap[index] || { brightness: 1, contrast: 1, saturate: 1 };
                       const isPreviewLoaded = !!previewLoaded[index];

                       return (
                      <div
                        key={index}
                        draggable
                        onDragStart={(e) => onDragStartThumb(e, index)}
                        onDragOver={(e) => onDragOverThumb(e, index)}
                        onDrop={(e) => onDropThumb(e, index)}
                        className={`relative group/item overflow-hidden rounded-lg sm:rounded-xl border border-gray-100 bg-gray-900 shadow-sm ${
                          isVideo ? 'aspect-video' : 'aspect-square'
                        }`}
                      >
                        {/* Loading Skeleton */}
                        {!isPreviewLoaded && (
                          <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-gray-700 via-gray-800 to-gray-700" />
                        )}

                        {/* Media Display */}
                        {isVideo ? (
                          <div className="relative w-full h-full">
                            <video 
                              src={URL.createObjectURL(file)} 
                              className='w-full h-full object-cover' 
                              controls 
                              playsInline
                              onLoadedData={() => handlePreviewLoaded(index)}
                            >
                              Your browser does not support the video tag.
                            </video>

                            {/* Video trim UI overlay - Mobile optimized */}
                            <div className="absolute left-1 right-1 bottom-1 bg-black/60 backdrop-blur-sm p-1.5 sm:p-2 rounded text-[10px] sm:text-xs text-white flex flex-col gap-0.5 sm:gap-1">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">Trim</span>
                                <span>{videoStatus?.duration ? formatDuration(videoStatus.duration) : ''}</span>
                              </div>
                              <div className="flex items-center gap-1 sm:gap-2">
                                <input
                                  type="range"
                                  min={0}
                                  max={videoStatus?.duration || 60}
                                  value={trimMap[fileName]?.start ?? 0}
                                  onChange={(e) => updateTrimForFile(fileName, { start: Number(e.target.value), end: trimMap[fileName]?.end ?? (videoStatus?.duration || 0) })}
                                  className="flex-1 h-1.5 sm:h-2"
                                />
                                <input
                                  type="range"
                                  min={0}
                                  max={videoStatus?.duration || 60}
                                  value={trimMap[fileName]?.end ?? (videoStatus?.duration || 0)}
                                  onChange={(e) => updateTrimForFile(fileName, { start: trimMap[fileName]?.start ?? 0, end: Number(e.target.value) })}
                                  className="flex-1 h-1.5 sm:h-2"
                                />
                              </div>
                              <div className="flex items-center justify-between text-[9px] sm:text-[11px]">
                                <span>Start: {formatDuration(trimMap[fileName]?.start ?? 0)}</span>
                                <span>End: {formatDuration(trimMap[fileName]?.end ?? videoStatus?.duration ?? 0)}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-full">
                            <img 
                              src={URL.createObjectURL(file)} 
                              className='w-full h-full object-cover transition-opacity group-hover/item:opacity-90' 
                              alt={`Preview ${index}`}
                              onLoad={() => handlePreviewLoaded(index)}
                              style={{
                                filter: `brightness(${filters.brightness}) contrast(${filters.contrast}) saturate(${filters.saturate}) ${blurMap[index] ? 'blur(6px)' : ''}`
                              }}
                            />
                          </div>
                        )}
                        
                        {/* Top Right Controls (Delete & Crop & Replace) - Mobile optimized */}
                        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity duration-200">
                            {/* Crop Button (Images Only) */}
                            {!isVideo && !loading && !preparingFiles && (
                                <button 
                                  onClick={(e) => { e.preventDefault(); handleStartCrop(file, index); }} 
                                  className='p-1 sm:p-1.5 bg-black/60 text-white rounded-full backdrop-blur-md hover:bg-indigo-500 transition-colors' 
                                  title="Crop Image"
                                >
                                    <CropIcon className="w-3 h-3 sm:w-4 sm:h-4"/>
                                </button>
                            )}
                            {/* Replace Button */}
                            <button
                              onClick={(e) => { e.preventDefault(); triggerReplace(index); }}
                              className='p-1 sm:p-1.5 bg-black/60 text-white rounded-full backdrop-blur-md hover:bg-yellow-500 transition-colors'
                              title="Replace"
                            >
                              <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4" />
                            </button>
                            {/* Delete Button */}
                            <button 
                              onClick={(e) => { e.preventDefault(); handleMediaRemove(index); }} 
                              disabled={loading || preparingFiles} 
                              className='p-1 sm:p-1.5 bg-black/60 text-white rounded-full backdrop-blur-md hover:bg-red-500 transition-colors' 
                              title="Remove"
                            >
                                <X className="w-3 h-3 sm:w-4 sm:h-4"/>
                            </button>
                        </div>

                        {/* Bottom Left Controls: File Info + Filters + Blur + Auto-Detect */}
                        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 sm:px-2 sm:py-1 bg-black/60 backdrop-blur-md rounded text-[9px] sm:text-[10px] font-medium text-white pointer-events-auto">
                          {isVideo ? <FileVideo className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> : <FileImage className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
                          <span>{formatFileSize(file.size)}</span>
                          {isVideo && videoStatus?.duration && (
                            <>
                              <span className="mx-0.5 sm:mx-1">•</span>
                              <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                              <span>{formatDuration(videoStatus.duration)}</span>
                            </>
                          )}
                        </div>

                        {/* Bottom Right: Filter Controls expanded on hover */}
                        <div className="absolute bottom-1.5 right-1.5 opacity-0 group-hover/item:opacity-100 transition-opacity duration-200">
                          {!isVideo && (
                            <div className="flex gap-0.5 items-center bg-black/60 p-1.5 sm:p-2 rounded-md max-w-[180px] sm:max-w-none">
                              <div className="flex flex-col text-[10px] sm:text-xs text-white gap-0.5 sm:gap-1 pr-1 sm:pr-2">
                                <label className="flex items-center gap-0.5 sm:gap-1">
                                  <span className="text-[8px] sm:text-[10px]">B</span>
                                  <input
                                    type="range"
                                    min={0.5}
                                    max={1.5}
                                    step={0.05}
                                    value={(filtersMap[index]?.brightness ?? 1)}
                                    onChange={(e) => updateFilterForIndex(index, { brightness: Number(e.target.value) })}
                                    className="w-12 sm:w-16"
                                  />
                                </label>
                                <label className="flex items-center gap-0.5 sm:gap-1">
                                  <span className="text-[8px] sm:text-[10px]">C</span>
                                  <input
                                    type="range"
                                    min={0.5}
                                    max={1.5}
                                    step={0.05}
                                    value={(filtersMap[index]?.contrast ?? 1)}
                                    onChange={(e) => updateFilterForIndex(index, { contrast: Number(e.target.value) })}
                                    className="w-12 sm:w-16"
                                  />
                                </label>
                                <label className="flex items-center gap-0.5 sm:gap-1">
                                  <span className="text-[8px] sm:text-[10px]">S</span>
                                  <input
                                    type="range"
                                    min={0.5}
                                    max={2}
                                    step={0.05}
                                    value={(filtersMap[index]?.saturate ?? 1)}
                                    onChange={(e) => updateFilterForIndex(index, { saturate: Number(e.target.value) })}
                                    className="w-12 sm:w-16"
                                  />
                                </label>
                              </div>

                              <div className="flex flex-col gap-0.5 sm:gap-1">
                                <button onClick={() => toggleBlurForIndex(index)} className="px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-[10px] sm:text-xs bg-white/10 text-white">Blur</button>
                                <button onClick={() => handleAutoDetectNSFW(index)} className="px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-[10px] sm:text-xs bg-white/10 text-white">Check</button>
                              </div>
                            </div>
                          )}

                          {isVideo && (
                            <div className="flex gap-1 items-center bg-black/60 p-1.5 sm:p-2 rounded-md">
                              <button onClick={() => triggerReplace(index)} className="px-1.5 py-0.5 sm:px-2 sm:py-1 rounded text-[10px] sm:text-xs bg-white/10 text-white">Replace</button>
                            </div>
                          )}
                        </div>

                        {/* Cloudinary Badge for Videos */}
                        {isVideo && (
                          <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 sm:px-2 sm:py-1 bg-blue-600/80 backdrop-blur-md rounded text-[9px] sm:text-[10px] font-bold text-white flex items-center gap-0.5 sm:gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                        className={`flex flex-col items-center justify-center aspect-square rounded-lg sm:rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 hover:bg-indigo-50 hover:border-indigo-300 cursor-pointer transition-all text-gray-400 hover:text-indigo-500 ${
                          preparingFiles || loading ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <CloudUpload className="w-5 h-5 sm:w-6 sm:h-6 mb-1 sm:mb-2" /> 
                        <span className="text-xs font-semibold">Add More</span>
                      </label>
                    )}
                  </div>
                  
                  {/* Cloudinary Info Message */}
                  {hasVideos && (
                    <div className="flex items-center gap-2 p-2 sm:p-3 bg-blue-50 text-blue-700 rounded-lg text-xs sm:text-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4 4 0 003 15z" />
                      </svg>
                      <span className="flex-1">Videos will be uploaded to Cloudinary (fast video hosting)</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Preparing Files Status */}
            {preparingFiles && (
              <div className="flex items-center gap-2 p-2 sm:p-3 bg-blue-50 text-blue-700 rounded-lg text-xs sm:text-sm">
                <Loader className="w-3 h-3 sm:w-4 sm:h-4 animate-spin flex-shrink-0" /> 
                <span>Preparing files for upload...</span>
              </div>
            )}

            {/* Action Bar - Mobile Optimized */}
            <div className='flex flex-col sm:flex-row sm:items-center justify-between pt-4 sm:pt-6 border-t border-gray-100 gap-3 sm:gap-0'>
              <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-500 order-2 sm:order-1">
                <span className={content.length > 500 ? 'text-red-500' : ''}>
                  {content.length} chars
                </span>
                <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                <span>{media.length}/4 media</span>
                {hasVideos && (
                  <>
                    <span className="w-1 h-1 bg-gray-300 rounded-full hidden sm:block"></span>
                    <span className="text-blue-600 flex items-center gap-1 hidden sm:flex">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4 4 0 003 15z" />
                      </svg>
                      Cloudinary
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-2 order-1 sm:order-2">
                <div className="flex items-center gap-2">
                  <label 
                    htmlFor="media-upload" 
                    className={`p-2 sm:p-3 rounded-full text-gray-500 hover:bg-gray-100 hover:text-indigo-600 transition-colors cursor-pointer ${
                      (media.length >= 4 || preparingFiles || loading) ? 'hidden' : 'block'
                    }`}
                  >
                    <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </label>

                  <button
                    onClick={handleGenerateCaption}
                    className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm bg-gray-100 hover:bg-gray-200 whitespace-nowrap"
                    disabled={preparingFiles || loading}
                  >
                    Generate Caption
                  </button>
                </div>

                {lastFailedPayload && (
                  <button
                    onClick={handleRetryUpload}
                    className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm bg-yellow-100 hover:bg-yellow-200"
                    disabled={loading || preparingFiles}
                  >
                    Retry
                  </button>
                )}

                <button 
                  disabled={loading || preparingFiles || (!media.length && !content.trim())} 
                  onClick={handleSubmit} 
                  className='flex items-center gap-1 sm:gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-full font-semibold text-white shadow-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  {loading || preparingFiles ? (
                    <Loader className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                  ) : hasVideos ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4 4 0 003 15z" />
                    </svg>
                  ) : (
                    <Send className='w-3 h-3 sm:w-4 sm:h-4' />
                  )} 
                  <span className="text-sm sm:text-base">
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

      {/* --- CROP MODAL OVERLAY - Mobile Optimized --- */}
      {cropModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm">
           <div className="bg-white rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-100">
                 <h3 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-1 sm:gap-2">
                   <CropIcon className="w-4 h-4 sm:w-5 sm:h-5"/> Crop Image
                 </h3>
                 <button onClick={handleCloseCropModal} className="p-1.5 sm:p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
                   <X className="w-4 h-4 sm:w-5 sm:h-5"/>
                 </button>
              </div>

              {/* Cropper Area */}
              <div className="flex-grow overflow-auto p-2 sm:p-4 bg-gray-900 flex items-center justify-center relative">
                 {imageToCropSrc && (
                   <ReactCrop 
                     crop={crop} 
                     onChange={(_, percentCrop) => setCrop(percentCrop)} 
                     onComplete={(c) => setCompletedCrop(c)}
                     aspect={undefined}
                     className="max-h-[60vh] sm:max-h-[70vh]"
                   >
                     <img 
                       ref={imgRef} 
                       src={imageToCropSrc} 
                       alt="Crop target" 
                       onLoad={onImageLoad}
                       style={{ maxHeight: '60vh', maxWidth: '100%', objectFit: 'contain' }} 
                     />
                   </ReactCrop>
                 )}
              </div>

               {/* Modal Footer Actions */}
              <div className="p-3 sm:p-4 border-t border-gray-100 flex justify-between items-center bg-gray-50">
                 <button onClick={handleCloseCropModal} className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium text-sm sm:text-base">
                    <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4"/> Cancel
                 </button>
                 <button 
                   onClick={handleApplyCrop} 
                   disabled={!completedCrop?.width || !completedCrop?.height}
                   className="flex items-center gap-1 sm:gap-2 px-4 sm:px-6 py-1.5 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                 >
                    <Check className="w-4 h-4 sm:w-5 sm:h-5"/> Apply Crop
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default CreatePost;