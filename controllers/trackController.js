import Music from '../models/Music.js'; // Changed from Track to Music
import web3StorageService from '../config/web3storage.js'; // Fixed import name
import { ethers } from 'ethers';
import { getMusicStoreContract, isMusicStoreAvailable } from '../config/blockchain.js';

// Public: Get all active tracks
export async function getAllTracks(req, res) {
  try {
    const tracks = await Music.find({ isActive: true })
      .select('-ipfs.audioHash') // Don't expose audio hash
      .sort({ createdAt: -1 }); // Changed from -releaseDate to -createdAt
    res.json({ tracks });
  } catch (error) {
    console.error('Get tracks error:', error);
    res.status(500).json({ error: 'Failed to fetch tracks' });
  }
}

// Public: Get track details (without download access)
export async function getTrackDetails(req, res) {
  try {
    const track = await Music.findById(req.params.id)
      .select('-ipfs.audioHash'); // Don't expose audio hash
      
    if (!track) {
      return res.status(404).json({ error: 'Track not found' });
    }
    
    res.json(track);
  } catch (error) {
    console.error('Get track details error:', error);
    res.status(500).json({ error: 'Failed to fetch track details' });
  }
}

// Public: Get all artists
export async function getAllArtists(req, res) {
  try {
    const artists = await Music.distinct('artist');
    res.json({ artists });
  } catch (error) {
    console.error('Get artists error:', error);
    res.status(500).json({ error: 'Failed to fetch artists' });
  }
}

// Public: Get artist by ID
export async function getArtistById(req, res) {
  try {
    const artistName = req.params.id;
    const tracks = await Music.find({ artist: artistName })
      .select('-ipfs.audioHash');
    
    res.json({
      artist: artistName,
      tracks
    });
  } catch (error) {
    console.error('Get artist error:', error);
    res.status(500).json({ error: 'Failed to fetch artist' });
  }
}

// Public: Get artist's music
export async function getArtistMusic(req, res) {
  try {
    const artistName = req.params.id;
    const music = await Music.find({ artist: artistName })
      .select('-ipfs.audioHash')
      .sort({ createdAt: -1 });
    
    res.json({ music });
  } catch (error) {
    console.error('Get artist music error:', error);
    res.status(500).json({ error: 'Failed to fetch artist music' });
  }
}

// Public: Verify blockchain purchase
export async function verifyPurchase(req, res) {
  try {
    const { trackId, txHash, buyerAddress } = req.body;
    
    if (!trackId || !txHash || !buyerAddress) {
      return res.status(400).json({ 
        error: 'Track ID, transaction hash, and buyer address required' 
      });
    }
    
    // Get track
    const track = await Music.findById(trackId);
    if (!track) {
      return res.status(404).json({ error: 'Track not found' });
    }
    
    // Verify transaction on blockchain
    const { provider } = await import('../config/blockchain.js');
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!receipt || receipt.status !== 1) {
      return res.status(400).json({ error: 'Invalid transaction' });
    }
    
    // Generate signed download URL (expires in 24 hours)
    const downloadToken = generateDownloadToken(trackId, buyerAddress);
    
    res.json({
      verified: true,
      downloadUrl: `/api/download/${trackId}/${downloadToken}`,
      expiresIn: '24h'
    });
    
  } catch (error) {
    console.error('Verify purchase error:', error);
    res.status(500).json({ error: 'Failed to verify purchase' });
  }
}

// Public: Download track (requires valid token)
export async function downloadTrack(req, res) {
  try {
    const { trackId, token } = req.params;
    
    // Verify download token
    if (!verifyDownloadToken(token, trackId)) {
      return res.status(403).json({ error: 'Invalid or expired download token' });
    }
    
    const track = await Music.findById(trackId);
    if (!track) {
      return res.status(404).json({ error: 'Track not found' });
    }
    
    // Return the actual download URL
    res.json({
      downloadUrl: track.ipfs.url || `https://${track.ipfs.cid}.ipfs.w3s.link`,
      filename: `${track.title}.mp3`
    });
    
  } catch (error) {
    console.error('Download track error:', error);
    res.status(500).json({ error: 'Failed to get download link' });
  }
}

// Admin: Upload new track
export async function uploadTrack(req, res) {
    try {
        const { title, artist, genre, price } = req.body;
        const file = req.file; // Changed from req.files to req.file for single file upload
        
        if (!file) {
            return res.status(400).json({ error: 'Audio file required' });
        }
        
        // Create File object for Web3.Storage
        const web3File = new File([file.buffer], file.originalname, {
            type: file.mimetype
        });
        
        // Upload to Web3.Storage
        const audioResult = await web3StorageService.uploadFile(web3File);
        
        // Create track in database (skip blockchain for now if not available)
        const track = new Music({
            title,
            artist,
            genre,
            price: price ? ethers.parseEther(price.toString()).toString() : '0',
            ipfs: {
                cid: audioResult.cid,
                url: audioResult.url
            },
            fileSize: file.size,
            mimeType: file.mimetype,
            isActive: true
        });
        
        await track.save();
        
        // Try to add to blockchain if available
        if (isMusicStoreAvailable()) {
            try {
                const musicStore = getMusicStoreContract();
                const priceInWei = ethers.parseEther(price || '0.001');
                const tx = await musicStore.addTrack(priceInWei, artist);
                const receipt = await tx.wait();
                
                // Update track with blockchain info
                track.blockchainId = receipt.logs[0]?.topics[1] || 'unknown';
                await track.save();
                
                console.log('Track added to blockchain:', tx.hash);
            } catch (blockchainError) {
                console.warn('Failed to add to blockchain:', blockchainError.message);
            }
        }
        
        res.json({
            message: 'Track uploaded successfully',
            track: {
                id: track._id,
                title: track.title,
                artist: track.artist,
                price: price || '0.001'
            }
        });
        
    } catch (error) {
        console.error('Upload track error:', error);
        res.status(500).json({ error: 'Failed to upload track' });
    }
}

// Helper functions
function generateDownloadToken(trackId, buyerAddress) {
  const payload = {
    trackId,
    buyerAddress,
    exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

function verifyDownloadToken(token, trackId) {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString());
    return payload.trackId === trackId && payload.exp > Date.now();
  } catch {
    return false;
  }
}