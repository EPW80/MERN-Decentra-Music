import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { generateRateLimitKey } from '../utils/security.js';
import crypto from 'crypto';

/**
 * Enhanced Authentication Middleware with JWT and Security
 */

// Admin login rate limiting
export const adminLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: {
        success: false,
        error: 'Too many login attempts, please try again in 15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => generateRateLimitKey(req, 'admin-login')
});

// General admin endpoint rate limiting
export const adminRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: {
        success: false,
        error: 'Too many admin requests, please slow down'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => generateRateLimitKey(req, 'admin-api')
});

// Generate JWT token for admin
export const generateAdminToken = (adminId, permissions = ['read', 'write', 'delete']) => {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET not configured');
    }

    const payload = {
        adminId,
        role: 'admin',
        permissions,
        iat: Math.floor(Date.now() / 1000),
        jti: crypto.randomUUID() // Unique token ID for revocation
    };

    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        issuer: 'decentra-music-api',
        audience: 'decentra-music-admin'
    });
};

// Generate refresh token
export const generateRefreshToken = (adminId) => {
    if (!process.env.REFRESH_TOKEN_SECRET) {
        throw new Error('REFRESH_TOKEN_SECRET not configured');
    }

    const payload = {
        adminId,
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000),
        jti: crypto.randomUUID()
    };

    return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
        expiresIn: '7d', // Refresh tokens last longer
        issuer: 'decentra-music-api',
        audience: 'decentra-music-admin'
    });
};

// Validate JWT admin token
export const validateAdmin = (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;
        const legacyKey = req.headers['x-admin-key']; // Backward compatibility
        
        let token = null;

        // Check for Bearer token first (preferred)
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.replace('Bearer ', '');
        }
        // Fallback to legacy admin key (temporary)
        else if (legacyKey && process.env.ADMIN_KEY && legacyKey === process.env.ADMIN_KEY) {
            console.warn('⚠️ Using legacy admin key - please upgrade to JWT tokens');
            req.isAdmin = true;
            req.admin = { 
                adminId: 'legacy', 
                role: 'admin', 
                permissions: ['read', 'write', 'delete'],
                legacy: true 
            };
            return next();
        }

        if (!token) {
            console.warn(`⚠️ Admin access attempt without token from ${req.ip}`);
            return res.status(401).json({
                success: false,
                error: 'Authentication token required',
                hint: 'Use Authorization: Bearer <token> header'
            });
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET, {
            issuer: 'decentra-music-api',
            audience: 'decentra-music-admin'
        });

        // Validate role
        if (decoded.role !== 'admin') {
            console.warn(`⚠️ Non-admin token used from ${req.ip}`);
            return res.status(403).json({
                success: false,
                error: 'Admin access required'
            });
        }

        // Check if token is expired (additional check)
        const now = Math.floor(Date.now() / 1000);
        if (decoded.exp && decoded.exp < now) {
            return res.status(401).json({
                success: false,
                error: 'Token expired',
                hint: 'Please obtain a new token'
            });
        }

        // Add admin info to request
        req.isAdmin = true;
        req.admin = {
            adminId: decoded.adminId,
            role: decoded.role,
            permissions: decoded.permissions || ['read', 'write', 'delete'],
            tokenId: decoded.jti,
            issuedAt: decoded.iat,
            expiresAt: decoded.exp
        };

        console.log(`✅ Admin authenticated: ${decoded.adminId} from ${req.ip}`);
        next();

    } catch (error) {
        console.error('❌ Admin token validation error:', error.message);

        // Handle specific JWT errors
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Token expired',
                hint: 'Please obtain a new token'
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: 'Invalid token',
                hint: 'Please provide a valid JWT token'
            });
        }

        if (error.name === 'NotBeforeError') {
            return res.status(401).json({
                success: false,
                error: 'Token not active yet'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Authentication error'
        });
    }
};

// Validate specific permissions
export const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.isAdmin || !req.admin) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        // Legacy admin has all permissions
        if (req.admin.legacy) {
            return next();
        }

        if (!req.admin.permissions || !req.admin.permissions.includes(permission)) {
            console.warn(`⚠️ Permission denied: ${req.admin.adminId} needs '${permission}' from ${req.ip}`);
            return res.status(403).json({
                success: false,
                error: `Permission '${permission}' required`,
                userPermissions: req.admin.permissions
            });
        }

        next();
    };
};

// Refresh token validation
export const validateRefreshToken = (req, res, next) => {
    try {
        const refreshToken = req.body.refreshToken;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                error: 'Refresh token required'
            });
        }

        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, {
            issuer: 'decentra-music-api',
            audience: 'decentra-music-admin'
        });

        if (decoded.type !== 'refresh') {
            return res.status(400).json({
                success: false,
                error: 'Invalid refresh token type'
            });
        }

        req.refreshTokenData = {
            adminId: decoded.adminId,
            tokenId: decoded.jti
        };

        next();

    } catch (error) {
        console.error('❌ Refresh token validation error:', error.message);

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Refresh token expired',
                hint: 'Please login again'
            });
        }

        res.status(401).json({
            success: false,
            error: 'Invalid refresh token'
        });
    }
};

// API key validation for external services
export const validateApiKey = (req, res, next) => {
    try {
        const apiKey = req.headers['x-api-key'];
        const validApiKeys = process.env.API_KEYS ? process.env.API_KEYS.split(',') : [];

        if (!apiKey) {
            return res.status(401).json({
                success: false,
                error: 'API key required'
            });
        }

        if (!validApiKeys.includes(apiKey)) {
            console.warn(`⚠️ Invalid API key attempt from ${req.ip}`);
            return res.status(403).json({
                success: false,
                error: 'Invalid API key'
            });
        }

        req.isApiClient = true;
        next();

    } catch (error) {
        console.error('❌ API key validation error:', error);
        res.status(500).json({
            success: false,
            error: 'Authentication error'
        });
    }
};

// Password hash utility (for future user auth)
export const hashPassword = async (password) => {
    const bcrypt = await import('bcrypt');
    return await bcrypt.hash(password, 12);
};

// Password verification utility
export const verifyPassword = async (password, hash) => {
    const bcrypt = await import('bcrypt');
    return await bcrypt.compare(password, hash);
};

console.log('✅ Enhanced authentication middleware loaded');