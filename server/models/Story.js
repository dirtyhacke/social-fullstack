import mongoose from 'mongoose';

const storySchema = new mongoose.Schema({
    user: { type: String, ref: 'User', required: true },
    content: { type: String },
    media_url: { type: String },
    media_type: { type: String, enum: ['text', 'image', 'video'] },
    views_count: [{ type: String, ref: 'User' }],
    background_color: { type: String },
    
    // Music fields
    music_data: {
        id: { type: String },
        name: { type: String },
        artist: { type: String },
        image: { type: String },
        duration: { type: String },
        downloadUrl: { type: String },
        clipDuration: { type: Number, default: 15 },
        favoritePartStart: { type: Number, default: 0 }
    },
    
    // Music display settings
    music_position: {
        x: { type: Number, default: 50 },
        y: { type: Number, default: 20 }
    },
    show_lyrics: { type: Boolean, default: false },
    hide_watermark: { type: Boolean, default: false },
    card_size: { type: String, enum: ['small', 'medium', 'large'], default: 'medium' },
    card_style: { type: String, enum: ['default', 'minimal', 'classic', 'modern'], default: 'default' }
    
}, { timestamps: true, minimize: false })

const Story = mongoose.model('Story', storySchema)

export default Story;