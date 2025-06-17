import { Router } from "express";
import { uploadMiddleware } from "../middleware/upload.js";
import {
  uploadTrack,
  updateTrack,
  deleteTrack,
  getAnalytics,
  getSalesData,
} from "../controllers/adminController.js";

const router = Router();

// Track management
router.post("/tracks", uploadMiddleware, uploadTrack);
router.put("/tracks/:id", updateTrack);
router.delete("/tracks/:id", deleteTrack);

// Sales analytics
router.get("/analytics", getAnalytics);
router.get("/sales", getSalesData);

export default router;
