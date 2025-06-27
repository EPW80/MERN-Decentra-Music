import express from 'express';
import Track from '../models/Track.js';

const router = express.Router();

/**
 * Public API Routes
 */

// Get all public tracks
router.get('/tracks', async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            genre, 
            artist, 
            search, 
            sort = '-createdAt' 
        } = req.query;

        // Build query
        const query = { 
            isActive: true, 
            isPublic: true 
        };

        if (genre) {
            query.genre = genre;
        }

        if (artist) {
            query.artist = new RegExp(artist, 'i');
        }

        if (search) {
            query.$or = [
                { title: new RegExp(search, 'i') },
                { artist: new RegExp(search, 'i') },
                { album: new RegExp(search, 'i') }
            ];
        }

        // Execute query with pagination
        const tracks = await Track.find(query)
            .sort(sort)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .select('-__v');

        const total = await Track.countDocuments(query);

        res.json({
            success: true,
            tracks,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('❌ Get tracks error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch tracks'
        });
    }
});

// Get single track by ID
router.get('/tracks/:id', async (req, res) => {
    try {
        const track = await Track.findOne({
            _id: req.params.id,
            isActive: true,
            isPublic: true
        }).select('-__v');

        if (!track) {
            return res.status(404).json({
                success: false,
                error: 'Track not found'
            });
        }

        res.json({
            success: true,
            track
        });

    } catch (error) {
        console.error('❌ Get track error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch track'
        });
    }
});

// Get track stream/download (with play count)
router.get('/tracks/:id/stream', async (req, res) => {
    try {
        const track = await Track.findOne({
            _id: req.params.id,
            isActive: true,
            isPublic: true
        });

        if (!track) {
            return res.status(404).json({
                success: false,
                error: 'Track not found'
            });
        }

        // Increment play count
        track.plays += 1;
        await track.save();

        // For local storage, redirect to file URL
        if (track.storage && track.storage.url) {
            return res.redirect(track.storage.url);
        }

        // Legacy IPFS support
        if (track.ipfs && track.ipfs.url) {
            return res.redirect(track.ipfs.url);
        }

        res.status(404).json({
            success: false,
            error: 'Track file not available'
        });

    } catch (error) {
        console.error('❌ Stream track error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to stream track'
        });
    }
});

// Get genres
router.get('/genres', async (req, res) => {
    try {
        const genres = await Track.distinct('genre', {
            isActive: true,
            isPublic: true
        });

        res.json({
            success: true,
            genres: genres.filter(g => g && g.trim())
        });

    } catch (error) {
        console.error('❌ Get genres error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch genres'
        });
    }
});

// Get artists
router.get('/artists', async (req, res) => {
    try {
        const artists = await Track.distinct('artist', {
            isActive: true,
            isPublic: true
        });

        res.json({
            success: true,
            artists: artists.filter(a => a && a.trim())
        });

    } catch (error) {
        console.error('❌ Get artists error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch artists'
        });
    }
});

// Search tracks
router.get('/search', async (req, res) => {
    try {
        const { q, limit = 10 } = req.query;

        if (!q) {
            return res.status(400).json({
                success: false,
                error: 'Search query required'
            });
        }

        const tracks = await Track.find({
            isActive: true,
            isPublic: true,
            $or: [
                { title: new RegExp(q, 'i') },
                { artist: new RegExp(q, 'i') },
                { album: new RegExp(q, 'i') },
                { genre: new RegExp(q, 'i') }
            ]
        })
        .limit(parseInt(limit))
        .select('title artist album genre price createdAt')
        .sort({ plays: -1, createdAt: -1 });

        res.json({
            success: true,
            query: q,
            results: tracks.length,
            tracks
        });

    } catch (error) {
        console.error('❌ Search error:', error);
        res.status(500).json({
            success: false,
            error: 'Search failed'
        });
    }
});

// API info endpoint
router.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Decentra Music API',
        version: '1.0.0',
        endpoints: {
            tracks: '/api/tracks',
            search: '/api/search',
            genres: '/api/genres',
            artists: '/api/artists'
        }
    });
});

console.log('✅ Public routes loaded');

// IMPORTANT: Export the router
export { router };
