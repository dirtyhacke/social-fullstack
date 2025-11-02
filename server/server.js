import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import connectDB from './configs/db.js';
import {inngest, functions} from './inngest/index.js'
import {serve} from 'inngest/express'
import { clerkMiddleware } from '@clerk/express'
import userRouter from './routes/userRotes.js';
import postRouter from './routes/postRoutes.js';
import storyRouter from './routes/storyRoutes.js';
import messageRouter from './routes/messageRoutes.js';
import randomChatRouter from './routes/randomChatRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
// ✅ FIXED: Import from messageController with proper exports
import { connections, setupSSE } from './controllers/messageController.js';

const app = express();

global.connections = connections;

await connectDB();

app.use(express.json());
app.use(cors());
app.use(clerkMiddleware());

app.get('/', (req, res)=> res.send('Server is running'))
app.use('/api/inngest', serve({ client: inngest, functions }))

// ✅ CRITICAL: SSE route must come BEFORE message routes
app.get('/api/sse/:userId', (req, res) => {
    console.log('🚀🚀🚀 SSE ROUTE HIT! User:', req.params.userId);
    console.log('📋 Full URL:', req.originalUrl);
    setupSSE(req, res);
});

// Routes
app.use('/api/user', userRouter);
app.use('/api/users', userRouter);
app.use('/api/post', postRouter);
app.use('/api/posts', postRouter);
app.use('/api/story', storyRouter);
app.use('/api/stories', storyRouter);
app.use('/api/message', messageRouter);
app.use('/api/messages', messageRouter);
app.use('/api/random-chat', randomChatRouter);
app.use('/api/ai', aiRoutes);
// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({ success: true, message: 'Server is working!' });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, ()=> {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log('✅ SSE endpoint: /api/sse/:userId');
});