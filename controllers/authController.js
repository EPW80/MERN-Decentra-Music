const User = require("../models/User");
const jwt = require("jsonwebtoken");
const { ethers } = require("ethers");

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

// Verify signature
exports.login = async (req, res) => {
  try {
    const { walletAddress, signature, message } = req.body;

    // Verify signature
    const recoveredAddress = ethers.utils.verifyMessage(message, signature);

    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    // Find or create user
    let user = await User.findOne({
      walletAddress: walletAddress.toLowerCase(),
    });

    if (!user) {
      user = await User.create({
        walletAddress: walletAddress.toLowerCase(),
        username: `user_${walletAddress.slice(0, 8)}`,
      });
    }

    res.json({
      token: generateToken(user._id),
      user: {
        id: user._id,
        walletAddress: user.walletAddress,
        username: user.username,
        isArtist: user.isArtist,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update profile
exports.updateProfile = async (req, res) => {
  try {
    const { username, bio, isArtist } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { username, bio, isArtist },
      { new: true }
    );

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
