// backend/routes/musicRoutes.js
import express from 'express';
import { request } from 'undici';

const router = express.Router();

// Working Saavn API base URL
const SAAVN_API_BASE = 'https://saavn.sumit.co/api';

// Search songs
router.get('/search/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const { page = '0', limit = '20' } = req.query;
        
        console.log('🎵 Searching Saavn for:', query);
        
        const { statusCode, body } = await request(
            `${SAAVN_API_BASE}/search/songs?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
        );
        
        const data = await body.json();
        
        if (statusCode !== 200) {
            throw new Error(`API returned status ${statusCode}`);
        }
        
        console.log('🎵 Raw API response:', JSON.stringify(data).substring(0, 500));
        
        // Safely extract songs from response
        let songs = [];
        if (data && data.data && data.data.results) {
            songs = data.data.results;
        } else if (data && data.results) {
            songs = data.results;
        } else if (Array.isArray(data)) {
            songs = data;
        }
        
        console.log('🎵 Saavn search successful, found', songs.length, 'songs');
        
        // Format the response safely
        const formattedSongs = songs.map((song, index) => {
            // Safe property access
            const safeSong = song || {};
            return {
                id: safeSong.id || `song_${index}_${Date.now()}`,
                name: safeSong.name || safeSong.title || 'Unknown Song',
                primaryArtists: safeSong.primaryArtists || safeSong.artists || safeSong.singers || 'Unknown Artist',
                image: getBestImage(safeSong),
                duration: formatDuration(safeSong.duration),
                downloadUrl: getBestDownloadUrl(safeSong),
                language: safeSong.language || 'hindi',
                album: safeSong.album || null,
                year: safeSong.year || null,
                copyright: safeSong.copyright || '',
                hasLyrics: safeSong.hasLyrics || false
            };
        }).filter(song => song.id && song.name); // Filter out invalid songs
        
        res.json({
            success: true,
            songs: formattedSongs,
            total: formattedSongs.length,
            hasMore: data.data?.hasMore || false,
            query: query
        });
        
    } catch (error) {
        console.error('🎵 Saavn search error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Search failed: ' + error.message,
            songs: [] // Always return empty array on error
        });
    }
});

// Get trending songs
router.get('/trending', async (req, res) => {
    try {
        console.log('🎵 Fetching trending songs');
        
        // Search for popular songs to simulate trending
        const popularSearches = [
            'Shape of You', 'Blinding Lights', 'Dance Monkey', 
            'Kesariya', 'Malayalam', 'Bollywood'
        ];
        
        const allSongs = [];
        
        for (const search of popularSearches.slice(0, 3)) {
            try {
                const { statusCode, body } = await request(
                    `${SAAVN_API_BASE}/search/songs?query=${encodeURIComponent(search)}&page=0&limit=3`
                );
                
                if (statusCode === 200) {
                    const data = await body.json();
                    if (data.data && data.data.results) {
                        allSongs.push(...data.data.results.slice(0, 2));
                    }
                }
            } catch (err) {
                console.log(`Search for ${search} failed:`, err.message);
            }
        }
        
        // Remove duplicates and format safely
        const uniqueSongs = allSongs.filter((song, index, self) =>
            index === self.findIndex(s => s.id === song.id)
        );
        
        const formattedSongs = uniqueSongs.map((song, index) => ({
            id: song.id || `trending_${index}_${Date.now()}`,
            name: song.name || 'Popular Song',
            primaryArtists: song.primaryArtists || song.artists || 'Various Artists',
            image: getBestImage(song),
            duration: formatDuration(song.duration),
            downloadUrl: getBestDownloadUrl(song),
            language: song.language || 'hindi',
            album: song.album || null,
            year: song.year || null
        })).filter(song => song.id && song.name);
        
        console.log('🎵 Trending songs fetched, found', formattedSongs.length, 'songs');
        
        res.json({
            success: true,
            songs: formattedSongs,
            total: formattedSongs.length
        });
        
    } catch (error) {
        console.error('🎵 Trending songs error:', error.message);
        res.json({
            success: false,
            error: 'Failed to fetch trending songs',
            songs: [] // Always return empty array
        });
    }
});

// Get song details
router.get('/song/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log('🎵 Fetching song details for:', id);
        
        // For now, return a mock response since we don't have direct song endpoint
        const songData = {
            id: id,
            name: 'Song Details',
            primaryArtists: 'Artist',
            image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
            duration: '3:45',
            downloadUrl: null, // We'll use search results for playback
            language: 'hindi',
            album: 'Album',
            year: '2024'
        };
        
        res.json({
            success: true,
            ...songData
        });
        
    } catch (error) {
        console.error('🎵 Song details error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch song details'
        });
    }
});

// Health check
router.get('/health', async (req, res) => {
    try {
        const { statusCode, body } = await request(
            `${SAAVN_API_BASE}/search/songs?query=test&page=0&limit=1`
        );
        
        const data = await body.json();
        
        res.json({ 
            status: 'OK', 
            message: 'Saavn API is working',
            songsAvailable: data.data?.results?.length > 0
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'Error', 
            message: 'Saavn API is not available',
            error: error.message 
        });
    }
});

// Helper functions
function getBestImage(song) {
    if (!song) return 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop';
    
    if (song.image) {
        if (Array.isArray(song.image)) {
            return song.image[2]?.url || song.image[1]?.url || song.image[0]?.url;
        }
        return song.image;
    }
    if (song.thumbnail) {
        return song.thumbnail;
    }
    return 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop';
}

function getBestDownloadUrl(song) {
    if (!song) return null;
    
    if (song.downloadUrl) {
        if (Array.isArray(song.downloadUrl)) {
            return song.downloadUrl[4]?.url || song.downloadUrl[3]?.url || song.downloadUrl[0]?.url;
        }
        return song.downloadUrl;
    }
    if (song.media_url) {
        return song.media_url;
    }
    if (song.url) {
        return song.url;
    }
    return null;
}

function formatDuration(seconds) {
    if (!seconds) return '3:45';
    const secs = parseInt(seconds);
    if (isNaN(secs)) return '3:45';
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
}

export default router;