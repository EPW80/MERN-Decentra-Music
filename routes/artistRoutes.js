import express from 'express';

// Import each function explicitly
import { 
    createArtist,
    getAllArtists, 
    getArtistById,
    updateArtist,
    deleteArtist,
    getArtistMusic 
} from '../controllers/artistController.js';

const router = express.Router();

// Create new artist
router.post('/', createArtist);

// Get all artists
router.get('/', getAllArtists);

// Get artist by ID
router.get('/:id', getArtistById);

// Update artist
router.put('/:id', updateArtist);

// Delete artist
router.delete('/:id', deleteArtist);

// Get artist's music
router.get('/:id/music', getArtistMusic);

export default router;
