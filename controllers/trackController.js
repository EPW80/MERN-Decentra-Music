import Track from '../models/Track.js';

// Public: Get all active tracks with filtering and pagination
export async function getAllTracks(req, res) {
  try {
    console.log('Getting all tracks...');
    const {
      page = 1,
      limit = 20,
      genre,
      artist,
      sort = 'newest',
      search,
    } = req.query;

    let filter = { isActive: true, isPublic: true };

    // Add filters
    if (genre) filter.genre = { $regex: genre, $options: 'i' };
    if (artist) filter.artist = { $regex: artist, $options: 'i' };
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { artist: { $regex: search, $options: 'i' } },
        { album: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    // Sort options
    let sortOption = { releaseDate: -1 };
    switch (sort) {
      case 'popular':
        sortOption = { plays: -1 };
        break;
      case 'liked':
        sortOption = { likes: -1 };
        break;
      case 'oldest':
        sortOption = { releaseDate: 1 };
        break;
      case 'alphabetical':
        sortOption = { title: 1 };
        break;
    }

    const tracks = await Track.find(filter)
      .select('-ipfs.audioHash -ipfs.coverHash')
      .sort(sortOption)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Track.countDocuments(filter);

    res.json({
      success: true,
      tracks: tracks || [],
      count: tracks.length,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
      filters: {
        genre: genre || null,
        artist: artist || null,
        search: search || null,
        sort,
      },
    });
  } catch (error) {
    console.error('Get tracks error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tracks',
    });
  }
}

// Public: Get track details
export async function getTrackDetails(req, res) {
  try {
    console.log('Getting track details for:', req.params.id);
    const track = await Track.findById(req.params.id)
      .select('-ipfs.audioHash -ipfs.coverHash')
      .lean();

    if (!track || !track.isActive || !track.isPublic) {
      return res.status(404).json({
        success: false,
        error: 'Track not found',
      });
    }

    res.json({
      success: true,
      track,
    });
  } catch (error) {
    console.error('Get track details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch track details',
    });
  }
}

// Public: Get all artists
export async function getAllArtists(req, res) {
  try {
    const { page = 1, limit = 50 } = req.query;

    const artists = await Track.aggregate([
      { $match: { isActive: true, isPublic: true } },
      {
        $group: {
          _id: '$artist',
          trackCount: { $sum: 1 },
          totalPlays: { $sum: '$plays' },
          genres: { $addToSet: '$genre' },
          latestRelease: { $max: '$releaseDate' },
        },
      },
      { $sort: { trackCount: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: parseInt(limit) },
    ]);

    const total = await Track.distinct('artist', {
      isActive: true,
      isPublic: true,
    });

    res.json({
      success: true,
      artists: artists.map((artist) => ({
        name: artist._id,
        trackCount: artist.trackCount,
        totalPlays: artist.totalPlays,
        genres: artist.genres.filter(Boolean),
        latestRelease: artist.latestRelease,
      })),
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total.length / limit),
        total: total.length,
      },
    });
  } catch (error) {
    console.error('Get artists error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch artists',
    });
  }
}

// Public: Get artist by ID (name)
export async function getArtistById(req, res) {
  try {
    const artistName = req.params.id;

    // Get artist stats
    const artistStats = await Track.aggregate([
      {
        $match: {
          artist: { $regex: new RegExp(`^${artistName}$`, 'i') },
          isActive: true,
          isPublic: true,
        },
      },
      {
        $group: {
          _id: '$artist',
          trackCount: { $sum: 1 },
          totalPlays: { $sum: '$plays' },
          totalLikes: { $sum: { $size: '$likes' } },
          genres: { $addToSet: '$genre' },
          albums: { $addToSet: '$album' },
          firstRelease: { $min: '$releaseDate' },
          latestRelease: { $max: '$releaseDate' },
        },
      },
    ]);

    if (artistStats.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Artist not found',
      });
    }

    const stats = artistStats[0];

    res.json({
      success: true,
      artist: {
        name: stats._id,
        trackCount: stats.trackCount,
        totalPlays: stats.totalPlays,
        totalLikes: stats.totalLikes,
        genres: stats.genres.filter(Boolean),
        albums: stats.albums.filter(Boolean),
        firstRelease: stats.firstRelease,
        latestRelease: stats.latestRelease,
      },
    });
  } catch (error) {
    console.error('Get artist error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch artist',
    });
  }
}

// Public: Get artist's music
export async function getArtistMusic(req, res) {
  try {
    const artistName = req.params.id;
    const { page = 1, limit = 20, sort = 'newest' } = req.query;

    let sortOption = { releaseDate: -1 };
    if (sort === 'popular') sortOption = { plays: -1 };
    if (sort === 'alphabetical') sortOption = { title: 1 };

    const tracks = await Track.find({
      artist: { $regex: new RegExp(`^${artistName}$`, 'i') },
      isActive: true,
      isPublic: true,
    })
      .select('-ipfs.audioHash -ipfs.coverHash')
      .sort(sortOption)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Track.countDocuments({
      artist: { $regex: new RegExp(`^${artistName}$`, 'i') },
      isActive: true,
      isPublic: true,
    });

    res.json({
      success: true,
      artist: artistName,
      tracks: tracks.map((track) => ({
        ...track,
        likeCount: track.likes?.length || 0,
        formattedDuration: formatDuration(track.duration),
      })),
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error('Get artist music error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch artist music',
    });
  }
}

// Public: Search tracks
export async function searchTracks(req, res) {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters',
      });
    }

    const searchRegex = new RegExp(q.trim(), 'i');

    const tracks = await Track.find({
      $or: [
        { title: searchRegex },
        { artist: searchRegex },
        { album: searchRegex },
        { tags: searchRegex },
      ],
      isActive: true,
      isPublic: true,
    })
      .select('title artist album genre duration plays')
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      query: q,
      results: tracks,
      count: tracks.length,
    });
  } catch (error) {
    console.error('Search tracks error:', error);
    res.status(500).json({
      success: false,
      error: 'Search failed',
    });
  }
}

