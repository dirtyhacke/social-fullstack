// models/LikedSong.js
import mongoose from 'mongoose';

const likedSongSchema = new mongoose.Schema({
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
        type: mongoose.Schema.Types.Mixed, // Change to Mixed to handle both string and array
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
    likedAt: { 
        type: Date, 
        default: Date.now 
    }
}, { 
    timestamps: true 
});

// Compound index to ensure a user can't like the same song multiple times
likedSongSchema.index({ userId: 1, songId: 1 }, { unique: true });

const LikedSong = mongoose.model('LikedSong', likedSongSchema);

export default LikedSong;