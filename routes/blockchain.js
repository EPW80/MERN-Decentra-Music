import express from 'express';
import Track from '../models/Track.js';

const router = express.Router();

/**
 * Blockchain Integration Routes
 * For Web3 functionality
 */

// Get blockchain status
router.get('/status', async (req, res) => {
    try {
        const blockchainEnabled = process.env.BLOCKCHAIN_ENABLED === 'true';
        
        if (!blockchainEnabled) {
            return res.json({
                success: true,
                enabled: false,
                message: 'Blockchain functionality is disabled'
            });
        }

        // Check blockchain service status
        let blockchainStatus = null;
        try {
            const blockchainService = await import('../services/BlockchainService.js');
            blockchainStatus = await blockchainService.default.getStatus();
        } catch (error) {
            blockchainStatus = { error: error.message };
        }

        res.json({
            success: true,
            enabled: true,
            status: blockchainStatus
        });

    } catch (error) {
        console.error('❌ Blockchain status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get blockchain status'
        });
    }
});

// Get track's blockchain info
router.get('/tracks/:id', async (req, res) => {
    try {
        const track = await Track.findById(req.params.id)
            .select('title artist blockchain')
            .lean();

        if (!track) {
            return res.status(404).json({
                success: false,
                error: 'Track not found'
            });
        }

        res.json({
            success: true,
            trackId: track._id,
            title: track.title,
            artist: track.artist,
            blockchain: track.blockchain || { status: 'disabled' }
        });

    } catch (error) {
        console.error('❌ Get track blockchain info error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get blockchain information'
        });
    }
});

console.log('✅ Blockchain routes loaded');

export { router };