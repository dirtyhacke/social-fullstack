import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../api/axios.js'
import toast from 'react-hot-toast'

const initialState = {
    value: null,
    loading: false,
    error: null
}

export const fetchUser = createAsyncThunk('user/fetchUser', async (token, { rejectWithValue }) => {
    try {
        console.log('🔍 Fetching user data...');
        // ✅ CHANGED: /api/user/data → /api/users/data
        const { data } = await api.get('/api/users/data', {
            headers: {Authorization: `Bearer ${token}`}
        })
        
        console.log('📨 User data response:', data);
        
        if(data.success){
            return data.user;
        } else {
            return rejectWithValue(data.message || 'Failed to fetch user data');
        }
    } catch (error) {
        console.log('❌ Error fetching user:', error);
        return rejectWithValue(error.response?.data?.message || error.message);
    }
})

export const updateUser = createAsyncThunk('user/update', async ({userData ,token}, { rejectWithValue }) => {
    try {
        // ✅ CHANGED: /api/user/update → /api/users/update
        const { data } = await api.post('/api/users/update', userData, {
            headers: {Authorization: `Bearer ${token}`}
        })
        
        if(data.success){
            toast.success(data.message)
            return data.user
        } else {
            toast.error(data.message)
            return rejectWithValue(data.message)
        }
    } catch (error) {
        console.log('❌ Error updating user:', error);
        toast.error('Failed to update profile');
        return rejectWithValue(error.response?.data?.message || error.message);
    }
})

const userSlice = createSlice({
    name: 'user',
    initialState,
    reducers: {
        clearUser: (state) => {
            state.value = null;
            state.error = null;
        },
        clearError: (state) => {
            state.error = null;
        }
    },
    extraReducers: (builder)=>{
        builder
            .addCase(fetchUser.pending, (state)=>{
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchUser.fulfilled, (state, action)=>{
                state.loading = false;
                state.value = action.payload;
            })
            .addCase(fetchUser.rejected, (state, action)=>{
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(updateUser.pending, (state)=>{
                state.loading = true;
                state.error = null;
            })
            .addCase(updateUser.fulfilled, (state, action)=>{
                state.loading = false;
                state.value = action.payload;
            })
            .addCase(updateUser.rejected, (state, action)=>{
                state.loading = false;
                state.error = action.payload;
            })
    }
})

export const { clearUser, clearError } = userSlice.actions;
export default userSlice.reducer