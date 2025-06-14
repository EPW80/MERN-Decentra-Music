import { Schema, model } from "mongoose";

const albumSchema = new Schema({
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
  tracks: [
    {
      type: Schema.Types.ObjectId,
      ref: "Track",
    },
  ],
  coverArt: String,
  price: String,
  totalSupply: Number,
  minted: Number,
  metadata: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default model("Album", albumSchema);
