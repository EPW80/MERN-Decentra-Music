import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Basic route
app.get("/", (req, res) => {
  res.json({
    message: "Decentra Music Backend API",
    version: "1.0.0",
    endpoints: {
      public: "/api",
      admin: "/api/admin",
    },
  });
});

console.log("🚀 Starting server initialization...");

// Load routes
console.log("Loading public routes...");
try {
  const publicRoutes = await import("./routes/public.js");
  app.use("/api", publicRoutes.default);
  console.log("✅ Public routes loaded successfully");
} catch (error) {
  console.error("❌ Failed to load public routes:", error.message);
  process.exit(1);
}

console.log("Loading admin routes...");
try {
  const adminRoutes = await import("./routes/admin.js");
  app.use("/api/admin", adminRoutes.default);
  console.log("✅ Admin routes loaded successfully");
} catch (error) {
  console.error("❌ Failed to load admin routes:", error.message);
  process.exit(1);
}

console.log("✅ All routes loaded, starting MongoDB connection...");

// MongoDB connection with detailed error handling
const mongoURI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/decentra-music";

try {
  console.log("🔄 Connecting to MongoDB...");
  await mongoose.connect(mongoURI);
  console.log("✅ MongoDB connected");
  console.log(`Database: ${mongoose.connection.name}`);
} catch (err) {
  console.error("❌ MongoDB connection error:", err);
  console.log("⚠️ Continuing without MongoDB...");
}

console.log("✅ MongoDB setup complete, initializing services...");

// Initialize services with detailed error handling
try {
  console.log("🔍 Loading blockchain services...");
  const blockchainModule = await import("./config/blockchain.js");
  console.log("✅ Blockchain module loaded");

  const { validateABI, isMusicPlatformAvailable } = blockchainModule;

  const abiValidation = validateABI();
  if (abiValidation.valid) {
    console.log("✅ ABI is valid");
  } else {
    console.log("⚠️ ABI validation failed:", abiValidation.error);
  }

  console.log("🔗 Music Platform Available:", isMusicPlatformAvailable());
} catch (error) {
  console.error("❌ Blockchain service failed:", error.message);
}

try {
  console.log("🔍 Loading storage services...");
  const storageModule = await import("./config/storage.js");
  console.log("✅ Storage module loaded");

  await storageModule.default.initialize();
  console.log("✅ Storage service initialized");
} catch (error) {
  console.error("❌ Storage service failed:", error.message);
}

console.log("✅ All services initialized, setting up error handlers...");

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Express error:", err.stack);
  res.status(500).json({
    success: false,
    error: "Something went wrong!",
  });
});

// Handle 404
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
  });
});

console.log("🔄 Starting HTTP server...");

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Public API: http://localhost:${PORT}/api`);
  console.log(`🔐 Admin API: http://localhost:${PORT}/api/admin`);
  console.log("✅ Server startup complete!");
});

export default app;
