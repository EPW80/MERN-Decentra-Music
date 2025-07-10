import express from 'express';
import {
  verifyPurchase,
  getUserPurchases,
  checkPurchaseStatus,
  recordTrackAccess,
  getArtistSales,
} from '../controllers/purchaseController.js';
import { body, param, validationResult } from 'express-validator';

const router = express.Router();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

/**
 * Purchase Verification Routes
 */

// Verify a purchase by transaction hash
router.post('/verify', [
  body('txHash')
    .matches(/^0x[a-fA-F0-9]{64}$/)
    .withMessage('Invalid transaction hash format'),
  body('buyerAddress')
    .isEthereumAddress()
    .withMessage('Invalid buyer Ethereum address'),
], handleValidationErrors, verifyPurchase);

// Get user's purchases
router.get('/user/:userAddress', [
  param('userAddress')
    .isEthereumAddress()
    .withMessage('Invalid user Ethereum address'),
], handleValidationErrors, getUserPurchases);

// Check if user has purchased a specific track
router.get('/check/:userAddress/:trackId', [
  param('userAddress')
    .isEthereumAddress()
    .withMessage('Invalid user Ethereum address'),
  param('trackId')
    .notEmpty()
    .withMessage('Track ID is required'),
], handleValidationErrors, checkPurchaseStatus);

// Record track access (download/play)
router.post('/access/:userAddress/:trackId', [
  param('userAddress')
    .isEthereumAddress()
    .withMessage('Invalid user Ethereum address'),
  param('trackId')
    .notEmpty()
    .withMessage('Track ID is required'),
  body('accessType')
    .optional()
    .isIn(['download', 'stream', 'play'])
    .withMessage('Access type must be download, stream, or play'),
], handleValidationErrors, recordTrackAccess);

// Get artist sales
router.get('/artist/:artistAddress', [
  param('artistAddress')
    .isEthereumAddress()
    .withMessage('Invalid artist Ethereum address'),
], handleValidationErrors, getArtistSales);

/**
 * Utility Routes
 */

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Purchase service is healthy',
    timestamp: new Date().toISOString(),
  });
});

// Get purchase statistics (basic)
router.get('/stats', async (req, res) => {
  try {
    const Purchase = (await import('../models/Purchase.js')).default;
    
    const stats = await Purchase.aggregate([
      {
        $group: {
          _id: null,
          totalPurchases: { $sum: 1 },
          totalRevenue: { $sum: { $toDouble: '$amount' } },
          verifiedPurchases: {
            $sum: { $cond: ['$verified', 1, 0] }
          },
          uniqueBuyers: { $addToSet: '$buyerAddress' },
        }
      },
      {
        $project: {
          _id: 0,
          totalPurchases: 1,
          totalRevenue: 1,
          verifiedPurchases: 1,
          uniqueBuyers: { $size: '$uniqueBuyers' },
        }
      }
    ]);

    res.json({
      success: true,
      stats: stats[0] || {
        totalPurchases: 0,
        totalRevenue: 0,
        verifiedPurchases: 0,
        uniqueBuyers: 0,
      },
    });
  } catch (error) {
    console.error('❌ Purchase stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get purchase statistics',
    });
  }
});

export default router;
