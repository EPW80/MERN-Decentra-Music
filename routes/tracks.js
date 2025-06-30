import express from "express";
import Track from "../models/Track.js";
import {
  validateTrackInput,
  validateSearchInput,
  validateObjectId,
  validateFileUpload,
} from "../middleware/sanitization.js";
import { uploadSingle } from "../middleware/upload.js"; // Use the correct export name

const router = express.Router();

/**
 * Public Track API Routes
 * No authentication required
 */

// Get all public tracks with filtering and pagination
router.get("/", validateSearchInput, async (req, res) => {
  try {
    // Input is already sanitized by middleware
    const {
      page = 1,
      limit = 20,
      genre,
      artist,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build secure query
    const query = {
      isActive: true,
      isPublic: true,
    };

    // Apply filters (inputs already validated)
    if (genre && genre !== "all") {
      query.genre = genre.toLowerCase();
    }

    if (artist) {
      query.artist = new RegExp(
        artist.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      ); // Escape regex
    }

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { title: new RegExp(escapedSearch, "i") },
        { artist: new RegExp(escapedSearch, "i") },
        { album: new RegExp(escapedSearch, "i") },
      ];
    }

    // Execute query
    const tracks = await Track.find(query)
      .sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .select("-__v -blockchain.error -purchases")
      .lean();

    const total = await Track.countDocuments(query);

    res.json({
      success: true,
      tracks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Get tracks error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch tracks",
      timestamp: new Date().toISOString(),
    });
  }
});

// Get single track by ID with ID validation
router.get("/:id", validateObjectId, async (req, res) => {
  try {
    const track = await Track.findOne({
      _id: req.params.id,
      isActive: true,
      isPublic: true,
    })
      .select("-__v -blockchain.error -purchases")
      .lean();

    if (!track) {
      return res.status(404).json({
        success: false,
        error: "Track not found",
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      track,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Get track error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch track",
      timestamp: new Date().toISOString(),
    });
  }
});

// Stream/download track
router.get("/:id/stream", validateObjectId, async (req, res) => {
  try {
    const track = await Track.findOne({
      _id: req.params.id,
      isActive: true,
      isPublic: true,
    });

    if (!track) {
      return res.status(404).json({
        success: false,
        error: "Track not found",
        timestamp: new Date().toISOString(),
      });
    }

    // Determine file path based on storage system
    let filePath;

    if (track.storage?.filename) {
      // New storage system
      filePath = path.join(process.cwd(), "uploads", track.storage.filename);
    } else if (track.ipfs?.cid) {
      // Legacy IPFS - redirect to gateway
      return res.redirect(track.ipfs.url);
    } else {
      return res.status(404).json({
        success: false,
        error: "File not available",
        timestamp: new Date().toISOString(),
      });
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: "File not found on server",
        timestamp: new Date().toISOString(),
      });
    }

    // Increment play count (async, don't wait)
    Track.findByIdAndUpdate(req.params.id, { $inc: { plays: 1 } }).exec();

    // Get file stats
    const stats = fs.statSync(filePath);

    // Set headers for audio streaming
    res.set({
      "Content-Type": track.mimeType || track.storage?.mimeType || "audio/mpeg",
      "Content-Length": stats.size,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
      "Content-Disposition": `inline; filename="${track.title}.mp3"`,
      "X-Content-Type-Options": "nosniff",
    });

    // Handle range requests for audio seeking
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      const chunksize = end - start + 1;

      res.status(206);
      res.set({
        "Content-Range": `bytes ${start}-${end}/${stats.size}`,
        "Content-Length": chunksize,
      });

      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      // Send entire file
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    }
  } catch (error) {
    console.error("❌ Stream track error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to stream track",
      timestamp: new Date().toISOString(),
    });
  }
});

// Upload track with comprehensive validation
router.post(
  "/",
  uploadSingle, // Use the correct export name
  validateFileUpload,
  validateTrackInput,
  async (req, res) => {
    try {
      // All inputs are sanitized and validated
      const trackData = {
        title: req.body.title,
        artist: req.body.artist,
        album: req.body.album || "",
        genre: req.body.genre,
        description: req.body.description || "",
        tags: req.body.tags
          ? Array.isArray(req.body.tags)
            ? req.body.tags
            : [req.body.tags]
          : [],
        price: parseFloat(req.body.price) || 0,
        isPublic: req.body.isPublic !== "false",
      };

      // File info (already validated)
      if (req.file) {
        trackData.storage = {
          filename: req.file.filename,
          originalFilename: req.file.originalname,
          size: req.file.size,
          mimeType: req.file.mimetype,
        };

        // Set additional metadata
        trackData.mimeType = req.file.mimetype;
        trackData.fileSize = req.file.size;
      }

      const track = new Track(trackData);
      await track.save();

      console.log(`✅ Track uploaded: ${track.title} by ${track.artist}`);

      res.status(201).json({
        success: true,
        message: "Track uploaded successfully",
        track: {
          id: track._id,
          title: track.title,
          artist: track.artist,
          album: track.album,
          genre: track.genre,
          fileSize: track.fileSize,
          mimeType: track.mimeType,
          createdAt: track.createdAt,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("❌ Track upload error:", error);

      // Handle validation errors
      if (error.name === "ValidationError") {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: Object.values(error.errors).map((err) => ({
            field: err.path,
            message: err.message,
          })),
          timestamp: new Date().toISOString(),
        });
      }

      res.status(500).json({
        success: false,
        error: "Failed to upload track",
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// Search tracks
router.get("/search", async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: "Search query must be at least 2 characters",
      });
    }

    const tracks = await Track.search(q.trim(), parseInt(limit));

    res.json({
      success: true,
      query: q.trim(),
      tracks,
      count: tracks.length,
    });
  } catch (error) {
    console.error("❌ Search error:", error);
    res.status(500).json({
      success: false,
      error: "Search failed",
    });
  }
});

// Get available genres
router.get("/meta/genres", async (req, res) => {
  try {
    const genres = await Track.distinct("genre", {
      isActive: true,
      isPublic: true,
    });

    const genreStats = await Track.aggregate([
      {
        $match: { isActive: true, isPublic: true },
      },
      {
        $group: {
          _id: "$genre",
          count: { $sum: 1 },
          totalPlays: { $sum: "$plays" },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    res.json({
      success: true,
      genres: genreStats.map((g) => ({
        name: g._id,
        count: g.count,
        plays: g.totalPlays,
      })),
    });
  } catch (error) {
    console.error("❌ Get genres error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch genres",
    });
  }
});

// Get available artists
router.get("/meta/artists", async (req, res) => {
  try {
    const artists = await Track.aggregate([
      {
        $match: { isActive: true, isPublic: true },
      },
      {
        $group: {
          _id: "$artist",
          trackCount: { $sum: 1 },
          totalPlays: { $sum: "$plays" },
          genres: { $addToSet: "$genre" },
        },
      },
      {
        $sort: { trackCount: -1 },
      },
    ]);

    res.json({
      success: true,
      artists: artists.map((a) => ({
        name: a._id,
        trackCount: a.trackCount,
        totalPlays: a.totalPlays,
        genres: a.genres,
      })),
    });
  } catch (error) {
    console.error("❌ Get artists error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch artists",
    });
  }
});

console.log("✅ Secure tracks routes loaded");

export { router };
