const mongoose = require("mongoose");

const trackSchema = new mongoose.Schema({
  blockchainId: {
    type: Number,
    required: true,
    unique: true,
  },
  title: {
    type: String,
    required: true,
  },
  artist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  ipfsHash: {
    type: String,
    required: true,
  },
  coverArt: String,
  genre: String,
  duration: Number,
  price: String,
  royaltyPercentage: Number,
  isPremium: Boolean,
  plays: {
    type: Number,
    default: 0,
  },
  likes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Track", trackSchema);
