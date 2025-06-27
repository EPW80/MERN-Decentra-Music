import joi from "joi";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Environment Configuration and Validation
 */

// Environment schema
const envSchema = joi
  .object({
    // Application
    NODE_ENV: joi
      .string()
      .valid("development", "production", "test")
      .default("development"),

    PORT: joi.number().port().default(8000),

    BASE_URL: joi.string().uri().default("http://localhost:8000"),

    // Database
    MONGODB_URI: joi.string().required().messages({
      "any.required": "MONGODB_URI is required",
    }),

    // Security
    ADMIN_KEY: joi.string().min(32).required().messages({
      "any.required": "ADMIN_KEY is required for security",
      "string.min": "ADMIN_KEY must be at least 32 characters long",
    }),

    // Blockchain (optional when disabled)
    BLOCKCHAIN_ENABLED: joi.string().valid("true", "false").default("false"),

    PRIVATE_KEY: joi.when("BLOCKCHAIN_ENABLED", {
      is: "true",
      then: joi
        .string()
        .pattern(/^0x[a-fA-F0-9]{64}$/)
        .required()
        .messages({
          "string.pattern.base":
            "PRIVATE_KEY must be a valid 64-character hex string starting with 0x",
          "any.required": "PRIVATE_KEY is required when blockchain is enabled",
        }),
      otherwise: joi
        .string()
        .pattern(/^0x[a-fA-F0-9]{64}$/)
        .optional(),
    }),

    CONTRACT_ADDRESS: joi.when("BLOCKCHAIN_ENABLED", {
      is: "true",
      then: joi
        .string()
        .pattern(/^0x[a-fA-F0-9]{40}$/)
        .required()
        .messages({
          "string.pattern.base":
            "CONTRACT_ADDRESS must be a valid 40-character hex string starting with 0x",
          "any.required":
            "CONTRACT_ADDRESS is required when blockchain is enabled",
        }),
      otherwise: joi
        .string()
        .pattern(/^0x[a-fA-F0-9]{40}$/)
        .optional(),
    }),

    RPC_URL: joi.when("BLOCKCHAIN_ENABLED", {
      is: "true",
      then: joi.string().uri().required().messages({
        "any.required": "RPC_URL is required when blockchain is enabled",
      }),
      otherwise: joi.string().uri().optional(),
    }),

    // Storage
    STORAGE_PROVIDER: joi
      .string()
      .valid("local", "ipfs", "pinata", "nft_storage")
      .default("local"),

    // IPFS Settings (when using IPFS)
    IPFS_API_URL: joi.when("STORAGE_PROVIDER", {
      is: "ipfs",
      then: joi.string().uri().required(),
      otherwise: joi.string().uri().optional(),
    }),

    // Pinata Settings (when using Pinata)
    PINATA_JWT: joi.when("STORAGE_PROVIDER", {
      is: "pinata",
      then: joi.string().required(),
      otherwise: joi.string().optional(),
    }),

    // NFT.Storage Settings (when using NFT.Storage)
    NFT_STORAGE_TOKEN: joi.when("STORAGE_PROVIDER", {
      is: "nft_storage",
      then: joi.string().required(),
      otherwise: joi.string().optional(),
    }),

    // CORS
    ALLOWED_ORIGINS: joi
      .string()
      .optional()
      .description("Comma-separated list of allowed origins"),

    // File Upload
    MAX_FILE_SIZE: joi
      .number()
      .integer()
      .min(1024 * 1024) // Minimum 1MB
      .max(500 * 1024 * 1024) // Maximum 500MB
      .default(100 * 1024 * 1024), // Default 100MB

    UPLOAD_TEMP_DIR: joi.string().default("./uploads/temp"),

    // Logging
    LOG_LEVEL: joi
      .string()
      .valid("error", "warn", "info", "debug")
      .default("info"),

    // JWT Configuration
    JWT_SECRET: joi.string().min(64).required().messages({
      "any.required": "JWT_SECRET is required for authentication",
      "string.min": "JWT_SECRET must be at least 64 characters long",
    }),

    REFRESH_TOKEN_SECRET: joi.string().min(64).required().messages({
      "any.required": "REFRESH_TOKEN_SECRET is required",
      "string.min": "REFRESH_TOKEN_SECRET must be at least 64 characters long",
    }),

    JWT_EXPIRES_IN: joi
      .string()
      .pattern(/^\d+[smhd]$/)
      .default("24h")
      .messages({
        "string.pattern.base":
          "JWT_EXPIRES_IN must be a valid time string (e.g., 24h, 30m)",
      }),

    // Admin Authentication
    ADMIN_USERNAME: joi.string().min(3).required(),
    ADMIN_PASSWORD: joi.string().min(12).required().messages({
      "string.min": "ADMIN_PASSWORD must be at least 12 characters long",
    }),

    // ... rest of your existing schema
  })
  .unknown(true); // Allow unknown environment variables

/**
 * Validate environment variables
 */
export const validateEnv = () => {
  console.log("🔍 Validating environment configuration...");

  const { error, value } = envSchema.validate(process.env, {
    abortEarly: false,
    stripUnknown: false,
  });

  if (error) {
    console.error("❌ Environment validation failed:");
    error.details.forEach((detail) => {
      console.error(`   - ${detail.message}`);
    });

    // In production, fail fast
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Environment validation failed: ${error.message}`);
    } else {
      console.warn(
        "⚠️ Environment validation failed, but continuing in development mode"
      );
      console.warn("⚠️ Please fix these issues before deploying to production");
    }
  } else {
    console.log("✅ Environment validation passed");
  }

  // Log configuration summary (without sensitive data)
  const configSummary = {
    NODE_ENV: value.NODE_ENV,
    PORT: value.PORT,
    DATABASE: value.MONGODB_URI ? "configured" : "missing",
    BLOCKCHAIN_ENABLED: value.BLOCKCHAIN_ENABLED,
    STORAGE_PROVIDER: value.STORAGE_PROVIDER,
    ADMIN_KEY: value.ADMIN_KEY ? "configured" : "missing",
    PRIVATE_KEY: value.PRIVATE_KEY ? "configured" : "not set",
  };

  console.log("📋 Configuration summary:", configSummary);

  return value;
};

/**
 * Get validated configuration
 */
export const getConfig = () => {
  const config = validateEnv();

  return {
    // Application
    nodeEnv: config.NODE_ENV,
    port: config.PORT,
    baseUrl: config.BASE_URL,

    // Database
    mongoUri: config.MONGODB_URI,

    // Security
    adminKey: config.ADMIN_KEY,
    allowedOrigins: config.ALLOWED_ORIGINS
      ? config.ALLOWED_ORIGINS.split(",")
      : [],

    // Blockchain
    blockchain: {
      enabled: config.BLOCKCHAIN_ENABLED === "true",
      privateKey: config.PRIVATE_KEY,
      contractAddress: config.CONTRACT_ADDRESS,
      rpcUrl: config.RPC_URL,
    },

    // Storage
    storage: {
      provider: config.STORAGE_PROVIDER,
      ipfsApiUrl: config.IPFS_API_URL,
      pinataJwt: config.PINATA_JWT,
      nftStorageToken: config.NFT_STORAGE_TOKEN,
    },

    // Upload
    upload: {
      maxFileSize: config.MAX_FILE_SIZE,
      tempDir: config.UPLOAD_TEMP_DIR,
    },

    // Logging
    logLevel: config.LOG_LEVEL,
  };
};

console.log("✅ Environment configuration loaded");
