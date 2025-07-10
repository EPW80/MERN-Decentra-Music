import express from "express";

/**
 * Main API Router
 * Consolidates all route modules with clear separation
 */

const router = express.Router();

// Import route modules (with error handling)
let tracksRoutes, purchasesRoutes, artistsRoutes, blockchainRoutes;

try {
    tracksRoutes = (await import('./api/tracks.js')).default;
    router.use('/tracks', tracksRoutes);
    console.log('✅ Tracks routes loaded');
} catch (error) {
    console.error('❌ Failed to load tracks routes:', error.message);
}

try {
    purchasesRoutes = (await import('./api/purchases.js')).default;
    router.use('/purchases', purchasesRoutes);
    console.log('✅ Purchases routes loaded');
} catch (error) {
    console.warn('⚠️ Purchases routes not available:', error.message);
    // Create fallback purchase routes
    router.get('/purchases/health', (req, res) => {
        res.json({ success: false, error: 'Purchase service not available' });
    });
}

try {
    artistsRoutes = (await import('./api/artists.js')).default;
} catch (error) {
    console.warn('⚠️ Artists routes not available:', error.message);
}

try {
    blockchainRoutes = (await import('./api/blockchain.js')).default;
    router.use('/blockchain', blockchainRoutes);
    console.log('✅ Blockchain routes loaded');
} catch (error) {
    console.error('❌ Failed to load blockchain routes:', error.message);
}

// API Information
router.get("/", (req, res) => {
    const availableEndpoints = {};
    
    if (tracksRoutes) availableEndpoints.tracks = '/api/tracks';
    if (purchasesRoutes) availableEndpoints.purchases = '/api/purchases';
    if (artistsRoutes) availableEndpoints.artists = '/api/artists';
    if (blockchainRoutes) availableEndpoints.blockchain = '/api/blockchain';
    
    res.json({
        success: true,
        message: 'Decentra Music API v1',
        version: '1.0.0',
        endpoints: {
            tracks: '/api/tracks',
            blockchain: '/api/blockchain',
            test: '/api/blockchain/test'
        },
        timestamp: new Date().toISOString()
    });
});

export { router };

console.log("✅ Main router configured");
