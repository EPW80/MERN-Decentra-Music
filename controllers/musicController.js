import Track from "../models/Track";
import User from "../models/User";
import { uploadToIPFS } from "../utils/ipfs";
import { getContract } from "../config/blockchain";
import Music from '../models/Music';
import { uploadFile } from '../config/web3storage';
import multer, { memoryStorage } from 'multer';

// Configure multer for memory storage
const upload = multer({ 
    storage: memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
});

// Upload track
export async function uploadTrack(req, res) {
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
}

// Get all tracks
export async function getTracks(req, res) {
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
}

// Get single track
export async function getTrack(req, res) {
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
}

// Stream track
export async function streamTrack(req, res) {
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
}

// Like track
export async function likeTrack(req, res) {
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
}

// Upload music
export async function uploadMusic(req, res) {
    try {
        const { title, artist, genre, album } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Create a File object for Web3.Storage
        const web3File = new File([file.buffer], file.originalname, {
            type: file.mimetype
        });

        // Upload to Web3.Storage
        const ipfsResult = await uploadFile(web3File);

        // Save to MongoDB
        const newMusic = new Music({
            title,
            artist,
            genre,
            album,
            ipfs: {
                cid: ipfsResult.cid,
                url: ipfsResult.url
            },
            fileSize: file.size,
            mimeType: file.mimetype
        });

        const savedMusic = await newMusic.save();

        res.status(201).json({
            message: 'Music uploaded successfully',
            music: savedMusic,
            ipfsUrl: ipfsResult.url
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload music' });
    }
}

export async function getAllMusic(req, res) {
    try {
        const music = await Music.find().sort({ createdAt: -1 });
        res.json(music);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch music' });
    }
}

export async function getMusicById(req, res) {
    try {
        const music = await Music.findById(req.params.id);
        if (!music) {
            return res.status(404).json({ error: 'Music not found' });
        }
        res.json(music);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch music' });
    }
}

export const uploadMiddleware = upload.single('musicFile');
