import express from 'express';
import {
    uploadMusic,
    getAllMusic,
    getMusicById,
    uploadMiddleware
} from '../controllers/musicController.js';

const router = express.Router();

// Upload music file
router.post('/upload', uploadMiddleware, uploadMusic);

// Get all music
router.get('/', getAllMusic);

// Get music by ID
router.get('/:id', getMusicById);

export default router;
