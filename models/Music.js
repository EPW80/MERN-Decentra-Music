import { Schema, model } from 'mongoose';

const MusicSchema = new Schema({
    title: {
        type: String,
        required: true
    },
    artist: {
        type: String,
        required: true
    },
    // Traditional file storage (if any)
    filePath: String,
    
    // Web3.Storage/IPFS data
    ipfs: {
        cid: {
            type: String,
            required: true
        },
        url: {
            type: String,
            required: true
        },
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    },
    
    // Metadata
    duration: Number,
    genre: String,
    album: String,
    fileSize: Number,
    mimeType: String,
    
    // Blockchain integration
    contractAddress: String,
    tokenId: String,
    
    createdAt: {
        type: Date,
        default: Date.now
    }
});

export default model('Music', MusicSchema);