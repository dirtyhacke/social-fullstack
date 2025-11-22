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

  useEffect(() => {
    if (user?.settings) {
      setSettings({
        profilePrivacy: user.settings.profilePrivacy || 'public',
        messageSetting: user.settings.messageSetting || 'anyone',
        allowedMessagingUsers: user.settings.allowedMessagingUsers || []
      })
    }
  }, [user])

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
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const addAllowedUser = (user) => {
    if (!settings.allowedMessagingUsers.includes(user._id)) {
      setSettings(prev => ({
        ...prev,
        allowedMessagingUsers: [...prev.allowedMessagingUsers, user._id]
      }))
      setCustomUsers(prev => [...prev, user])
      setSearchInput('')
      setSearchResults([])
    }
  }

  const removeAllowedUser = (userId) => {
    setSettings(prev => ({
      ...prev,
      allowedMessagingUsers: prev.allowedMessagingUsers.filter(id => id !== userId)
    }))
    setCustomUsers(prev => prev.filter(user => user._id !== userId))
  }

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
      <div className='bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto'>
        <div className='flex items-center justify-between p-6 border-b sticky top-0 bg-white'>
          <h2 className='text-xl font-bold text-gray-900'>Profile Settings</h2>
          <button 
            onClick={() => setShowSettings(false)}
            className='text-gray-400 hover:text-gray-600 transition-colors'
          >
            ✕
          </button>
        </div>

        <div className='p-6 space-y-6'>
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
                <label key={option.value} className='flex items-start space-x-3 cursor-pointer'>
                  <input
                    type='radio'
                    value={option.value}
                    checked={settings.profilePrivacy === option.value}
                    onChange={(e) => setSettings(prev => ({ ...prev, profilePrivacy: e.target.value }))}
                    className='mt-1 text-green-600 focus:ring-green-500'
                  />
                  <div>
                    <p className='font-medium text-gray-900'>{option.label}</p>
                    <p className='text-sm text-gray-500'>{option.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

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
                <label key={option.value} className='flex items-start space-x-3 cursor-pointer'>
                  <input
                    type='radio'
                    value={option.value}
                    checked={settings.messageSetting === option.value}
                    onChange={(e) => setSettings(prev => ({ ...prev, messageSetting: e.target.value }))}
                    className='mt-1 text-green-600 focus:ring-green-500'
                  />
                  <div>
                    <p className='font-medium text-gray-900'>{option.label}</p>
                    <p className='text-sm text-gray-500'>{option.description}</p>
                  </div>
                </label>
              ))}
            </div>

            {settings.messageSetting === 'custom' && (
              <div className='mt-4 p-4 bg-gray-50 rounded-lg'>
                <h4 className='font-medium text-gray-900 mb-3'>Select users who can message you:</h4>
                
                <input
                  type='text'
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value)
                    searchUsers(e.target.value)
                  }}
                  placeholder='Search users...'
                  className='w-full p-2 border border-gray-300 rounded-lg mb-3'
                />

                {searchResults.length > 0 && (
                  <div className='mb-3 max-h-32 overflow-y-auto'>
                    {searchResults.map(user => (
                      <div key={user._id} className='flex items-center justify-between p-2 bg-white rounded border mb-1'>
                        <div className='flex items-center'>
                          <img 
                            src={user.profile_picture || '/default-avatar.png'} 
                            className='w-6 h-6 rounded-full mr-2'
                            alt={user.full_name}
                          />
                          <span className='text-sm'>{user.full_name}</span>
                        </div>
                        <button
                          onClick={() => addAllowedUser(user)}
                          className='text-green-600 hover:text-green-800 text-sm'
                        >
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className='space-y-2'>
                  <p className='text-sm text-gray-600 mb-2'>Allowed users ({settings.allowedMessagingUsers.length}):</p>
                  {customUsers.map(user => (
                    <div key={user._id} className='flex items-center justify-between p-2 bg-white rounded border'>
                      <div className='flex items-center'>
                        <img 
                          src={user.profile_picture || '/default-avatar.png'} 
                          className='w-6 h-6 rounded-full mr-2'
                          alt={user.full_name}
                        />
                        <span className='text-sm'>{user.full_name}</span>
                      </div>
                      <button
                        onClick={() => removeAllowedUser(user._id)}
                        className='text-red-600 hover:text-red-800 text-sm'
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {settings.allowedMessagingUsers.length === 0 && (
                    <p className='text-sm text-gray-500 text-center py-2'>No users selected</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className='flex justify-end space-x-3 p-6 border-t sticky bottom-0 bg-white'>
          <button
            onClick={() => setShowSettings(false)}
            className='px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors'
          >
            Cancel
          </button>
          <button
            onClick={handleSaveSettings}
            disabled={loading}
            className='px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProfileSettingsModal