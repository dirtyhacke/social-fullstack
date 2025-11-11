import express from 'express';
import PlaylistSong from '../models/PlaylistSong.js';

const router = express.Router();

// Helper function to extract artist names
const extractArtistNames = (artistData) => {
    if (!artistData) return 'Unknown Artist';
    
    if (typeof artistData === 'string') {
        return artistData;
    }
    
    if (Array.isArray(artistData)) {
        const artistNames = artistData
            .filter(artist => artist && artist.name)
            .map(artist => artist.name);
        return artistNames.length > 0 ? artistNames.join(', ') : 'Various Artists';
    }
    
    if (typeof artistData === 'object') {
        if (artistData.primary) {
            return artistData.primary;
        } else if (artistData.all) {
            return artistData.all;
        } else if (artistData.featured) {
            return artistData.featured;
        } else {
            const values = Object.values(artistData).filter(val => val && typeof val === 'string');
            return values.length > 0 ? values.join(', ') : 'Various Artists';
        }
    }
    
    return String(artistData);
};

// Add song to playlist
router.post('/add', async (req, res) => {
    try {
        const { userId, song } = req.body;
        
        console.log('📋 Add to playlist request:', { userId, song: song?.name });
        
        if (!userId || !song || !song.id) {
            return res.status(400).json({
                success: false,
                error: 'User ID and song data are required'
            });
        }

        // Check if song is already in playlist
        const existingSong = await PlaylistSong.findOne({ 
            userId: userId, 
            songId: song.id 
        });

        if (existingSong) {
            return res.status(400).json({
                success: false,
                error: 'Song already in playlist'
            });
        }

        // Extract and format artist names
        const artistNames = extractArtistNames(song.primaryArtists || song.artists);

        // Create new playlist song
        const playlistSong = new PlaylistSong({
            userId: userId,
            songId: song.id,
            name: song.name || 'Unknown Song',
            primaryArtists: artistNames,
            image: song.image || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
            duration: song.duration || '3:45',
            downloadUrl: song.downloadUrl,
            language: song.language || 'hindi'
        });

        await playlistSong.save();

        console.log('✅ Song added to playlist:', playlistSong.name);

        res.json({
            success: true,
            message: 'Song added to playlist',
            playlistSong: playlistSong
        });

    } catch (error) {
        console.error('🎵 Add to playlist error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add song to playlist: ' + error.message
        });
    }
});

// Remove song from playlist
router.post('/remove', async (req, res) => {
    try {
        const { userId, songId } = req.body;
        
        if (!userId || !songId) {
            return res.status(400).json({
                success: false,
                error: 'User ID and song ID are required'
            });
        }

        const result = await PlaylistSong.findOneAndDelete({ 
            userId: userId, 
            songId: songId 
        });

        if (!result) {
            return res.status(404).json({
                success: false,
                error: 'Song not found in playlist'
            });
        }

        res.json({
            success: true,
            message: 'Song removed from playlist'
        });

    } catch (error) {
        console.error('🎵 Remove from playlist error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to remove song from playlist: ' + error.message
        });
    }
});

// Get user's playlist songs
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

        const playlistSongs = await PlaylistSong.find({ userId: userId })
            .sort({ addedAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await PlaylistSong.countDocuments({ userId: userId });

        res.json({
            success: true,
            playlistSongs: playlistSongs,
            total: total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });

    } catch (error) {
        console.error('🎵 Get playlist songs error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get playlist songs: ' + error.message
        });
    }
});

export default router;