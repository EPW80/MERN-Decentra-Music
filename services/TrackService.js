import Track from "../models/Track.js";
import BlockchainService from "./BlockchainService.js";
import StorageService from "./StorageService.js";
import { ethers } from "ethers";

class TrackService {
  constructor() {
    this.blockchainService = new BlockchainService();
    this.storageService = new StorageService();
  }

  /**
   * Create a new track with optional blockchain integration
   * @param {Object} data - Track data
   * @param {Object} file - Uploaded file object
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Created track
   */
  async createTrack(data, file = null, options = {}) {
    try {
      // Validate required fields
      if (!data.title || !data.artist) {
        throw new Error("Title and artist are required");
      }

      // Validate price format
      if (data.price) {
        const price = parseFloat(data.price);
        if (isNaN(price) || price < 0) {
          throw new Error("Price must be a valid positive number");
        }
      }

      // Validate artist address if provided
      if (data.artistAddress && !ethers.isAddress(data.artistAddress)) {
        throw new Error("Invalid Ethereum address format");
      }

      // Handle file upload if provided
      let storageData = {};
      if (file) {
        storageData = await this.storageService.uploadFile(file, {
          provider: options.storageProvider || "local",
          metadata: {
            title: data.title,
            artist: data.artist,
            genre: data.genre,
          },
        });
      }

      // Create track document
      const trackData = {
        ...data,
        storage: storageData,
        // Set blockchain status based on whether we have an artist address
        blockchain: {
          status: data.artistAddress ? "pending" : "disabled",
          artistAddress: data.artistAddress,
          artist: data.artist,
          price: data.price || "0.001",
        },
      };

      const track = new Track(trackData);
      await track.save();

      // Add to blockchain if artist address is provided and blockchain is enabled
      if (data.artistAddress && options.addToBlockchain !== false) {
        try {
          await this.addToBlockchain(track._id);
        } catch (error) {
          console.error("Failed to add track to blockchain:", error);
          // Update track with error status but don't fail the creation
          await Track.findByIdAndUpdate(track._id, {
            "blockchain.status": "failed",
            "blockchain.error": error.message,
          });
        }
      }

      return track;
    } catch (error) {
      console.error("TrackService.createTrack error:", error);
      throw error;
    }
  }

  /**
   * Add track to blockchain
   * @param {string} trackId - Track ID
   * @returns {Promise<Object>} Blockchain transaction result
   */
  async addToBlockchain(trackId) {
    try {
      const track = await Track.findById(trackId);
      if (!track) {
        throw new Error("Track not found");
      }

      if (!track.artistAddress && !track.blockchain.artistAddress) {
        throw new Error(
          "Artist address is required for blockchain integration"
        );
      }

      const artistAddress =
        track.artistAddress || track.blockchain.artistAddress;

      // Update status to pending
      track.blockchain.status = "pending";
      track.blockchain.pendingTxHash = null;
      track.blockchain.error = null;
      await track.save();

      // Add to blockchain
      const result = await this.blockchainService.addTrack(
        artistAddress,
        track.title,
        track.price,
        track.storage.url || track.storage.cid || "",
        track._id.toString()
      );

      // Update track with blockchain data
      track.blockchain.contractId = result.contractId;
      track.blockchain.txHash = result.txHash;
      track.blockchain.blockNumber = result.blockNumber;
      track.blockchain.owner = result.owner;
      track.blockchain.status = "confirmed";
      track.blockchain.addedAt = new Date();
      track.blockchain.pendingTxHash = null;
      track.blockchain.error = null;

      await track.save();

      return result;
    } catch (error) {
      console.error("TrackService.addToBlockchain error:", error);

      // Update track with error status
      if (trackId) {
        await Track.findByIdAndUpdate(trackId, {
          "blockchain.status": "failed",
          "blockchain.error": error.message,
        });
      }

      throw error;
    }
  }

  /**
   * Get track by ID with optional population
   * @param {string} trackId - Track ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Track document
   */
  async getTrackById(trackId, options = {}) {
    try {
      let query = Track.findById(trackId);

      if (options.includeInactive !== true) {
        query = query.where({ isActive: true });
      }

      if (options.includePrivate !== true) {
        query = query.where({ isPublic: true });
      }

      const track = await query.exec();

      if (!track) {
        throw new Error("Track not found");
      }

      return track;
    } catch (error) {
      console.error("TrackService.getTrackById error:", error);
      throw error;
    }
  }

