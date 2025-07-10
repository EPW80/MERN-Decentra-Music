import express from "express";
import TrackService from "../../services/TrackService.js";
import { body, param, validationResult } from "express-validator";

const router = express.Router();
const trackService = new TrackService();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: "Validation failed",
      details: errors.array(),
    });
  }
  next();
};

// Get all tracks with filtering and pagination
router.get("/", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      genre,
      artist,
      search,
      sort = "newest",
      active = "true",
    } = req.query;

    // Build filters
    const filters = {};

    if (genre && genre !== "all") {
      filters.genre = genre;
    }

    if (artist) {
      filters.artist = { $regex: artist, $options: "i" };
    }

    if (active === "false") {
      filters.isActive = false;
    }

    // Handle search
    if (search) {
      const tracks = await trackService.searchTracks(search, {
        limit: parseInt(limit),
        includeInactive: active === "false",
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

    // Get tracks using service
    const result = await trackService.getTracks(filters, {
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      sortOrder,
      includeInactive: active === "false",
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
});

// Get all tracks (legacy endpoint for backward compatibility)
router.get("/all", async (req, res) => {
  try {
    const { active = "true", limit = 50, offset = 0 } = req.query;

    // Convert to pagination format
    const page = Math.floor(parseInt(offset) / parseInt(limit)) + 1;

    const result = await trackService.getTracks(
      {},
      {
        page,
        limit: parseInt(limit),
        sortBy: "createdAt",
        sortOrder: "desc",
        includeInactive: active === "false",
        includePrivate: false,
      }
    );

    res.json({
      success: true,
      data: result.tracks,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Get all tracks error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve tracks",
      error: error.message,
    });
  }
});

// Get specific track by ID
router.get(
  "/:trackId",
  [
    param("trackId")
      .isMongoId()
      .withMessage("Track ID must be a valid MongoDB ID"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { trackId } = req.params;

      const track = await trackService.getTrackById(trackId, {
        includeInactive: false,
        includePrivate: false,
      });

      res.json({
        success: true,
        data: track,
      });
    } catch (error) {
      console.error(`Get track ${req.params.trackId} error:`, error);
      if (error.message === "Track not found") {
        res.status(404).json({
          success: false,
          message: "Track not found",
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Failed to retrieve track",
          error: error.message,
        });
      }
    }
  }
);

// Get track by blockchain contract ID
router.get(
  "/blockchain/:contractId",
  [param("contractId").isString().withMessage("Contract ID must be a string")],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { contractId } = req.params;

      const result = await trackService.getTracks(
        { "blockchain.contractId": contractId },
        { limit: 1, includeInactive: false, includePrivate: false }
      );

      if (!result.tracks || result.tracks.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Track not found on blockchain",
        });
      }

      res.json({
        success: true,
        data: result.tracks[0],
      });
    } catch (error) {
      console.error(
        `Get blockchain track ${req.params.contractId} error:`,
        error
      );
      res.status(500).json({
        success: false,
        message: "Failed to retrieve track",
        error: error.message,
      });
    }
  }
);
// Search tracks
router.get(
  "/search/:query",
  [
    param("query")
      .isString()
      .isLength({ min: 2 })
      .withMessage("Search query must be at least 2 characters"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { query } = req.params;
      const { limit = 20 } = req.query;

      const tracks = await trackService.searchTracks(query, {
        limit: parseInt(limit),
        includeInactive: false,
        includePrivate: false,
      });

      res.json({
        success: true,
        data: tracks,
        query,
      });
    } catch (error) {
      console.error("Search tracks error:", error);
      res.status(500).json({
        success: false,
        message: "Search failed",
        error: error.message,
      });
    }
  }
);

// Get tracks by genre
router.get(
  "/genre/:genre",
  [param("genre").isString().withMessage("Genre must be a string")],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { genre } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const result = await trackService.getTracksByGenre(genre, {
        page: parseInt(page),
        limit: parseInt(limit),
        includeInactive: false,
        includePrivate: false,
      });

      res.json({
        success: true,
        data: result.tracks,
        pagination: result.pagination,
      });
    } catch (error) {
      console.error("Get tracks by genre error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve tracks by genre",
        error: error.message,
      });
    }
  }
);

// Get tracks by artist
router.get(
  "/artist/:artist",
  [param("artist").isString().withMessage("Artist must be a string")],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { artist } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const result = await trackService.getTracksByArtist(artist, {
        page: parseInt(page),
        limit: parseInt(limit),
        includeInactive: false,
        includePrivate: false,
      });

      res.json({
        success: true,
        data: result.tracks,
        pagination: result.pagination,
      });
    } catch (error) {
      console.error("Get tracks by artist error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve tracks by artist",
        error: error.message,
      });
    }
  }
);

// Increment play count
router.post(
  "/:trackId/play",
  [
    param("trackId")
      .isMongoId()
      .withMessage("Track ID must be a valid MongoDB ID"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { trackId } = req.params;

      const track = await trackService.incrementPlays(trackId);

      res.json({
        success: true,
        data: {
          trackId: track._id,
          plays: track.plays,
        },
      });
    } catch (error) {
      console.error("Increment plays error:", error);
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
  }
);

// Get track analytics
router.get(
  "/:trackId/analytics",
  [
    param("trackId")
      .isMongoId()
      .withMessage("Track ID must be a valid MongoDB ID"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { trackId } = req.params;

      const analytics = await trackService.getTrackAnalytics(trackId);

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      console.error("Get track analytics error:", error);
      if (error.message === "Track not found") {
        res.status(404).json({
          success: false,
          message: "Track not found",
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Failed to retrieve track analytics",
          error: error.message,
        });
      }
    }
  }
);

export default router;
