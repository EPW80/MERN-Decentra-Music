import express from 'express';
import * as artistController from '../controllers/artistController.js';

const router = express.Router();

// Create new artist
router.post('/', artistController.createArtist);

// Get all artists
router.get('/', artistController.getAllArtists);

// Get artist by ID
router.get('/:id', artistController.getArtistById);

// Update artist
router.put('/:id', artistController.updateArtist);

// Delete artist
router.delete('/:id', artistController.deleteArtist);

// Get artist's music
router.get('/:id/music', artistController.getArtistMusic);

export default router;
