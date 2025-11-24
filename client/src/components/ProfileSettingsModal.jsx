import React, { useState, useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { useSelector } from 'react-redux'

const ProfileSettingsModal = ({ setShowSettings, user }) => {
  const { getToken } = useAuth()
  const currentUser = useSelector((state) => state.user.value)
  const [settings, setSettings] = useState({
    profilePrivacy: 'public',
    messageSetting: 'anyone',
    allowedMessagingUsers: []
  })
  const [loading, setLoading] = useState(false)
  const [customUsers, setCustomUsers] = useState([])
  const [searchInput, setSearchInput] = useState('')
  const [searchResults, setSearchResults] = useState([])

  // Load user settings
  useEffect(() => {
    const loadUserSettings = async () => {
      const token = await getToken()
      try {
        const { data } = await api.get('/api/user/settings', {
          headers: { Authorization: `Bearer ${token}` }
        })
        
        if (data.success) {
          const userSettings = data.settings || {
            profilePrivacy: 'public',
            messageSetting: 'anyone',
            allowedMessagingUsers: []
          }
          
          setSettings(userSettings)
          
          // Load allowed users details if needed
          if (userSettings.allowedMessagingUsers.length > 0) {
            await fetchAllowedUsersDetails(userSettings.allowedMessagingUsers)
          }
        }
      } catch (error) {
        console.error('Error loading settings:', error)
        // Fallback to user props if API fails
        if (user?.settings) {
          setSettings({
            profilePrivacy: user.settings.profilePrivacy || 'public',
            messageSetting: user.settings.messageSetting || 'anyone',
            allowedMessagingUsers: user.settings.allowedMessagingUsers || []
          })
        }
      }
    }

    loadUserSettings()
  }, [user, getToken])

  const fetchAllowedUsersDetails = async (userIds) => {
    if (!userIds.length) return
    
    const token = await getToken()
    try {
      const { data } = await api.post('/api/user/get-users-by-ids', { userIds }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (data.success) {
        setCustomUsers(data.users || [])
      }
    } catch (error) {
      console.error('Error fetching user details:', error)
    }
  }

  const searchUsers = async (query) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    
    const token = await getToken()
    try {
      const { data } = await api.post('/api/user/discover', { input: query }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (data.success) {
        const filtered = data.users.filter(u => 
          u._id !== currentUser._id && 
          !settings.allowedMessagingUsers.includes(u._id)
        )
        setSearchResults(filtered)
      }
    } catch (error) {
      console.error('Search error:', error)
      toast.error('Failed to search users')
    }
  }

  const handleSaveSettings = async () => {
    setLoading(true)
    const token = await getToken()
    try {
      const { data } = await api.put('/api/user/settings', settings, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (data.success) {
        toast.success('Settings updated successfully!')
        setShowSettings(false)
        // Trigger refresh in parent component
        if (window.updateUserData) {
          window.updateUserData()
        }
      } else {
        toast.error(data.message || 'Failed to update settings')
      }
    } catch (error) {
      console.error('Save settings error:', error)
      toast.error(error.response?.data?.message || 'Failed to update settings')
    } finally {
      setLoading(false)
    }
  }

  const addAllowedUser = (user) => {
    if (!settings.allowedMessagingUsers.includes(user._id)) {
      const updatedAllowedUsers = [...settings.allowedMessagingUsers, user._id]
      const updatedCustomUsers = [...customUsers, user]
      
      setSettings(prev => ({
        ...prev,
        allowedMessagingUsers: updatedAllowedUsers
      }))
      setCustomUsers(updatedCustomUsers)
      setSearchInput('')
      setSearchResults([])
      toast.success(`Added ${user.full_name} to allowed messaging list`)
    }
  }

  const removeAllowedUser = (userId) => {
    const userToRemove = customUsers.find(u => u._id === userId)
    const updatedAllowedUsers = settings.allowedMessagingUsers.filter(id => id !== userId)
    const updatedCustomUsers = customUsers.filter(user => user._id !== userId)
    
    setSettings(prev => ({
      ...prev,
      allowedMessagingUsers: updatedAllowedUsers
    }))
    setCustomUsers(updatedCustomUsers)
    
    if (userToRemove) {
      toast.success(`Removed ${userToRemove.full_name} from allowed messaging list`)
    }
  }

  // Handle radio button changes
  const handleProfilePrivacyChange = (value) => {
    console.log('Setting profile privacy to:', value)
    setSettings(prev => ({
      ...prev,
      profilePrivacy: value
    }))
  }

  const handleMessageSettingChange = (value) => {
    console.log('Setting message setting to:', value)
    setSettings(prev => ({
      ...prev,
      messageSetting: value
    }))
  }

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
      <div className='bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto'>
        <div className='flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10'>
          <h2 className='text-xl font-bold text-gray-900'>Profile Settings</h2>
          <button 
            onClick={() => setShowSettings(false)}
            className='text-gray-400 hover:text-gray-600 transition-colors text-2xl font-light'
            disabled={loading}
          >
            &times;
          </button>
        </div>

        <div className='p-6 space-y-6'>
          {/* Profile Privacy Section */}
          <div>
            <h3 className='text-lg font-semibold text-gray-900 mb-3'>Profile Privacy</h3>
            <div className='space-y-2'>
              {[
                { 
                  value: 'public', 
                  label: 'Public', 
                  description: 'Anyone can see your profile and posts' 
                },
                { 
                  value: 'private', 
                  label: 'Private', 
                  description: 'Only approved followers can see your profile and posts' 
                }
              ].map((option) => (
                <label 
                  key={option.value} 
                  className='flex items-start space-x-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors'
                >
                  <input
                    type='radio'
                    value={option.value}
                    checked={settings.profilePrivacy === option.value}
                    onChange={(e) => handleProfilePrivacyChange(e.target.value)}
                    className='mt-1 text-green-600 focus:ring-green-500 border-gray-300'
                  />
                  <div className='flex-1'>
                    <p className='font-medium text-gray-900'>{option.label}</p>
                    <p className='text-sm text-gray-500 mt-1'>{option.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Message Settings Section */}
          <div>
            <h3 className='text-lg font-semibold text-gray-900 mb-3'>Message Settings</h3>
            <div className='space-y-2'>
              {[
                { 
                  value: 'anyone', 
                  label: 'Anyone', 
                  description: 'Anyone can send you messages and message requests' 
                },
                { 
                  value: 'custom', 
                  label: 'Custom', 
                  description: 'Only selected users can message you directly' 
                },
                { 
                  value: 'private', 
                  label: 'Private', 
                  description: 'Only people you follow can message you' 
                }
              ].map((option) => (
                <label 
                  key={option.value} 
                  className='flex items-start space-x-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors'
                >
                  <input
                    type='radio'
                    value={option.value}
                    checked={settings.messageSetting === option.value}
                    onChange={(e) => handleMessageSettingChange(e.target.value)}
                    className='mt-1 text-green-600 focus:ring-green-500 border-gray-300'
                  />
                  <div className='flex-1'>
                    <p className='font-medium text-gray-900'>{option.label}</p>
                    <p className='text-sm text-gray-500 mt-1'>{option.description}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* Custom Users Selection */}
            {settings.messageSetting === 'custom' && (
              <div className='mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200'>
                <h4 className='font-medium text-gray-900 mb-3'>Select users who can message you:</h4>
                
                {/* Search Input */}
                <input
                  type='text'
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value)
                    searchUsers(e.target.value)
                  }}
                  placeholder='Search users by name or username...'
                  className='w-full p-3 border border-gray-300 rounded-lg mb-3 focus:ring-2 focus:ring-green-500 focus:border-transparent'
                  disabled={loading}
                />

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className='mb-4 max-h-32 overflow-y-auto border border-gray-200 rounded-lg bg-white'>
                    {searchResults.map(user => (
                      <div 
                        key={user._id} 
                        className='flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-gray-50'
                      >
                        <div className='flex items-center space-x-3'>
                          <img 
                            src={user.profile_picture || '/default-avatar.png'} 
                            className='w-8 h-8 rounded-full object-cover'
                            alt={user.full_name}
                            onError={(e) => {
                              e.target.src = '/default-avatar.png'
                            }}
                          />
                          <div>
                            <p className='font-medium text-gray-900 text-sm'>{user.full_name}</p>
                            <p className='text-xs text-gray-500'>@{user.username}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => addAllowedUser(user)}
                          className='px-3 py-1 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50'
                          disabled={loading}
                        >
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Selected Users */}
                <div className='space-y-2'>
                  <p className='text-sm font-medium text-gray-700 mb-2'>
                    Allowed users ({settings.allowedMessagingUsers.length}):
                  </p>
                  {customUsers.length > 0 ? (
                    customUsers.map(user => (
                      <div 
                        key={user._id} 
                        className='flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-50'
                      >
                        <div className='flex items-center space-x-3'>
                          <img 
                            src={user.profile_picture || '/default-avatar.png'} 
                            className='w-8 h-8 rounded-full object-cover'
                            alt={user.full_name}
                            onError={(e) => {
                              e.target.src = '/default-avatar.png'
                            }}
                          />
                          <div>
                            <p className='font-medium text-gray-900 text-sm'>{user.full_name}</p>
                            <p className='text-xs text-gray-500'>@{user.username}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => removeAllowedUser(user._id)}
                          className='px-3 py-1 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50'
                          disabled={loading}
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className='text-center py-4'>
                      <p className='text-sm text-gray-500'>No users selected yet</p>
                      <p className='text-xs text-gray-400 mt-1'>Search and add users above</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Buttons */}
        <div className='flex justify-end space-x-3 p-6 border-t bg-white sticky bottom-0'>
          <button
            onClick={() => setShowSettings(false)}
            disabled={loading}
            className='px-6 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors'
          >
            Cancel
          </button>
          <button
            onClick={handleSaveSettings}
            disabled={loading}
            className='px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2'
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Saving...</span>
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProfileSettingsModal