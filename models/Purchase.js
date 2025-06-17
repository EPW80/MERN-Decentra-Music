import mongoose from 'mongoose';

const PurchaseSchema = new mongoose.Schema({
    trackId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Music',
        required: true
    },
    txHash: {
        type: String,
        required: true,
        unique: true
    },
    buyerAddress: {
        type: String,
        required: true,
        lowercase: true
    },
    amount: {
        type: String, // Store as string to avoid precision issues
        required: true
    },
    verified: {
        type: Boolean,
        default: false
    },
    downloadCount: {
        type: Number,
        default: 0
    },
    purchaseDate: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Compound index for efficient lookups
PurchaseSchema.index({ trackId: 1, txHash: 1 });
PurchaseSchema.index({ buyerAddress: 1, purchaseDate: -1 });

export default mongoose.model('Purchase', PurchaseSchema);