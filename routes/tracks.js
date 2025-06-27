import express from 'express';
import Track from '../models/Track.js';
import path from 'path';
import fs from 'fs';

const router = express.Router();

/**
 * Public Track API Routes
 * No authentication required
 */

// Get all public tracks with filtering and pagination
router.get('/', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            genre,
            artist,
            search,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Build query for public tracks only
        const query = {
            isActive: true,
            isPublic: true
        };

        // Apply filters
        if (genre && genre !== 'all') {
            query.genre = genre.toLowerCase();
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

        // Build sort object
        const sortObj = {};
        sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Execute query with pagination
        const tracks = await Track.find(query)
            .sort(sortObj)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .select('-__v -blockchain.error -purchases -royalties -withdrawals')
            .lean();

        const total = await Track.countDocuments(query);

        res.json({
            success: true,
            tracks,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit),
                hasNext: page * limit < total,
                hasPrev: page > 1
            },
            filters: {
                genre: genre || 'all',
                artist: artist || null,
                search: search || null
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
router.get('/:id', async (req, res) => {
    try {
        const track = await Track.findOne({
            _id: req.params.id,
            isActive: true,
            isPublic: true
        })
        .select('-__v -blockchain.error -purchases -royalties -withdrawals')
        .lean();

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
        
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                error: 'Invalid track ID'
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Failed to fetch track'
        });
    }
});

// Stream/download track
router.get('/:id/stream', async (req, res) => {
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

        // Determine file path
        let filePath;
        
        if (track.storage?.filename) {
            // New storage system
            filePath = path.join(process.cwd(), 'uploads', track.storage.filename);
        } else if (track.ipfs?.cid) {
            // Legacy IPFS - redirect to gateway
            return res.redirect(track.ipfs.url);
        } else {
            return res.status(404).json({
                success: false,
                error: 'File not available'
            });
        }

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                error: 'File not found on server'
            });
        }

        // Increment play count (async, don't wait)
        Track.findByIdAndUpdate(req.params.id, { $inc: { plays: 1 } }).exec();

        // Get file stats
        const stats = fs.statSync(filePath);
        
        // Set headers for audio streaming
        res.set({
            'Content-Type': track.mimeType || 'audio/mpeg',
            'Content-Length': stats.size,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=3600',
            'Content-Disposition': `inline; filename="${track.title}.mp3"`
        });

        // Handle range requests for audio seeking
        const range = req.headers.range;
        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
            const chunksize = (end - start) + 1;
            
            res.status(206);
            res.set({
                'Content-Range': `bytes ${start}-${end}/${stats.size}`,
                'Content-Length': chunksize
            });
            
            const stream = fs.createReadStream(filePath, { start, end });
            stream.pipe(res);
        } else {
            // Send entire file
            const stream = fs.createReadStream(filePath);
            stream.pipe(res);
        }

    } catch (error) {
        console.error('❌ Stream track error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to stream track'
        });
    }
});

// Search tracks
router.get('/search', async (req, res) => {
    try {
        const { q, limit = 20 } = req.query;

        if (!q || q.trim().length < 2) {
            return res.status(400).json({
                success: false,
                error: 'Search query must be at least 2 characters'
            });
        }

        const tracks = await Track.search(q.trim(), parseInt(limit));

        res.json({
            success: true,
            query: q.trim(),
            tracks,
            count: tracks.length
        });

    } catch (error) {
        console.error('❌ Search error:', error);
        res.status(500).json({
            success: false,
            error: 'Search failed'
        });
    }
});

// Get available genres
router.get('/meta/genres', async (req, res) => {
    try {
        const genres = await Track.distinct('genre', {
            isActive: true,
            isPublic: true
        });

        const genreStats = await Track.aggregate([
            {
                $match: { isActive: true, isPublic: true }
            },
            {
                $group: {
                    _id: '$genre',
                    count: { $sum: 1 },
                    totalPlays: { $sum: '$plays' }
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        res.json({
            success: true,
            genres: genreStats.map(g => ({
                name: g._id,
                count: g.count,
                plays: g.totalPlays
            }))
        });

    } catch (error) {
        console.error('❌ Get genres error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch genres'
        });
    }
});

// Get available artists
router.get('/meta/artists', async (req, res) => {
    try {
        const artists = await Track.aggregate([
            {
                $match: { isActive: true, isPublic: true }
            },
            {
                $group: {
                    _id: '$artist',
                    trackCount: { $sum: 1 },
                    totalPlays: { $sum: '$plays' },
                    genres: { $addToSet: '$genre' }
                }
            },
            {
                $sort: { trackCount: -1 }
            }
        ]);

        res.json({
            success: true,
            artists: artists.map(a => ({
                name: a._id,
                trackCount: a.trackCount,
                totalPlays: a.totalPlays,
                genres: a.genres
            }))
        });

    } catch (error) {
        console.error('❌ Get artists error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch artists'
        });
    }
});

console.log('✅ Track routes loaded');

export { router };