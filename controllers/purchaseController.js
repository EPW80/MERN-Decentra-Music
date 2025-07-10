import Purchase from "../models/Purchase.js";
import Track from "../models/Track.js";
import BlockchainService from "../services/BlockchainService.js";
import { ethers } from "ethers";

/**
 * Purchase Controller - Handle purchase verification and management
 */

// Verify purchase by transaction hash
export const verifyPurchase = async (req, res) => {
  try {
    const { txHash, buyerAddress } = req.body;

    // Validate inputs
    if (!txHash || !buyerAddress) {
      return res.status(400).json({
        success: false,
        error: "Transaction hash and buyer address are required",
      });
    }

    if (!ethers.isAddress(buyerAddress)) {
      return res.status(400).json({
        success: false,
        error: "Invalid buyer address format",
      });
    }

    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return res.status(400).json({
        success: false,
        error: "Invalid transaction hash format",
      });
    }

    console.log(`🔍 Verifying purchase: ${txHash} for ${buyerAddress}`);

    // Check if purchase already exists
    let purchase = await Purchase.findByTransaction(txHash);

    if (purchase) {
      console.log(`📦 Purchase already exists: ${purchase.id}`);

      // Update buyer address if different (edge case)
      if (purchase.buyerAddress !== buyerAddress.toLowerCase()) {
        console.warn(
          `⚠️ Buyer address mismatch: ${
            purchase.buyerAddress
          } vs ${buyerAddress.toLowerCase()}`
        );
      }

      return res.json({
        success: true,
        verified: purchase.verified,
        purchase: {
          id: purchase.id,
          txHash: purchase.txHash,
          buyerAddress: purchase.buyerAddress,
          amount: purchase.amount,
          verified: purchase.verified,
          purchaseDate: purchase.purchaseDate,
          trackInfo: purchase.trackInfo,
        },
      });
    }

    // Initialize blockchain service
    const blockchainService = new BlockchainService();
    await blockchainService.initialize();

    // Verify transaction on blockchain
    const verificationResult =
      await blockchainService.verifyPurchaseTransaction(txHash, buyerAddress);

    if (!verificationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Transaction verification failed",
        details: verificationResult.error,
      });
    }

    const txData = verificationResult.data;

    // Find associated track
    const track = await Track.findOne({
      $or: [
        { "blockchain.contractId": txData.trackId },
        { _id: txData.trackId }, // Fallback to MongoDB ID
      ],
    });

    if (!track) {
      console.warn(`⚠️ Track not found for ID: ${txData.trackId}`);
    }

    // Create purchase record
    const purchaseData = {
      txHash: txHash,
      blockNumber: txData.blockNumber,
      blockHash: txData.blockHash,
      trackId: track ? track._id : null,
      contractTrackId: txData.trackId,
      buyerAddress: buyerAddress.toLowerCase(),
      artistAddress: txData.artistAddress
        ? txData.artistAddress.toLowerCase()
        : null,
      amount: txData.amount,
      platformFee: txData.platformFee,
      artistPayment: txData.artistPayment,
      verified: true,
      status: "confirmed",
      confirmations: txData.confirmations || 0,
      accessGranted: true,
      purchaseDate: txData.timestamp
        ? new Date(txData.timestamp * 1000)
        : new Date(),
      verifiedAt: new Date(),
      trackInfo: track
        ? {
            title: track.title,
            artist: track.artist,
            price: track.price,
          }
        : null,
      eventData: txData.eventData || {},
    };

    purchase = new Purchase(purchaseData);
    await purchase.save();

    // Update track statistics
    if (track) {
      track.downloads += 1;
      await track.save();
    }

    console.log(`✅ Purchase verified and saved: ${purchase.id}`);

    res.json({
      success: true,
      verified: true,
      purchase: {
        id: purchase.id,
        txHash: purchase.txHash,
        buyerAddress: purchase.buyerAddress,
        amount: purchase.amount,
        verified: purchase.verified,
        purchaseDate: purchase.purchaseDate,
        trackInfo: purchase.trackInfo,
      },
    });
  } catch (error) {
    console.error("❌ Purchase verification error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to verify purchase",
      details: error.message,
    });
  }
};

// Get user's purchases
export const getUserPurchases = async (req, res) => {
  try {
    const { userAddress } = req.params;

    if (!ethers.isAddress(userAddress)) {
      return res.status(400).json({
        success: false,
        error: "Invalid user address format",
      });
    }

    const purchases = await Purchase.findUserPurchases(userAddress)
      .populate("trackId", "title artist price storage.url")
      .limit(100);

    res.json({
      success: true,
      purchases: purchases.map((purchase) => ({
        id: purchase.id,
        txHash: purchase.txHash,
        amount: purchase.amount,
        purchaseDate: purchase.purchaseDate,
        downloadCount: purchase.downloadCount,
        track: purchase.trackId || purchase.trackInfo,
      })),
      count: purchases.length,
    });
  } catch (error) {
    console.error("❌ Get user purchases error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get user purchases",
    });
  }
};

