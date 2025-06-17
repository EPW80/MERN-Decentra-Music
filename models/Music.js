import mongoose from "mongoose";

const MusicSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  artist: {
    type: String,
    required: true,
  },
  genre: String,
  album: String,
  price: {
    type: String,
    default: "0",
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  blockchainId: String,

  // IPFS storage
  ipfs: {
    cid: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    audioHash: String, // For backward compatibility
  },

  // File metadata
  fileSize: Number,
  mimeType: String,
  duration: Number,

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("Music", MusicSchema);
