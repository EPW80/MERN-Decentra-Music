import Track from '../models/Track.js';
import blockchainService from '../services/BlockchainService.js';
import { getMusicStoreContract, isBlockchainAvailable, getWallet } from '../config/blockchain.js';
import { ethers } from 'ethers';

/**
 * MusicStore Blockchain Controller
 */

// Add track to blockchain (matches your contract function signature)
export const addTrackToBlockchain = async (req, res) => {
    try {
        const { trackId } = req.params;
        const { price } = req.body;

        if (!isBlockchainAvailable()) {
            return res.status(503).json({
                success: false,
                error: 'Blockchain not available'
            });
        }

        const wallet = getWallet();
        if (!wallet) {
            return res.status(503).json({
                success: false,
                error: 'Wallet not available'
            });
        }

        const track = await Track.findById(trackId);
        if (!track) {
            return res.status(404).json({
                success: false,
                error: 'Track not found'
            });
        }

        if (track.blockchain?.contractId) {
            return res.status(400).json({
                success: false,
                error: 'Track already on blockchain'
            });
        }

        console.log(`🔗 Adding track to blockchain: ${track.title}`);

        const contract = getMusicStoreContract();
        
        // Call addTrack with correct parameter order: (price, artist)
        const tx = await contract.addTrack(
            ethers.utils.parseEther(price || track.price),
            wallet.address // artist address
        );

        console.log(`⏳ Transaction submitted: ${tx.hash}`);

        // Store pending transaction
        track.blockchain = {
            pendingTxHash: tx.hash,
            status: 'pending'
        };
        await track.save();

        res.status(202).json({
            success: true,
            message: 'Track being added to blockchain',
            transaction: {
                hash: tx.hash,
                status: 'pending'
            },
            track: {
                id: track._id,
                title: track.title,
                artist: track.artist
            }
        });

    } catch (error) {
        console.error('❌ Add track to blockchain error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add track to blockchain',
            details: error.message
        });
    }
};

// Purchase track
export const purchaseTrack = async (req, res) => {
    try {
        const { contractId } = req.params;

        const track = await Track.findOne({ 
            'blockchain.contractId': contractId 
        });

        if (!track) {
            return res.status(404).json({
                success: false,
                error: 'Track not found on blockchain'
            });
        }

        const contract = getMusicStoreContract();
        
        // Get track info from blockchain
        const trackInfo = await contract.tracks(contractId);
        const price = trackInfo.price;

        console.log(`💰 Purchasing track: ${track.title} for ${ethers.utils.formatEther(price)} ETH`);

        const tx = await contract.purchaseTrack(contractId, {
            value: price
        });

        console.log(`⏳ Purchase transaction: ${tx.hash}`);

        res.status(202).json({
            success: true,
            message: 'Purchase transaction submitted',
            transaction: {
                hash: tx.hash,
                status: 'pending'
            },
            track: {
                id: track._id,
                title: track.title,
                artist: track.artist,
                price: ethers.utils.formatEther(price)
            }
        });

    } catch (error) {
        console.error('❌ Purchase error:', error);
        res.status(500).json({
            success: false,
            error: 'Purchase failed',
            details: error.message
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
                error: 'User address required'
            });
        }

        const contract = getMusicStoreContract();
        const hasPurchased = await contract.hasPurchased(userAddress, contractId);

        res.json({
            success: true,
            hasPurchased,
            userAddress,
            contractId
        });

    } catch (error) {
        console.error('Check purchase error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check purchase'
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
                error: 'Wallet not available'
            });
        }

        const contract = getMusicStoreContract();
        
        // Check balance first
        const balance = await contract.artistBalances(wallet.address);
        
        if (balance.eq(0)) {
            return res.status(400).json({
                success: false,
                error: 'No balance to withdraw'
            });
        }

        console.log(`💸 Withdrawing artist balance: ${ethers.utils.formatEther(balance)} ETH`);

        const tx = await contract.withdrawArtistBalance();

        res.status(202).json({
            success: true,
            message: 'Withdrawal transaction submitted',
            transaction: {
                hash: tx.hash,
                status: 'pending'
            },
            amount: ethers.utils.formatEther(balance)
        });

    } catch (error) {
        console.error('❌ Withdrawal error:', error);
        res.status(500).json({
            success: false,
            error: 'Withdrawal failed',
            details: error.message
        });
    }
};

// Get blockchain status and stats
export const getBlockchainStatus = async (req, res) => {
    try {
        const status = await blockchainService.getStatus();
        
        // Get additional stats
        const [
            totalTracks,
            blockchainTracks,
            pendingTracks
        ] = await Promise.all([
            Track.countDocuments(),
            Track.countDocuments({ 'blockchain.contractId': { $exists: true } }),
            Track.countDocuments({ 'blockchain.status': 'pending' })
        ]);

        res.json({
            success: true,
            blockchain: {
                ...status,
                stats: {
                    totalTracks,
                    blockchainTracks,
                    pendingTracks,
                    offChainTracks: totalTracks - blockchainTracks
                }
            }
        });

    } catch (error) {
        console.error('Blockchain status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get blockchain status'
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
                ...verification
            }
        });

    } catch (error) {
        console.error('Transaction status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get transaction status'
        });
    }
};