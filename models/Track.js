import mongoose from "mongoose";

const TrackSchema = new mongoose.Schema(
  {
    // Basic track info
    title: {
      type: String,
      required: true,
      trim: true,
      maxLength: 200,
    },
    artist: {
      type: String,
      required: true,
      trim: true,
      maxLength: 100,
    },
    artistAddress: {
      type: String,
      validate: {
        validator: function(v) {
          if (!v) return true; // Allow empty/null for backward compatibility
          // Basic Ethereum address validation
          return /^0x[a-fA-F0-9]{40}$/.test(v);
        },
        message: 'artistAddress must be a valid Ethereum address'
      },
      index: true, // Add index for faster queries
    },
    genre: {
      type: String,
      default: "other",
      trim: true,
      maxLength: 50,
    },
    album: {
      type: String,
      default: "",
      trim: true,
      maxLength: 200,
    },
    price: {
      type: String,
      default: "0.001",
      required: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxLength: 1000,
    },

    // Storage info
    storage: {
      provider: {
        type: String,
        enum: ["local", "ipfs", "web3storage", "pinata"],
        default: "local",
      },
      cid: String,
      url: String,
      filename: String,
      path: String,
    },

    // Legacy IPFS support (for backward compatibility)
    ipfs: {
      cid: String,
      url: String,
      gateway: String,
    },

    // File metadata
    fileSize: {
      type: Number,
      default: 0,
      min: 0,
    },
    mimeType: {
      type: String,
      default: "audio/mpeg",
    },
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
      min: 0,
    },
    downloads: {
      type: Number,
      default: 0,
      min: 0,
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Enhanced blockchain info
    blockchain: {
      contractId: {
        type: String,
        sparse: true, // Allow multiple null values
      },
      owner: String,
      artist: String, // Legacy field for artist name
      artistAddress: {
        type: String,
        validate: {
          validator: function(v) {
            if (!v) return true; // Allow empty/null
            // Basic Ethereum address validation
            return /^0x[a-fA-F0-9]{40}$/.test(v);
          },
          message: 'artistAddress must be a valid Ethereum address'
        }
      },
      txHash: String,
      blockNumber: Number,
      addedAt: Date,
      mintedAt: Date,
      price: String,
      status: {
        type: String,
        enum: ["pending", "confirmed", "failed", "disabled"],
        default: "disabled", // Changed from "pending" to "disabled" since blockchain is optional
      },
      pendingTxHash: String,
      error: String, // Added to track blockchain errors
    },

    // Purchase history
    purchases: [
      {
        buyer: {
          type: String,
          required: true,
        },
        price: {
          type: String,
          required: true,
        },
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
        artist: {
          type: String,
          required: true,
        },
        amount: {
          type: String,
          required: true,
        },
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
        artist: {
          type: String,
          required: true,
        },
        amount: {
          type: String,
          required: true,
        },
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ===== INDEXES =====

// Text search index for full-text search
TrackSchema.index({ title: "text", artist: "text", album: "text" });

// Compound indexes for common queries
TrackSchema.index({ title: 1, artist: 1 });
TrackSchema.index({ isActive: 1, isPublic: 1 });
TrackSchema.index({ genre: 1, isActive: 1 }); // Optimized for genre filtering with active status

// Performance indexes for sorting and filtering
TrackSchema.index({ createdAt: -1 });
TrackSchema.index({ plays: -1 });

// Blockchain indexes - single sparse unique index as recommended
TrackSchema.index(
  { "blockchain.contractId": 1 },
  {
    unique: true,
    sparse: true, // This is crucial - allows multiple null/undefined values
    name: "blockchain_contractId_unique",
  }
);

// Additional blockchain status index for filtering
TrackSchema.index({ "blockchain.status": 1 });

// Storage provider index for performance
TrackSchema.index({ "storage.provider": 1 });

// ===== VIRTUALS =====

// Virtual for like count
TrackSchema.virtual("likeCount").get(function () {
  return this.likes ? this.likes.length : 0;
});

// Virtual for purchase count
TrackSchema.virtual("purchaseCount").get(function () {
  return this.purchases ? this.purchases.length : 0;
});

// Virtual for total royalties
TrackSchema.virtual("totalRoyalties").get(function () {
  if (!this.royalties || this.royalties.length === 0) return "0";

  return this.royalties.reduce((total, royalty) => {
    return (parseFloat(total) + parseFloat(royalty.amount || 0)).toString();
  }, "0");
});

// ===== MIDDLEWARE =====

// Pre-save middleware for data cleaning
TrackSchema.pre("save", function (next) {
  // Clean up text fields
  if (this.isModified("title")) {
    this.title = this.title.trim();
  }
  if (this.isModified("artist")) {
    this.artist = this.artist.trim();
  }
  if (this.isModified("genre")) {
    this.genre = this.genre.trim().toLowerCase();
  }
  if (this.isModified("album")) {
    this.album = this.album.trim();
  }

  // Ensure non-negative numbers
  if (this.plays < 0) this.plays = 0;
  if (this.downloads < 0) this.downloads = 0;
  if (this.fileSize < 0) this.fileSize = 0;

  // Validate price format
  if (this.isModified("price")) {
    const price = parseFloat(this.price);
    if (isNaN(price) || price < 0) {
      this.price = "0.001";
    }
  }

  next();
});

// ===== STATIC METHODS =====

// Find public tracks
TrackSchema.statics.findPublic = function (query = {}) {
  return this.find({
    isActive: true,
    isPublic: true,
    ...query,
  });
};

// Find by genre
TrackSchema.statics.findByGenre = function (genre) {
  return this.findPublic({ genre: genre.toLowerCase() });
};

// Search tracks
TrackSchema.statics.search = function (searchTerm, limit = 20) {
  return this.find({
    isActive: true,
    isPublic: true,
    $or: [
      { title: new RegExp(searchTerm, "i") },
      { artist: new RegExp(searchTerm, "i") },
      { album: new RegExp(searchTerm, "i") },
      { genre: new RegExp(searchTerm, "i") },
    ],
  })
    .limit(limit)
    .sort({ plays: -1, createdAt: -1 });
};

// ===== INSTANCE METHODS =====

// Increment play count
TrackSchema.methods.incrementPlays = function () {
  this.plays += 1;
  return this.save();
};

// Increment download count
TrackSchema.methods.incrementDownloads = function () {
  this.downloads += 1;
  return this.save();
};

// Add purchase record
TrackSchema.methods.addPurchase = function (buyer, price, txHash, blockNumber) {
  this.purchases.push({
    buyer,
    price,
    txHash,
    blockNumber,
    timestamp: new Date(),
  });

  // Update total earnings
  const currentEarnings = parseFloat(this.totalEarnings || 0);
  const purchaseAmount = parseFloat(price || 0);
  this.totalEarnings = (currentEarnings + purchaseAmount).toString();

  return this.save();
};

export default mongoose.model("Track", TrackSchema);

console.log("✅ Track model loaded with enhanced features");
