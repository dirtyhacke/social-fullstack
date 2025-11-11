// routes/post.js
import express from 'express';
import { 
    addPost, 
    getFeedPosts, 
    likePost,
    getCommentsCount,
    addComment,
    getSharesCount,
    sharePost,
    getPostComments,
    updateComment,
    deleteComment
} from '../controllers/postController.js';
import { mediaUpload } from '../configs/multer.js';
import { protect } from '../middlewares/auth.js';

const postRouter = express.Router();

// Apply protect middleware to all routes
postRouter.use(protect);

// Now all routes below will be protected
postRouter.post('/add', mediaUpload, addPost); // Changed to mediaUpload
postRouter.get('/feed', getFeedPosts);
postRouter.post('/like', likePost);

// Comment and Share routes
postRouter.get('/comments/count/:postId', getCommentsCount);
postRouter.post('/comment', addComment);
postRouter.get('/shares/count/:postId', getSharesCount);
postRouter.post('/share', sharePost);
postRouter.get('/comments/:postId', getPostComments);

// Update and delete comments
postRouter.put('/comment/:commentId', updateComment);
postRouter.delete('/comment/:commentId', deleteComment);

export default postRouter;