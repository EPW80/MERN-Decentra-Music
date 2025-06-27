import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./config/database.js";
import { getConfig } from "./config/env.js";

// Load environment variables first
dotenv.config();

// Validate environment configuration
let config;
try {
  config = getConfig();
} catch (error) {
  console.error("❌ Environment validation failed:", error.message);
  process.exit(1);
}

// Fix EventEmitter memory leak warning
process.setMaxListeners(20); // Increase from 15 to 20

const app = express();

console.log("🚀 Starting Decentra Music API Server...");
console.log(`🌍 Environment: ${config.nodeEnv}`);

// ===== MIDDLEWARE SETUP =====

// Security middleware
app.use((req, res, next) => {
  res.setHeader("X-Powered-By", "Decentra Music");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("API-Version", "v1");
  next();
});

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Serve static files
app.use("/uploads", express.static("uploads"));
console.log("📁 Static file serving enabled for /uploads");

// Request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const userAgent = req.get("User-Agent") || "Unknown";

  console.log(
    `📥 ${timestamp} | ${req.method} ${req.url} | ${req.ip} | ${userAgent.substring(
      0,
      50
    )}`
  );
  next();
});

// ===== CORE ENDPOINTS =====

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Decentra Music API",
    version: "1.0.0",
    endpoints: {
      api: "/api",
      tracks: "/api/tracks",
      admin: "/api/admin",
      blockchain: "/api/blockchain",
      auth: "/auth",
      health: "/health",
    },
    timestamp: new Date().toISOString(),
  });
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
  });
});

// ===== LOAD EXISTING ROUTES =====

console.log("Loading API routes...");
try {
  // Try to load v1 routes first
  let apiRoutes;
  try {
    const v1Routes = await import("./routes/v1/index.js");
    app.use("/api/v1", v1Routes.router);
    console.log("✅ API v1 routes loaded at /api/v1");

    // Also mount at /api for current compatibility
    app.use("/api", v1Routes.router);
    console.log("✅ API v1 routes also mounted at /api");
  } catch (v1Error) {
    console.log("⚠️ V1 routes not found, falling back to existing routes...");

    // Fallback to existing route structure
    const legacyRoutes = await import("./routes/index.js");
    app.use("/api", legacyRoutes.router);
    console.log("✅ Legacy API routes loaded at /api");
  }
} catch (error) {
  console.error("❌ Failed to load any API routes:", error);
  process.exit(1);
}

// ===== AUTHENTICATION ROUTES =====

console.log("Loading authentication routes...");
try {
  // Try v1 auth first, then fallback
  try {
    const authV1Routes = await import("./routes/auth/v1.js");
    app.use("/auth/v1", authV1Routes.router);
    console.log("✅ Auth v1 routes loaded at /auth/v1");
  } catch (authV1Error) {
    console.log("⚠️ Auth v1 routes not found, trying legacy auth...");
  }

  // Load legacy auth routes
  const authRoutes = await import("./routes/auth.js");
  app.use("/auth", authRoutes.router);
  console.log("✅ Auth routes loaded at /auth");
} catch (error) {
  console.warn("⚠️ Authentication routes not available:", error.message);
  console.log("🔄 Server will continue without auth routes");
}

console.log("✅ All available routes loaded, starting MongoDB connection...");

// ===== DATABASE CONNECTION =====

try {
  await connectDB();
  console.log("✅ MongoDB setup complete, initializing services...");
} catch (error) {
  console.error("❌ Database connection failed:", error);
  process.exit(1);
}

// ===== SERVICE INITIALIZATION =====

// Storage service
console.log("🔍 Loading storage services...");
try {
  const storageService = await import("./services/StorageService.js");
  const initResult = await storageService.default.initialize();

  if (initResult && initResult.success) {
    console.log("✅ Storage service ready:", initResult.provider);
  } else {
    throw new Error(
      `Storage initialization failed: ${initResult?.error || "Unknown error"}`
    );
  }
} catch (error) {
  console.error("❌ Storage service failed:", error.message);

  if (config.nodeEnv === "development") {
    console.log("⚠️ Continuing in development mode without storage service");
  } else {
    process.exit(1);
  }
}

// Blockchain service (optional)
if (config.blockchain.enabled) {
  console.log("🔍 Loading blockchain services...");
  try {
    const blockchainService = await import("./services/BlockchainService.js");
    const initResult = await blockchainService.default.initialize();

    if (initResult && initResult.success) {
      console.log("✅ Blockchain service loaded");
    } else {
      console.log(
        "⚠️ Blockchain service initialized with warnings:",
        initResult?.error
      );
    }
  } catch (error) {
    console.error("❌ Blockchain service failed:", error.message);
    console.log("🔄 Server will continue without blockchain features");
  }
} else {
  console.log("⚠️ Blockchain service disabled");
}

console.log("✅ All services initialized");

// ===== ERROR HANDLING =====

// Global error handler
app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  const isDevelopment = config.nodeEnv === "development";

  res.status(err.status || 500).json({
    success: false,
    error: isDevelopment ? err.message : "Internal server error",
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: {
      api: "/api",
      tracks: "/api/tracks",
      admin: "/api/admin",
      auth: "/auth",
      health: "/health",
    },
    timestamp: new Date().toISOString(),
  });
});

// ===== SERVER STARTUP =====

const server = app.listen(config.port, () => {
  console.log("🎉 Server startup complete!");
  console.log("┌─────────────────────────────────────────────┐");
  console.log("│            Decentra Music API               │");
  console.log("├─────────────────────────────────────────────┤");
  console.log(`│ 🚀 Server: ${config.baseUrl.padEnd(26)}│`);
  console.log(`│ 📡 API:     ${config.baseUrl}/api           │`);
  console.log(`│ 🔐 Auth:    ${config.baseUrl}/auth          │`);
  console.log(`│ 📁 Files:   ${config.baseUrl}/uploads/      │`);
  console.log(`│ ❤️  Health:  ${config.baseUrl}/health        │`);
  console.log("├─────────────────────────────────────────────┤");
  console.log(`│ 🌍 Environment: ${config.nodeEnv.padEnd(20)}│`);
  console.log(`│ 🔗 Database: Connected                      │`);
  console.log(`│ 📦 Storage: ${config.storage.provider.padEnd(22)}│`);
  console.log(`│ ⛓️  Blockchain: ${(config.blockchain.enabled ? "Enabled" : "Disabled").padEnd(16)}│`);
  console.log("└─────────────────────────────────────────────┘");
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n👋 Received ${signal}, shutting down gracefully...`);

  server.close(() => {
    console.log("✅ Server shutdown complete");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("❌ Forced shutdown after timeout");
    process.exit(1);
  }, 30000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
