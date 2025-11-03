import { useAuth } from '@clerk/clerk-react'
import { ArrowLeft, Sparkle, TextIcon, Upload, X } from 'lucide-react'
import React, { useState } from 'react'
import toast from 'react-hot-toast'
import api from '../api/axios'

const StoryModal = ({setShowModal, fetchStories}) => {

    const bgColors = ["#4f46e5", "#7c3aed", "#db2777", "#e11d48", "#ca8a04", "#0d9488"] // Indigo, Violet, Rose, Red, Yellow, Teal

    const [mode, setMode] = useState("text")
    const [background, setBackground] = useState(bgColors[0])
    const [text, setText] = useState("")
    const [media, setMedia] = useState(null)
    const [previewUrl, setPreviewUrl] = useState(null)
    const [loading, setLoading] = useState(false)

    const {getToken} = useAuth()

    const MAX_VIDEO_DURATION = 60; // seconds
    const MAX_VIDEO_SIZE_MB = 50; // MB

    const handleMediaUpload = (e)=>{
        const file = e.target.files?.[0]
        if(!file) return;

        if(file.type.startsWith("video")){
            if(file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024){
                toast.error(`Video file size cannot exceed ${MAX_VIDEO_SIZE_MB}MB.`)
                setMedia(null)
                setPreviewUrl(null)
                return;
            }
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = ()=>{
                window.URL.revokeObjectURL(video.src)
                if(video.duration > MAX_VIDEO_DURATION){
                    toast.error("Video duration cannot exceed 1 minute.")
                    setMedia(null)
                    setPreviewUrl(null)
                }else{
                    setMedia(file)
                    setPreviewUrl(URL.createObjectURL(file))
                    setText('')
                    setMode("media")
                }
            }
            video.src = URL.createObjectURL(file)
        }else if(file.type.startsWith("image")){
            setMedia(file)
            setPreviewUrl(URL.createObjectURL(file))
            setText('')
            setMode("media")
        }
    }

    const handleCreateStory = async () => {
        setLoading(true);
        const media_type = mode === 'media' 
            ? media?.type.startsWith('image') ? 'image' : "video" 
            : "text";

        if(media_type === "text" && !text.trim()){
            throw new Error("Please enter some text")
        }
        if(media_type !== "text" && !media){
            throw new Error("Please select media")
        }

        let formData = new FormData();
        // Append content only if in text mode or if there is text in media mode
        formData.append('content', text); 
        formData.append('media_type', media_type);
        if(media_type !== 'text') {
            formData.append('media', media);
        }
        formData.append('background_color', background);

        const token = await getToken();
        try {
            const { data } = await api.post('/api/story/create', formData, {
                headers: { Authorization: `Bearer ${token}` }
            })

            if (data.success){
                setShowModal(false)
                toast.success("Story created successfully! 🎉")
                fetchStories()
            }else{
                throw new Error(data.message || "Failed to create story.")
            }
        } catch (error) {
            console.error(error);
            throw new Error(error.message || "An unexpected error occurred.")
        } finally {
            setLoading(false);
        }
    }

    const resetState = (newMode) => {
        setMode(newMode);
        setText('');
        setMedia(null);
        setPreviewUrl(null);
        setBackground(bgColors[0]);
    }


  return (
    // Backdrop with better focus
    <div className='fixed inset-0 z-[1000] h-[100dvh] bg-black/80 backdrop-blur-sm text-white flex items-center justify-center p-4'>
        <div className='w-full max-w-sm bg-zinc-900 rounded-xl shadow-2xl p-6'>
            
            {/* Header */}
            <div className='flex items-center justify-between pb-4 mb-4 border-b border-zinc-700'>
                <h2 className='text-xl font-bold'>Create Story</h2>
                <button 
                    onClick={()=> setShowModal(false)} 
                    className='text-zinc-400 hover:text-white p-2 rounded-full hover:bg-zinc-800 transition'
                    aria-label="Close modal"
                >
                    <X className='w-6 h-6'/>
                </button>
            </div>

            {/* Story Preview Area */}
            <div 
                className='w-full aspect-[3/4] rounded-lg flex items-center justify-center relative shadow-xl overflow-hidden' 
                style={{backgroundColor: background}}
            >
                {/* Text Mode */}
                {mode === 'text' && (
                    <textarea 
                        className='bg-transparent text-white w-full h-full p-6 text-xl sm:text-2xl font-extrabold text-center resize-none focus:outline-none placeholder-zinc-400/80 leading-snug' 
                        placeholder="Type something amazing..." 
                        onChange={(e)=>setText(e.target.value)} 
                        value={text}
                        maxLength={150}
                    />
                )}
                
                {/* Media Mode */}
                {
                    mode === 'media' && previewUrl && (
                        <>
                            {media?.type.startsWith('image') ? (
                                <img src={previewUrl} alt="Media Preview" className='object-cover w-full h-full'/>
                            ) : (
                                <video src={previewUrl} className='object-cover w-full h-full' autoPlay muted loop/>
                            )}
                            {/* Optional: Text overlay on media */}
                            {text && (
                                <div className='absolute bottom-0 left-0 right-0 p-4 bg-black/40 backdrop-blur-sm'>
                                    <p className='text-sm text-white line-clamp-2'>{text}</p>
                                </div>
                            )}
                        </>
                    )
                }

                {/* Media Placeholder/Input Area */}
                {mode === 'media' && !previewUrl && (
                    <label className='flex flex-col items-center justify-center w-full h-full bg-zinc-800/80 hover:bg-zinc-800 transition cursor-pointer p-8 text-zinc-400'>
                        <Upload className='w-10 h-10 mb-2'/>
                        <span className='font-semibold text-center'>Tap to select a photo or video</span>
                        <span className='text-xs mt-1 text-zinc-500 text-center'>Max 1 min video, 50MB file size.</span>
                        <input 
                            onChange={handleMediaUpload} 
                            type="file" 
                            accept='image/*, video/*' 
                            className='hidden'
                        />
                    </label>
                )}

            </div>

            {/* Text Mode Options (Color Picker) */}
            {mode === 'text' && (
                <div className='flex justify-center mt-4 gap-3'>
                    {bgColors.map((color)=>(
                        <button 
                            key={color} 
                            className={`w-8 h-8 rounded-full transition-all duration-200 shadow-md ${background === color ? 'ring-4 ring-white ring-offset-2 ring-offset-zinc-900' : 'hover:ring-2 hover:ring-white/50'}`} 
                            style={{backgroundColor: color}} 
                            onClick={()=> setBackground(color)}
                            aria-label={`Set background color to ${color}`}
                        />
                    ))}
                </div>
            )}
            
            {/* Mode Selection and Controls */}
            <div className={`flex gap-3 mt-6 ${mode === 'media' && previewUrl ? 'flex-col' : 'flex-row'}`}>
                
                {/* Reset/Back Button (if media selected) */}
                {mode === 'media' && previewUrl && (
                    <button 
                        onClick={() => resetState("media")} 
                        className='w-full flex items-center justify-center gap-2 p-3 rounded-full bg-zinc-700 text-white hover:bg-zinc-600 transition'
                    >
                        <ArrowLeft size={18}/> Retake/Change Media
                    </button>
                )}

                {/* Text Mode Button */}
                <button 
                    onClick={() => resetState("text")} 
                    className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-full font-medium transition ${mode === 'text' ? "bg-indigo-600 text-white shadow-lg" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
                >
                    <TextIcon size={18}/> Text
                </button>
                
                {/* Photo/Video Mode Button */}
                <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-full font-medium transition ${mode === 'media' && !previewUrl ? "bg-indigo-600 text-white shadow-lg" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}>
                    <input 
                        onChange={handleMediaUpload} 
                        type="file" 
                        accept='image/*, video/*' 
                        className='hidden'
                    />
                    <Upload size={18}/> Media
                </label>
            </div>
            
            {/* Create Story Button */}
            <button 
                onClick={()=> toast.promise(handleCreateStory(), {
                    loading: 'Creating story...',
                    success: 'Story created!',
                    error: (err) => err.message || 'Failed to create story.',
                })} 
                disabled={loading || (mode === 'text' && !text.trim()) || (mode === 'media' && !media)}
                className='flex items-center justify-center gap-2 text-white py-3 mt-4 w-full rounded-full bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] font-semibold'
            >
                <Sparkle size={18}/> {loading ? 'Creating...' : 'Share Story'}
            </button>

        </div>
    </div>
  )
}

export default StoryModal