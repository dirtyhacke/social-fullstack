import express from 'express';
import LikedGame from '../models/LikedGame.js';
import { clerkClient } from '@clerk/clerk-sdk-node';

const router = express.Router();

// Get all liked games for a user
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const likedGames = await LikedGame.find({ user_id: userId })
            .sort({ createdAt: -1 });
        
        res.json(likedGames);
    } catch (error) {
        console.error('Error fetching liked games:', error);
        res.status(500).json({ error: 'Failed to fetch liked games' });
    }
});

// Add game to liked games
router.post('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const gameData = req.body;

        const likedGame = new LikedGame({
            user_id: userId,
            ...gameData
        });

        await likedGame.save();
        res.status(201).json(likedGame);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ error: 'Game already liked' });
        }
        console.error('Error liking game:', error);
        res.status(500).json({ error: 'Failed to like game' });
    }
});

// Remove game from liked games
router.delete('/:userId/:gameId', async (req, res) => {
    try {
        const { userId, gameId } = req.params;
        
        const result = await LikedGame.findOneAndDelete({ 
            user_id: userId, 
            game_id: gameId 
        });
        
        if (!result) {
            return res.status(404).json({ error: 'Liked game not found' });
        }
        
        res.json({ message: 'Game unliked successfully' });
    } catch (error) {
        console.error('Error unliking game:', error);
        res.status(500).json({ error: 'Failed to unlike game' });
    }
});

// Check if game is liked
router.get('/:userId/:gameId/status', async (req, res) => {
    try {
        const { userId, gameId } = req.params;
        
        const likedGame = await LikedGame.findOne({ 
            user_id: userId, 
            game_id: gameId 
        });
        
        res.json({ isLiked: !!likedGame });
    } catch (error) {
        console.error('Error checking like status:', error);
        res.status(500).json({ error: 'Failed to check like status' });
    }
});

export default router;