import { generateRateLimitKey } from '../utils/security.js';

/**
 * Simple Authentication Middleware
 */

// Simple admin key validation
export const validateAdmin = (req, res, next) => {
    try {
        const providedKey = req.headers['x-admin-key'];
        const expectedKey = process.env.ADMIN_KEY;
        
        if (!providedKey) {
            console.warn(`⚠️ Admin access attempt without key from ${req.ip}`);
            return res.status(401).json({
                success: false,
                error: 'Admin key required'
            });
        }
        
        if (providedKey !== expectedKey) {
            console.warn(`⚠️ Invalid admin key attempt from ${req.ip}`);
            return res.status(403).json({
                success: false,
                error: 'Invalid admin key'
            });
        }
        
        // Add admin flag to request
        req.isAdmin = true;
        next();
    } catch (error) {
        console.error('❌ Admin validation error:', error);
        res.status(500).json({
            success: false,
            error: 'Authentication error'
        });
    }
};

console.log('✅ Simple auth middleware loaded');