// Public: Get featured tracks
export async function getFeaturedTracks(req, res) {
  try {
    const { limit = 10 } = req.query;

    const featuredTracks = await Track.find({
      isFeatured: true,
      isActive: true,
      isPublic: true,
    })
      .select('-ipfs.audioHash -ipfs.coverHash')
      .sort({ releaseDate: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      featuredTracks: featuredTracks.map((track) => ({
        ...track,
        likeCount: track.likes?.length || 0,
        formattedDuration: formatDuration(track.duration),
      })),
    });
  } catch (error) {
    console.error('Get featured tracks error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch featured tracks',
    });
  }
}

// Public: Get tracks by genre
export async function getTracksByGenre(req, res) {
  try {
    const { genre } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const tracks = await Track.find({
      genre: { $regex: new RegExp(`^${genre}$`, 'i') },
      isActive: true,
      isPublic: true,
    })
      .select('-ipfs.audioHash -ipfs.coverHash')
      .sort({ plays: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Track.countDocuments({
      genre: { $regex: new RegExp(`^${genre}$`, 'i') },
      isActive: true,
      isPublic: true,
    });

    res.json({
      success: true,
      genre,
      tracks: tracks.map((track) => ({
        ...track,
        likeCount: track.likes?.length || 0,
        formattedDuration: formatDuration(track.duration),
      })),
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error('Get tracks by genre error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tracks by genre',
    });
  }
}

// Public: Increment play count
export async function incrementPlayCount(req, res) {
  try {
    const track = await Track.findByIdAndUpdate(
      req.params.id,
      { $inc: { plays: 1 } },
      { new: true }
    ).select('plays');

    if (!track) {
      return res.status(404).json({
        success: false,
        error: 'Track not found',
      });
    }

    res.json({
      success: true,
      plays: track.plays,
    });
  } catch (error) {
    console.error('Increment play count error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to increment play count',
    });
  }
}

// Public: Verify blockchain purchase
export async function verifyPurchase(req, res) {
  try {
    const { trackId, txHash, buyerAddress } = req.body;

    if (!trackId || !txHash || !buyerAddress) {
      return res.status(400).json({
        success: false,
        error: 'Track ID, transaction hash, and buyer address required',
      });
    }

    // Get track
    const track = await Track.findById(trackId);
    if (!track || !track.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Track not found',
      });
    }

    // Check if purchase already exists
    const existingPurchase = await Purchase.findOne({ trackId, txHash });
    if (existingPurchase) {
      const downloadToken = generateDownloadToken(trackId, buyerAddress);
      return res.json({
        success: true,
        verified: true,
        downloadUrl: `/api/download/${trackId}/${downloadToken}`,
        expiresIn: '24h',
      });
    }

    // Verify transaction on blockchain
    const { provider } = await import('../config/blockchain.js');
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt || receipt.status !== 1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or failed transaction',
      });
    }

    // Create purchase record
    const purchase = new Purchase({
      trackId,
      txHash,
      buyerAddress: buyerAddress.toLowerCase(),
      amount: ethers.formatEther(receipt.gasUsed * receipt.gasPrice),
      verified: true,
      purchaseDate: new Date(),
    });

    await purchase.save();

    // Increment download count
    await Track.findByIdAndUpdate(trackId, { $inc: { downloads: 1 } });

    // Generate download token
    const downloadToken = generateDownloadToken(trackId, buyerAddress);

    res.json({
      success: true,
      verified: true,
      downloadUrl: `/api/download/${trackId}/${downloadToken}`,
      expiresIn: '24h',
      purchase: {
        id: purchase._id,
        txHash,
        amount: purchase.amount,
      },
    });
  } catch (error) {
    console.error('Verify purchase error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify purchase',
    });
  }
}

// Public: Download track (requires valid token)
export async function downloadTrack(req, res) {
  try {
    const { trackId, token } = req.params;

    // Verify download token
    const tokenData = verifyDownloadToken(token, trackId);
    if (!tokenData.valid) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired download token',
      });
    }

    const track = await Track.findById(trackId);
    if (!track) {
      return res.status(404).json({
        success: false,
        error: 'Track not found',
      });
    }

    // Return the actual download URL
    res.json({
      success: true,
      downloadUrl: track.ipfs.url,
      filename: `${track.artist} - ${track.title}.mp3`,
      fileSize: track.fileSize,
      expiresAt: new Date(tokenData.expiresAt),
    });
  } catch (error) {
    console.error('Download track error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get download link',
    });
  }
}

// Helper functions
function generateDownloadToken(trackId, buyerAddress) {
  const payload = {
    trackId,
    buyerAddress: buyerAddress.toLowerCase(),
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

function verifyDownloadToken(token, trackId) {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    const isValid = payload.trackId === trackId && payload.exp > Date.now();
    return {
      valid: isValid,
      expiresAt: payload.exp,
      buyerAddress: payload.buyerAddress,
    };
  } catch {
    return { valid: false };
  }
}

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes) {
  if (!bytes) return '0 MB';
  const mb = (bytes / (1024 * 1024)).toFixed(2);
  return `${mb} MB`;
}
