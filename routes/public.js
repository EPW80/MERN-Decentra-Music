import express from "express";

const router = express.Router();

// Import controllers - but let's start simple to identify the issue
console.log("Setting up public routes...");

// Basic health check first
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: "1.0.0",
  });
});

// Test route
router.get("/test", (req, res) => {
  res.json({ message: "Public routes working" });
});

// Add routes one by one to identify the problematic one
try {
  console.log("Importing track controller...");
  const trackController = await import("../controllers/trackController.js");

  // Simple routes without validation first
  router.get("/tracks", trackController.getAllTracks);
  console.log("✅ Basic tracks route added");

  router.get("/tracks/:id", trackController.getTrackDetails);
  console.log("✅ Track details route added");
} catch (error) {
  console.error("❌ Failed to import track controller:", error.message);
}

console.log("Public routes setup complete");
export default router;
