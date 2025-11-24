import React, { useState, useEffect } from 'react'
import { Pencil, X, Check, MapPin, Navigation, User, Search, Shuffle, Image } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { updateUser } from '../features/user/userSlice';
import { useAuth } from '@clerk/clerk-react';
import toast from 'react-hot-toast';

// DiceBear API Styles for Avatars
const AVATAR_STYLES = {
  'adventurer': { name: 'Adventurer', baseUrl: 'https://api.dicebear.com/7.x/adventurer/svg' },
  'avataaars': { name: 'Classic', baseUrl: 'https://api.dicebear.com/7.x/avataaars/svg' },
  'pixel-art': { name: 'Pixel Art', baseUrl: 'https://api.dicebear.com/7.x/pixel-art/svg' },
  'bottts': { name: 'Robots', baseUrl: 'https://api.dicebear.com/7.x/bottts/svg' },
  'lorelei': { name: 'Fairy Tale', baseUrl: 'https://api.dicebear.com/7.x/lorelei/svg' },
  'micah': { name: 'Cartoon', baseUrl: 'https://api.dicebear.com/7.x/micah/svg' },
  'miniavs': { name: 'Mini Avatars', baseUrl: 'https://api.dicebear.com/7.x/miniavs/svg' },
  'personas': { name: 'Professional', baseUrl: 'https://api.dicebear.com/7.x/personas/svg' }
};

// Cover Photo Themes
const COVER_THEMES = {
  'nature': { name: 'Nature', baseUrl: 'https://picsum.photos/600/200?random=' },
  'gradient': { name: 'Gradient', baseUrl: 'https://picsum.photos/600/200?blur=2&random=' },
  'abstract': { name: 'Abstract', baseUrl: 'https://picsum.photos/600/200?grayscale&random=' },
  'city': { name: 'City', baseUrl: 'https://picsum.photos/600/200?city&random=' },
  'mountains': { name: 'Mountains', baseUrl: 'https://picsum.photos/600/200?mountains&random=' },
  'beach': { name: 'Beach', baseUrl: 'https://picsum.photos/600/200?beach&random=' }
};

