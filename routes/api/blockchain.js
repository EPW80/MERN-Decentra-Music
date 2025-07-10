// routes/api/blockchain.js
import express from "express";

const router = express.Router();

// Test endpoint
router.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "Blockchain endpoint test successful",
    data: {
      connected: false,
      note: "Basic endpoint working, blockchain integration pending",
    },
  });
});

// Stats endpoint
router.get("/stats", (req, res) => {
  res.json({
    success: true,
    message: "Stats endpoint working",
    data: {
      contractAddress: process.env.CONTRACT_ADDRESS,
      network: process.env.BLOCKCHAIN_NETWORK,
      chainId: process.env.CHAIN_ID,
      enabled: process.env.BLOCKCHAIN_ENABLED,
    },
  });
});

// Network endpoint
router.get("/network", (req, res) => {
  res.json({
    success: true,
    data: {
      name: process.env.BLOCKCHAIN_NETWORK,
      chainId: process.env.CHAIN_ID,
      rpcUrl: process.env.RPC_URL,
      contractAddress: process.env.CONTRACT_ADDRESS,
    },
  });
});

export default router;
