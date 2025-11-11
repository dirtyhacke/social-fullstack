import mongoose from 'mongoose';

const playlistSongSchema = new mongoose.Schema({
    userId: { 
        type: String, 
        required: true, 
        ref: 'User' 
    },
    songId: { 
        type: String, 
        required: true 
    },
    name: { 
        type: String, 
        required: true 
    },
    primaryArtists: { 
        type: mongoose.Schema.Types.Mixed,
        required: true 
    },
    image: { 
        type: String, 
        required: true 
    },
    duration: { 
        type: String, 
        default: '0:00' 
    },
    downloadUrl: { 
        type: String 
    },
    language: { 
        type: String, 
        default: 'hindi' 
    },
    addedAt: { 
        type: Date, 
        default: Date.now 
    },
    playCount: {
        type: Number,
        default: 0
    },
    lastPlayed: {
        type: Date
    }
}, { 
    timestamps: true 
});

// Compound index to ensure a user can't add the same song multiple times
playlistSongSchema.index({ userId: 1, songId: 1 }, { unique: true });

const PlaylistSong = mongoose.model('PlaylistSong', playlistSongSchema);

export default PlaylistSong;