// Generate random avatars
const generateRandomAvatars = (count = 100) => {
  const avatars = [];
  const styleKeys = Object.keys(AVATAR_STYLES);
  const colors = ['ffdfbf', 'b6e3f4', 'd1d4f9', 'ffadad', 'caffbf', 'fdffb6', 'ffd6a5', 'fffffc'];
  
  for (let i = 0; i < count; i++) {
    const styleKey = styleKeys[Math.floor(Math.random() * styleKeys.length)];
    const style = AVATAR_STYLES[styleKey];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const seed = `avatar-${i}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const avatar = {
      id: seed,
      name: `${style.name} ${i + 1}`,
      url: `${style.baseUrl}?seed=${seed}&backgroundColor=${color}`,
      style: styleKey
    };
    
    avatars.push(avatar);
  }
  
  return avatars;
};

// Generate cover photos
const generateCoverPhotos = () => {
  const covers = [];
  const themeKeys = Object.keys(COVER_THEMES);
  
  themeKeys.forEach((themeKey, index) => {
    const theme = COVER_THEMES[themeKey];
    for (let i = 0; i < 3; i++) {
      const seed = `cover-${themeKey}-${i}-${Date.now()}`;
      covers.push({
        id: seed,
        name: `${theme.name} ${i + 1}`,
        url: `${theme.baseUrl}${seed}`,
        style: themeKey
      });
    }
  });
  
  return covers;
};

// --- Location Detection Component ---
const LocationInput = ({ value, onChange, disabled }) => {
    const [isDetecting, setIsDetecting] = useState(false);
    const [showLocationOptions, setShowLocationOptions] = useState(false);

    const detectLocation = () => {
        if (!navigator.geolocation) {
            toast.error('Geolocation is not supported by your browser');
            return;
        }

        setIsDetecting(true);
        setShowLocationOptions(false);

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    console.log('Got coordinates:', latitude, longitude);
                    
                    // Try multiple reverse geocoding services for better reliability
                    let locationName = await tryReverseGeocoding(latitude, longitude);
                    
                    if (locationName) {
                        onChange(locationName);
                        toast.success('Location detected successfully!');
                    } else {
                        // If reverse geocoding fails, show coordinates
                        const fallbackLocation = `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`;
                        onChange(fallbackLocation);
                        toast.success('Location detected! (Coordinates only)');
                    }
                } catch (error) {
                    console.error('Location detection error:', error);
                    toast.error('Failed to get location details');
                } finally {
                    setIsDetecting(false);
                }
            },
            (error) => {
                console.error('Geolocation error:', error);
                let errorMessage = 'Failed to detect location';
                
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Location access denied. Please enable location permissions in your browser settings.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Location information unavailable.';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Location request timed out. Please try again.';
                        break;
                }
                
                toast.error(errorMessage);
                setIsDetecting(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 60000
            }
        );
    };

    // Try multiple reverse geocoding services
    const tryReverseGeocoding = async (lat, lng) => {
        const services = [
            // OpenStreetMap Nominatim (free, no API key required)
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`,
            
            // BigDataCloud (free tier)
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
            
            // GeoNames (free tier)
            `http://api.geonames.org/findNearbyPlaceNameJSON?lat=${lat}&lng=${lng}&username=demo`
        ];

        for (let serviceUrl of services) {
            try {
                console.log('Trying service:', serviceUrl);
                const response = await fetch(serviceUrl);
                
                if (!response.ok) continue;
                
                const data = await response.json();
                console.log('Service response:', data);
                
                let location = extractLocationName(data, serviceUrl);
                if (location) {
                    console.log('Found location:', location);
                    return location;
                }
            } catch (error) {
                console.log('Service failed:', serviceUrl, error);
                continue;
            }
        }
        
        return null;
    };

    // Extract location name from different service responses
    const extractLocationName = (data, serviceUrl) => {
        // OpenStreetMap Nominatim
        if (serviceUrl.includes('nominatim')) {
            if (data.address) {
                const { city, town, village, county, state, country } = data.address;
                return [city, town, village, county].find(Boolean) + ', ' + (state || country);
            }
        }
        
        // BigDataCloud
        if (serviceUrl.includes('bigdatacloud')) {
            if (data.city && data.countryName) {
                return `${data.city}, ${data.countryName}`;
            } else if (data.locality && data.countryName) {
                return `${data.locality}, ${data.countryName}`;
            }
        }
        
        // GeoNames
        if (serviceUrl.includes('geonames')) {
            if (data.geonames && data.geonames[0]) {
                const place = data.geonames[0];
                return `${place.name}, ${data.countryName}`;
            }
        }
        
        return null;
    };

    return (
        <div className="relative">
            <div className="flex gap-2">
                <div className="flex-1 relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        disabled={disabled}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                        placeholder="Enter your location manually"
                        onFocus={() => setShowLocationOptions(true)}
                    />
                </div>
                
                <button
                    type="button"
                    onClick={detectLocation}
                    disabled={isDetecting || disabled}
                    className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap min-w-[140px] justify-center"
                >
                    {isDetecting ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Detecting...</span>
                        </>
                    ) : (
                        <>
                            <Navigation className="w-4 h-4" />
                            <span>Auto Detect</span>
                        </>
                    )}
                </button>
            </div>

            {/* Location Options Dropdown */}
            {showLocationOptions && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                    <button
                        type="button"
                        onClick={() => {
                            detectLocation();
                            setShowLocationOptions(false);
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b border-gray-100"
                    >
                        <Navigation className="w-4 h-4 text-blue-600" />
                        <div>
                            <div className="font-medium text-gray-900">Use Current Location</div>
                            <div className="text-sm text-gray-500">Automatically detect your location</div>
                        </div>
                    </button>
                    
                    <button
                        type="button"
                        onClick={() => {
                            onChange('');
                            setShowLocationOptions(false);
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3"
                    >
                        <X className="w-4 h-4 text-gray-600" />
                        <div>
                            <div className="font-medium text-gray-900">Clear Location</div>
                            <div className="text-sm text-gray-500">Remove location information</div>
                        </div>
                    </button>
                </div>
            )}

            {/* Click outside to close dropdown */}
            {showLocationOptions && (
                <div 
                    className="fixed inset-0 z-0" 
                    onClick={() => setShowLocationOptions(false)}
                />
            )}
        </div>
    );
};

// --- Avatar Selector Component ---
const AvatarSelector = ({ onAvatarSelect }) => {
    const [showAvatarOptions, setShowAvatarOptions] = useState(false);
    const [selectedStyle, setSelectedStyle] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [avatars, setAvatars] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (showAvatarOptions && avatars.length === 0) {
            generateMoreAvatars();
        }
    }, [showAvatarOptions]);

    const generateMoreAvatars = () => {
        setIsLoading(true);
        setTimeout(() => {
            const newAvatars = generateRandomAvatars(50);
            setAvatars(prev => [...prev, ...newAvatars]);
            setIsLoading(false);
        }, 500);
    };

    const filteredAvatars = avatars.filter(avatar => {
        const matchesStyle = selectedStyle === 'all' || avatar.style === selectedStyle;
        const matchesSearch = avatar.name.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesStyle && matchesSearch;
    });

    const handleAvatarSelect = async (avatar) => {
        try {
            const response = await fetch(avatar.url);
            const blob = await response.blob();
            const file = new File([blob], `avatar-${avatar.id}.svg`, { type: 'image/svg+xml' });
            
            onAvatarSelect(file);
            setShowAvatarOptions(false);
            toast.success('Avatar selected!');
        } catch (error) {
            console.error('Error loading avatar:', error);
            toast.error('Failed to select avatar');
        }
    };

    const handleShuffle = () => {
        setAvatars([]);
        generateMoreAvatars();
    };

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setShowAvatarOptions(true)}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all font-medium flex items-center gap-2 text-sm"
            >
                <User className="w-4 h-4" />
                <span>Choose Avatar</span>
            </button>

            {showAvatarOptions && (
                <div className="fixed inset-0 z-[10000] bg-white flex flex-col">
                    {/* Header */}
                    <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
                        <div>
                            <h3 className="text-2xl font-bold text-gray-900">Choose Your Avatar</h3>
                            <p className="text-gray-600 mt-1">Select from unlimited unique avatars</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={handleShuffle}
                                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                                disabled={isLoading}
                            >
                                <Shuffle className="w-4 h-4" />
                                Shuffle
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowAvatarOptions(false)}
                                className="text-gray-500 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Search and Controls */}
                    <div className="p-4 border-b border-gray-200 bg-white">
                        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Search avatars..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-purple-500 focus:ring-1 focus:ring-purple-200"
                                />
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedStyle('all')}
                                    className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                                        selectedStyle === 'all' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    All
                                </button>
                                {Object.entries(AVATAR_STYLES).map(([key, style]) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setSelectedStyle(key)}
                                        className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                                            selectedStyle === key ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    >
                                        {style.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Avatars Grid */}
                    <div className="flex-1 overflow-auto bg-gray-50 p-4">
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                            {filteredAvatars.map((avatar) => (
                                <button
                                    key={avatar.id}
                                    type="button"
                                    onClick={() => handleAvatarSelect(avatar)}
                                    className="p-3 bg-white border border-gray-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-all flex flex-col items-center gap-2 group"
                                >
                                    <img
                                        src={avatar.url}
                                        alt={avatar.name}
                                        className="w-16 h-16 rounded-full object-cover border-2 border-gray-200 group-hover:border-purple-300 transition-colors"
                                        loading="lazy"
                                    />
                                    <span className="text-xs text-gray-600 text-center line-clamp-1">{avatar.name}</span>
                                </button>
                            ))}
                        </div>
                        
                        {isLoading && (
                            <div className="text-center py-4">
                                <div className="inline-flex items-center gap-2 text-purple-600">
                                    <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                                    Loading more avatars...
                                </div>
                            </div>
                        )}

                        {!isLoading && (
                            <div className="text-center py-4">
                                <button
                                    type="button"
                                    onClick={generateMoreAvatars}
                                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                                >
                                    Load More Avatars
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t border-gray-200 bg-white">
                        <button
                            type="button"
                            onClick={() => setShowAvatarOptions(false)}
                            className="w-full py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Cover Photo Selector Component ---
const CoverPhotoSelector = ({ onCoverSelect }) => {
    const [showCoverOptions, setShowCoverOptions] = useState(false);
    const [covers, setCovers] = useState([]);

    useEffect(() => {
        if (showCoverOptions && covers.length === 0) {
            setCovers(generateCoverPhotos());
        }
    }, [showCoverOptions]);

    const handleCoverSelect = async (cover) => {
        try {
            const response = await fetch(cover.url);
            const blob = await response.blob();
            const file = new File([blob], `cover-${cover.id}.jpg`, { type: 'image/jpeg' });
            
            onCoverSelect(file);
            setShowCoverOptions(false);
            toast.success('Cover photo selected!');
        } catch (error) {
            console.error('Error loading cover:', error);
            toast.error('Failed to select cover photo');
        }
    };

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setShowCoverOptions(true)}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all font-medium flex items-center gap-2 text-sm"
            >
                <Image className="w-4 h-4" />
                <span>Choose Cover</span>
            </button>

            {showCoverOptions && (
                <div className="fixed inset-0 z-[10000] bg-white flex flex-col">
                    <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-cyan-50">
                        <div>
                            <h3 className="text-2xl font-bold text-gray-900">Choose Cover Photo</h3>
                            <p className="text-gray-600 mt-1">Select from beautiful cover themes</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowCoverOptions(false)}
                            className="text-gray-500 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-auto bg-gray-50 p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {covers.map((cover) => (
                                <button
                                    key={cover.id}
                                    type="button"
                                    onClick={() => handleCoverSelect(cover)}
                                    className="group bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:scale-105"
                                >
                                    <div className="aspect-w-16 aspect-h-9 bg-gray-200">
                                        <img
                                            src={cover.url}
                                            alt={cover.name}
                                            className="w-full h-32 object-cover group-hover:scale-110 transition-transform duration-300"
                                            loading="lazy"
                                        />
                                    </div>
                                    <div className="p-3">
                                        <h4 className="font-medium text-gray-900 text-sm">{cover.name}</h4>
                                        <p className="text-xs text-gray-500 capitalize">{cover.style} theme</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="p-4 border-t border-gray-200 bg-white">
                        <button
                            type="button"
                            onClick={() => setShowCoverOptions(false)}
                            className="w-full py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Main ProfileModal Component ---
const ProfileModal = ({ setShowEdit }) => {
    const dispatch = useDispatch();
    const { getToken } = useAuth()
    const user = useSelector((state) => state.user.value)
    
    // CORE STATE
    const [editForm, setEditForm] = useState({
        username: user.username || '',
        bio: user.bio || '',
        location: user.location || '',
        profile_picture: user.profile_picture || null,
        cover_photo: user.cover_photo || null,
        full_name: user.full_name || '',
    })

    const [isSaving, setIsSaving] = useState(false);

    // --- Core Logic ---
    const handleSaveProfile = async () => {
        try {
            setIsSaving(true);
            const userData = new FormData();
            const { full_name, username, bio, location, profile_picture, cover_photo } = editForm

            if (!full_name.trim() || !username.trim()) {
                throw new Error('Name and Username are required.');
            }

            userData.append('username', username);
            userData.append('bio', bio);
            userData.append('location', location);
            userData.append('full_name', full_name);
            
            // Only append if it's a File object (new selection)
            if (profile_picture instanceof File) {
                userData.append('profile', profile_picture);
            }
            if (cover_photo instanceof File) {
                userData.append('cover', cover_photo);
            }

            const token = await getToken()
            await dispatch(updateUser({ userData, token })) 

            setShowEdit(false)
            toast.success('Profile updated successfully!');
        } catch (error) {
            toast.error(error.message || 'Error saving profile');
        } finally {
            setIsSaving(false);
        }
    }

    // Handle avatar selection
    const handleAvatarSelect = (avatarFile) => {
        setEditForm(prev => ({
            ...prev,
            profile_picture: avatarFile
        }));
    };

    // Handle cover photo selection
    const handleCoverSelect = (coverFile) => {
        setEditForm(prev => ({
            ...prev,
            cover_photo: coverFile
        }));
    };

    // Handle image upload directly without cropping
    const handleImageUpload = (key, file) => {
        if (file) {
            setEditForm(prev => ({
                ...prev,
                [key]: file
            }));
        }
    }

    // Handle location change
    const handleLocationChange = (location) => {
        setEditForm(prev => ({
            ...prev,
            location
        }));
    };

    // Utility function to get image URL for preview
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
                                onClick={()=> setShowEdit(false)} 
                                type='button' 
                                className='text-gray-500 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition'
                                aria-label="Close modal"
                            >
                                <X className='w-6 h-6' />
                            </button>
                        </div>

                        <form className='space-y-6' onSubmit={(e) => {
                            e.preventDefault();
                            handleSaveProfile();
                        }}>
                            
                            {/* Image Upload Area */}
                            <div className='space-y-6'>
                                
                                {/* Cover Photo Input */}
                                <div className='relative'>
                                    <div className="flex justify-between items-center mb-2">
                                        <label htmlFor="cover_photo_input" className="block text-sm font-semibold text-gray-700 cursor-pointer">
                                            Cover Photo
                                        </label>
                                        <CoverPhotoSelector onCoverSelect={handleCoverSelect} />
                                    </div>
                                    <input 
                                        hidden 
                                        type="file" 
                                        accept="image/*" 
                                        id="cover_photo_input" 
                                        onChange={(e) => {
                                            e.preventDefault();
                                            handleImageUpload('cover_photo', e.target.files[0]);
                                        }}
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
                                    <div className='flex flex-col items-start gap-4'>
                                        <div className="flex items-end gap-4">
                                            <label htmlFor="profile_picture_input" className='block cursor-pointer'>
                                                <input 
                                                    hidden 
                                                    type="file" 
                                                    accept="image/*" 
                                                    id="profile_picture_input" 
                                                    onChange={(e) => {
                                                        e.preventDefault();
                                                        handleImageUpload('profile_picture', e.target.files[0]);
                                                    }}
                                                />
                                                <div className='group/profile relative w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-xl transition-transform hover:scale-[1.02] hover:border-indigo-400'>
                                                    <img 
                                                        src={getImageUrl(editForm.profile_picture, user.profile_picture)} 
                                                        alt="Profile Preview" 
                                                        className='w-full h-full object-cover'
                                                        onError={(e) => { 
                                                            e.target.src = 'https://via.placeholder.com/100?text=P'; 
                                                        }}
                                                    />
                                                    <div className='absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/profile:opacity-100 transition-opacity duration-300'>
                                                        <Pencil className="w-5 h-5 text-white"/>
                                                    </div>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-2 ml-2">Upload Photo</p>
                                            </label>
                                            <AvatarSelector onAvatarSelect={handleAvatarSelect} />
                                        </div>
                                    </div>
                                </div>

                            </div>

                            {/* Form Fields */}
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
                                    <LocationInput 
                                        value={editForm.location}
                                        onChange={handleLocationChange}
                                        disabled={isSaving}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Use auto-detect for accurate location or type manually
                                    </p>
                                </div>
                            </div>

                            {/* Action Buttons */}
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
        </div>
    )
}

export default ProfileModal