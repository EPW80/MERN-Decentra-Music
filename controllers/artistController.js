import Track from "../models/Track.js";
import Album from "../models/Album.js";
import Artist from "../models/Artist.js";
import Music from "../models/Music.js";
import { getContract } from "../config/blockchain.js";

// Get artist profile
export async function getArtistProfile(req, res) {
  try {
    const artist = await User.findOne({
      walletAddress: req.params.address.toLowerCase(),
    });

    if (!artist) {
      return res.status(404).json({ error: "Artist not found" });
    }

    const tracks = await Track.find({ artist: artist._id });
    const albums = await Album.find({ artist: artist._id });

    res.json({
      artist,
      tracks,
      albums,
      stats: {
        totalTracks: tracks.length,
        totalAlbums: albums.length,
        totalPlays: tracks.reduce((sum, track) => sum + track.plays, 0),
        followers: artist.followers.length,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// Get artist earnings
export async function getEarnings(req, res) {
  try {
    const contract = await getContract();
    const earnings = await contract.artistEarnings(req.user.walletAddress);

    res.json({
      earnings: ethers.utils.formatEther(earnings),
      earningsWei: earnings.toString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// Follow/unfollow artist
export async function toggleFollow(req, res) {
  try {
    const artist = await User.findOne({
      walletAddress: req.params.address.toLowerCase(),
    });
    const user = await User.findById(req.user.id);

    if (!artist) {
      return res.status(404).json({ error: "Artist not found" });
    }

    const followerIndex = artist.followers.indexOf(user._id);
    const followingIndex = user.following.indexOf(artist._id);

    if (followerIndex > -1) {
      artist.followers.splice(followerIndex, 1);
      user.following.splice(followingIndex, 1);
    } else {
      artist.followers.push(user._id);
      user.following.push(artist._id);
    }

    await artist.save();
    await user.save();

    res.json({
      isFollowing: followerIndex === -1,
      followers: artist.followers.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// Create this file if it doesn't exist
export const createArtist = async (req, res) => {
  try {
    const { name, email, bio, genres } = req.body;

    const newArtist = new Artist({
      name,
      email,
      bio,
      genres,
    });

    const savedArtist = await newArtist.save();
    res.status(201).json(savedArtist);
  } catch (error) {
    console.error("Create artist error:", error);
    res.status(500).json({ error: "Failed to create artist" });
  }
};

export const getAllArtists = async (req, res) => {
  try {
    const artists = await Artist.find().sort({ createdAt: -1 });
    res.json(artists);
  } catch (error) {
    console.error("Get artists error:", error);
    res.status(500).json({ error: "Failed to fetch artists" });
  }
};

export const getArtistById = async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id);
    if (!artist) {
      return res.status(404).json({ error: "Artist not found" });
    }
    res.json(artist);
  } catch (error) {
    console.error("Get artist error:", error);
    res.status(500).json({ error: "Failed to fetch artist" });
  }
};

export const updateArtist = async (req, res) => {
  try {
    const updatedArtist = await Artist.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedArtist) {
      return res.status(404).json({ error: "Artist not found" });
    }

    res.json(updatedArtist);
  } catch (error) {
    console.error("Update artist error:", error);
    res.status(500).json({ error: "Failed to update artist" });
  }
};

export const deleteArtist = async (req, res) => {
  try {
    const deletedArtist = await Artist.findByIdAndDelete(req.params.id);

    if (!deletedArtist) {
      return res.status(404).json({ error: "Artist not found" });
    }

    res.json({ message: "Artist deleted successfully" });
  } catch (error) {
    console.error("Delete artist error:", error);
    res.status(500).json({ error: "Failed to delete artist" });
  }
};

export const getArtistMusic = async (req, res) => {
  try {
    const music = await Music.find({ artist: req.params.id }).sort({
      createdAt: -1,
    });
    res.json(music);
  } catch (error) {
    console.error("Get artist music error:", error);
    res.status(500).json({ error: "Failed to fetch artist music" });
  }
};
