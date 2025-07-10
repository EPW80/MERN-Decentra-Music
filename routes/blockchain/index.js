import express from 'express';
import musicStoreService from '../../src/services/blockchain/MusicStoreService.js';
import web3Provider from '../../src/services/blockchain/web3Provider.js';

const router = express.Router();

// Get contract stats and network info
router.get('/stats', async (req, res) => {
    try {
        const stats = await musicStoreService.getContractStats();
        const networkInfo = await web3Provider.getNetworkInfo();
        
        res.json({
            success: true,
            data: {
                contract: stats,
                network: networkInfo
            }
        });
    } catch (error) {
        console.error('❌ Error getting contract stats:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get contract statistics'
        });
    }
});

// Get network information
router.get('/network', async (req, res) => {
    try {
        const networkInfo = await web3Provider.getNetworkInfo();
        
        res.json({
            success: true,
            data: networkInfo
        });
    } catch (error) {
        console.error('❌ Error getting network info:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to get network information'
        });
    }
});

// Test blockchain connection
router.get('/test', async (req, res) => {
    try {
        // Test basic connectivity
        const networkInfo = await web3Provider.getNetworkInfo();
        const stats = await musicStoreService.getContractStats();
        
        res.json({
            success: true,
            message: 'Blockchain connection test successful',
            data: {
                connected: true,
                network: networkInfo,
                contractStats: stats
            }
        });
    } catch (error) {
        console.error('❌ Blockchain connection test failed:', error.message);
        res.status(500).json({
            success: false,
            error: 'Blockchain connection test failed',
            details: error.message
        });
    }
});

export default router;