import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Pencil, X, RotateCw, Check, Move, Filter, Sliders } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { updateUser } from '../features/user/userSlice';
import { useAuth } from '@clerk/clerk-react';
import toast from 'react-hot-toast';

// --- InteractiveCropper Component (Updated with 15 Filters) ---
/**
 * Handles interactive drag, resize, rotation, and now filtering of the crop area.
 */
const InteractiveCropper = ({
    originalImage,
    imageKey,
    rotation,
    setRotation,
    handleCropComplete,
    handleCropCancel
}) => {
    const imageRef = useRef(null);
    const ASPECT_RATIO = imageKey === 'profile_picture' ? 1 : 4; // 1:1 or 4:1
    const MIN_SIZE = imageKey === 'profile_picture' ? 80 : 160;

    // New state for filter
    const [filterType, setFilterType] = useState('none'); 

    const [crop, setCrop] = useState({ x: 0, y: 0, width: 150, height: 150 / ASPECT_RATIO });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [initialCrop, setInitialCrop] = useState(null);

    // --- 15 Filter Presets ---
    const filters = {
        'none': 'none',
        'grayscale': 'grayscale(100%)',
        'sepia': 'sepia(100%)',
        'vintage': 'sepia(50%) contrast(1.3) brightness(1.1)',
        'lomo': 'contrast(1.5) brightness(0.9) saturate(1.2)',
        'blue_wash': 'brightness(1.1) contrast(1.1) sepia(20%) hue-rotate(180deg)',
        'dark_mono': 'grayscale(100%) contrast(1.5) brightness(0.7)',
        'bright_pop': 'saturate(200%) brightness(1.2)',
        'warm_retro': 'sepia(80%) contrast(0.8) brightness(0.9)',
        'x_pro': 'sepia(30%) contrast(1.5) brightness(0.8) saturate(1.3)',
        'blur_light': 'brightness(1.5) blur(1px)',
        'contrast_max': 'contrast(200%)',
        'soft_breeze': 'sepia(10%) brightness(1.1) contrast(0.9) saturate(1.1)',
        'cool_tone': 'brightness(1.1) contrast(1.1) sepia(10%) hue-rotate(220deg)',
        'high_sat': 'saturate(300%) contrast(1.1)',
    }

    // Initialize crop box to the center (CORE LOGIC UNCHANGED)
    useEffect(() => {
        if (imageRef.current) {
            const img = imageRef.current;
            const containerWidth = img.clientWidth;
            const containerHeight = img.clientHeight;

            const initialWidth = Math.min(containerWidth, containerHeight * ASPECT_RATIO) * 0.6;
            const initialHeight = initialWidth / ASPECT_RATIO;

            setCrop({
                x: (containerWidth - initialWidth) / 2,
                y: (containerHeight - initialHeight) / 2,
                width: initialWidth,
                height: initialHeight
            });
        }
    }, [originalImage, imageKey, ASPECT_RATIO]);


    // Mouse/Touch Handlers (CORE LOGIC UNCHANGED)
    const handleMouseDown = (e, mode) => {
        e.preventDefault();
        e.stopPropagation();

        const clientX = e.clientX || (e.touches ? e.touches[0].clientX : e.clientX);
        const clientY = e.clientY || (e.touches ? e.touches[0].clientY : e.clientY);

        setStartPos({ x: clientX, y: clientY });
        setInitialCrop(crop);

        if (mode === 'drag') setIsDragging(true);
        else if (mode === 'resize') setIsResizing(true);
    };

    const handleMouseMove = useCallback((e) => {
        if (!isDragging && !isResizing) return;
        
        const imgContainer = imageRef.current;
        if (!imgContainer) return;

        const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : startPos.x);
        const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : startPos.y);
        
        const dx = clientX - startPos.x;
        const dy = clientY - startPos.y;

        const containerRect = imgContainer.getBoundingClientRect();

        if (isDragging) {
            const newX = Math.max(0, Math.min(initialCrop.x + dx, containerRect.width - initialCrop.width));
            const newY = Math.max(0, Math.min(initialCrop.y + dy, containerRect.height - initialCrop.height));
            setCrop(prev => ({ ...prev, x: newX, y: newY }));

        } else if (isResizing) {
            const change = (dx > dy ? dx : dy);
            let newWidth = initialCrop.width + change;

            newWidth = Math.max(MIN_SIZE, newWidth); 
            newWidth = Math.min(newWidth, containerRect.width);
            newWidth = Math.min(newWidth, containerRect.height * ASPECT_RATIO);
            
            const newHeight = newWidth / ASPECT_RATIO;

            const newX = initialCrop.x - (newWidth - initialCrop.width) / 2;
            const newY = initialCrop.y - (newHeight - initialCrop.height) / 2;

            const finalX = Math.max(0, Math.min(newX, containerRect.width - newWidth));
            const finalY = Math.max(0, Math.min(newY, containerRect.height - newHeight));
            
            setCrop({ x: finalX, y: finalY, width: newWidth, height: newHeight });
        }
    }, [isDragging, isResizing, startPos, initialCrop, ASPECT_RATIO, MIN_SIZE]);


    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        setIsResizing(false);
        setInitialCrop(null);
    }, []);

    // Attach/Detach global event listeners (CORE LOGIC UNCHANGED)
    useEffect(() => {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('touchmove', handleMouseMove);
        document.addEventListener('touchend', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('touchmove', handleMouseMove);
            document.removeEventListener('touchend', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);
    
    
    const isProfile = imageKey === 'profile_picture';
    const containerClass = isProfile 
        ? 'w-64 h-64 rounded-full' 
        : 'w-full h-48 rounded-lg';

    // Handler to complete the crop, passing the filter type
    const handleApply = () => {
        if(imageRef.current) {
            handleCropComplete(imageRef.current, crop, filters[filterType]);
        }
    }


    return (
        <div className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl scale-100 transition-transform duration-300">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
                    <h3 className="text-xl font-bold text-gray-800">Adjust Image & Apply Filter</h3>
                    <button
                        onClick={handleCropCancel}
                        className="text-gray-500 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Image Preview & Interactive Area */}
                <div className="p-6">
                    <div 
                        ref={imageRef}
                        className={`relative mx-auto bg-gray-900 overflow-hidden shadow-xl border-4 border-gray-700/50 ${containerClass}`}
                        onMouseDown={(e) => e.preventDefault()}
                    >
                        {/* Rotated & Filtered Image */}
                        <img
                            src={originalImage}
                            alt="Crop preview"
                            className={`w-full h-full object-contain transition-transform duration-200 ${isProfile ? 'rounded-full' : 'rounded-lg'}`}
                            style={{
                                transform: `rotate(${rotation}deg)`,
                                filter: filters[filterType], // Apply CSS filter for preview
                            }}
                        />

                        {/* Interactive Crop Box */}
                        <div
                            className={`absolute border-4 border-teal-400 cursor-move shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] transition-all duration-50 ease-in-out ${isProfile ? 'rounded-full' : 'rounded-none'}`}
                            style={{
                                top: `${crop.y}px`,
                                left: `${crop.x}px`,
                                width: `${crop.width}px`,
                                height: `${crop.height}px`,
                            }}
                            onMouseDown={(e) => handleMouseDown(e, 'drag')}
                            onTouchStart={(e) => handleMouseDown(e, 'drag')}
                        >
                            <div className='absolute inset-0 flex items-center justify-center text-white/50 pointer-events-none'>
                                <Move className='w-6 h-6' />
                            </div>

                            {/* Resize Handle */}
                            <div 
                                className='absolute bottom-0 right-0 w-6 h-6 bg-teal-500 rounded-full cursor-nwse-resize transform translate-x-1/2 translate-y-1/2 border-2 border-white shadow-lg'
                                onMouseDown={(e) => handleMouseDown(e, 'resize')}
                                onTouchStart={(e) => handleMouseDown(e, 'resize')}
                            ></div>
                        </div>
                    </div>

                    {/* Filter Controls */}
                    <div className='mt-6 border-t pt-4 border-gray-100'>
                        <h4 className='text-sm font-semibold text-gray-700 flex items-center mb-3'>
                            <Sliders className='w-4 h-4 mr-2 text-indigo-500'/>
                            Select Filter
                        </h4>
                        {/* Horizontal Scrollable Filter List */}
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                            {Object.keys(filters).map((key) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setFilterType(key)}
                                    className={`
                                        flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all shadow-sm active:scale-95 capitalize whitespace-nowrap
                                        ${filterType === key 
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-400/50'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }
                                    `}
                                >
                                    {key.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-4 mt-8 pt-4 border-t border-gray-100">
                         <button
                            onClick={() => setRotation(prev => (prev + 90) % 360)}
                            className="flex items-center gap-2 px-5 py-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors font-medium text-gray-700 active:scale-[0.98] shadow-md"
                        >
                            <RotateCw className="w-5 h-5" />
                            <span>Rotate</span>
                        </button>
                        
                        <button
                            onClick={handleApply} 
                            className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white rounded-full transition-all font-semibold shadow-xl shadow-teal-500/30 active:scale-[0.98]"
                        >
                            <Check className="w-5 h-5" />
                            <span>Crop & Apply</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};


// --- Main ProfileModal Component (CORE LOGIC UNCHANGED) ---
const ProfileModal = ({setShowEdit}) => {
    const dispatch = useDispatch();
    const {getToken} = useAuth()
    const user = useSelector((state) => state.user.value)
    
    // CORE STATE UNCHANGED
    const [editForm, setEditForm] = useState({
        username: user.username || '',
        bio: user.bio || '',
        location: user.location || '',
        profile_picture: null,
        cover_photo: null,
        full_name: user.full_name || '',
    })

    const [isSaving, setIsSaving] = useState(false);

    // CORE CROP STATES UNCHANGED
    const [cropMode, setCropMode] = useState(false);
    const [originalImage, setOriginalImage] = useState(null);
    const [rotation, setRotation] = useState(0);
    const [imageKey, setImageKey] = useState(''); 

    // --- Core Logic (UNCHANGED) ---
    const handleSaveProfile = async () => {
        try {
            const userData = new FormData();
            const {full_name, username, bio, location, profile_picture, cover_photo} = editForm

            if (!full_name.trim() || !username.trim()) {
                throw new Error('Name and Username are required.');
            }

            userData.append('username', username);
            userData.append('bio', bio);
            userData.append('location', location);
            userData.append('full_name', full_name);
            
            if (profile_picture instanceof File) {
                userData.append('profile', profile_picture);
            }
            if (cover_photo instanceof File) {
                userData.append('cover', cover_photo);
            }

            const token = await getToken()
            await dispatch(updateUser({userData, token})) 

            setShowEdit(false)
        } catch (error) {
            throw error; 
        }
    }

    // CORE HANDLER UNCHANGED
    const handleImageUpload = (key, file) => {
        if (file) {
            setImageKey(key);
            setOriginalImage(URL.createObjectURL(file));
            setCropMode(true); 
            setRotation(0);
        }
    }

    /**
     * UPDATED: Now accepts a filter style string.
     */
    const handleCropComplete = (imageContainerElement, crop, filterStyle = 'none') => {
        const img = imageContainerElement.querySelector('img');
        if (!img) {
            handleCropCancel();
            return;
        }

        const naturalWidth = img.naturalWidth;
        const naturalHeight = img.naturalHeight;
        const containerRect = imageContainerElement.getBoundingClientRect();

        const ratioX = containerRect.width / naturalWidth;
        const ratioY = containerRect.height / naturalHeight;
        const scale = Math.min(ratioX, ratioY);
        
        const offsetX = (containerRect.width - (naturalWidth * scale)) / 2;
        const offsetY = (containerRect.height - (naturalHeight * scale)) / 2;

        const originalCropX = (crop.x - offsetX) / scale;
        const originalCropY = (crop.y - offsetY) / scale;
        const originalCropWidth = crop.width / scale;
        const originalCropHeight = crop.height / scale;

        // Canvas for final output
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const imgObj = new Image();
        imgObj.onload = () => {
            let finalWidth = originalCropWidth;
            let finalHeight = originalCropHeight;
            
            if (rotation % 180 !== 0) {
                 [finalWidth, finalHeight] = [originalCropHeight, originalCropWidth];
            }

            canvas.width = finalWidth;
            canvas.height = finalHeight;
            
            // --- FILTER APPLICATION ---
            if (filterStyle && filterStyle !== 'none') {
                ctx.filter = filterStyle; 
            }
            // --------------------------

            // Apply translation and rotation to the canvas context
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate((rotation * Math.PI) / 180);
            
            // Draw the cropped portion of the original image onto the rotated canvas
            ctx.drawImage(
                imgObj, 
                originalCropX,
                originalCropY,
                originalCropWidth,
                originalCropHeight,
                -originalCropWidth / 2,
                -originalCropHeight / 2,
                originalCropWidth,
                originalCropHeight
            );
            
            // Reset filter for any future canvas use (good practice)
            ctx.filter = 'none'; 

            // Convert to blob and update form
            canvas.toBlob((blob) => {
                const croppedFile = new File([blob], `${imageKey}-cropped.jpg`, { type: 'image/jpeg' });
                setEditForm(prev => ({
                    ...prev,
                    [imageKey]: croppedFile
                }));
            }, 'image/jpeg', 0.9);
            
            // Close the cropper
            handleCropCancel();
        };
        imgObj.src = originalImage;
    }


    const handleCropCancel = () => {
        setCropMode(false);
        setOriginalImage(null);
        setRotation(0);
        setImageKey('');
    }

    // Utility function to get image URL for preview (UNCHANGED)
    const getImageUrl = (file, fallbackUrl) => {
        if (file instanceof File) {
            return URL.createObjectURL(file);
        }
        return fallbackUrl;
    }

    return (
        <div className='ProfileModalContainer'>
            <div className='fixed inset-0 z-[9999] h-[100dvh] overflow-y-auto bg-black/60 backdrop-blur-sm flex justify-center items-start pt-8 sm:pt-16 pb-8'>
                <div className='max-w-xl w-full mx-4 sm:mx-auto transition-all duration-300 transform'>
                    <div className='bg-white rounded-2xl shadow-3xl p-6 sm:p-8 relative'>

                        {/* Modal Header */}
                        <div className='flex justify-between items-center border-b border-gray-100 pb-4 mb-6'>
                            <h1 className='text-2xl font-extrabold text-gray-900'>Edit Your Profile</h1>
                            <button 
                                onClick={()=> {
                                    setShowEdit(false);
                                }} 
                                type='button' 
                                className='text-gray-500 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition'
                                aria-label="Close modal"
                            >
                                <X className='w-6 h-6' />
                            </button>
                        </div>

                        <form className='space-y-6' onSubmit={(e) => {
                            e.preventDefault();
                            setIsSaving(true); 

                            toast.promise(
                                handleSaveProfile(), 
                                {
                                    loading: 'Saving changes...',
                                    success: () => 'Profile updated!',
                                    error: (err) => err.message || 'Error saving profile',
                                }
                            ).finally(() => {
                                setIsSaving(false); 
                            });
                        }}>
                            
                            {/* Image Upload Area */}
                            <div className='space-y-6'>
                                
                                {/* Cover Photo Input */}
                                <div className='relative'>
                                    <label htmlFor="cover_photo_input" className="block text-sm font-semibold text-gray-700 mb-2 cursor-pointer">
                                        Cover Photo
                                    </label>
                                    <input 
                                        hidden 
                                        type="file" 
                                        accept="image/*" 
                                        id="cover_photo_input" 
                                        onChange={(e)=>handleImageUpload('cover_photo', e.target.files[0])}
                                    />
                                    <label htmlFor="cover_photo_input" className='cursor-pointer'>
                                        <div className='group/cover relative w-full h-40 bg-gray-100 rounded-xl overflow-hidden shadow-md border border-gray-200 hover:border-indigo-400 transition-all duration-200'>
                                            <img 
                                                src={getImageUrl(editForm.cover_photo, user.cover_photo)} 
                                                alt="Cover Preview" 
                                                className='w-full h-full object-cover transition-opacity duration-300 group-hover/cover:opacity-70'
                                                onError={(e) => { e.target.src = 'https://via.placeholder.com/600x200?text=Select+Cover+Photo'; }}
                                            />
                                            <div className='absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-opacity duration-300'>
                                                <Pencil className="w-6 h-6 text-white"/>
                                            </div>
                                        </div>
                                    </label>
                                </div>

                                {/* Profile Picture Input */}
                                <div className='relative -mt-16 ml-6'>
                                    <label htmlFor="profile_picture_input" className='block cursor-pointer'>
                                        <input 
                                            hidden 
                                            type="file" 
                                            accept="image/*" 
                                            id="profile_picture_input" 
                                            onChange={(e)=>handleImageUpload('profile_picture', e.target.files[0])}
                                        />
                                        <div className='group/profile relative w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-xl transition-transform hover:scale-[1.02] hover:border-indigo-400'>
                                            <img 
                                                src={getImageUrl(editForm.profile_picture, user.profile_picture)} 
                                                alt="Profile Preview" 
                                                className='w-full h-full object-cover'
                                                onError={(e) => { e.target.src = 'https://via.placeholder.com/100?text=P'; }}
                                            />
                                            <div className='absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/profile:opacity-100 transition-opacity duration-300'>
                                                <Pencil className="w-5 h-5 text-white"/>
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2 ml-2">Click to change</p>
                                    </label>
                                </div>

                            </div>

                            {/* Form Fields (Styling Enhanced) */}
                            <div className="pt-4 space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                    <input 
                                        type="text" 
                                        className='w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all' 
                                        placeholder='Enter your full name' 
                                        onChange={(e)=>setEditForm({...editForm, full_name: e.target.value})} 
                                        value={editForm.full_name}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                                    <input 
                                        type="text" 
                                        className='w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all' 
                                        placeholder='Enter a unique username' 
                                        onChange={(e)=>setEditForm({...editForm, username: e.target.value})} 
                                        value={editForm.username}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                                    <textarea 
                                        rows={3} 
                                        className='w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 resize-none transition-all' 
                                        placeholder='Share a short bio about yourself' 
                                        onChange={(e)=>setEditForm({...editForm, bio: e.target.value})} 
                                        value={editForm.bio}
                                        maxLength={160}
                                    />
                                    <p className='text-xs text-gray-500 text-right'>{editForm.bio.length}/160</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                                    <input 
                                        type="text" 
                                        className='w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all' 
                                        placeholder='e.g., San Francisco, CA' 
                                        onChange={(e)=>setEditForm({...editForm, location: e.target.value})} 
                                        value={editForm.location}
                                    />
                                </div>
                            </div>

                            {/* Action Buttons with Loading State */}
                            <div className='flex justify-end space-x-3 pt-6 border-t border-gray-100'>
                                <button 
                                    onClick={()=> setShowEdit(false)} 
                                    type='button' 
                                    className='px-5 py-2.5 border border-gray-300 rounded-full text-gray-700 font-medium hover:bg-gray-100 transition-colors shadow-sm active:scale-[0.98]'
                                    disabled={isSaving} 
                                >
                                    Cancel
                                </button>

                                <button 
                                    type='submit' 
                                    disabled={isSaving} 
                                    className={`
                                        px-6 py-2.5 rounded-full font-bold transition-all shadow-lg flex items-center justify-center space-x-2 
                                        ${isSaving 
                                            ? 'bg-gray-400 text-white cursor-not-allowed shadow-none'
                                            : 'bg-gradient-to-r from-indigo-600 to-purple-700 text-white hover:from-indigo-700 hover:to-purple-800 shadow-indigo-500/50 active:scale-[0.98]'
                                        }
                                    `}
                                >
                                    {isSaving ? (
                                        <>
                                            {/* Simple Tailwind spinner */}
                                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <span>Saving...</span>
                                        </>
                                    ) : (
                                        <span>Save Changes</span>
                                    )}
                                </button>
                            </div>

                        </form>
                    </div>
                </div>
            </div>

            {/* Interactive Crop Modal */}
            {cropMode && originalImage && imageKey && (
                <InteractiveCropper
                    originalImage={originalImage}
                    imageKey={imageKey}
                    rotation={rotation}
                    setRotation={setRotation}
                    handleCropComplete={handleCropComplete}
                    handleCropCancel={handleCropCancel}
                />
            )}
        </div>
    )
}

export default ProfileModal