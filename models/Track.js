import mongoose from "mongoose";

const TrackSchema = new mongoose.Schema(
  {
    // Basic track information
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    artist: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    genre: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    album: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    price: {
      type: String,
      default: "0",
    },

    // Blockchain data - REMOVE index: true from here
    blockchainId: {
      type: String,
    },
    txHash: {
      type: String,
    },

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
    },

    // File metadata
    fileSize: Number,
    mimeType: String,
    duration: Number,

    // Status
    isActive: {
      type: Boolean,
      default: true,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },

    // Engagement
    plays: {
      type: Number,
      default: 0,
    },
    downloads: {
      type: Number,
      default: 0,
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    storageProvider: {
      type: String,
      default: "local",
    },
  },
  {
    timestamps: true,
  }
);

// Add indexes ONLY here, not in the schema definition
TrackSchema.index({ artist: 1, createdAt: -1 });
TrackSchema.index({ genre: 1, isActive: 1 });
TrackSchema.index({ isActive: 1, isPublic: 1 });
TrackSchema.index({ blockchainId: 1 }, { sparse: true });

export default mongoose.model("Track", TrackSchema);
