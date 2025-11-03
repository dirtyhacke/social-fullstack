import mongoose from 'mongoose';

const likedGameSchema = new mongoose.Schema({
    user_id: { 
        type: String, 
        required: true, 
        ref: 'User' 
    },
    game_id: { 
        type: String, 
        required: true 
    },
    title: { 
        type: String, 
        required: true 
    },
    description: { 
        type: String, 
        default: '' 
    },
    thumbnail: { 
        type: String, 
        default: '' 
    },
    genre: { 
        type: String, 
        default: '' 
    },
    platform: { 
        type: String, 
        default: 'Web Browser' 
    },
    game_url: { 
        type: String, 
        required: true 
    },
    rating: { 
        type: Number, 
        default: 0 
    },
    players: { 
        type: String, 
        default: 'Single Player' 
    },
    duration: { 
        type: String, 
        default: '10-30 min' 
    },
    developer: { 
        type: String, 
        default: 'Unknown' 
    },
    source: { 
        type: String, 
        default: 'freeToGame' 
    }
}, { 
    timestamps: true 
});

// Compound index to ensure a user can't like the same game multiple times
likedGameSchema.index({ user_id: 1, game_id: 1 }, { unique: true });

const LikedGame = mongoose.model('LikedGame', likedGameSchema);

export default LikedGame;