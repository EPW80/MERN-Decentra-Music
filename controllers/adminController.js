import Track from '../models/Track.js';
import storageService from '../services/StorageService.js';

/**
 * Admin Track Operations
 * - Upload tracks
 * - Update tracks
 * - Delete tracks
 * - Manage track status
 */

// Upload new track
export const uploadTrack = async (req, res) => {
    try {
        console.log('📤 Admin track upload request');
        console.log('📋 Request body:', req.body);
        console.log('📁 Request file:', req.file ? {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            filename: req.file.filename
        } : 'No file uploaded');
        console.log('📊 Request headers:', {
            'content-type': req.headers['content-type'],
            'content-length': req.headers['content-length']
        });
        
        const { title, artist, genre, album, price, description } = req.body;
        const file = req.file;

        // Enhanced validation with better logging
        if (!title || !artist) {
            console.log('❌ Validation failed - missing required fields');
            console.log('   Title:', title || 'MISSING');
            console.log('   Artist:', artist || 'MISSING');
            console.log('   All body fields:', req.body);
            
            return res.status(400).json({ 
                success: false,
                error: 'Title and artist are required',
                received: { 
                    title: title || null, 
                    artist: artist || null, 
                    genre: genre || null, 
                    album: album || null,
                    hasFile: !!file
                }
            });
        }

        if (!file) {
            console.log('❌ No file uploaded');
            return res.status(400).json({ 
                success: false,
                error: 'Audio file is required',
                received: { title, artist, genre, album }
            });
        }

        console.log(`📁 Processing upload: "${title}" by "${artist}"`);

        // Upload to storage
        const uploadResult = await storageService.uploadFile(file, {
            filename: file.originalname,
            trackInfo: { title, artist, genre, album },
            uploadedBy: 'admin',
            uploadedAt: new Date().toISOString()
        });

        if (!uploadResult.success) {
            throw new Error(`Storage upload failed: ${uploadResult.error}`);
        }

        // Create track record
        const trackData = {
            title: title.trim(),
            artist: artist.trim(),
            genre: genre?.trim() || 'other',
            album: album?.trim() || '',
            price: price || '0.001',
            description: description?.trim() || '',
            
            // Storage info
            storage: {
                provider: uploadResult.provider,
                cid: uploadResult.cid,
                url: uploadResult.url,
                filename: uploadResult.filename
            },
            
            // Legacy compatibility
            ipfs: {
                cid: uploadResult.cid,
                url: uploadResult.url
            },
            
            // File metadata
            fileSize: uploadResult.size,
            mimeType: file.mimetype,
            originalFilename: file.originalname,
            
            // Status
            isActive: true,
            isPublic: true,
            
            // Initial stats
            plays: 0,
            downloads: 0,
            likes: []
        };

        const newTrack = new Track(trackData);
        const savedTrack = await newTrack.save();

        console.log(`✅ Track uploaded successfully: ${savedTrack._id}`);

        res.status(201).json({
            success: true,
            message: 'Track uploaded successfully',
            track: {
                id: savedTrack._id,
                title: savedTrack.title,
                artist: savedTrack.artist,
                genre: savedTrack.genre,
                album: savedTrack.album,
                price: savedTrack.price,
                url: savedTrack.storage.url,
                fileSize: savedTrack.fileSize,
                createdAt: savedTrack.createdAt
            },
            storage: {
                provider: uploadResult.provider,
                cid: uploadResult.cid,
                url: uploadResult.url
            }
        });

    } catch (error) {
        console.error('❌ Admin track upload failed:', error);
        res.status(500).json({ 
            success: false,
            error: 'Track upload failed',
            details: error.message
        });
    }
};

