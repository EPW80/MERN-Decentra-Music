import { ethers } from "ethers";
import {
  getMusicStoreContract,
  getProvider,
  getWallet,
  isBlockchainAvailable,
  testBlockchainConnection,
} from "../config/blockchain.js";
import Track from "../models/Track.js";
import EventEmitter from "events";
import fs from "fs";
import path from "path";

/**
 * Enhanced Blockchain Service with Error Recovery
 */
class BlockchainService extends EventEmitter {
  constructor() {
    super();
    this.contract = null;
    this.provider = null;
    this.wallet = null;
    this.isListening = false;
    this.blockConfirmations = 2;
    this.enabled = process.env.BLOCKCHAIN_ENABLED !== "false";

    // Error handling and retry configuration
    this.maxRetries = 3;
    this.retryDelay = 2000; // 2 seconds base delay
    this.failedEventsFile = path.join(
      process.cwd(),
      "data",
      "failed-events.json"
    );
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 10000; // 10 seconds

    // Ensure data directory exists
    this.ensureDataDirectory();

    // Process failed events on startup
    this.processPendingFailedEvents();
  }

  ensureDataDirectory() {
    const dataDir = path.dirname(this.failedEventsFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log("📁 Created data directory for blockchain service");
    }
  }

  async initialize() {
    try {
      console.log("🔗 Initializing blockchain service...");

      if (!this.enabled) {
        console.log("⚠️ Blockchain service disabled");
        return { success: false, error: "Blockchain disabled" };
      }

      if (!isBlockchainAvailable()) {
        console.log("⚠️ Blockchain not available, service disabled");
        return { success: false, error: "Blockchain not available" };
      }

      return await this.initializeWithRetry();
    } catch (error) {
      console.error(
        "❌ Blockchain service initialization failed:",
        error.message
      );
      this.emit("error", error);
      return { success: false, error: error.message };
    }
  }

