import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import xss from "xss-clean";

/**
 * Comprehensive Security Middleware
 */

// CORS Configuration
export const corsMiddleware = cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      "http://localhost:3000", // React dev server
      "http://localhost:3001", // Alternative React port
      "http://127.0.0.1:3000",
      "https://localhost:3000",
      ...(process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(",")
        : []),
    ];

    if (process.env.NODE_ENV === "development") {
      // Allow all origins in development
      return callback(null, true);
    }

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS blocked origin: ${origin}`);
      callback(new Error("CORS policy violation"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
    "x-admin-key",
    "x-api-key",
  ],
  exposedHeaders: ["X-Total-Count"],
  maxAge: 86400, // 24 hours
});

// Rate Limiting - Different limits for different endpoints
export const createRateLimit = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: message || "Too many requests, please try again later",
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting for admin requests in development
    skip: (req) => {
      if (
        process.env.NODE_ENV === "development" &&
        req.headers["x-admin-key"]
      ) {
        return true;
      }
      return false;
    },
  });

// General rate limit
export const generalRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests per window
  "Too many requests from this IP"
);

// Strict rate limit for authentication endpoints
export const authRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5, // 5 attempts per window
  "Too many authentication attempts"
);

// Upload rate limit
export const uploadRateLimit = createRateLimit(
  60 * 60 * 1000, // 1 hour
  10, // 10 uploads per hour
  "Too many upload attempts"
);

// Admin rate limit (more lenient)
export const adminRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  200, // 200 requests per window
  "Too many admin requests"
);

// Helmet configuration
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow file uploads
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

// Security middleware collection
export const securityMiddleware = [
  helmetMiddleware,
  corsMiddleware,
  generalRateLimit,
  mongoSanitize({
    allowDots: true,
    replaceWith: "_",
  }),
  hpp({
    whitelist: ["sort", "fields", "page", "limit", "genre", "artist"],
  }),
  xss(),
];

// Admin security middleware
export const adminSecurityMiddleware = [
  helmetMiddleware,
  corsMiddleware,
  adminRateLimit,
  mongoSanitize(),
  hpp(),
  xss(),
];

// Upload security middleware
export const uploadSecurityMiddleware = [
  helmetMiddleware,
  corsMiddleware,
  uploadRateLimit,
  mongoSanitize(),
  xss(),
];

console.log("✅ Security middleware loaded");
