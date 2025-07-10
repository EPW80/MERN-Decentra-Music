import TrackService from "../services/TrackService.js";

/**
 * Public Track Operations
 * - Get tracks (public read-only operations)
 * - Search tracks
 * - Get track details
 * - Stream track (with access control)
 */

const trackService = new TrackService();

// Get all tracks with filtering
export const getAllTracks = async (req, res) => {
  try {
    const {
      genre,
      artist,
      search,
      sort = "newest",
      page = 1,
      limit = 20,
    } = req.query;

    // Use TrackService for handling the query
    if (search) {
      // Handle search query
      const tracks = await trackService.searchTracks(search, {
        limit: parseInt(limit),
        includeInactive: false,
        includePrivate: false,
      });

      return res.json({
        success: true,
        data: tracks,
        pagination: {
          page: 1,
          limit: parseInt(limit),
          total: tracks.length,
          pages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });
    }

    // Build filters
    const filters = {};

    if (genre && genre !== "all") {
      filters.genre = genre;
    }

    if (artist) {
      filters.artist = { $regex: artist, $options: "i" };
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
      default:
        sortBy = "createdAt";
        sortOrder = "desc";
    }

    // Use TrackService for pagination and filtering
    const result = await trackService.getTracks(filters, {
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      sortOrder,
      includeInactive: false,
      includePrivate: false,
    });

    res.json({
      success: true,
      data: result.tracks,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Get tracks error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve tracks",
      error: error.message,
    });
  }
};

// Get single track details
export const getTrackDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const track = await trackService.getTrackById(id, {
      includeInactive: false,
      includePrivate: false,
    });

    res.json({
      success: true,
      data: track,
    });
  } catch (error) {
    console.error("Get track details error:", error);
    if (error.message === "Track not found") {
      res.status(404).json({
        success: false,
        message: "Track not found",
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to retrieve track details",
        error: error.message,
      });
    }
  }
};

// Search tracks
export const searchTracks = async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters",
      });
    }

    const tracks = await trackService.searchTracks(q.trim(), {
      limit: parseInt(limit),
      includeInactive: false,
      includePrivate: false,
    });

    res.json({
      success: true,
      data: tracks,
      count: tracks.length,
      query: q,
    });
  } catch (error) {
    console.error("Search tracks error:", error);
    res.status(500).json({
      success: false,
      message: "Search failed",
      error: error.message,
    });
  }
};

// Get track by blockchain ID (for blockchain integration)
export const getTrackByBlockchainId = async (req, res) => {
  try {
    const { blockchainId } = req.params;

    const result = await trackService.getTracks(
      { "blockchain.contractId": blockchainId },
      { limit: 1, includeInactive: false, includePrivate: false }
    );

    if (!result.tracks || result.tracks.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Track not found",
      });
    }

    res.json({
      success: true,
      data: result.tracks[0],
    });
  } catch (error) {
    console.error("Get track by blockchain ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve track",
      error: error.message,
    });
  }
};

// Increment play count
export const incrementPlayCount = async (req, res) => {
  try {
    const { id } = req.params;

    const track = await trackService.incrementPlays(id);

    res.json({
      success: true,
      data: track,
    });
  } catch (error) {
    console.error("Increment play count error:", error);
    if (error.message === "Track not found") {
      res.status(404).json({
        success: false,
        message: "Track not found",
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to increment play count",
        error: error.message,
      });
    }
  }
};
