import express from 'express';
import { 
    generateAdminToken, 
    generateRefreshToken, 
    validateRefreshToken,
    adminLoginLimiter 
} from '../middleware/auth.js';
import { hashPassword, verifyPassword } from '../middleware/auth.js';

const router = express.Router();

/**
 * Authentication Routes
 */

// Admin login endpoint
router.post('/admin/login', adminLoginLimiter, async (req, res) => {
    try {
        const { username, password, adminKey } = req.body;

        // For now, use environment variables for admin credentials
        // In production, this should use a proper user database
        const validUsername = process.env.ADMIN_USERNAME || 'admin';
        const validPassword = process.env.ADMIN_PASSWORD;
        const validAdminKey = process.env.ADMIN_KEY;

        // Check credentials
        let isValid = false;

        if (username && password && validPassword) {
            // Username/password auth (preferred)
            isValid = username === validUsername && password === validPassword;
        } else if (adminKey && validAdminKey) {
            // Legacy admin key (temporary support)
            isValid = adminKey === validAdminKey;
        }

        if (!isValid) {
            console.warn(`⚠️ Failed admin login attempt from ${req.ip}:`, { username, hasPassword: !!password, hasKey: !!adminKey });
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Generate tokens
        const adminId = username || 'admin';
        const permissions = ['read', 'write', 'delete', 'admin'];
        
        const accessToken = generateAdminToken(adminId, permissions);
        const refreshToken = generateRefreshToken(adminId);

        console.log(`✅ Admin login successful: ${adminId} from ${req.ip}`);

        res.json({
            success: true,
            message: 'Login successful',
            accessToken,
            refreshToken,
            expiresIn: process.env.JWT_EXPIRES_IN || '24h',
            admin: {
                id: adminId,
                role: 'admin',
                permissions
            }
        });

    } catch (error) {
        console.error('❌ Admin login error:', error);
        res.status(500).json({
            success: false,
            error: 'Login failed'
        });
    }
});

// Token refresh endpoint
router.post('/admin/refresh', validateRefreshToken, async (req, res) => {
    try {
        const { adminId } = req.refreshTokenData;

        // Generate new access token
        const permissions = ['read', 'write', 'delete', 'admin'];
        const newAccessToken = generateAdminToken(adminId, permissions);

        res.json({
            success: true,
            accessToken: newAccessToken,
            expiresIn: process.env.JWT_EXPIRES_IN || '24h'
        });

    } catch (error) {
        console.error('❌ Token refresh error:', error);
        res.status(500).json({
            success: false,
            error: 'Token refresh failed'
        });
    }
});

// Token validation endpoint
router.post('/admin/validate', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'No token provided'
            });
        }

        const token = authHeader.replace('Bearer ', '');
        
        try {
            const jwt = await import('jsonwebtoken');
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            res.json({
                success: true,
                valid: true,
                admin: {
                    id: decoded.adminId,
                    role: decoded.role,
                    permissions: decoded.permissions,
                    expiresAt: decoded.exp
                }
            });

        } catch (error) {
            res.json({
                success: true,
                valid: false,
                error: error.message
            });
        }

    } catch (error) {
        console.error('❌ Token validation error:', error);
        res.status(500).json({
            success: false,
            error: 'Validation failed'
        });
    }
});

console.log('✅ Authentication routes loaded');

export { router };