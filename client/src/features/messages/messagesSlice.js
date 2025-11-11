import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../api/axios'

const initialState = {
    messages: []
}

export const fetchMessages = createAsyncThunk('messages/fetchMessages', async ({token, userId}) => {
    const { data } = await api.post('/api/message/get', {to_user_id: userId}, {
        headers: { Authorization: `Bearer ${token}` }
    })
    return data.success ? data : null
})

const messagesSlice = createSlice({
    name: 'messages',
    initialState,
    reducers: {
        setMessages: (state, action)=>{
            state.messages = action.payload;
        },
        addMessage: (state, action)=>{
            state.messages = [...state.messages, action.payload]
        },
        resetMessages: (state)=>{
            state.messages = [];
        },
        // 🆕 ADD THIS REDUCER
        updateMessage: (state, action) => {
            const updatedMessage = action.payload;
            const index = state.messages.findIndex(msg => msg._id === updatedMessage._id);
            if (index !== -1) {
                state.messages[index] = updatedMessage;
            }
        },
    },
    extraReducers: (builder)=>{
        builder.addCase(fetchMessages.fulfilled, (state, action)=>{
            if(action.payload){
                state.messages = action.payload.messages
            }
        })
    }
})

// 🆕 ADD updateMessage TO THE EXPORTS
export const {setMessages, addMessage, resetMessages, updateMessage} = messagesSlice.actions;

export default messagesSlice.reducer