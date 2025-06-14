import express from 'express';
import auth from '../middleware/auth';
import * as nftController from '../controllers/nftController.js';

const router = express.Router();

// Mint new NFT
router.post('/mint', auth, nftController.mintNFT);

// Create album
router.post('/album', auth, nftController.createAlbum);

// Get all NFTs
router.get('/', nftController.getAllNFTs);

// Get NFT by ID
router.get('/:id', nftController.getNFTById);

// Get NFT by token ID
router.get('/token/:tokenId', nftController.getNFTByTokenId);

// Get NFTs by owner
router.get('/owner/:ownerAddress', nftController.getNFTsByOwner);

// Transfer NFT
router.post('/transfer', nftController.transferNFT);

// Update NFT metadata
router.put('/:id', nftController.updateNFT);

// Delete NFT record
router.delete('/:id', nftController.deleteNFT);

// Get all albums
router.get('/albums', nftController.getAlbums);

// Get album by ID
router.get('/album/:albumId', nftController.getAlbum);

export default router;
