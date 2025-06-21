import { body, param, query, validationResult } from 'express-validator';

// Helper function to handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false,
            error: 'Validation failed',
            errors: errors.array().map(error => ({
                field: error.path || error.param,
                message: error.msg,
                value: error.value
            }))
        });
    }
    next();
};

// Supported genres
const SUPPORTED_GENRES = [
    'rock', 'pop', 'jazz', 'electronic', 'classical', 'hip-hop', 'rap',
    'country', 'blues', 'folk', 'reggae', 'punk', 'metal', 'indie',
    'alternative', 'ambient', 'house', 'techno', 'trance', 'dubstep',
    'drum-and-bass', 'experimental', 'world', 'latin', 'r&b', 'soul',
    'funk', 'disco', 'gospel', 'soundtrack', 'podcast', 'other'
];

// Track Upload Validation
export const validateTrackUpload = [
    body('title')
        .notEmpty()
        .withMessage('Title is required')
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage('Title must be between 1 and 200 characters'),
    
    body('artist')
        .notEmpty()
        .withMessage('Artist name is required')
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Artist name must be between 1 and 100 characters'),
    
    body('genre')
        .optional()
        .trim()
        .isIn(SUPPORTED_GENRES)
        .withMessage(`Genre must be one of: ${SUPPORTED_GENRES.join(', ')}`),
    
    body('album')
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage('Album name must not exceed 200 characters'),
    
    body('price')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Price must be a positive number'),
    
    handleValidationErrors
];

// Track Update Validation
export const validateTrackUpdate = [
    param('id')
        .isMongoId()
        .withMessage('Invalid track ID'),
    
    body('title')
        .optional()
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage('Title must be between 1 and 200 characters'),
    
    body('artist')
        .optional()
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Artist name must be between 1 and 100 characters'),
    
    body('genre')
        .optional()
        .trim()
        .isIn(SUPPORTED_GENRES)
        .withMessage(`Genre must be one of: ${SUPPORTED_GENRES.join(', ')}`),
    
    body('price')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Price must be a positive number'),
    
    handleValidationErrors
];

// MongoDB ID Validation
export const validateMongoId = [
    param('id')
        .isMongoId()
        .withMessage('Invalid ID format'),
    
    handleValidationErrors
];

// Query Parameter Validations
export const validateTrackQuery = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    
    query('sort')
        .optional()
        .isIn(['newest', 'oldest', 'popular', 'alphabetical'])
        .withMessage('Sort must be one of: newest, oldest, popular, alphabetical'),
    
    handleValidationErrors
];

// Search Validation
export const validateSearch = [
    query('q')
        .notEmpty()
        .withMessage('Search query is required')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Search query must be between 2 and 100 characters'),
    
    handleValidationErrors
];

// Purchase Verification Validation
export const validatePurchaseVerification = [
    body('trackId')
        .notEmpty()
        .withMessage('Track ID is required')
        .isMongoId()
        .withMessage('Invalid track ID format'),
    
    body('txHash')
        .notEmpty()
        .withMessage('Transaction hash is required')
        .matches(/^0x[a-fA-F0-9]{64}$/)
        .withMessage('Invalid transaction hash format'),
    
    body('buyerAddress')
        .notEmpty()
        .withMessage('Buyer address is required')
        .matches(/^0x[a-fA-F0-9]{40}$/)
        .withMessage('Invalid Ethereum address format'),
    
    handleValidationErrors
];

// Artist Name Validation
export const validateArtistName = [
    param('id')
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Artist name must be between 1 and 100 characters'),
    
    handleValidationErrors
];

// Analytics Query Validation
export const validateAnalyticsQuery = [
    query('startDate')
        .optional()
        .isISO8601()
        .withMessage('Start date must be a valid date'),
    
    query('endDate')
        .optional()
        .isISO8601()
        .withMessage('End date must be a valid date'),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Limit must be between 1 and 1000'),
    
    handleValidationErrors
];

// File Upload Validation
export const validateFileUpload = (req, res, next) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            error: 'No file uploaded'
        });
    }
    
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/aac'];
    if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid file type. Only audio files are allowed.'
        });
    }
    
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (req.file.size > maxSize) {
        return res.status(400).json({
            success: false,
            error: 'File size exceeds 50MB limit'
        });
    }
    
    next();
};

// Admin Key Validation
export const validateAdminKey = (req, res, next) => {
    const adminKey = req.headers['x-admin-key'] || req.headers['authorization'];
    
    if (!adminKey) {
        return res.status(401).json({ 
            success: false,
            error: 'Admin authentication required'
        });
    }
    
    const key = adminKey.replace('Bearer ', '').trim();
    
    if (key !== process.env.ADMIN_KEY) {
        return res.status(403).json({
            success: false,
            error: 'Invalid admin key'
        });
    }
    
    next();
};
