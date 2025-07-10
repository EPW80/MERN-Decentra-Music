import mongoose from "mongoose";

const PurchaseSchema = new mongoose.Schema(
  {
    // Blockchain transaction info
    txHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    blockNumber: {
      type: Number,
      index: true,
    },
    blockHash: {
      type: String,
    },
    
    // Purchase details
    trackId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Track", // Updated to match Track model
      required: true,
      index: true,
    },
    contractTrackId: {
      type: Number, // Blockchain contract track ID
      index: true,
    },
    buyerAddress: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
      validate: {
        validator: function(v) {
          return /^0x[a-fA-F0-9]{40}$/.test(v);
        },
        message: 'Buyer address must be a valid Ethereum address'
      }
    },
    artistAddress: {
      type: String,
      lowercase: true,
      index: true,
      validate: {
        validator: function(v) {
          if (!v) return true; // Allow null/empty
          return /^0x[a-fA-F0-9]{40}$/.test(v);
        },
        message: 'Artist address must be a valid Ethereum address'
      }
    },
    
    // Financial details
    amount: {
      type: String, // Store as string to avoid precision issues
      required: true,
    },
    platformFee: {
      type: String, // In ETH
    },
    artistPayment: {
      type: String, // In ETH
    },
    
    // Status and verification
    verified: {
      type: Boolean,
      default: false,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'failed'],
      default: 'pending',
      index: true,
    },
    confirmations: {
      type: Number,
      default: 0,
    },
    
    // Access control
    accessGranted: {
      type: Boolean,
      default: false,
      index: true,
    },
    downloadCount: {
      type: Number,
      default: 0,
    },
    lastAccessedAt: {
      type: Date,
    },
    
    // Timestamps
    purchaseDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    verifiedAt: {
      type: Date,
    },
    
    // Associated track info (denormalized for performance)
    trackInfo: {
      title: String,
      artist: String, // Artist name (not address)
      price: String,
    },
    
    // Event data from blockchain
    eventData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Enhanced indexes for performance
PurchaseSchema.index({ txHash: 1 }, { unique: true }); // Primary unique index
PurchaseSchema.index({ buyerAddress: 1, purchaseDate: -1 }); // User purchase history
PurchaseSchema.index({ artistAddress: 1, purchaseDate: -1 }); // Artist sales
PurchaseSchema.index({ status: 1, verified: 1 }); // Purchase status filtering
PurchaseSchema.index({ buyerAddress: 1, contractTrackId: 1 }); // User-track purchase check
PurchaseSchema.index({ trackId: 1 }); // Track purchase lookup

// Instance methods
PurchaseSchema.methods.markAsVerified = function() {
  this.verified = true;
  this.verifiedAt = new Date();
  this.status = 'confirmed';
  return this.save();
};

PurchaseSchema.methods.grantAccess = function() {
  this.accessGranted = true;
  return this.save();
};

PurchaseSchema.methods.recordAccess = function() {
  this.lastAccessedAt = new Date();
  this.downloadCount += 1;
  return this.save();
};

// Static methods
PurchaseSchema.statics.findByTransaction = function(txHash) {
  return this.findOne({ txHash: txHash });
};

PurchaseSchema.statics.findUserPurchases = function(userAddress) {
  return this.find({ 
    buyerAddress: userAddress.toLowerCase(),
    verified: true 
  }).sort({ purchaseDate: -1 });
};

PurchaseSchema.statics.findArtistSales = function(artistAddress) {
  return this.find({ 
    artistAddress: artistAddress.toLowerCase(),
    verified: true 
  }).sort({ purchaseDate: -1 });
};

PurchaseSchema.statics.hasUserPurchased = function(userAddress, trackId) {
  return this.findOne({
    buyerAddress: userAddress.toLowerCase(),
    $or: [
      { trackId: trackId },
      { contractTrackId: trackId }
    ],
    verified: true
  });
};

export default mongoose.model("Purchase", PurchaseSchema);