// Update track
export const updateTrack = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        // Remove sensitive fields that shouldn't be updated
        delete updates._id;
        delete updates.storage;
        delete updates.ipfs;
        delete updates.fileSize;
        delete updates.mimeType;
        delete updates.plays;
        delete updates.downloads;
        delete updates.likes;
        delete updates.createdAt;
        delete updates.updatedAt;

        const track = await Track.findByIdAndUpdate(
            id,
            { ...updates, updatedAt: new Date() },
            { new: true, runValidators: true }
        );

        if (!track) {
            return res.status(404).json({ 
                success: false, 
                error: 'Track not found' 
            });
        }

        res.json({
            success: true,
            message: 'Track updated successfully',
            track
        });

    } catch (error) {
        console.error('Update track error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to update track' 
        });
    }
};

// Delete track
export const deleteTrack = async (req, res) => {
    try {
        const { id } = req.params;
        const { permanent = false } = req.query;

        const track = await Track.findById(id);
        
        if (!track) {
            return res.status(404).json({ 
                success: false, 
                error: 'Track not found' 
            });
        }

        if (permanent === 'true') {
            // Permanent deletion
            try {
                // Try to delete from storage
                await storageService.deleteFile(track.storage.cid);
            } catch (storageError) {
                console.warn('Storage deletion failed:', storageError.message);
            }
            
            await Track.findByIdAndDelete(id);
            
            res.json({
                success: true,
                message: 'Track permanently deleted'
            });
        } else {
            // Soft deletion
            track.isActive = false;
            track.isPublic = false;
            await track.save();
            
            res.json({
                success: true,
                message: 'Track deactivated'
            });
        }

    } catch (error) {
        console.error('Delete track error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to delete track' 
        });
    }
};

// Get all tracks (including inactive for admin)
export const getAllTracksAdmin = async (req, res) => {
    try {
        const { 
            status = 'all', 
            page = 1, 
            limit = 20,
            sort = 'newest'
        } = req.query;

        // Build filter
        const filter = {};
        
        if (status === 'active') {
            filter.isActive = true;
        } else if (status === 'inactive') {
            filter.isActive = false;
        }
        // 'all' shows both active and inactive

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
                sortOption = { plays: -1 };
                break;
            case 'title':
                sortOption = { title: 1 };
                break;
            default:
                sortOption = { createdAt: -1 };
        }

        // Execute query
        const skip = (page - 1) * limit;
        const [tracks, total] = await Promise.all([
            Track.find(filter)
                .sort(sortOption)
                .skip(skip)
                .limit(parseInt(limit)),
            Track.countDocuments(filter)
        ]);

        res.json({
            success: true,
            tracks,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(total / limit),
                total,
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            },
            filters: { status, sort }
        });

    } catch (error) {
        console.error('Get admin tracks error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch tracks' 
        });
    }
};

// Get analytics
export const getAnalytics = async (req, res) => {
    try {
        const [
            totalTracks,
            activeTracks,
            totalPlays,
            totalDownloads,
            storageStats,
            genreStats,
            recentTracks
        ] = await Promise.all([
            Track.countDocuments(),
            Track.countDocuments({ isActive: true }),
            Track.aggregate([
                { $group: { _id: null, total: { $sum: '$plays' } } }
            ]),
            Track.aggregate([
                { $group: { _id: null, total: { $sum: '$downloads' } } }
            ]),
            Track.aggregate([
                {
                    $group: {
                        _id: '$storage.provider',
                        count: { $sum: 1 },
                        totalSize: { $sum: '$fileSize' }
                    }
                }
            ]),
            Track.aggregate([
                { $group: { _id: '$genre', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            Track.find({ isActive: true })
                .sort({ createdAt: -1 })
                .limit(5)
                .select('title artist createdAt plays')
        ]);

        res.json({
            success: true,
            analytics: {
                tracks: {
                    total: totalTracks,
                    active: activeTracks,
                    inactive: totalTracks - activeTracks
                },
                engagement: {
                    totalPlays: totalPlays[0]?.total || 0,
                    totalDownloads: totalDownloads[0]?.total || 0,
                    averagePlays: totalTracks > 0 ? Math.round((totalPlays[0]?.total || 0) / totalTracks) : 0
                },
                storage: {
                    current: storageService.getStatus(),
                    distribution: storageStats
                },
                genres: genreStats,
                recentTracks
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get analytics' 
        });
    }
};