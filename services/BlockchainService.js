import { ethers } from 'ethers';
import { getMusicStoreContract, getProvider, getWallet, isBlockchainAvailable, testBlockchainConnection } from '../config/blockchain.js';
import Track from '../models/Track.js';
import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';

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
        this.enabled = process.env.BLOCKCHAIN_ENABLED !== 'false';
        
        // Error handling and retry configuration
        this.maxRetries = 3;
        this.retryDelay = 2000; // 2 seconds base delay
        this.failedEventsFile = path.join(process.cwd(), 'data', 'failed-events.json');
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
            console.log('📁 Created data directory for blockchain service');
        }
    }

    async initialize() {
        try {
            console.log('🔗 Initializing blockchain service...');

            if (!this.enabled) {
                console.log('⚠️ Blockchain service disabled');
                return { success: false, error: 'Blockchain disabled' };
            }

            if (!isBlockchainAvailable()) {
                console.log('⚠️ Blockchain not available, service disabled');
                return { success: false, error: 'Blockchain not available' };
            }

            return await this.initializeWithRetry();

        } catch (error) {
            console.error('❌ Blockchain service initialization failed:', error.message);
            this.emit('error', error);
            return { success: false, error: error.message };
        }
    }

    async initializeWithRetry(attempt = 1) {
        try {
            this.contract = getMusicStoreContract();
            this.provider = getProvider();
            this.wallet = getWallet();
            
            if (!this.contract) {
                throw new Error('MusicStore contract not available');
            }

            // Test connection before proceeding
            const connectionTest = await testBlockchainConnection();
            if (!connectionTest.connected) {
                if (attempt < this.maxReconnectAttempts) {
                    console.log(`⚠️ Blockchain connection failed (attempt ${attempt}), retrying in ${this.reconnectDelay/1000}s...`);
                    await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));
                    return await this.initializeWithRetry(attempt + 1);
                } else {
                    console.log('⚠️ Blockchain connection failed after max attempts, running in offline mode');
                    return { 
                        success: false, 
                        error: 'Connection failed after retries', 
                        offline: true,
                        details: connectionTest.error
                    };
                }
            }

            // Reset reconnect attempts on successful connection
            this.reconnectAttempts = 0;

            // Setup event listeners with error handling
            await this.setupEventListeners();
            
            console.log('✅ Blockchain service initialized');
            this.emit('initialized');
            
            return {
                success: true,
                contract: this.contract.address,
                network: connectionTest.network,
                blockNumber: connectionTest.blockNumber,
                attempt
            };

        } catch (error) {
            if (attempt < this.maxReconnectAttempts) {
                console.error(`❌ Initialization attempt ${attempt} failed:`, error.message);
                console.log(`🔄 Retrying in ${this.reconnectDelay/1000}s...`);
                await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));
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

        console.log('🎧 Setting up MusicStore event listeners with error handling...');

        try {
            // TrackAdded Event with error handling
            this.contract.on('TrackAdded', async (trackId, artist, price, event) => {
                console.log('🎵 TrackAdded event:', {
                    trackId: trackId.toString(),
                    artist,
                    price: ethers.utils.formatEther(price),
                    txHash: event.transactionHash
                });

                try {
                    await this.processTrackAddedWithRetry(trackId, artist, price, event);
                } catch (error) {
                    console.error('❌ Failed to process TrackAdded event:', error);
                    await this.storeFailedEvent('TrackAdded', { trackId, artist, price, event }, error);
                }
            });

            // TrackPurchased Event with error handling
            this.contract.on('TrackPurchased', async (trackId, buyer, price, event) => {
                console.log('💰 TrackPurchased event:', {
                    trackId: trackId.toString(),
                    buyer,
                    price: ethers.utils.formatEther(price),
                    txHash: event.transactionHash
                });

                try {
                    await this.processTrackPurchasedWithRetry(trackId, buyer, price, event);
                } catch (error) {
                    console.error('❌ Failed to process TrackPurchased event:', error);
                    await this.storeFailedEvent('TrackPurchased', { trackId, buyer, price, event }, error);
                }
            });

            // Provider error handler
            this.provider.on('error', async (error) => {
                console.error('❌ Provider error:', error);
                this.emit('providerError', error);
                await this.handleProviderError(error);
            });

            // Contract error handler
            this.contract.on('error', async (error) => {
                console.error('❌ Smart contract error:', error);
                this.emit('contractError', error);
                await this.handleContractError(error);
            });

            this.isListening = true;
            console.log('✅ Event listeners setup complete with error handling');

        } catch (error) {
            console.error('❌ Event listener setup failed:', error);
            this.isListening = false;
            
            // Schedule retry
            console.log('🔄 Scheduling event listener retry in 30s...');
            setTimeout(() => {
                this.setupEventListeners();
            }, 30000);
        }
    }

    // Enhanced TrackAdded processing with retry logic
    async processTrackAddedWithRetry(trackId, artist, price, event) {
        return await this.withRetry('processTrackAdded', async () => {
            return await this.processTrackAdded(trackId, artist, price, event);
        }, { trackId, artist, price, event });
    }

    async processTrackAdded(trackId, artist, price, event) {
        if (!this.enabled) return;
        
        console.log(`🔄 Processing TrackAdded: ${trackId}`);
        
        // Find track by artist wallet address or by pending blockchain status
        const track = await Track.findOne({
            $or: [
                { 'blockchain.pendingTxHash': event.transactionHash },
                { 
                    artist: artist, // If artist name matches wallet
                    'blockchain.contractId': { $exists: false }
                }
            ]
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
                price: ethers.utils.formatEther(price),
                status: 'confirmed'
            };

            // Remove pending status
            if (track.blockchain.pendingTxHash) {
                delete track.blockchain.pendingTxHash;
            }

            await track.save();
            
            console.log(`✅ Track updated with blockchain info: ${track.title}`);
            
            this.emit('trackAdded', {
                track,
                contractId: trackId.toString(),
                artist,
                txHash: event.transactionHash
            });
            
            return { success: true, track };
        } else {
            console.warn(`⚠️ Track not found for artist: ${artist}, txHash: ${event.transactionHash}`);
            throw new Error(`Track not found for event: ${event.transactionHash}`);
        }
    }

    // Enhanced TrackPurchased processing with retry logic
    async processTrackPurchasedWithRetry(trackId, buyer, price, event) {
        return await this.withRetry('processTrackPurchased', async () => {
            return await this.processTrackPurchased(trackId, buyer, price, event);
        }, { trackId, buyer, price, event });
    }

    async processTrackPurchased(trackId, buyer, price, event) {
        if (!this.enabled) return;
        
        console.log(`🔄 Processing TrackPurchased: ${trackId}`);
        
        const track = await Track.findOne({
            'blockchain.contractId': trackId.toString()
        });

        if (track) {
            // Update track stats
            track.downloads += 1;
            track.totalEarnings = (parseFloat(track.totalEarnings) || 0) + parseFloat(ethers.utils.formatEther(price));
            
            // Add purchase record
            if (!track.purchases) track.purchases = [];
            track.purchases.push({
                buyer,
                price: ethers.utils.formatEther(price),
                txHash: event.transactionHash,
                blockNumber: event.blockNumber,
                timestamp: new Date()
            });

            await track.save();

            console.log(`✅ Purchase processed: ${track.title} bought by ${buyer}`);

            this.emit('trackPurchased', {
                track,
                buyer,
                price: ethers.utils.formatEther(price),
                txHash: event.transactionHash
            });

            // Grant access to buyer
            await this.grantAccess(trackId.toString(), buyer, track);
            
            return { success: true, track, buyer };

        } else {
            console.warn(`⚠️ Track not found for contract ID: ${trackId}`);
            throw new Error(`Track not found for contract ID: ${trackId}`);
        }
    }

    // Generic retry wrapper
    async withRetry(operationName, operation, eventData) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                console.log(`🔄 ${operationName} attempt ${attempt}/${this.maxRetries}`);
                const result = await operation();
                
                if (attempt > 1) {
                    console.log(`✅ ${operationName} succeeded on attempt ${attempt}`);
                }
                
                return result;
                
            } catch (error) {
                lastError = error;
                console.error(`❌ ${operationName} attempt ${attempt} failed:`, error.message);
                
                if (attempt < this.maxRetries) {
                    const delay = this.retryDelay * attempt; // Exponential backoff
                    console.log(`⏳ Retrying ${operationName} in ${delay/1000}s...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    console.error(`❌ ${operationName} failed after ${this.maxRetries} attempts`);
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
                        blockHash: eventData.event?.blockHash
                    }
                },
                error: {
                    message: error.message,
                    stack: error.stack
                },
                timestamp: new Date().toISOString(),
                retryCount: 0,
                maxRetries: 5
            };

            let failedEvents = [];
            if (fs.existsSync(this.failedEventsFile)) {
                const data = fs.readFileSync(this.failedEventsFile, 'utf8');
                failedEvents = JSON.parse(data);
            }

            failedEvents.push(failedEvent);
            fs.writeFileSync(this.failedEventsFile, JSON.stringify(failedEvents, null, 2));

            console.log(`📝 Stored failed ${eventType} event for later retry:`, eventData.event?.transactionHash);

        } catch (storeError) {
            console.error('❌ Failed to store failed event:', storeError);
        }
    }

    // Process failed events from storage
    async processPendingFailedEvents() {
        if (!fs.existsSync(this.failedEventsFile)) {
            return;
        }

        try {
            const data = fs.readFileSync(this.failedEventsFile, 'utf8');
            const failedEvents = JSON.parse(data);
            
            if (failedEvents.length === 0) {
                return;
            }

            console.log(`🔄 Processing ${failedEvents.length} failed events...`);

            const stillFailed = [];

            for (const failedEvent of failedEvents) {
                if (failedEvent.retryCount >= failedEvent.maxRetries) {
                    console.log(`⚠️ Skipping event after max retries: ${failedEvent.eventData.event.transactionHash}`);
                    continue;
                }

                try {
                    failedEvent.retryCount++;
                    
                    if (failedEvent.eventType === 'TrackAdded') {
                        await this.processTrackAdded(
                            failedEvent.eventData.trackId,
                            failedEvent.eventData.artist,
                            failedEvent.eventData.price,
                            failedEvent.eventData.event
                        );
                    } else if (failedEvent.eventType === 'TrackPurchased') {
                        await this.processTrackPurchased(
                            failedEvent.eventData.trackId,
                            failedEvent.eventData.buyer,
                            failedEvent.eventData.price,
                            failedEvent.eventData.event
                        );
                    }

                    console.log(`✅ Successfully processed failed ${failedEvent.eventType} event`);

                } catch (error) {
                    console.error(`❌ Failed event still failing:`, error.message);
                    stillFailed.push(failedEvent);
                }
            }

            // Update failed events file
            fs.writeFileSync(this.failedEventsFile, JSON.stringify(stillFailed, null, 2));

            if (stillFailed.length > 0) {
                console.log(`⚠️ ${stillFailed.length} events still failing, will retry later`);
            }

        } catch (error) {
            console.error('❌ Error processing failed events:', error);
        }
    }

    // Error handlers
    async handleProviderError(error) {
        console.log('🔄 Attempting to reconnect provider...');
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(async () => {
                try {
                    await this.initialize();
                } catch (initError) {
                    console.error('❌ Reconnection failed:', initError);
                }
            }, this.reconnectDelay * this.reconnectAttempts);
        } else {
            console.error('❌ Max reconnection attempts reached, blockchain service offline');
            this.isListening = false;
        }
    }

    async handleContractError(error) {
        console.log('⚠️ Contract error detected, may need manual intervention');
        this.emit('contractError', error);
        
        // Log contract errors for analysis
        const errorLog = {
            timestamp: new Date().toISOString(),
            error: error.message,
            stack: error.stack,
            contract: this.contract?.address
        };
        
        console.log('📝 Contract error logged:', errorLog);
    }

    // Grant access method (placeholder)
    async grantAccess(trackId, buyer, track) {
        // Implement access granting logic here
        console.log(`🔐 Granting access to track ${trackId} for buyer ${buyer}`);
        
        // This could involve:
        // - Creating download tokens
        // - Adding buyer to access list
        // - Sending confirmation emails
        // - etc.
    }

    async getStatus() {
        try {
            if (!this.enabled) {
                return {
                    available: false,
                    listening: false,
                    enabled: false,
                    message: 'Blockchain service disabled'
                };
            }

            if (!this.contract) {
                return {
                    available: false,
                    listening: false,
                    enabled: true,
                    error: 'Contract not initialized'
                };
            }

            // Test connection
            const connectionTest = await testBlockchainConnection();
            
            if (!connectionTest.connected) {
                return {
                    available: false,
                    listening: false,
                    enabled: true,
                    error: 'Connection failed',
                    details: connectionTest.error,
                    reconnectAttempts: this.reconnectAttempts
                };
            }

            // Check for pending failed events
            let failedEventsCount = 0;
            if (fs.existsSync(this.failedEventsFile)) {
                const data = fs.readFileSync(this.failedEventsFile, 'utf8');
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
                    address: this.contract.address
                },
                wallet: this.wallet ? {
                    address: this.wallet.address
                } : null,
                failedEventsCount,
                reconnectAttempts: this.reconnectAttempts
            };

        } catch (error) {
            return {
                available: false,
                listening: false,
                enabled: this.enabled,
                error: error.message
            };
        }
    }

    async stop() {
        if (this.contract && this.isListening) {
            console.log('🛑 Stopping blockchain event listeners...');
            this.contract.removeAllListeners();
            this.provider?.removeAllListeners();
            this.isListening = false;
            console.log('✅ Blockchain service stopped');
        }
    }

    // Manual retry of failed events
    async retryFailedEvents() {
        console.log('🔄 Manually retrying failed events...');
        await this.processPendingFailedEvents();
    }

    // Clear failed events (for admin use)
    async clearFailedEvents() {
        if (fs.existsSync(this.failedEventsFile)) {
            fs.writeFileSync(this.failedEventsFile, JSON.stringify([], null, 2));
            console.log('🗑️ Cleared all failed events');
        }
    }
}

const blockchainService = new BlockchainService();
export default blockchainService;

console.log('✅ Enhanced Blockchain service loaded with error recovery');