  async initializeWithRetry(attempt = 1) {
    try {
      this.contract = getMusicStoreContract();
      this.provider = getProvider();
      this.wallet = getWallet();

      if (!this.contract) {
        throw new Error("MusicStore contract not available");
      }

      // Test connection before proceeding
      const connectionTest = await testBlockchainConnection();
      if (!connectionTest.connected) {
        if (attempt < this.maxReconnectAttempts) {
          console.log(
            `⚠️ Blockchain connection failed (attempt ${attempt}), retrying in ${
              this.reconnectDelay / 1000
            }s...`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, this.reconnectDelay)
          );
          return await this.initializeWithRetry(attempt + 1);
        } else {
          console.log(
            "⚠️ Blockchain connection failed after max attempts, running in offline mode"
          );
          return {
            success: false,
            error: "Connection failed after retries",
            offline: true,
            details: connectionTest.error,
          };
        }
      }

      // Reset reconnect attempts on successful connection
      this.reconnectAttempts = 0;

      // Setup event listeners with error handling
      await this.setupEventListeners();

      console.log("✅ Blockchain service initialized");
      this.emit("initialized");

      return {
        success: true,
        contract: this.contract.address,
        network: connectionTest.network,
        blockNumber: connectionTest.blockNumber,
        attempt,
      };
    } catch (error) {
      if (attempt < this.maxReconnectAttempts) {
        console.error(
          `❌ Initialization attempt ${attempt} failed:`,
          error.message
        );
        console.log(`🔄 Retrying in ${this.reconnectDelay / 1000}s...`);
        await new Promise((resolve) =>
          setTimeout(resolve, this.reconnectDelay)
        );
        return await this.initializeWithRetry(attempt + 1);
      } else {
        throw error;
      }
    }
  }

  async setupEventListeners() {
    if (!this.contract || this.isListening || !this.enabled) {
      return;
    }

    console.log(
      "🎧 Setting up MusicStore event listeners with error handling..."
    );

    try {
      // TrackAdded Event with error handling
      this.contract.on("TrackAdded", async (trackId, artist, price, event) => {
        console.log("🎵 TrackAdded event:", {
          trackId: trackId.toString(),
          artist,
          price: ethers.formatEther(price),
          txHash: event.transactionHash,
        });

        try {
          await this.processTrackAddedWithRetry(trackId, artist, price, event);
        } catch (error) {
          console.error("❌ Failed to process TrackAdded event:", error);
          await this.storeFailedEvent(
            "TrackAdded",
            { trackId, artist, price, event },
            error
          );
        }
      });

      // TrackPurchased Event with error handling
      this.contract.on(
        "TrackPurchased",
        async (trackId, buyer, price, event) => {
          console.log("💰 TrackPurchased event:", {
            trackId: trackId.toString(),
            buyer,
            price: ethers.formatEther(price),
            txHash: event.transactionHash,
          });

          try {
            await this.processTrackPurchasedWithRetry(
              trackId,
              buyer,
              price,
              event
            );
          } catch (error) {
            console.error("❌ Failed to process TrackPurchased event:", error);
            await this.storeFailedEvent(
              "TrackPurchased",
              { trackId, buyer, price, event },
              error
            );
          }
        }
      );

      // Provider error handler
      this.provider.on("error", async (error) => {
        console.error("❌ Provider error:", error);
        this.emit("providerError", error);
        await this.handleProviderError(error);
      });

      // Note: Contract error events are handled by provider error listener
      // No need for separate contract error listener as "error" is not a contract event
      // All contract events are properly defined and handled above
      
      this.isListening = true;
      console.log("✅ Event listeners setup complete with error handling");
    } catch (error) {
      console.error("❌ Event listener setup failed:", error);
      this.isListening = false;

      // Schedule retry
      console.log("🔄 Scheduling event listener retry in 30s...");
      setTimeout(() => {
        this.setupEventListeners();
      }, 30000);
    }
  }

  // Enhanced TrackAdded processing with retry logic
  async processTrackAddedWithRetry(trackId, artist, price, event) {
    return await this.withRetry(
      "processTrackAdded",
      async () => {
        return await this.processTrackAdded(trackId, artist, price, event);
      },
      { trackId, artist, price, event }
    );
  }

  async processTrackAdded(trackId, artist, price, event) {
    if (!this.enabled) return;

    console.log(`🔄 Processing TrackAdded: ${trackId}`);

    // Find track by artist wallet address or by pending blockchain status
    const track = await Track.findOne({
      $or: [
        { "blockchain.pendingTxHash": event.transactionHash },
        {
          artist: artist, // If artist name matches wallet
          "blockchain.contractId": { $exists: false },
        },
      ],
    });

    if (track) {
      // Update track with blockchain info
      track.blockchain = {
        ...track.blockchain,
        contractId: trackId.toString(),
        artist: artist,
        txHash: event.transactionHash,
        blockNumber: event.blockNumber,
        addedAt: new Date(),
        price: ethers.formatEther(price),
        status: "confirmed",
      };

      // Remove pending status
      if (track.blockchain.pendingTxHash) {
        delete track.blockchain.pendingTxHash;
      }

      await track.save();

      console.log(`✅ Track updated with blockchain info: ${track.title}`);

      this.emit("trackAdded", {
        track,
        contractId: trackId.toString(),
        artist,
        txHash: event.transactionHash,
      });

      return { success: true, track };
    } else {
      console.warn(
        `⚠️ Track not found for artist: ${artist}, txHash: ${event.transactionHash}`
      );
      throw new Error(`Track not found for event: ${event.transactionHash}`);
    }
  }

  // Enhanced TrackPurchased processing with retry logic
  async processTrackPurchasedWithRetry(trackId, buyer, price, event, attempt = 1) {
    try {
      console.log(`🎵 Processing TrackPurchased event (attempt ${attempt}):`, {
        trackId: trackId.toString(),
        buyer,
        price: ethers.formatEther(price),
        txHash: event.transactionHash,
      });

      // Sync purchase to database
      const { syncPurchaseFromEvent } = await import('../controllers/purchaseController.js');
      
      const eventData = {
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        blockHash: event.blockHash,
        trackId: trackId.toString(),
        buyer: buyer,
        artist: event.args?.artist || null,
        price: ethers.formatEther(price),
        platformFee: event.args?.platformFee ? ethers.formatEther(event.args.platformFee) : null,
        artistPayment: event.args?.artistPayment ? ethers.formatEther(event.args.artistPayment) : null,
        timestamp: event.timestamp || Date.now() / 1000,
      };

      const purchase = await syncPurchaseFromEvent(eventData);
      console.log(`✅ Purchase synced to database: ${purchase.id}`);

      return { success: true, purchase };

    } catch (error) {
      console.error(`❌ Failed to process TrackPurchased event (attempt ${attempt}):`, error);
      
      if (attempt < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`🔄 Retrying in ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.processTrackPurchasedWithRetry(trackId, buyer, price, event, attempt + 1);
      }

      // Store failed event for manual retry
      await this.storeFailedEvent("TrackPurchased", { trackId, buyer, price, event }, error);
      throw error;
    }
  }

  // Generic retry wrapper
  async withRetry(operationName, operation, eventData) {
    let lastError;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(
          `🔄 ${operationName} attempt ${attempt}/${this.maxRetries}`
        );
        const result = await operation();

        if (attempt > 1) {
          console.log(`✅ ${operationName} succeeded on attempt ${attempt}`);
        }

        return result;
      } catch (error) {
        lastError = error;
        console.error(
          `❌ ${operationName} attempt ${attempt} failed:`,
          error.message
        );

        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * attempt; // Exponential backoff
          console.log(`⏳ Retrying ${operationName} in ${delay / 1000}s...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          console.error(
            `❌ ${operationName} failed after ${this.maxRetries} attempts`
          );
          throw lastError;
        }
      }
    }

    throw lastError;
  }

  // Store failed events for later retry
  async storeFailedEvent(eventType, eventData, error) {
    try {
      const failedEvent = {
        eventType,
        eventData: {
          trackId: eventData.trackId?.toString(),
          artist: eventData.artist,
          buyer: eventData.buyer,
          price: eventData.price?.toString(),
          event: {
            transactionHash: eventData.event?.transactionHash,
            blockNumber: eventData.event?.blockNumber,
            blockHash: eventData.event?.blockHash,
          },
        },
        error: {
          message: error.message,
          stack: error.stack,
        },
        timestamp: new Date().toISOString(),
        retryCount: 0,
        maxRetries: 5,
      };

      let failedEvents = [];
      if (fs.existsSync(this.failedEventsFile)) {
        const data = fs.readFileSync(this.failedEventsFile, "utf8");
        failedEvents = JSON.parse(data);
      }

      failedEvents.push(failedEvent);
      fs.writeFileSync(
        this.failedEventsFile,
        JSON.stringify(failedEvents, null, 2)
      );

      console.log(
        `📝 Stored failed ${eventType} event for later retry:`,
        eventData.event?.transactionHash
      );
    } catch (storeError) {
      console.error("❌ Failed to store failed event:", storeError);
    }
  }

  // Process failed events from storage
  async processPendingFailedEvents() {
    if (!fs.existsSync(this.failedEventsFile)) {
      return;
    }

    try {
      const data = fs.readFileSync(this.failedEventsFile, "utf8");
      const failedEvents = JSON.parse(data);

      if (failedEvents.length === 0) {
        return;
      }

      console.log(`🔄 Processing ${failedEvents.length} failed events...`);

      const stillFailed = [];

      for (const failedEvent of failedEvents) {
        if (failedEvent.retryCount >= failedEvent.maxRetries) {
          console.log(
            `⚠️ Skipping event after max retries: ${failedEvent.eventData.event.transactionHash}`
          );
          continue;
        }

        try {
          failedEvent.retryCount++;

          if (failedEvent.eventType === "TrackAdded") {
            await this.processTrackAdded(
              failedEvent.eventData.trackId,
              failedEvent.eventData.artist,
              failedEvent.eventData.price,
              failedEvent.eventData.event
            );
          } else if (failedEvent.eventType === "TrackPurchased") {
            await this.processTrackPurchased(
              failedEvent.eventData.trackId,
              failedEvent.eventData.buyer,
              failedEvent.eventData.price,
              failedEvent.eventData.event
            );
          }

          console.log(
            `✅ Successfully processed failed ${failedEvent.eventType} event`
          );
        } catch (error) {
          console.error(`❌ Failed event still failing:`, error.message);
          stillFailed.push(failedEvent);
        }
      }

      // Update failed events file
      fs.writeFileSync(
        this.failedEventsFile,
        JSON.stringify(stillFailed, null, 2)
      );

      if (stillFailed.length > 0) {
        console.log(
          `⚠️ ${stillFailed.length} events still failing, will retry later`
        );
      }
    } catch (error) {
      console.error("❌ Error processing failed events:", error);
    }
  }

  // Error handlers
  async handleProviderError(error) {
    console.log("🔄 Attempting to reconnect provider...");

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(async () => {
        try {
          await this.initialize();
        } catch (initError) {
          console.error("❌ Reconnection failed:", initError);
        }
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error(
        "❌ Max reconnection attempts reached, blockchain service offline"
      );
      this.isListening = false;
    }
  }

  async handleContractError(error) {
    console.log("⚠️ Contract error detected, may need manual intervention");
    this.emit("contractError", error);

    // Log contract errors for analysis
    const errorLog = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      contract: this.contract?.address,
    };

    console.log("📝 Contract error logged:", errorLog);
  }

  /**
   * Purchase Verification Methods
   */

  // Verify a purchase transaction
  async verifyPurchaseTransaction(txHash, buyerAddress) {
    try {
      if (!this.provider || !this.contract) {
        throw new Error("Blockchain service not initialized");
      }

      console.log(`🔍 Verifying transaction: ${txHash} for buyer: ${buyerAddress}`);

      // Get transaction receipt
      const receipt = await this.provider.getTransactionReceipt(txHash);
      if (!receipt) {
        return {
          success: false,
          error: "Transaction not found or not confirmed",
        };
      }

      if (receipt.status !== 1) {
        return {
          success: false,
          error: "Transaction failed",
        };
      }

      // Parse transaction logs for TrackPurchased events
      const purchaseEvents = receipt.logs
        .map(log => {
          try {
            return this.contract.interface.parseLog(log);
          } catch (error) {
            return null;
          }
        })
        .filter(log => log && log.name === 'TrackPurchased');

      if (purchaseEvents.length === 0) {
        return {
          success: false,
          error: "No TrackPurchased event found in transaction",
        };
      }

      // Find the event that matches the buyer address
      const matchingEvent = purchaseEvents.find(event => 
        event.args.buyer.toLowerCase() === buyerAddress.toLowerCase()
      );

      if (!matchingEvent) {
        return {
          success: false,
          error: "Transaction not made by specified buyer address",
        };
      }

      // Get current block for confirmations
      const currentBlock = await this.provider.getBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber;

      // Extract event data
      const eventArgs = matchingEvent.args;
      const block = await this.provider.getBlock(receipt.blockNumber);

      return {
        success: true,
        data: {
          txHash: txHash,
          blockNumber: receipt.blockNumber,
          blockHash: receipt.blockHash,
          trackId: eventArgs.trackId.toString(),
          buyer: eventArgs.buyer,
          artistAddress: eventArgs.artist || null,
          amount: ethers.formatEther(eventArgs.price),
          platformFee: eventArgs.platformFee ? ethers.formatEther(eventArgs.platformFee) : null,
          artistPayment: eventArgs.artistPayment ? ethers.formatEther(eventArgs.artistPayment) : null,
          confirmations: confirmations,
          timestamp: block.timestamp,
          eventData: {
            name: matchingEvent.name,
            args: Object.fromEntries(
              Object.entries(eventArgs).map(([key, value]) => [
                key,
                typeof value === 'bigint' ? value.toString() : value
              ])
            ),
          },
        },
      };

    } catch (error) {
      console.error("❌ Purchase verification error:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Check if user has purchased a track
  async hasPurchased(userAddress, trackId) {
    try {
      if (!this.contract) {
        throw new Error("Contract not available");
      }

      console.log(`🔍 Checking purchase: user ${userAddress}, track ${trackId}`);

      // Call contract method to check purchase status
      const hasPurchased = await this.contract.hasPurchased(userAddress, trackId);
      return hasPurchased;

    } catch (error) {
      console.error("❌ Has purchased check error:", error);
      throw error;
    }
  }

  // Get purchase events for a specific user or track
  async getPurchaseEvents(fromBlock = 0, userAddress = null, trackId = null) {
    try {
      if (!this.contract) {
        throw new Error("Contract not available");
      }

      console.log(`📊 Getting purchase events from block ${fromBlock}`);

      // Set up filter
      const filter = this.contract.filters.TrackPurchased(
        trackId || null,  // trackId filter
        userAddress || null,  // buyer filter
        null  // price (no filter)
      );

      // Get events
      const events = await this.contract.queryFilter(filter, fromBlock);

      return events.map(event => {
        const args = event.args;
        return {
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
          blockHash: event.blockHash,
          trackId: args.trackId.toString(),
          buyer: args.buyer,
          artist: args.artist || null,
          price: ethers.formatEther(args.price),
          platformFee: args.platformFee ? ethers.formatEther(args.platformFee) : null,
          artistPayment: args.artistPayment ? ethers.formatEther(args.artistPayment) : null,
          timestamp: event.timestamp || null,
          eventIndex: event.logIndex,
        };
      });

    } catch (error) {
      console.error("❌ Get purchase events error:", error);
      throw error;
    }
  }

  // Calculate purchase details (price breakdown)
  async calculatePurchaseDetails(trackId) {
    try {
      if (!this.contract) {
        throw new Error("Contract not available");
      }

      // Get track info from contract
      const trackInfo = await this.contract.tracks(trackId);
      
      if (!trackInfo || trackInfo.artist === ethers.ZeroAddress) {
        throw new Error("Track not found on blockchain");
      }

      const price = ethers.formatEther(trackInfo.price);
      
      // Get platform fee percentage (assuming it's stored in contract)
      let platformFeePercent = 5; // Default 5%
      try {
        platformFeePercent = await this.contract.platformFeePercent();
      } catch (error) {
        console.warn("Could not get platform fee from contract, using default 5%");
      }

      const platformFee = (parseFloat(price) * platformFeePercent) / 100;
      const artistPayment = parseFloat(price) - platformFee;

      return {
        trackId: trackId,
        price: price,
        platformFeePercent: platformFeePercent,
        platformFee: platformFee.toString(),
        artistPayment: artistPayment.toString(),
        artist: trackInfo.artist,
        isActive: trackInfo.isActive || true,
      };

    } catch (error) {
      console.error("❌ Calculate purchase details error:", error);
      throw error;
    }
  }

  async getStatus() {
    try {
      if (!this.enabled) {
        return {
          available: false,
          listening: false,
          enabled: false,
          message: "Blockchain service disabled",
        };
      }

      if (!this.contract) {
        return {
          available: false,
          listening: false,
          enabled: true,
          error: "Contract not initialized",
        };
      }

      // Test connection
      const connectionTest = await testBlockchainConnection();

      if (!connectionTest.connected) {
        return {
          available: false,
          listening: false,
          enabled: true,
          error: "Connection failed",
          details: connectionTest.error,
          reconnectAttempts: this.reconnectAttempts,
        };
      }

      // Check for pending failed events
      let failedEventsCount = 0;
      if (fs.existsSync(this.failedEventsFile)) {
        const data = fs.readFileSync(this.failedEventsFile, "utf8");
        const failedEvents = JSON.parse(data);
        failedEventsCount = failedEvents.length;
      }

      return {
        available: true,
        listening: this.isListening,
        enabled: true,
        network: connectionTest.network,
        blockNumber: connectionTest.blockNumber,
        contract: {
          address: this.contract.address,
        },
        wallet: this.wallet
          ? {
              address: this.wallet.address,
            }
          : null,
        failedEventsCount,
        reconnectAttempts: this.reconnectAttempts,
      };
    } catch (error) {
      return {
        available: false,
        listening: false,
        enabled: this.enabled,
        error: error.message,
      };
    }
  }

  async stop() {
    if (this.contract && this.isListening) {
      console.log("🛑 Stopping blockchain event listeners...");
      this.contract.removeAllListeners();
      this.provider?.removeAllListeners();
      this.isListening = false;
      console.log("✅ Blockchain service stopped");
    }
  }

  // Manual retry of failed events
  async retryFailedEvents() {
    console.log("🔄 Manually retrying failed events...");
    await this.processPendingFailedEvents();
  }

  // Clear failed events (for admin use)
  async clearFailedEvents() {
    if (fs.existsSync(this.failedEventsFile)) {
      fs.writeFileSync(this.failedEventsFile, JSON.stringify([], null, 2));
      console.log("🗑️ Cleared all failed events");
    }
  }
}

export default BlockchainService;

console.log("✅ Enhanced Blockchain service loaded with error recovery");
