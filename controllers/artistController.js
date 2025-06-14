import User from "../models/User";
import Track from "../models/Track";
import Album from "../models/Album";
import { getContract } from "../config/blockchain";

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