  /**
   * Get tracks with filtering, sorting, and pagination
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Tracks with pagination info
   */
  async getTracks(filters = {}, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = "createdAt",
        sortOrder = "desc",
        includeInactive = false,
        includePrivate = false,
      } = options;

      // Build query
      const query = { ...filters };

      if (!includeInactive) {
        query.isActive = true;
      }

      if (!includePrivate) {
        query.isPublic = true;
      }

      // Calculate pagination
      const skip = (page - 1) * limit;
      const sortObj = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

      // Execute query
      const [tracks, total] = await Promise.all([
        Track.find(query).sort(sortObj).skip(skip).limit(limit).exec(),
        Track.countDocuments(query),
      ]);

      return {
        tracks,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      console.error("TrackService.getTracks error:", error);
      throw error;
    }
  }

  /**
   * Search tracks by text
   * @param {string} searchTerm - Search term
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Search results
   */
  async searchTracks(searchTerm, options = {}) {
    try {
      const {
        limit = 20,
        includeInactive = false,
        includePrivate = false,
      } = options;

      const query = {
        $or: [
          { title: new RegExp(searchTerm, "i") },
          { artist: new RegExp(searchTerm, "i") },
          { album: new RegExp(searchTerm, "i") },
          { genre: new RegExp(searchTerm, "i") },
        ],
      };

      if (!includeInactive) {
        query.isActive = true;
      }

      if (!includePrivate) {
        query.isPublic = true;
      }

      const tracks = await Track.find(query)
        .limit(limit)
        .sort({ plays: -1, createdAt: -1 })
        .exec();

      return tracks;
    } catch (error) {
      console.error("TrackService.searchTracks error:", error);
      throw error;
    }
  }

  /**
   * Get tracks by genre
   * @param {string} genre - Genre name
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Tracks in genre
   */
  async getTracksByGenre(genre, options = {}) {
    try {
      const filters = { genre: genre.toLowerCase() };
      return await this.getTracks(filters, options);
    } catch (error) {
      console.error("TrackService.getTracksByGenre error:", error);
      throw error;
    }
  }

  /**
   * Get tracks by artist
   * @param {string} artist - Artist name or address
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Artist's tracks
   */
  async getTracksByArtist(artist, options = {}) {
    try {
      const filters = {
        $or: [{ artist: new RegExp(artist, "i") }, { artistAddress: artist }],
      };
      return await this.getTracks(filters, options);
    } catch (error) {
      console.error("TrackService.getTracksByArtist error:", error);
      throw error;
    }
  }

  /**
   * Update track
   * @param {string} trackId - Track ID
   * @param {Object} updates - Update data
   * @param {Object} options - Update options
   * @returns {Promise<Object>} Updated track
   */
  async updateTrack(trackId, updates, options = {}) {
    try {
      const track = await Track.findById(trackId);
      if (!track) {
        throw new Error("Track not found");
      }

      // Validate updates
      if (updates.price) {
        const price = parseFloat(updates.price);
        if (isNaN(price) || price < 0) {
          throw new Error("Price must be a valid positive number");
        }
      }

      if (updates.artistAddress && !ethers.isAddress(updates.artistAddress)) {
        throw new Error("Invalid Ethereum address format");
      }

      // Apply updates
      Object.assign(track, updates);
      await track.save();

      // Update blockchain if needed
      if (updates.price && track.blockchain.status === "confirmed") {
        // Note: Blockchain price updates would require additional smart contract methods
        console.log("Price update - blockchain sync may be needed");
      }

      return track;
    } catch (error) {
      console.error("TrackService.updateTrack error:", error);
      throw error;
    }
  }

  /**
   * Delete track (soft delete)
   * @param {string} trackId - Track ID
   * @param {Object} options - Delete options
   * @returns {Promise<boolean>} Success status
   */
  async deleteTrack(trackId, options = {}) {
    try {
      const track = await Track.findById(trackId);
      if (!track) {
        throw new Error("Track not found");
      }

      if (options.hardDelete) {
        await Track.findByIdAndDelete(trackId);
      } else {
        // Soft delete
        track.isActive = false;
        await track.save();
      }

      return true;
    } catch (error) {
      console.error("TrackService.deleteTrack error:", error);
      throw error;
    }
  }

  /**
   * Increment track plays
   * @param {string} trackId - Track ID
   * @returns {Promise<Object>} Updated track
   */
  async incrementPlays(trackId) {
    try {
      const track = await Track.findByIdAndUpdate(
        trackId,
        { $inc: { plays: 1 } },
        { new: true }
      );

      if (!track) {
        throw new Error("Track not found");
      }

      return track;
    } catch (error) {
      console.error("TrackService.incrementPlays error:", error);
      throw error;
    }
  }

  /**
   * Increment track downloads
   * @param {string} trackId - Track ID
   * @returns {Promise<Object>} Updated track
   */
  async incrementDownloads(trackId) {
    try {
      const track = await Track.findByIdAndUpdate(
        trackId,
        { $inc: { downloads: 1 } },
        { new: true }
      );

      if (!track) {
        throw new Error("Track not found");
      }

      return track;
    } catch (error) {
      console.error("TrackService.incrementDownloads error:", error);
      throw error;
    }
  }

  /**
   * Add purchase record to track
   * @param {string} trackId - Track ID
   * @param {Object} purchaseData - Purchase data
   * @returns {Promise<Object>} Updated track
   */
  async addPurchase(trackId, purchaseData) {
    try {
      const { buyer, price, txHash, blockNumber } = purchaseData;

      const track = await Track.findById(trackId);
      if (!track) {
        throw new Error("Track not found");
      }

      // Add purchase record
      track.purchases.push({
        buyer,
        price,
        txHash,
        blockNumber,
        timestamp: new Date(),
      });

      // Update total earnings
      const currentEarnings = parseFloat(track.totalEarnings || 0);
      const purchaseAmount = parseFloat(price || 0);
      track.totalEarnings = (currentEarnings + purchaseAmount).toString();

      await track.save();

      return track;
    } catch (error) {
      console.error("TrackService.addPurchase error:", error);
      throw error;
    }
  }

  /**
   * Get track analytics
   * @param {string} trackId - Track ID
   * @returns {Promise<Object>} Track analytics
   */
  async getTrackAnalytics(trackId) {
    try {
      const track = await Track.findById(trackId);
      if (!track) {
        throw new Error("Track not found");
      }

      return {
        trackId: track._id,
        title: track.title,
        artist: track.artist,
        plays: track.plays,
        downloads: track.downloads,
        likes: track.likeCount,
        purchases: track.purchaseCount,
        totalEarnings: track.totalEarnings,
        royalties: track.totalRoyalties,
        createdAt: track.createdAt,
        blockchain: {
          status: track.blockchain.status,
          contractId: track.blockchain.contractId,
          addedAt: track.blockchain.addedAt,
        },
      };
    } catch (error) {
      console.error("TrackService.getTrackAnalytics error:", error);
      throw error;
    }
  }

  /**
   * Get multiple tracks analytics
   * @param {Array} trackIds - Array of track IDs
   * @returns {Promise<Array>} Array of track analytics
   */
  async getMultipleTrackAnalytics(trackIds) {
    try {
      const analytics = await Promise.all(
        trackIds.map((trackId) => this.getTrackAnalytics(trackId))
      );
      return analytics;
    } catch (error) {
      console.error("TrackService.getMultipleTrackAnalytics error:", error);
      throw error;
    }
  }

  /**
   * Get tracks with blockchain status
   * @param {string} status - Blockchain status
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Tracks with specified blockchain status
   */
  async getTracksByBlockchainStatus(status, options = {}) {
    try {
      const filters = { "blockchain.status": status };
      return await this.getTracks(filters, options);
    } catch (error) {
      console.error("TrackService.getTracksByBlockchainStatus error:", error);
      throw error;
    }
  }

  /**
   * Retry failed blockchain operations
   * @param {string} trackId - Track ID
   * @returns {Promise<Object>} Retry result
   */
  async retryBlockchainOperation(trackId) {
    try {
      const track = await Track.findById(trackId);
      if (!track) {
        throw new Error("Track not found");
      }

      if (track.blockchain.status !== "failed") {
        throw new Error("Track is not in failed state");
      }

      // Reset status and retry
      track.blockchain.status = "pending";
      track.blockchain.error = null;
      await track.save();

      return await this.addToBlockchain(trackId);
    } catch (error) {
      console.error("TrackService.retryBlockchainOperation error:", error);
      throw error;
    }
  }
}

export default TrackService;

console.log("✅ TrackService loaded with comprehensive business logic");
