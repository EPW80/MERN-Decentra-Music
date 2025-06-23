import Track from '../models/Track.js';

/**
 * Public Track Operations
 * - Get tracks (public read-only operations)
 * - Search tracks
 * - Get track details
 * - Stream track (with access control)
 */

// Get all tracks with filtering
export const getAllTracks = async (req, res) => {
    try {
        const { 
            genre, 
            artist, 
            search, 
            sort = 'newest',
            page = 1, 
            limit = 20 
        } = req.query;

        // Build filter
        const filter = { 
            isActive: true, 
            isPublic: true 
        };

        if (genre && genre !== 'all') {
            filter.genre = genre;
        }

        if (artist) {
            filter.artist = { $regex: artist, $options: 'i' };
        }

        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { artist: { $regex: search, $options: 'i' } },
                { album: { $regex: search, $options: 'i' } }
            ];
        }

        // Build sort
        let sortOption = {};
        switch (sort) {
            case 'newest':
                sortOption = { createdAt: -1 };
                break;
            case 'oldest':
                sortOption = { createdAt: 1 };
                break;
            case 'popular':
                sortOption = { plays: -1, likes: -1 };
                break;
            case 'title':
                sortOption = { title: 1 };
                break;
            case 'artist':
                sortOption = { artist: 1 };
                break;
            default:
                sortOption = { createdAt: -1 };
        }

        // Execute query with pagination
        const skip = (page - 1) * limit;
        const [tracks, total] = await Promise.all([
            Track.find(filter)
                .sort(sortOption)
                .skip(skip)
                .limit(parseInt(limit))
                .select('-__v'),
            Track.countDocuments(filter)
        ]);

        // Calculate pagination info
        const totalPages = Math.ceil(total / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;

        res.json({
            success: true,
            tracks,
            count: tracks.length,
            pagination: {
                current: parseInt(page),
                pages: totalPages,
                total,
                hasNext,
                hasPrev
            },
            filters: {
                genre: genre || null,
                artist: artist || null,
                search: search || null,
                sort
            }
        });

    } catch (error) {
        console.error('Get tracks error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch tracks' 
        });
    }
};

// Get single track details
export const getTrackDetails = async (req, res) => {
    try {
        const { id } = req.params;
        
        const track = await Track.findById(id)
            .select('-__v');

        if (!track || !track.isActive || !track.isPublic) {
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
        console.error('Get track details error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch track details' 
        });
    }
};

// Search tracks
export const searchTracks = async (req, res) => {
    try {
        const { q, limit = 10 } = req.query;

        if (!q || q.trim().length < 2) {
            return res.status(400).json({
                success: false,
                error: 'Search query must be at least 2 characters'
            });
        }

        const searchRegex = { $regex: q.trim(), $options: 'i' };
        
        const tracks = await Track.find({
            isActive: true,
            isPublic: true,
            $or: [
                { title: searchRegex },
                { artist: searchRegex },
                { album: searchRegex },
                { genre: searchRegex }
            ]
        })
        .limit(parseInt(limit))
        .sort({ plays: -1, createdAt: -1 })
        .select('-__v');

        res.json({
            success: true,
            tracks,
            count: tracks.length,
            query: q
        });

    } catch (error) {
        console.error('Search tracks error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Search failed' 
        });
    }
};

// Get track by blockchain ID (for blockchain integration)
export const getTrackByBlockchainId = async (req, res) => {
    try {
        const { blockchainId } = req.params;
        
        const track = await Track.findOne({ 
            'blockchain.contractId': blockchainId,
            isActive: true 
        });

        if (!track) {
            return res.status(404).json({ 
                success: false, 
                error: 'Track not found on blockchain' 
            });
        }

        res.json({
            success: true,
            track
        });

    } catch (error) {
        console.error('Get blockchain track error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch blockchain track' 
        });
    }
};

// Increment play count
export const incrementPlayCount = async (req, res) => {
    try {
        const { id } = req.params;
        
        const track = await Track.findByIdAndUpdate(
            id,
            { $inc: { plays: 1 } },
            { new: true }
        );

        if (!track) {
            return res.status(404).json({ 
                success: false, 
                error: 'Track not found' 
            });
        }

        res.json({
            success: true,
            plays: track.plays
        });

    } catch (error) {
        console.error('Increment play count error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to update play count' 
        });
    }
};
