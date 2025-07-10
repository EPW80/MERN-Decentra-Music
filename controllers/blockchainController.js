import TrackService from "../services/TrackService.js";
import blockchainService from "../services/BlockchainService.js";
import {
  getMusicStoreContract,
  isBlockchainAvailable,
  getWallet,
} from "../config/blockchain.js";
import { ethers } from "ethers";

/**
 * MusicStore Blockchain Controller
 */

const trackService = new TrackService();

// Add track to blockchain (matches your contract function signature)
export const addTrackToBlockchain = async (req, res) => {
  try {
    const { trackId } = req.params;
    const { price, artistAddress } = req.body;

    if (!isBlockchainAvailable()) {
      return res.status(503).json({
        success: false,
        error: "Blockchain not available",
      });
    }

    const wallet = getWallet();
    if (!wallet) {
      return res.status(503).json({
        success: false,
        error: "Wallet not available",
      });
    }

    // Use TrackService to get track
    const track = await trackService.getTrackById(trackId, {
      includeInactive: true,
      includePrivate: true,
    });

    if (track.blockchain?.contractId) {
      return res.status(400).json({
        success: false,
        error: "Track already on blockchain",
      });
    }

    // Validate artist address
    const finalArtistAddress = artistAddress || track.artistAddress;
    if (!finalArtistAddress || !ethers.isAddress(finalArtistAddress)) {
      return res.status(400).json({
        success: false,
        error: "Valid artist Ethereum address required",
        hint: "Provide artistAddress in request body or ensure track has artistAddress field",
      });
    }

    console.log(`🔗 Adding track to blockchain: ${track.title}`);
    console.log(`🎨 Artist address: ${finalArtistAddress}`);
    console.log(`💰 Price: ${price || track.price} ETH`);

    // Use TrackService to add track to blockchain
    const result = await trackService.addToBlockchain(trackId);

    res.status(202).json({
      success: true,
      message: "Track added to blockchain successfully",
      data: {
        transaction: {
          hash: result.txHash,
          status: "confirmed",
          blockNumber: result.blockNumber,
        },
        track: {
          id: track._id,
          title: track.title,
          artist: track.artist,
          artistAddress: finalArtistAddress,
          contractId: result.contractId,
        },
      },
    });
  } catch (error) {
    console.error("❌ Add track to blockchain error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add track to blockchain",
      error: error.message,
    });
  }
};

// Purchase track
export const purchaseTrack = async (req, res) => {
  try {
    const { contractId } = req.params;

    const result = await trackService.getTracks(
      { "blockchain.contractId": contractId },
      { limit: 1, includeInactive: false, includePrivate: false }
    );

    if (!result.tracks || result.tracks.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Track not found on blockchain",
      });
    }

    const track = result.tracks[0];

    const contract = getMusicStoreContract();

    // Get track info from blockchain
    const trackInfo = await contract.tracks(contractId);
    const price = trackInfo.price;

    console.log(
      `💰 Purchasing track: ${track.title} for ${ethers.utils.formatEther(
        price
      )} ETH`
    );

    const tx = await contract.purchaseTrack(contractId, {
      value: price,
    });

    console.log(`⏳ Purchase transaction: ${tx.hash}`);

    res.status(202).json({
      success: true,
      message: "Purchase transaction submitted",
      transaction: {
        hash: tx.hash,
        status: "pending",
      },
      track: {
        id: track._id,
        title: track.title,
        artist: track.artist,
        price: ethers.utils.formatEther(price),
      },
    });
  } catch (error) {
    console.error("❌ Purchase error:", error);
    res.status(500).json({
      success: false,
      error: "Purchase failed",
      details: error.message,
    });
  }
};

// Check if user has purchased track
export const checkPurchase = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { userAddress } = req.query;

    if (!userAddress) {
      return res.status(400).json({
        success: false,
        error: "User address required",
      });
    }

    const contract = getMusicStoreContract();
    const hasPurchased = await contract.hasPurchased(userAddress, contractId);

    res.json({
      success: true,
      hasPurchased,
      userAddress,
      contractId,
    });
  } catch (error) {
    console.error("Check purchase error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to check purchase",
    });
  }
};

// Withdraw artist balance
export const withdrawArtistBalance = async (req, res) => {
  try {
    const wallet = getWallet();
    if (!wallet) {
      return res.status(503).json({
        success: false,
        error: "Wallet not available",
      });
    }

    const contract = getMusicStoreContract();

    // Check balance first
    const balance = await contract.artistBalances(wallet.address);

    if (balance.eq(0)) {
      return res.status(400).json({
        success: false,
        error: "No balance to withdraw",
      });
    }

    console.log(
      `💸 Withdrawing artist balance: ${ethers.utils.formatEther(balance)} ETH`
    );

    const tx = await contract.withdrawArtistBalance();

    res.status(202).json({
      success: true,
      message: "Withdrawal transaction submitted",
      transaction: {
        hash: tx.hash,
        status: "pending",
      },
      amount: ethers.utils.formatEther(balance),
    });
  } catch (error) {
    console.error("❌ Withdrawal error:", error);
    res.status(500).json({
      success: false,
      error: "Withdrawal failed",
      details: error.message,
    });
  }
};

// Get blockchain status and stats
export const getBlockchainStatus = async (req, res) => {
  try {
    const status = await blockchainService.getStatus();

    // Get additional stats
    const [totalTracks, blockchainTracks, pendingTracks] = await Promise.all([
      Track.countDocuments(),
      Track.countDocuments({ "blockchain.contractId": { $exists: true } }),
      Track.countDocuments({ "blockchain.status": "pending" }),
    ]);

    res.json({
      success: true,
      blockchain: {
        ...status,
        stats: {
          totalTracks,
          blockchainTracks,
          pendingTracks,
          offChainTracks: totalTracks - blockchainTracks,
        },
      },
    });
  } catch (error) {
    console.error("Blockchain status error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get blockchain status",
    });
  }
};

// Get transaction status
export const getTransactionStatus = async (req, res) => {
  try {
    const { txHash } = req.params;

    const verification = await blockchainService.verifyTransaction(txHash);

    res.json({
      success: true,
      transaction: {
        hash: txHash,
        ...verification,
      },
    });
  } catch (error) {
    console.error("Transaction status error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get transaction status",
    });
  }
};
