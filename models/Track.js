import mongoose from "mongoose";

const TrackSchema = new mongoose.Schema(
  {
    // Basic track info
    title: {
      type: String,
      required: true,
      trim: true,
    },
    artist: {
      type: String,
      required: true,
      trim: true,
    },
    genre: {
      type: String,
      default: "other",
      trim: true,
    },
    album: {
      type: String,
      default: "",
      trim: true,
    },
    price: {
      type: String,
      default: "0.001",
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },

    // Storage info
    storage: {
      provider: String,
      cid: String,
      url: String,
      filename: String,
    },

    // Legacy IPFS support
    ipfs: {
      cid: String,
      url: String,
    },

    // File metadata
    fileSize: Number,
    mimeType: String,
    originalFilename: String,

    // Status
    isActive: {
      type: Boolean,
      default: true,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },

    // Stats
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

    // Enhanced blockchain info
    blockchain: {
      contractId: String,
      owner: String,
      artist: String,
      txHash: String,
      blockNumber: Number,
      addedAt: Date,
      mintedAt: Date,
      price: String,
      status: {
        type: String,
        enum: ["pending", "confirmed", "failed"],
        default: "pending",
      },
      pendingTxHash: String,
    },

    // Purchase history
    purchases: [
      {
        buyer: String,
        price: String,
        txHash: String,
        blockNumber: Number,
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Royalty payments
    royalties: [
      {
        artist: String,
        amount: String,
        txHash: String,
        blockNumber: Number,
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Withdrawal records
    withdrawals: [
      {
        artist: String,
        amount: String,
        txHash: String,
        blockNumber: Number,
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Financial tracking
    totalEarnings: {
      type: String,
      default: "0",
    },
  },
  {
    timestamps: true,
  }
);

// Create indexes
TrackSchema.index({ title: 1, artist: 1 });
TrackSchema.index({ genre: 1 });
TrackSchema.index({ isActive: 1, isPublic: 1 });
TrackSchema.index({ createdAt: -1 });
TrackSchema.index({ plays: -1 });

// FIXED: Create sparse unique index for blockchain contractId
// Sparse index ignores null values, preventing duplicate null errors
TrackSchema.index(
  { "blockchain.contractId": 1 },
  {
    unique: true,
    sparse: true,
    name: "blockchain_contractId_unique",
  }
);

// Remove the old problematic index if it exists
// Note: You may need to drop this manually in MongoDB

export default mongoose.model("Track", TrackSchema);
