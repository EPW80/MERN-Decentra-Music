import express from "express";
import * as adminTrackController from "../controllers/adminController.js";
import * as blockchainController from "../controllers/blockchainController.js";
import { uploadMiddleware } from "../middleware/upload.js";
import { adminAuth } from "../middleware/adminAuth.js";

const router = express.Router();

console.log("Setting up admin routes...");

// Apply admin authentication
router.use(adminAuth);

// Test route
router.get("/test", (req, res) => {
  res.json({ message: "Admin routes working" });
});

// Admin track routes
router.post("/tracks", uploadMiddleware, adminTrackController.uploadTrack);
router.get("/tracks", adminTrackController.getAllTracksAdmin);
router.put("/tracks/:id", adminTrackController.updateTrack);
router.delete("/tracks/:id", adminTrackController.deleteTrack);
router.get("/analytics", adminTrackController.getAnalytics);

// Blockchain admin routes
router.post('/tracks/:trackId/blockchain', blockchainController.addTrackToBlockchain);
router.post('/blockchain/:contractId/purchase', blockchainController.purchaseTrack);
router.get('/blockchain/:contractId/check', blockchainController.checkPurchase);
router.post('/blockchain/withdraw', blockchainController.withdrawArtistBalance);
router.get('/blockchain/status', blockchainController.getBlockchainStatus);
router.get('/transactions/:txHash', blockchainController.getTransactionStatus);

console.log("Admin routes setup complete");
export default router;
