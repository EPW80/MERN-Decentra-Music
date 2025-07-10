// routes/api/artists.js
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

// Get artist profile and stats
router.get(
  "/:artistAddress",
  [
    param("artistAddress")
      .isEthereumAddress()
      .withMessage("Invalid Ethereum address"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { artistAddress } = req.params;

      // Get artist balance
      const balance = await blockchainService.getArtistBalance(artistAddress);

      // Get all tracks by this artist
      const allTracks = await blockchainService.getAllTracks();
      const artistTracks = allTracks.filter(
        (track) => track.artist.toLowerCase() === artistAddress.toLowerCase()
      );

      // Get purchase events for artist's tracks
      const purchaseEvents = await blockchainService.getPurchaseEvents();
      const artistSales = purchaseEvents.filter(
        (event) => event.artist.toLowerCase() === artistAddress.toLowerCase()
      );

      // Calculate stats
      const stats = {
        totalTracks: artistTracks.length,
        totalSales: artistSales.length,
        totalRevenue: artistSales.reduce(
          (sum, sale) => sum + parseFloat(sale.artistPayment),
          0
        ),
        averageTrackPrice:
          artistTracks.length > 0
            ? artistTracks.reduce(
                (sum, track) => sum + parseFloat(track.price),
                0
              ) / artistTracks.length
            : 0,
      };

      res.json({
        success: true,
        data: {
          address: artistAddress,
          balance: balance,
          tracks: artistTracks,
          stats: stats,
          recentSales: artistSales.slice(-10), // Last 10 sales
        },
      });
    } catch (error) {
      console.error("❌ Error getting artist data:", error.message);
      res.status(500).json({
        success: false,
        error: "Failed to get artist information",
      });
    }
  }
);

// Get artist's tracks
router.get(
  "/:artistAddress/tracks",
  [
    param("artistAddress")
      .isEthereumAddress()
      .withMessage("Invalid Ethereum address"),
    query("active")
      .optional()
      .isBoolean()
      .withMessage("Active must be boolean"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { artistAddress } = req.params;
      const { active } = req.query;

      const allTracks = await blockchainService.getAllTracks();
      let artistTracks = allTracks.filter(
        (track) => track.artist.toLowerCase() === artistAddress.toLowerCase()
      );

      // Filter by active status if specified
      if (active !== undefined) {
        const isActive = active === "true";
        artistTracks = artistTracks.filter(
          (track) => track.isActive === isActive
        );
      }

      res.json({
        success: true,
        data: artistTracks,
        count: artistTracks.length,
      });
    } catch (error) {
      console.error("❌ Error getting artist tracks:", error.message);
      res.status(500).json({
        success: false,
        error: "Failed to get artist tracks",
      });
    }
  }
);

// Get artist's sales history
router.get(
  "/:artistAddress/sales",
  [
    param("artistAddress")
      .isEthereumAddress()
      .withMessage("Invalid Ethereum address"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage("Limit must be between 1 and 1000"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { artistAddress } = req.params;
      const { limit = 50 } = req.query;

      const purchaseEvents = await musicStoreService.getPurchaseEvents();
      const artistSales = purchaseEvents
        .filter(
          (event) => event.artist.toLowerCase() === artistAddress.toLowerCase()
        )
        .slice(0, parseInt(limit));

      // Get track details for each sale
      const salesWithTrackDetails = await Promise.all(
        artistSales.map(async (sale) => {
          try {
            const track = await musicStoreService.getTrack(sale.trackId);
            return {
              ...sale,
              trackDetails: track,
            };
          } catch (error) {
            return sale; // Return sale without track details if error
          }
        })
      );

      res.json({
        success: true,
        data: salesWithTrackDetails,
        count: salesWithTrackDetails.length,
      });
    } catch (error) {
      console.error("❌ Error getting artist sales:", error.message);
      res.status(500).json({
        success: false,
        error: "Failed to get artist sales",
      });
    }
  }
);

// Get artist balance
router.get(
  "/:artistAddress/balance",
  [
    param("artistAddress")
      .isEthereumAddress()
      .withMessage("Invalid Ethereum address"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { artistAddress } = req.params;
      const balance = await musicStoreService.getArtistBalance(artistAddress);

      res.json({
        success: true,
        data: {
          artistAddress,
          ...balance,
        },
      });
    } catch (error) {
      console.error("❌ Error getting artist balance:", error.message);
      res.status(500).json({
        success: false,
        error: "Failed to get artist balance",
      });
    }
  }
);

// Withdrawal endpoint (for frontend integration)
router.post(
  "/:artistAddress/withdraw",
  [
    param("artistAddress")
      .isEthereumAddress()
      .withMessage("Invalid Ethereum address"),
    body("signature")
      .optional()
      .notEmpty()
      .withMessage("Transaction signature required"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      // This endpoint is for frontend integration
      // The actual withdrawal happens on the frontend with MetaMask
      res.json({
        success: false,
        error:
          "Withdrawal must be performed through Web3 wallet (MetaMask). Use frontend application.",
        instructions: {
          step1: "Connect your Web3 wallet",
          step2: "Call withdrawArtistBalance() function on the smart contract",
          step3: "Sign the transaction with your wallet",
        },
      });
    } catch (error) {
      console.error("❌ Error processing withdrawal request:", error.message);
      res.status(500).json({
        success: false,
        error: "Failed to process withdrawal request",
      });
    }
  }
);

// Get all artists (summary)
router.get("/", async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    // Get all tracks to extract unique artists
    const allTracks = await musicStoreService.getAllTracks();
    const uniqueArtists = [...new Set(allTracks.map((track) => track.artist))];

    // Get basic stats for each artist
    const artistSummaries = await Promise.all(
      uniqueArtists.slice(0, parseInt(limit)).map(async (artistAddress) => {
        try {
          const artistTracks = allTracks.filter(
            (track) =>
              track.artist.toLowerCase() === artistAddress.toLowerCase()
          );

          const balance = await musicStoreService.getArtistBalance(
            artistAddress
          );

          return {
            address: artistAddress,
            trackCount: artistTracks.length,
            balance: balance.balance,
            latestTrack:
              artistTracks.sort(
                (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
              )[0] || null,
          };
        } catch (error) {
          return {
            address: artistAddress,
            trackCount: 0,
            balance: "0",
            error: "Could not load artist data",
          };
        }
      })
    );

    res.json({
      success: true,
      data: artistSummaries,
      count: artistSummaries.length,
      total: uniqueArtists.length,
    });
  } catch (error) {
    console.error("❌ Error getting artists list:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to get artists list",
    });
  }
});

export default router;
