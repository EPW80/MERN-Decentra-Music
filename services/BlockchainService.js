import { ethers } from 'ethers';
import { getMusicStoreContract, getProvider, getWallet, isBlockchainAvailable, testBlockchainConnection } from '../config/blockchain.js';
import Track from '../models/Track.js';
import EventEmitter from 'events';

/**
 * Blockchain Service - Updated for MusicStore contract
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

            this.contract = getMusicStoreContract();
            this.provider = getProvider();
            this.wallet = getWallet();
            
            if (!this.contract) {
                throw new Error('MusicStore contract not available');
            }

            // Test connection before proceeding
            const connectionTest = await testBlockchainConnection();
            if (!connectionTest.connected) {
                console.log('⚠️ Blockchain connection failed, running in offline mode');
                console.log(`   Error: ${connectionTest.error}`);
                return { 
                    success: false, 
                    error: 'Connection failed', 
                    offline: true,
                    details: connectionTest.error
                };
            }

            // Setup event listeners only if connection is successful
            await this.setupEventListeners();
            
            console.log('✅ Blockchain service initialized');
            this.emit('initialized');
            
            return {
                success: true,
                contract: this.contract.address,
                network: connectionTest.network,
                blockNumber: connectionTest.blockNumber
            };

        } catch (error) {
            console.error('❌ Blockchain service initialization failed:', error.message);
            this.emit('error', error);
            return { success: false, error: error.message };
        }
    }

    async setupEventListeners() {
        if (!this.contract || this.isListening || !this.enabled) {
            return;
        }

        console.log('🎧 Setting up MusicStore event listeners...');

        try {
            // TrackAdded Event
            this.contract.on('TrackAdded', async (trackId, artist, price, event) => {
                console.log('🎵 TrackAdded event:', {
                    trackId: trackId.toString(),
                    artist,
                    price: ethers.utils.formatEther(price),
                    txHash: event.transactionHash
                });

                await this.processTrackAdded(trackId, artist, price, event);
            });

            // TrackPurchased Event
            this.contract.on('TrackPurchased', async (trackId, buyer, price, event) => {
                console.log('💰 TrackPurchased event:', {
                    trackId: trackId.toString(),
                    buyer,
                    price: ethers.utils.formatEther(price),
                    txHash: event.transactionHash
                });

                await this.processTrackPurchased(trackId, buyer, price, event);
            });

            // Error handlers
            this.contract.on('error', (error) => {
                console.error('❌ Smart contract error:', error);
                this.emit('contractError', error);
            });

            this.isListening = true;
            console.log('✅ Event listeners setup complete');

        } catch (error) {
            console.error('❌ Event listener setup failed:', error);
            this.isListening = false;
            console.log('⚠️ Event listening disabled due to setup failure');
        }
    }

    // Mock functions for offline mode
    async processTrackAdded(trackId, artist, price, event) {
        if (!this.enabled) return;
        
        try {
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
                    contractId: trackId.toString(),
                    artist: artist,
                    txHash: event.transactionHash,
                    blockNumber: event.blockNumber,
                    addedAt: new Date(),
                    price: ethers.utils.formatEther(price)
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
            } else {
                console.warn(`⚠️ Track not found for artist: ${artist}, txHash: ${event.transactionHash}`);
            }

        } catch (error) {
            console.error('❌ Process track added failed:', error);
        }
    }

    /**
     * Process TrackPurchased event
     */
    async processTrackPurchased(trackId, buyer, price, event) {
        if (!this.enabled) return;
        
        try {
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

            } else {
                console.warn(`⚠️ Track not found for contract ID: ${trackId}`);
            }

        } catch (error) {
            console.error('❌ Process purchase failed:', error);
        }
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
                    details: connectionTest.error
                };
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
                } : null
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
            this.isListening = false;
            console.log('✅ Blockchain service stopped');
        }
    }
}

const blockchainService = new BlockchainService();
export default blockchainService;