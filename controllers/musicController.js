const Track = require("../models/Track");
const User = require("../models/User");
const { uploadToIPFS } = require("../utils/ipfs");
const { getContract } = require("../config/blockchain");

// Upload track
exports.uploadTrack = async (req, res) => {
  try {
    const { title, genre, price, royaltyPercentage, isPremium } = req.body;
    const audioFile = req.files.audio;
    const coverFile = req.files?.cover;

    // Upload to IPFS
    const audioHash = await uploadToIPFS(audioFile.data);
    const coverHash = coverFile ? await uploadToIPFS(coverFile.data) : null;

    // Call smart contract
    const contract = await getContract();
    const tx = await contract.uploadTrack(
      audioHash,
      ethers.utils.parseEther(price),
      royaltyPercentage,
      isPremium
    );
    const receipt = await tx.wait();

    // Get track ID from events
    const trackId = receipt.events[0].args.trackId.toNumber();

    // Save to MongoDB
    const track = new Track({
      blockchainId: trackId,
      title,
      artist: req.user.id,
      ipfsHash: audioHash,
      coverArt: coverHash,
      genre,
      price,
      royaltyPercentage,
      isPremium,
    });

    await track.save();
    res.json({ success: true, track });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all tracks
exports.getTracks = async (req, res) => {
  try {
    const { genre, artist, premium } = req.query;
    const filter = {};

    if (genre) filter.genre = genre;
    if (artist) filter.artist = artist;
    if (premium !== undefined) filter.isPremium = premium === "true";

    const tracks = await Track.find(filter)
      .populate("artist", "username walletAddress")
      .sort("-createdAt");

    res.json(tracks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get single track
exports.getTrack = async (req, res) => {
  try {
    const track = await Track.findOne({
      blockchainId: req.params.trackId,
    }).populate("artist", "username walletAddress");

    if (!track) {
      return res.status(404).json({ error: "Track not found" });
    }

    res.json(track);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Stream track
exports.streamTrack = async (req, res) => {
  try {
    const { trackId } = req.params;
    const userAddress = req.body.walletAddress;

    // Check blockchain access
    const contract = await getContract();
    const hasAccess = await contract.hasAccess(trackId, userAddress);

    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Get track from DB
    const track = await Track.findOne({ blockchainId: trackId });
    if (!track) {
      return res.status(404).json({ error: "Track not found" });
    }

    // Increment plays
    track.plays += 1;
    await track.save();

    res.json({ ipfsHash: track.ipfsHash });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Like track
exports.likeTrack = async (req, res) => {
  try {
    const track = await Track.findOne({ blockchainId: req.params.trackId });

    if (!track) {
      return res.status(404).json({ error: "Track not found" });
    }

    const userIndex = track.likes.indexOf(req.user.id);

    if (userIndex > -1) {
      track.likes.splice(userIndex, 1);
    } else {
      track.likes.push(req.user.id);
    }

    await track.save();
    res.json({ likes: track.likes.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
