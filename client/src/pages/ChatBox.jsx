import React, { useEffect, useRef, useState, useCallback } from 'react'; // Added useCallback
import { ImageIcon, SendHorizonal, ArrowLeft, MessageSquare } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react'; 
import api from '../api/axios';
import { addMessage, fetchMessages, resetMessages } from '../features/messages/messagesSlice';
import toast from 'react-hot-toast';

const ChatBox = () => {
  const { messages } = useSelector((state) => state.messages);
  const { connections } = useSelector((state) => state.connections);
  const { userId } = useParams();
  const { getToken } = useAuth();
  const { user: currentUser } = useUser(); 
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const [user, setUser] = useState(null); 
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null); 
  
  const [isConnectionsListVisible, setIsConnectionsListVisible] = useState(false);

  // --- Data Fetching and Logic ---

  const fetchUserMessages = async () => {
    try {
      const token = await getToken();
      dispatch(fetchMessages({ token, userId }));
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const sendMessage = async () => {
    try {
      if (!text.trim() && !image) return;

      const token = await getToken();
      const formData = new FormData();
      formData.append('to_user_id', userId);
      formData.append('text', text.trim());
      image && formData.append('image', image);

      const { data } = await api.post('/api/message/send', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (data.success) {
        setText('');
        setImage(null);
        dispatch(addMessage(data.message));
        
        // Ensure focus after sending
        inputRef.current?.focus(); 
      } else {
        throw new Error(data.message || 'Failed to send message.');
      }
    } catch (error) {
      toast.error(error.message);
    }
  };
  
  // FIX: Use useCallback to stabilize the function and setTimeout for delayed focus
  const handleTextChange = useCallback((e) => {
    const newValue = e.target.value;
    setText(newValue);
    
    // The critical change: Delaying focus slightly (e.g., 0ms)
    // This allows the DOM to update with the new 'value' prop before we call focus(),
    // preventing the cursor from being lost during the re-render cycle.
    setTimeout(() => {
        inputRef.current?.focus();
        // Optional: Ensure cursor is at the end of the text
        if (inputRef.current) {
            const cursorPosition = newValue.length;
            inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
        }
    }, 0); 
  }, []); // Empty dependency array means this function is created once

  // --- Effects ---
// ... (rest of the effects remain the same)
  useEffect(() => {
    fetchUserMessages();
    setIsConnectionsListVisible(false);

    return () => {
      dispatch(resetMessages());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (connections.length > 0) {
      const connectedUser = connections.find(connection => connection._id === userId);
      setUser(connectedUser);
    }
  }, [connections, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setImage(file);
    } else {
      setImage(null);
      if (file) toast.error('Please select a valid image file.');
    }
  };

  // --- Sub-Components ---

  const ConnectionsList = () => (
    <div className='w-full md:w-80 border-r border-gray-200 bg-white h-full overflow-y-auto flex-shrink-0'>
      <div className ='p-4 border-b border-gray-100 sticky top-0 bg-white z-5'>
        <h2 className='text-xl font-bold text-slate-800'>Connections</h2>
      </div>
      
      {connections.length === 0 ? (
        <div className="text-center p-8 text-gray-500">
          <MessageSquare className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">No connections found.</p>
        </div>
      ) : (
        connections.map((connection) => {
          const isSelected = connection._id === userId;
          return (
            <div
              key={connection._id}
              onClick={() => navigate(`/messages/${connection._id}`)}
              className={`flex items-center p-3 sm:p-4 border-b border-gray-100 transition-all cursor-pointer ${
                isSelected ? 'bg-indigo-50 border-l-4 border-indigo-600' : 'hover:bg-gray-50 border-l-4 border-white'
              }`}
            >
              <img
                src={connection.profile_picture || '/default-avatar.png'}
                alt={connection.full_name}
                className='size-12 rounded-full object-cover flex-shrink-0'
                onError={(e) => { e.target.src = '/default-avatar.png'; }}
              />
              <div className='ml-3 overflow-hidden'>
                <p className='font-semibold text-slate-800 truncate'>{connection.full_name}</p>
                <p className='text-xs text-gray-500 truncate'>@{connection.username}</p>
                <p className='text-xs text-gray-400 mt-1 truncate'>...</p>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  const ChatContent = () => {
    if (!user) {
      return (
        <div className='flex items-center justify-center flex-1 bg-gray-100'>
          <div className="text-center">
            <h3 className="text-2xl font-bold text-gray-700 mb-4">Select a Connection</h3>
            <p className="text-gray-500">Choose a user from the list to start chatting.</p>
          </div>
        </div>
      );
    }
    
    return (
      <div className='flex flex-col flex-1 h-full'>
        {/* --- Chat Header --- */}
        <div className='sticky top-0 z-10 flex items-center gap-3 p-3 sm:p-4 bg-white shadow-md border-b border-gray-100 flex-shrink-0'>
          <button 
            onClick={() => setIsConnectionsListVisible(true)} 
            className='p-2 rounded-full hover:bg-gray-100 transition-colors md:hidden' 
            title="Back to Connections"
          >
              <ArrowLeft className="w-5 h-5 text-gray-700"/>
          </button>
          <img 
              src={user.profile_picture || '/default-avatar.png'} 
              alt={user.full_name} 
              className="size-10 rounded-full object-cover border-2 border-indigo-300"
              onError={(e) => { e.target.src = '/default-avatar.png' }}
          />
          <div>
            <p className="font-semibold text-lg text-slate-800">{user.full_name}</p>
            <p className="text-xs text-gray-500 -mt-0.5">@{user.username}</p>
          </div>
        </div>

        {/* --- Message Area --- */}
        <div className='flex-1 p-4 overflow-y-scroll space-y-4 bg-gray-100'>
          <div className='max-w-4xl mx-auto py-2'>
            {messages.toSorted((a,b)=> new Date(a.createdAt) - new Date(b.createdAt)).map((message, index)=>{
              
              const senderId = message.from_user_id?._id || message.from_user_id;
              const currentClerkId = currentUser?.id;

              const isSent = senderId === currentClerkId || (message.to_user_id === userId); 

              const time = message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...';

              return (
                <div key={index} className={`flex w-full ${isSent ? 'justify-end' : 'justify-start'}`}>
                  <div className='max-w-[80%] md:max-w-[60%]'>
                    <div className={`flex flex-col mb-1 ${isSent ? 'items-end' : 'items-start'}`}>
                      <div className={`p-3 text-sm rounded-xl shadow-md transition-all ${isSent 
                          ? 'bg-indigo-600 text-white rounded-br-none' 
                          : 'bg-white text-slate-800 rounded-tl-none border border-gray-200'
                        }`}>
                        
                        {/* Image Content */}
                        {message.message_type === 'image' && message.media_url && (
                            <img 
                                src={message.media_url} 
                                className='w-full max-w-xs md:max-w-sm rounded-lg mb-2 object-cover cursor-pointer' 
                                alt="Shared media"
                                onClick={() => window.open(message.media_url, '_blank')} 
                            />
                        )}
                        
                        {/* Text Content */}
                        {message.text && <p className='whitespace-pre-wrap'>{message.text}</p>}
                      </div>
                      
                      {/* Time Stamp */}
                      <p className={`text-xs mt-1 ${isSent ? 'text-gray-500' : 'text-gray-500 mr-2'}`}>
                          {time}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* --- Message Input --- */}
        <div className='sticky bottom-0 z-10 bg-white p-4 shadow-xl flex-shrink-0'>
            {image && (
                <div className='flex items-center justify-between p-2 mb-2 bg-indigo-50 rounded-lg max-w-xl mx-auto'>
                    <div className='flex items-center gap-3'>
                        <img src={URL.createObjectURL(image)} alt="Preview" className='h-10 w-10 object-cover rounded'/>
                        <p className='text-sm text-indigo-800 truncate'>{image.name}</p>
                    </div>
                    <button onClick={() => setImage(null)} className='text-red-500 hover:text-red-700 font-bold text-lg leading-none'>&times;</button>
                </div>
            )}

            <div className='flex items-center gap-3 p-1.5 bg-white w-full max-w-xl mx-auto border border-gray-300 rounded-full shadow-lg'>
              
              <input 
                  type="text" 
                  ref={inputRef} 
                  className='flex-1 py-2 px-3 outline-none text-slate-700 placeholder:text-gray-400' 
                  placeholder='Type a message...'
                  onKeyDown={e=>e.key === 'Enter' && sendMessage()} 
                  onChange={handleTextChange} // <-- Using the new stable/delayed handler
                  value={text} 
              />

              <label htmlFor="image" className='flex-shrink-0'>
                <div className='p-2 cursor-pointer rounded-full hover:bg-gray-100 transition-colors' title="Add Image">
                  {
                    image 
                    ? <img src={URL.createObjectURL(image)} alt="" className='h-6 w-6 rounded object-cover'/> 
                    : <ImageIcon className='size-6 text-indigo-500'/>
                  }
                </div>
                <input 
                    type="file" 
                    id='image' 
                    accept="image/*" 
                    hidden 
                    onChange={handleImageChange}
                    onClick={(e) => e.target.value = null}
                />
              </label>

              <button 
                  onClick={sendMessage} 
                  disabled={!text.trim() && !image}
                  className={`flex-shrink-0 cursor-pointer text-white p-3 rounded-full transition-all ${!text.trim() && !image 
                      ? 'bg-gray-400' 
                      : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95'
                  }`}
                  title="Send"
              >
                <SendHorizonal size={18}/>
              </button>
            </div>
        </div>
      </div>
    );
  };

  // --- Main Render (Two-Side Layout) ---

  return (
    <div className='flex h-screen overflow-hidden bg-white'>
      
      {/* 1. Connections List (Left Pane) - Always visible on desktop, toggle on mobile */}
      <div className={`h-full ${isConnectionsListVisible ? 'w-full absolute inset-0 md:relative md:w-80' : 'hidden md:block md:w-80'}`}>
        <ConnectionsList />
      </div>

      {/* 2. Chat Area (Right Pane) - Always visible on desktop, toggle on mobile */}
      <div className={`h-full ${isConnectionsListVisible ? 'hidden md:flex flex-1' : 'flex flex-1'}`}>
        <ChatContent />
      </div>

    </div>
  );
};

export default ChatBox;