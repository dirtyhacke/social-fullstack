// backend/routes/musicLikesRoutes.js
import express from 'express';
import LikedSong from '../models/LikedSong.js';

const router = express.Router();

// Helper function to extract artist names from various data structures
const extractArtistNames = (artistData) => {
    if (!artistData) return 'Unknown Artist';
    
    if (typeof artistData === 'string') {
        return artistData;
    }
    
    if (Array.isArray(artistData)) {
        // Handle array of artist objects
        const artistNames = artistData
            .filter(artist => artist && artist.name)
            .map(artist => artist.name);
        return artistNames.length > 0 ? artistNames.join(', ') : 'Various Artists';
    }
    
    if (typeof artistData === 'object') {
        // Handle object structure: {primary, featured, all, etc.}
        if (artistData.primary) {
            return artistData.primary;
        } else if (artistData.all) {
            return artistData.all;
        } else if (artistData.featured) {
            return artistData.featured;
        } else {
            // Convert all object values to string
            const values = Object.values(artistData).filter(val => val && typeof val === 'string');
            return values.length > 0 ? values.join(', ') : 'Various Artists';
        }
    }
    
    return String(artistData);
};

// Like a song
router.post('/like', async (req, res) => {
    try {
        const { userId, song } = req.body;
        
        if (!userId || !song || !song.id) {
            return res.status(400).json({
                success: false,
                error: 'User ID and song data are required'
            });
        }

        // Check if song is already liked
        const existingLike = await LikedSong.findOne({ 
            userId: userId, 
            songId: song.id 
        });

        if (existingLike) {
            return res.status(400).json({
                success: false,
                error: 'Song already liked'
            });
        }

        // Extract and format artist names
        const artistNames = extractArtistNames(song.primaryArtists || song.artists);

        // Create new liked song
        const likedSong = new LikedSong({
            userId: userId,
            songId: song.id,
            name: song.name || 'Unknown Song',
            primaryArtists: artistNames, // Store as string
            image: song.image || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
            duration: song.duration || '3:45',
            downloadUrl: song.downloadUrl,
            language: song.language || 'hindi'
        });

        await likedSong.save();

        res.json({
            success: true,
            message: 'Song added to likes',
            likedSong: likedSong
        });

    } catch (error) {
        console.error('🎵 Like song error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to like song: ' + error.message
        });
    }
});

// Unlike a song
router.post('/unlike', async (req, res) => {
    try {
        const { userId, songId } = req.body;
        
        if (!userId || !songId) {
            return res.status(400).json({
                success: false,
                error: 'User ID and song ID are required'
            });
        }

        const result = await LikedSong.findOneAndDelete({ 
            userId: userId, 
            songId: songId 
        });

        if (!result) {
            return res.status(404).json({
                success: false,
                error: 'Song not found in likes'
            });
        }

        res.json({
            success: true,
            message: 'Song removed from likes'
        });

    } catch (error) {
        console.error('🎵 Unlike song error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to unlike song: ' + error.message
        });
    }
});

// Get user's liked songs
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 50 } = req.query;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
        }

        const likedSongs = await LikedSong.find({ userId: userId })
            .sort({ likedAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await LikedSong.countDocuments({ userId: userId });

        res.json({
            success: true,
            likedSongs: likedSongs,
            total: total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });

    } catch (error) {
        console.error('🎵 Get liked songs error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get liked songs: ' + error.message
        });
    }
});

// Check if songs are liked by user
router.post('/check-likes', async (req, res) => {
    try {
        const { userId, songIds } = req.body;
        
        if (!userId || !Array.isArray(songIds)) {
            return res.status(400).json({
                success: false,
                error: 'User ID and song IDs array are required'
            });
        }

        const likedSongs = await LikedSong.find({ 
            userId: userId, 
            songId: { $in: songIds } 
        });

        const likedSongIds = likedSongs.map(song => song.songId);

        res.json({
            success: true,
            likedSongIds: likedSongIds
        });

    } catch (error) {
        console.error('🎵 Check likes error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check liked songs: ' + error.message
        });
    }
});

export default router;