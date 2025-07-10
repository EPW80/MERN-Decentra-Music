import TrackService from "../services/TrackService.js";

/**
 * Admin Track Operations
 * - Upload tracks
 * - Update tracks
 * - Delete tracks
 * - Manage track status
 */

const trackService = new TrackService();

// Upload new track
export const uploadTrack = async (req, res) => {
  try {
    console.log("📤 Admin track upload request");
    console.log("📋 Request body:", req.body);
    console.log(
      "📁 Request file:",
      req.file
        ? {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            filename: req.file.filename,
          }
        : "No file uploaded"
    );

    const { title, artist, artistAddress, genre, album, price, description } =
      req.body;
    const file = req.file;

    // Enhanced validation with better logging
    if (!title || !artist) {
      console.log("❌ Validation failed - missing required fields");
      console.log("   Title:", title || "MISSING");
      console.log("   Artist:", artist || "MISSING");
      console.log("   All body fields:", req.body);

      return res.status(400).json({
        success: false,
        error: "Title and artist are required",
        received: {
          title: title || null,
          artist: artist || null,
          artistAddress: artistAddress || null,
          genre: genre || null,
          album: album || null,
          hasFile: !!file,
        },
      });
    }

    if (!file) {
      console.log("❌ No file uploaded");
      return res.status(400).json({
        success: false,
        error: "Audio file is required",
        received: { title, artist, genre, album },
      });
    }

    console.log(`📁 Processing upload: "${title}" by "${artist}"`);

    // Use TrackService to create track
    const trackData = {
      title: title.trim(),
      artist: artist.trim(),
      artistAddress: artistAddress?.trim() || null,
      genre: genre?.trim() || "other",
      album: album?.trim() || "",
      price: price || "0.001",
      description: description?.trim() || "",
      isPublic: true,
      isActive: true,
    };

    const track = await trackService.createTrack(trackData, file, {
      addToBlockchain: !!artistAddress, // Only add to blockchain if artist address is provided
      storageProvider: "local",
    });

    console.log(`✅ Track created successfully: ${track._id}`);

    res.json({
      success: true,
      message: "Track uploaded successfully",
      data: track,
    });
  } catch (error) {
    console.error("❌ Upload track error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload track",
      error: error.message,
    });
  }
};

// Update track
export const updateTrack = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Remove sensitive fields that shouldn't be updated
    delete updates._id;
    delete updates.storage;
    delete updates.ipfs;
    delete updates.fileSize;
    delete updates.mimeType;
    delete updates.plays;
    delete updates.downloads;
    delete updates.likes;
    delete updates.createdAt;
    delete updates.updatedAt;

    // Use TrackService to update track
    const track = await trackService.updateTrack(id, updates);

    res.json({
      success: true,
      message: "Track updated successfully",
      data: track,
    });
  } catch (error) {
    console.error("Update track error:", error);
    if (error.message === "Track not found") {
      res.status(404).json({
        success: false,
        message: "Track not found",
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to update track",
        error: error.message,
      });
    }
  }
};

// Delete track
export const deleteTrack = async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent = false } = req.query;

    const hardDelete = permanent === "true";
    await trackService.deleteTrack(id, { hardDelete });

    res.json({
      success: true,
      message: hardDelete ? "Track permanently deleted" : "Track deactivated",
    });
  } catch (error) {
    console.error("Delete track error:", error);
    if (error.message === "Track not found") {
      res.status(404).json({
        success: false,
        message: "Track not found",
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to delete track",
        error: error.message,
      });
    }
  }
};

// Get all tracks (including inactive for admin)
export const getAllTracksAdmin = async (req, res) => {
  try {
    const { status = "all", page = 1, limit = 20, sort = "newest" } = req.query;

    // Build filter based on status
    const filters = {};
    if (status === "active") {
      filters.isActive = true;
    } else if (status === "inactive") {
      filters.isActive = false;
    }

    // Map sort options
    let sortBy = "createdAt";
    let sortOrder = "desc";

    switch (sort) {
      case "newest":
        sortBy = "createdAt";
        sortOrder = "desc";
        break;
      case "oldest":
        sortBy = "createdAt";
        sortOrder = "asc";
        break;
      case "popular":
        sortBy = "plays";
        sortOrder = "desc";
        break;
      case "title":
        sortBy = "title";
        sortOrder = "asc";
        break;
      case "artist":
        sortBy = "artist";
        sortOrder = "asc";
        break;
    }

    // Use TrackService for admin queries (include all tracks)
    const result = await trackService.getTracks(filters, {
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      sortOrder,
      includeInactive: true, // Admin can see inactive tracks
      includePrivate: true, // Admin can see private tracks
    });

    res.json({
      success: true,
      data: result.tracks,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Get admin tracks error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve tracks",
      error: error.message,
    });
  }
};

// Get analytics
export const getAnalytics = async (req, res) => {
  try {
    const [
      totalTracks,
      activeTracks,
      totalPlays,
      totalDownloads,
      storageStats,
      genreStats,
      recentTracks,
    ] = await Promise.all([
      Track.countDocuments(),
      Track.countDocuments({ isActive: true }),
      Track.aggregate([{ $group: { _id: null, total: { $sum: "$plays" } } }]),
      Track.aggregate([
        { $group: { _id: null, total: { $sum: "$downloads" } } },
      ]),
      Track.aggregate([
        {
          $group: {
            _id: "$storage.provider",
            count: { $sum: 1 },
            totalSize: { $sum: "$fileSize" },
          },
        },
      ]),
      Track.aggregate([
        { $group: { _id: "$genre", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Track.find({ isActive: true })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("title artist createdAt plays"),
    ]);

    res.json({
      success: true,
      analytics: {
        tracks: {
          total: totalTracks,
          active: activeTracks,
          inactive: totalTracks - activeTracks,
        },
        engagement: {
          totalPlays: totalPlays[0]?.total || 0,
          totalDownloads: totalDownloads[0]?.total || 0,
          averagePlays:
            totalTracks > 0
              ? Math.round((totalPlays[0]?.total || 0) / totalTracks)
              : 0,
        },
        storage: {
          current: storageService.getStatus(),
          distribution: storageStats,
        },
        genres: genreStats,
        recentTracks,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get analytics",
    });
  }
};
