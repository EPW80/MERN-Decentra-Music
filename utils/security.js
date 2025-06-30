import crypto from "crypto";
import bcrypt from "bcrypt";

/**
 * Security utility functions
 */

// Generate secure random strings
export const generateSecureKey = (length = 64) => {
  return crypto.randomBytes(length).toString("hex");
};

// Generate API keys
export const generateApiKey = () => {
  return generateSecureKey(32);
};

// Hash passwords/keys
export const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

// Verify passwords/keys
export const verifyPassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

// Sanitize file names
export const sanitizeFilename = (filename) => {
  // Remove dangerous characters
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .substring(0, 255);
};

// Validate admin key
export const validateAdminKey = (providedKey, expectedKey) => {
  if (!providedKey || !expectedKey) {
    return false;
  }

  // Use timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(providedKey),
    Buffer.from(expectedKey)
  );
};

// Generate CSRF tokens
export const generateCSRFToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

// Validate file types
export const validateFileType = (mimetype, allowedTypes) => {
  return allowedTypes.includes(mimetype);
};

// Check for suspicious patterns
export const detectSuspiciousActivity = (req) => {
  const suspiciousPatterns = [
    /(<script>|javascript:)/i,
    /(union|select|insert|delete|drop|create|alter)/i,
    /(\.\.|\/etc\/|\/var\/|\/usr\/)/i,
    /(exec|eval|system|shell)/i,
  ];

  const checkString = JSON.stringify({
    body: req.body,
    query: req.query,
    params: req.params,
  });

  return suspiciousPatterns.some((pattern) => pattern.test(checkString));
};

// Rate limiting key generator
export const generateRateLimitKey = (req) => {
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get("User-Agent") || "unknown";

  // Create a hash of IP + User-Agent for more granular limiting
  return crypto
    .createHash("sha256")
    .update(`${ip}-${userAgent}`)
    .digest("hex")
    .substring(0, 16);
};

console.log("✅ Security utilities loaded");
