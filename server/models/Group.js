import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true, 
        trim: true,
        maxlength: 100 
    },
    description: { 
        type: String, 
        trim: true,
        maxlength: 500 
    },
    created_by: { 
        type: String, 
        ref: 'User', 
        required: true 
    },
    admins: [{ 
        type: String, 
        ref: 'User' 
    }],
    members: [{ 
        type: String, 
        ref: 'User' 
    }],
    profile_picture: { 
        type: String 
    },
    is_public: { 
        type: Boolean, 
        default: false 
    },
    max_members: { 
        type: Number, 
        default: 100 
    },
    last_activity: { 
        type: Date, 
        default: Date.now 
    }
}, { 
    timestamps: true 
});

groupSchema.index({ name: 'text', description: 'text' });
groupSchema.index({ last_activity: -1 });
groupSchema.index({ 'members': 1 });

const Group = mongoose.model('Group', groupSchema);

export default Group;