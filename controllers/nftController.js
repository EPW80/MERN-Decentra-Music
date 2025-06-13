const Album = require("../models/Album");
const { getContract } = require("../config/blockchain");
const { uploadToIPFS } = require("../utils/ipfs");

// Create NFT album
exports.createAlbum = async (req, res) => {
  try {
    const { title, trackIds, price, totalSupply } = req.body;
    const coverFile = req.files?.cover;

    // Upload cover to IPFS
    const coverHash = coverFile ? await uploadToIPFS(coverFile.data) : null;

    // Create metadata
    const metadata = {
      title,
      artist: req.user.username,
      coverArt: coverHash,
      tracks: trackIds,
      createdAt: new Date().toISOString(),
    };

    const metadataHash = await uploadToIPFS(
      Buffer.from(JSON.stringify(metadata))
    );

    // Call smart contract
    const contract = await getContract();
    const tx = await contract.createAlbum(
      trackIds,
      ethers.utils.parseEther(price),
      totalSupply,
      metadataHash
    );
    const receipt = await tx.wait();

    // Get album ID from events
    const albumId = receipt.events[0].args.albumId.toNumber();

    // Save to MongoDB
    const album = new Album({
      blockchainId: albumId,
      title,
      artist: req.user.id,
      tracks: trackIds,
      coverArt: coverHash,
      price,
      totalSupply,
      minted: 0,
      metadata: metadataHash,
    });

    await album.save();
    res.json({ success: true, album });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all albums
exports.getAlbums = async (req, res) => {
  try {
    const albums = await Album.find()
      .populate("artist", "username walletAddress")
      .populate("tracks")
      .sort("-createdAt");

    res.json(albums);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get album details
exports.getAlbum = async (req, res) => {
  try {
    const album = await Album.findOne({ blockchainId: req.params.albumId })
      .populate("artist", "username walletAddress")
      .populate("tracks");

    if (!album) {
      return res.status(404).json({ error: "Album not found" });
    }

    // Get current minted count from blockchain
    const contract = await getContract();
    const albumData = await contract.albums(album.blockchainId);
    album.minted = albumData.minted.toNumber();

    res.json(album);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
