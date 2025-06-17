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
  res.json({
    message: "Decentra Music Backend API",
    version: "1.0.0",
    endpoints: {
      public: "/api",
      admin: "/api/admin",
    },
  });
});

// Load routes with error handling to identify the problematic one
try {
  console.log("Loading public routes...");
  const publicRoutes = await import("./routes/public.js");
  app.use("/api", publicRoutes.default);
  console.log("✅ Public routes loaded successfully");
} catch (error) {
  console.error("❌ Failed to load public routes:", error.message);
  console.error("Stack:", error.stack);
}

try {
  console.log("Loading admin routes...");
  const adminRoutes = await import("./routes/admin.js");
  const { adminAuth } = await import("./middleware/adminAuth.js");
  app.use("/api/admin", adminAuth, adminRoutes.default);
  console.log("✅ Admin routes loaded successfully");
} catch (error) {
  console.error("❌ Failed to load admin routes:", error.message);
  console.error("Stack:", error.stack);
}

// MongoDB connection
const mongoURI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/decentra-music";

mongoose
  .connect(mongoURI)
  .then(() => {
    console.log("MongoDB connected");
    console.log(`Database: ${mongoose.connection.name}`);
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    // Don't exit on MongoDB error during development
    console.warn("Continuing without MongoDB connection...");
  });

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Express error:", err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// Handle 404
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Public API: http://localhost:${PORT}/api`);
  console.log(`Admin API: http://localhost:${PORT}/api/admin`);
});

export default app;
