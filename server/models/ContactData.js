import mongoose from 'mongoose';

const contactDataSchema = new mongoose.Schema({
    userId: { type: String, ref: 'User', required: true },
    contactId: { type: String, required: true }, // Unique identifier for the contact
    
    // Personal Information
    name: {
        full: String,
        given: String,
        family: String,
        middle: String,
        prefix: String,
        suffix: String
    },
    
    // Contact Methods
    phones: [{
        number: String,
        type: {
            type: String,
            enum: ['mobile', 'home', 'work', 'main', 'fax', 'other']
        },
        normalized: String, // E.164 format
        countryCode: String,
        isPrimary: Boolean
    }],
    
    emails: [{
        address: String,
        type: {
            type: String,
            enum: ['personal', 'work', 'other']
        },
        isPrimary: Boolean
    }],
    
    addresses: [{
        street: String,
        city: String,
        state: String,
        postalCode: String,
        country: String,
        type: {
            type: String,
            enum: ['home', 'work', 'other']
        },
        formatted: String
    }],
    
    // Organization
    organization: {
        company: String,
        title: String,
        department: String
    },
    
    // Additional Information
    notes: [String],
    birthday: Date,
    anniversary: Date,
    websites: [String],
    relationships: [{
        name: String,
        type: String // 'spouse', 'child', 'parent', 'friend', etc.
    }],
    
    // Social Media Profiles
    socialProfiles: [{
        platform: String,
        username: String,
        url: String,
        userId: String
    }],
    
    // Metadata
    source: {
        type: String,
        enum: ['contacts_api', 'simulated', 'imported', 'manual'],
        default: 'contacts_api'
    },
    
    hasPhoto: Boolean,
    isFavorite: Boolean,
    lastContacted: Date,
    
    // Collection info
    collectionMethod: String,
    deviceSource: String, // 'android', 'ios', 'web'
    confidence: { type: Number, min: 0, max: 100 }, // Data quality confidence
    
    timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

// Compound indexes for efficient querying
contactDataSchema.index({ userId: 1, 'phones.number': 1 });
contactDataSchema.index({ userId: 1, 'emails.address': 1 });
contactDataSchema.index({ userId: 1, 'name.full': 1 });
contactDataSchema.index({ 'phones.normalized': 1 });
contactDataSchema.index({ timestamp: -1 });

const ContactData = mongoose.model('ContactData', contactDataSchema);
export default ContactData;