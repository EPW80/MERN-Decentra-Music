import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic route
app.get("/", (req, res) => {
  res.json({ message: "Decentra Music Backend API" });
});

// Test route to confirm server works
app.get("/test", (req, res) => {
  res.json({ message: "Server is working" });
});

// Add routes one by one to identify the problem

// 1. Try music routes first
try {
  console.log("Loading music routes...");
  const musicRoutes = await import("./routes/musicRoutes.js");
  app.use("/api/music", musicRoutes.default);
  console.log("✅ Music routes loaded successfully");
} catch (error) {
  console.error("❌ Failed to load music routes:", error.message);
}

// Comment out the other routes for now

try {
    console.log('Loading artist routes...');
    const artistRoutes = await import('./routes/artistRoutes.js');
    app.use('/api/artists', artistRoutes.default);
    console.log('✅ Artist routes loaded successfully');
} catch (error) {
    console.error('❌ Failed to load artist routes:', error.message);
}

try {
    console.log('Loading NFT routes...');
    const nftRoutes = await import('./routes/nftRoutes.js');
    app.use('/api/nfts', nftRoutes.default);
    console.log('✅ NFT routes loaded successfully');
} catch (error) {
    console.error('❌ Failed to load NFT routes:', error.message);
}


// MongoDB connection
const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/decentra-music";

mongoose
  .connect(mongoURI)
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
