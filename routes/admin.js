import express from "express";

const router = express.Router();

console.log("Setting up admin routes...");

// Simple admin auth middleware
const simpleAdminAuth = (req, res, next) => {
  const adminKey = req.headers["x-admin-key"];
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: "Invalid admin key" });
  }
  next();
};

// Apply auth
router.use(simpleAdminAuth);

// Test route
router.get("/test", (req, res) => {
  res.json({ message: "Admin routes working" });
});

// Add admin routes
try {
  console.log("Importing admin controller...");
  const adminController = await import("../controllers/adminController.js");
  const { uploadMiddleware } = await import("../middleware/upload.js");

  router.post("/tracks", uploadMiddleware, adminController.uploadTrack);
  console.log("✅ Upload track route added");

  router.get("/analytics", adminController.getAnalytics);
  console.log("✅ Analytics route added");
} catch (error) {
  console.error("❌ Failed to import admin controller:", error.message);
}

console.log("Admin routes setup complete");
export default router;
