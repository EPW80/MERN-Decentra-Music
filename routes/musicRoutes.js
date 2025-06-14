import { Router } from 'express';
const router = Router();
import { uploadMiddleware, uploadMusic, getAllMusic, getMusicById } from '../controllers/musicController';

// Upload music file
router.post('/upload', 
    uploadMiddleware,
    uploadMusic
);

// Get all music
router.get('/', getAllMusic);

// Get music by ID
router.get('/:id', getMusicById);

export default router;
