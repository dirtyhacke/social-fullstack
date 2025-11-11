import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    from_user_id: {
        type: String,
        ref: 'User',
        required: true
    },
    to_user_id: {
        type: String,
        ref: 'User',
        // Make to_user_id optional when group_id is present
        required: function() {
            return !this.group_id; // Only required for individual messages
        }
    },
    group_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        // Make group_id optional when to_user_id is present
        required: function() {
            return !this.to_user_id; // Only required for group messages
        }
    },
    text: {
        type: String,
        trim: true,
        // Text is optional for media messages
        required: function() {
            return !this.media_url && this.message_type !== 'system';
        }
    },
    message_type: {
        type: String,
        enum: ['text', 'image', 'audio', 'sticker', 'system'],
        default: 'text'
    },
    media_url: {
        type: String
    },
    reply_to: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    },
    seen: {
        type: Boolean,
        default: false
    },
    delivered: {
        type: Boolean,
        default: false
    },
    seen_by: [{
        type: String,
        ref: 'User'
    }],
    duration: {
        type: Number,
        default: 0
    },
    // Group message specific fields
    mentions: [{
        type: String,
        ref: 'User'
    }],
    is_system_message: {
        type: Boolean,
        default: false
    },
    // Additional fields for better functionality
    edited: {
        type: Boolean,
        default: false
    },
    edited_at: {
        type: Date
    },
    deleted: {
        type: Boolean,
        default: false
    },
    deleted_at: {
        type: Date
    },
    reactions: [{
        user_id: {
            type: String,
            ref: 'User',
            required: true
        },
        emoji: {
            type: String,
            required: true
        },
        created_at: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true,
    minimize: false
});

// Virtual for checking if message is a group message
messageSchema.virtual('isGroupMessage').get(function() {
    return !!this.group_id;
});

// Virtual for checking if message is an individual message
messageSchema.virtual('isIndividualMessage').get(function() {
    return !!this.to_user_id;
});

// Compound indexes for better performance
messageSchema.index({ from_user_id: 1, to_user_id: 1 });
messageSchema.index({ group_id: 1, createdAt: -1 });
messageSchema.index({ createdAt: -1 });
messageSchema.index({ 'reactions.user_id': 1 });
messageSchema.index({ deleted: 1 }); // For soft delete queries

// Text search index for message content
messageSchema.index({ text: 'text' });

// Middleware to validate that message is either individual OR group, not both
messageSchema.pre('save', function(next) {
    if (this.to_user_id && this.group_id) {
        const error = new Error('Message cannot have both to_user_id and group_id');
        return next(error);
    }
    
    if (!this.to_user_id && !this.group_id) {
        const error = new Error('Message must have either to_user_id or group_id');
        return next(error);
    }
    
    // For system messages in groups, ensure they have group_id
    if (this.is_system_message && !this.group_id) {
        const error = new Error('System messages must be in a group');
        return next(error);
    }
    
    next();
});

// Static method to find messages by group with pagination
messageSchema.statics.findByGroup = function(groupId, options = {}) {
    const { limit = 50, skip = 0, before = null } = options;
    
    let query = { group_id: groupId, deleted: false };
    
    // If before date is provided, get messages before that date
    if (before) {
        query.createdAt = { $lt: new Date(before) };
    }
    
    return this.find(query)
        .populate('from_user_id', 'full_name profile_picture username')
        .populate('reply_to')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip);
};

// Static method to find messages by user conversation with pagination
messageSchema.statics.findByUsers = function(userId1, userId2, options = {}) {
    const { limit = 50, skip = 0, before = null } = options;
    
    let query = {
        $or: [
            { from_user_id: userId1, to_user_id: userId2 },
            { from_user_id: userId2, to_user_id: userId1 }
        ],
        deleted: false
    };
    
    // If before date is provided, get messages before that date
    if (before) {
        query.createdAt = { $lt: new Date(before) };
    }
    
    return this.find(query)
        .populate('from_user_id', 'full_name profile_picture username')
        .populate('reply_to')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip);
};

// Instance method to mark message as seen by a user
messageSchema.methods.markAsSeen = function(userId) {
    if (!this.seen_by.includes(userId)) {
        this.seen_by.push(userId);
    }
    this.seen = this.seen_by.length > 0;
    return this.save();
};

// Instance method to add reaction
messageSchema.methods.addReaction = function(userId, emoji) {
    // Remove existing reaction from this user
    this.reactions = this.reactions.filter(r => r.user_id.toString() !== userId);
    
    // Add new reaction
    this.reactions.push({
        user_id: userId,
        emoji: emoji
    });
    
    return this.save();
};

// Instance method to remove reaction
messageSchema.methods.removeReaction = function(userId) {
    this.reactions = this.reactions.filter(r => r.user_id.toString() !== userId);
    return this.save();
};

// Instance method for soft delete
messageSchema.methods.softDelete = function() {
    this.deleted = true;
    this.deleted_at = new Date();
    // Clear sensitive data but keep the message structure
    this.text = '[This message was deleted]';
    this.media_url = null;
    this.mentions = [];
    return this.save();
};

const Message = mongoose.model('Message', messageSchema);

export default Message;