// Check if user has purchased a specific track
export const checkPurchaseStatus = async (req, res) => {
  try {
    const { userAddress, trackId } = req.params;

    if (!ethers.isAddress(userAddress)) {
      return res.status(400).json({
        success: false,
        error: "Invalid user address format",
      });
    }

    const purchase = await Purchase.hasUserPurchased(userAddress, trackId);

    res.json({
      success: true,
      hasPurchased: !!purchase,
      purchase: purchase
        ? {
            id: purchase.id,
            txHash: purchase.txHash,
            amount: purchase.amount,
            purchaseDate: purchase.purchaseDate,
            downloadCount: purchase.downloadCount,
          }
        : null,
    });
  } catch (error) {
    console.error("❌ Check purchase status error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to check purchase status",
    });
  }
};

// Record track access (download/play)
export const recordTrackAccess = async (req, res) => {
  try {
    const { userAddress, trackId } = req.params;
    const { accessType = "download" } = req.body;

    if (!ethers.isAddress(userAddress)) {
      return res.status(400).json({
        success: false,
        error: "Invalid user address format",
      });
    }

    const purchase = await Purchase.hasUserPurchased(userAddress, trackId);

    if (!purchase) {
      return res.status(403).json({
        success: false,
        error: "Track not purchased by user",
      });
    }

    if (!purchase.accessGranted) {
      return res.status(403).json({
        success: false,
        error: "Access not granted for this purchase",
      });
    }

    // Record access
    await purchase.recordAccess();

    res.json({
      success: true,
      message: "Track access recorded",
      downloadCount: purchase.downloadCount,
      lastAccessedAt: purchase.lastAccessedAt,
    });
  } catch (error) {
    console.error("❌ Record track access error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to record track access",
    });
  }
};

// Get artist sales
export const getArtistSales = async (req, res) => {
  try {
    const { artistAddress } = req.params;

    if (!ethers.isAddress(artistAddress)) {
      return res.status(400).json({
        success: false,
        error: "Invalid artist address format",
      });
    }

    const sales = await Purchase.findArtistSales(artistAddress)
      .populate("trackId", "title artist price")
      .limit(100);

    // Calculate statistics
    const stats = {
      totalSales: sales.length,
      totalRevenue: sales.reduce(
        (sum, sale) => sum + parseFloat(sale.amount),
        0
      ),
      totalArtistPayments: sales.reduce(
        (sum, sale) => sum + parseFloat(sale.artistPayment || 0),
        0
      ),
      totalPlatformFees: sales.reduce(
        (sum, sale) => sum + parseFloat(sale.platformFee || 0),
        0
      ),
    };

    res.json({
      success: true,
      sales: sales.map((sale) => ({
        id: sale.id,
        txHash: sale.txHash,
        buyerAddress: sale.buyerAddress,
        amount: sale.amount,
        platformFee: sale.platformFee,
        artistPayment: sale.artistPayment,
        purchaseDate: sale.purchaseDate,
        track: sale.trackId || sale.trackInfo,
      })),
      stats,
      count: sales.length,
    });
  } catch (error) {
    console.error("❌ Get artist sales error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get artist sales",
    });
  }
};

// Sync purchase from blockchain event
export const syncPurchaseFromEvent = async (eventData) => {
  try {
    console.log("🔄 Syncing purchase from blockchain event:", eventData);

    // Check if purchase already exists
    const existingPurchase = await Purchase.findByTransaction(
      eventData.transactionHash
    );
    if (existingPurchase) {
      console.log(`📦 Purchase already synced: ${existingPurchase.id}`);
      return existingPurchase;
    }

    // Find associated track
    const track = await Track.findOne({
      $or: [
        { "blockchain.contractId": eventData.trackId },
        { _id: eventData.trackId },
      ],
    });

    // Create purchase record
    const purchaseData = {
      txHash: eventData.transactionHash,
      blockNumber: eventData.blockNumber,
      blockHash: eventData.blockHash,
      trackId: track ? track._id : null,
      contractTrackId: eventData.trackId,
      buyerAddress: eventData.buyer.toLowerCase(),
      artistAddress: eventData.artist ? eventData.artist.toLowerCase() : null,
      amount: eventData.price,
      platformFee: eventData.platformFee,
      artistPayment: eventData.artistPayment,
      verified: true,
      status: "confirmed",
      accessGranted: true,
      purchaseDate: eventData.timestamp
        ? new Date(eventData.timestamp * 1000)
        : new Date(),
      verifiedAt: new Date(),
      trackInfo: track
        ? {
            title: track.title,
            artist: track.artist,
            price: track.price,
          }
        : null,
      eventData: eventData,
    };

    const purchase = new Purchase(purchaseData);
    await purchase.save();

    // Update track statistics
    if (track) {
      track.downloads += 1;
      await track.save();
    }

    console.log(`✅ Purchase synced from event: ${purchase.id}`);
    return purchase;
  } catch (error) {
    console.error("❌ Sync purchase from event error:", error);
    throw error;
  }
};

export default {
  verifyPurchase,
  getUserPurchases,
  checkPurchaseStatus,
  recordTrackAccess,
  getArtistSales,
  syncPurchaseFromEvent,
};
