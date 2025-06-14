import mongoose from 'mongoose';

const ArtistSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    bio: {
        type: String,
        maxlength: 1000
    },
    genres: [{
        type: String,
        trim: true
    }],
    profileImage: {
        type: String
    },
    socialLinks: {
        twitter: String,
        instagram: String,
        website: String
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    totalPlays: {
        type: Number,
        default: 0
    },
    totalFollowers: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

export default mongoose.model('Artist', ArtistSchema);