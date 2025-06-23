import express from "express";
import * as trackController from "../controllers/trackController.js";

const router = express.Router();

// Public track routes
router.get("/tracks", trackController.getAllTracks);
router.get("/tracks/search", trackController.searchTracks);
router.get("/tracks/:id", trackController.getTrackDetails);
router.post("/tracks/:id/play", trackController.incrementPlayCount);

// Blockchain routes
router.get("/blockchain/tracks/:blockchainId", trackController.getTrackByBlockchainId);

export default router;
