import express from "express";
import { validateAdmin } from "../middleware/auth.js";
import { uploadSingle } from "../middleware/upload.js";
import * as adminController from "../controllers/adminController.js";
import Track from "../models/Track.js";

const router = express.Router();

/**
 * Admin API Routes
 */

// Middleware to validate admin key for all admin routes
router.use(validateAdmin);

// Admin info
router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Decentra Music Admin API",
    version: "1.0.0",
    admin: true,
    endpoints: {
      tracks: "/api/admin/tracks",
      upload: "POST /api/admin/tracks (with file)",
      status: "/api/admin/status",
      stats: "/api/admin/stats",
    },
  });
});

// Track management routes
// IMPORTANT: Add upload middleware to the POST route
router.post("/tracks", uploadSingle, adminController.uploadTrack);
router.get("/tracks", adminController.getAllTracksAdmin);
router.get("/tracks/:id", async (req, res) => {
  try {
    const track = await Track.findById(req.params.id).select("-__v");

    if (!track) {
      return res.status(404).json({
        success: false,
        error: "Track not found",
      });
    }

    res.json({
      success: true,
      track,
    });
  } catch (error) {
    console.error("❌ Get track error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch track",
    });
  }
});
router.put("/tracks/:id", adminController.updateTrack);
router.delete("/tracks/:id", adminController.deleteTrack);

// System status
router.get("/status", async (req, res) => {
  try {
    const { getConnectionStatus } = await import("../config/database.js");
    const dbStatus = getConnectionStatus();

    // Get storage service status
    let storageStatus = null;
    try {
      const storageService = await import("../services/StorageService.js");
      storageStatus = await storageService.default.getStatus();
    } catch (error) {
      storageStatus = { error: error.message };
    }

    // Get blockchain status
    let blockchainStatus = null;
    try {
      const blockchainModule = await import("../config/blockchain.js");
      blockchainStatus = {
        available: blockchainModule.isBlockchainAvailable
          ? blockchainModule.isBlockchainAvailable()
          : false,
        enabled: process.env.BLOCKCHAIN_ENABLED !== "false",
      };
    } catch (error) {
      blockchainStatus = { error: error.message };
    }

    res.json({
      success: true,
      status: "operational",
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        storage: storageStatus,
        blockchain: blockchainStatus,
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || "1.0.0",
        nodeVersion: process.version,
        platform: process.platform,
      },
    });
  } catch (error) {
    console.error("❌ Status check error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get system status",
      details: error.message,
    });
  }
});

// System statistics
router.get("/stats", async (req, res) => {
  try {
    const [
      totalTracks,
      activeTracks,
      totalPlays,
      totalDownloads,
      recentTracks,
    ] = await Promise.all([
      Track.countDocuments(),
      Track.countDocuments({ isActive: true }),
      Track.aggregate([{ $group: { _id: null, total: { $sum: "$plays" } } }]),
      Track.aggregate([{ $group: { _id: null, total: { $sum: "$downloads" } } }]),
      Track.find({ isActive: true })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("title artist createdAt plays downloads"),
    ]);

    const stats = {
      tracks: {
        total: totalTracks,
        active: activeTracks,
        inactive: totalTracks - activeTracks,
      },
      engagement: {
        totalPlays: totalPlays[0]?.total || 0,
        totalDownloads: totalDownloads[0]?.total || 0,
        averagePlaysPerTrack:
          activeTracks > 0
            ? Math.round((totalPlays[0]?.total || 0) / activeTracks)
            : 0,
      },
      recent: recentTracks,
    };

    res.json({
      success: true,
      stats,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Stats error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get statistics",
    });
  }
});

// Blockchain management endpoints
router.get('/blockchain/status', async (req, res) => {
    try {
        let blockchainService;
        try {
            blockchainService = await import('../services/BlockchainService.js');
        } catch (error) {
            return res.json({
                success: true,
                status: {
                    available: false,
                    enabled: false,
                    error: 'Blockchain service not available'
                }
            });
        }

        const status = await blockchainService.default.getStatus();
        res.json({
            success: true,
            status
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get blockchain status'
        });
    }
});

router.post('/blockchain/retry-failed-events', async (req, res) => {
    try {
        const blockchainService = await import('../services/BlockchainService.js');
        await blockchainService.default.retryFailedEvents();
        
        res.json({
            success: true,
            message: 'Failed events retry initiated'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to retry events'
        });
    }
});

router.delete('/blockchain/failed-events', async (req, res) => {
    try {
        const blockchainService = await import('../services/BlockchainService.js');
        await blockchainService.default.clearFailedEvents();
        
        res.json({
            success: true,
            message: 'Failed events cleared'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to clear events'
        });
    }
});

console.log("✅ Admin routes loaded");

// Export the router
export { router };
