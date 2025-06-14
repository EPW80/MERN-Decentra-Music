import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";

// ES modules don't have __dirname, so we create it
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes - Note the .js extension is required for ES modules
import musicRoutes from "./routes/musicRoutes.js";
app.use("/api/music", musicRoutes);
import artistRoutes from './routes/artistRoutes.js';
app.use('/api/artists', artistRoutes);

// Basic route
app.get("/", (req, res) => {
  res.json({ message: "Decentra Music Backend API" });
});

// MongoDB connection
const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/decentra-music";

mongoose
  .connect(mongoURI)
  .then(() => {
    console.log("MongoDB connected");
    console.log(`Database: ${mongoose.connection.name}`);
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// Handle 404
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});

export default app;
