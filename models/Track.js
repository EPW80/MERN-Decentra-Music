import mongoose from "mongoose";

const TrackSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    artist: {
      type: String,
      required: true,
    },
    genre: {
      type: String,
      required: true,
    },
    price: {
      type: String, // Store as string to avoid precision issues with wei
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    releaseDate: {
      type: Date,
      default: Date.now,
    },
    ipfs: {
      audioHash: {
        type: String,
        required: true,
      },
      coverHash: {
        type: String,
      },
    },
    metadata: {
      duration: Number,
      fileSize: Number,
      sampleRate: Number,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Track", TrackSchema);
