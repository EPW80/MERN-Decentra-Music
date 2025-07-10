import express from "express";
import BlockchainService from "../../services/BlockchainService.js";
import { body, param, query, validationResult } from "express-validator";

const router = express.Router();
const blockchainService = new BlockchainService();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: "Validation failed",
      details: errors.array(),
    });
  }
  next();
};

// Get user's purchases
router.get(
  "/user/:userAddress",
  [
    param("userAddress")
      .isEthereumAddress()
      .withMessage("Invalid Ethereum address"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { userAddress } = req.params;

      // Get all purchase events for this user
      const purchaseEvents = await blockchainService.getPurchaseEvents();
      const userPurchases = purchaseEvents.filter(
        (event) => event.buyer.toLowerCase() === userAddress.toLowerCase()
      );

      // Get track details for each purchase
      const purchasesWithDetails = await Promise.all(
        userPurchases.map(async (purchase) => {
          try {
            const track = await blockchainService.getTrack(purchase.trackId);
            return {
              ...purchase,
              track,
            };
          } catch (error) {
            console.warn(`Could not get track details for ${purchase.trackId}`);
            return purchase;
          }
        })
      );

      res.json({
        success: true,
        data: purchasesWithDetails,
        count: purchasesWithDetails.length,
      });
    } catch (error) {
      console.error("❌ Error getting user purchases:", error.message);
      res.status(500).json({
        success: false,
        error: "Failed to get user purchases",
      });
    }
  }
);

// Verify purchase
router.post(
  "/verify",
  [
    body("transactionHash")
      .matches(/^0x[a-fA-F0-9]{64}$/)
      .withMessage("Invalid transaction hash"),
    body("trackId")
      .isInt({ min: 1 })
      .withMessage("Track ID must be a positive integer"),
    body("buyerAddress")
      .isEthereumAddress()
      .withMessage("Invalid buyer address"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { transactionHash, trackId, buyerAddress } = req.body;

      // Check if user has purchased the track
      const hasPurchased = await blockchainService.hasPurchased(
        buyerAddress,
        trackId
      );

      res.json({
        success: true,
        data: {
          verified: hasPurchased,
          trackId: parseInt(trackId),
          buyerAddress,
          transactionHash,
        },
      });
    } catch (error) {
      console.error("❌ Error verifying purchase:", error.message);
      res.status(500).json({
        success: false,
        error: "Failed to verify purchase",
      });
    }
  }
);

// Get all purchase events (admin)
router.get(
  "/events",
  [
    query("fromBlock")
      .optional()
      .isInt({ min: 0 })
      .withMessage("From block must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage("Limit must be between 1 and 1000"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { fromBlock = 0, limit = 100 } = req.query;

      const events = await blockchainService.getPurchaseEvents(fromBlock);
      const limitedEvents = events.slice(0, parseInt(limit));

      res.json({
        success: true,
        data: limitedEvents,
        count: limitedEvents.length,
        total: events.length,
      });
    } catch (error) {
      console.error("❌ Error getting purchase events:", error.message);
      res.status(500).json({
        success: false,
        error: "Failed to get purchase events",
      });
    }
  }
);

// Get purchase statistics
router.get("/stats", async (req, res) => {
  try {
    const purchaseEvents = await blockchainService.getPurchaseEvents();

    const stats = {
      totalPurchases: purchaseEvents.length,
      totalRevenue: purchaseEvents.reduce(
        (sum, event) => sum + parseFloat(event.price),
        0
      ),
      totalPlatformFees: purchaseEvents.reduce(
        (sum, event) => sum + parseFloat(event.platformFee),
        0
      ),
      totalArtistPayments: purchaseEvents.reduce(
        (sum, event) => sum + parseFloat(event.artistPayment),
        0
      ),
      uniqueBuyers: [...new Set(purchaseEvents.map((event) => event.buyer))]
        .length,
      uniqueArtists: [...new Set(purchaseEvents.map((event) => event.artist))]
        .length,
      averageTrackPrice:
        purchaseEvents.length > 0
          ? purchaseEvents.reduce(
              (sum, event) => sum + parseFloat(event.price),
              0
            ) / purchaseEvents.length
          : 0,
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("❌ Error getting purchase stats:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to get purchase statistics",
    });
  }
});

export default router;
