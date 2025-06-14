import { Schema, model } from "mongoose";

const trackSchema = new Schema({
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
    type: Schema.Types.ObjectId,
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
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default model("Track", trackSchema);
