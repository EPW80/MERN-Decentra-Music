import express from "express";

/**
 * Main API Router
 * Consolidates all route modules with clear separation
 */

const router = express.Router();

// API Information
router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Decentra Music API",
    version: "1.0.0",
    endpoints: {
      tracks: "/api/tracks",
      admin: "/api/admin",
      blockchain: "/api/blockchain",
      health: "/health",
    },
    documentation: "https://github.com/epw80/decentra-music-backend",
    timestamp: new Date().toISOString(),
  });
});

// Load and mount route modules
async function setupRoutes() {
  try {
    // Public track routes
    const trackRoutes = await import("./tracks.js");
    router.use("/tracks", trackRoutes.router);
    console.log("✅ Track routes mounted at /api/tracks");

    // Admin routes
    const adminRoutes = await import("./admin.js");
    router.use("/admin", adminRoutes.router);
    console.log("✅ Admin routes mounted at /api/admin");

    // Blockchain routes (if enabled)
    if (process.env.BLOCKCHAIN_ENABLED === "true") {
      try {
        const blockchainRoutes = await import("./blockchain.js");
        router.use("/blockchain", blockchainRoutes.router);
        console.log("✅ Blockchain routes mounted at /api/blockchain");
      } catch (error) {
        console.log("⚠️ Blockchain routes not available:", error.message);
      }
    }
  } catch (error) {
    console.error("❌ Error setting up routes:", error);
    throw error;
  }
}

// Initialize routes
await setupRoutes();

export { router };

console.log("✅ Main router configured");
