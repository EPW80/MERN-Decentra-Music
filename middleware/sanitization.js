import { body, param, query, validationResult } from "express-validator";
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import mongoSanitize from "express-mongo-sanitize";

/**
 * Input Sanitization and XSS Protection Middleware
 */

// Create DOMPurify instance
const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

/**
 * Sanitize HTML content using DOMPurify
 */
export const sanitizeHtml = (dirty) => {
  if (typeof dirty !== "string") return dirty;

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [], // Remove all HTML tags
    ALLOWED_ATTR: [], // Remove all attributes
    KEEP_CONTENT: true, // Keep text content
  });
};

/**
 * Sanitize string for safe display (more permissive for descriptions)
 */
export const sanitizeText = (dirty) => {
  if (typeof dirty !== "string") return dirty;

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "br", "p"], // Allow basic formatting
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
};

/**
 * Deep sanitize object recursively
 */
export const deepSanitize = (obj) => {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === "string") {
    return sanitizeHtml(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepSanitize(item));
  }

  if (typeof obj === "object") {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize both keys and values
      const cleanKey = sanitizeHtml(key);
      sanitized[cleanKey] = deepSanitize(value);
    }
    return sanitized;
  }

  return obj;
};

/**
 * Express middleware for request sanitization
 */
export const sanitizeRequest = (req, res, next) => {
  try {
    // Sanitize request body
    if (req.body && typeof req.body === "object") {
      req.body = deepSanitize(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === "object") {
      req.query = deepSanitize(req.query);
    }

    // Sanitize URL parameters
    if (req.params && typeof req.params === "object") {
      req.params = deepSanitize(req.params);
    }

    next();
  } catch (error) {
    console.error("❌ Sanitization error:", error);
    res.status(400).json({
      success: false,
      error: "Invalid input data",
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * MongoDB injection protection
 */
export const mongoSanitizeMiddleware = mongoSanitize({
  replaceWith: "_",
  onSanitize: ({ req, key }) => {
    console.warn(
      `⚠️ MongoDB injection attempt detected: ${key} from ${req.ip}`
    );
  },
});

/**
 * Validation error handler
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    console.warn(`⚠️ Validation errors from ${req.ip}:`, errors.array());

    return res.status(400).json({
      success: false,
      error: "Validation failed",
      details: errors.array().map((error) => ({
        field: error.path,
        message: error.msg,
        value: error.value ? "***" : undefined, // Hide actual values for security
      })),
      timestamp: new Date().toISOString(),
    });
  }

  next();
};

/**
 * Track validation rules
 */
export const validateTrackInput = [
  body("title")
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Title must be between 1 and 200 characters")
    .matches(/^[a-zA-Z0-9\s\-_.,!?()]+$/)
    .withMessage("Title contains invalid characters"),

  body("artist")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Artist must be between 1 and 100 characters")
    .matches(/^[a-zA-Z0-9\s\-_.]+$/)
    .withMessage("Artist name contains invalid characters"),

  body("album")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Album name too long")
    .matches(/^[a-zA-Z0-9\s\-_.]*$/)
    .withMessage("Album name contains invalid characters"),

  body("genre")
    .trim()
    .isIn([
      "rock",
      "pop",
      "jazz",
      "classical",
      "electronic",
      "hip-hop",
      "country",
      "blues",
      "reggae",
      "folk",
      "other",
    ])
    .withMessage("Invalid genre selection"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description too long"),

  body("price")
    .optional()
    .isFloat({ min: 0, max: 1000 })
    .withMessage("Price must be between 0 and 1000"),

  body("tags")
    .optional()
    .isArray({ max: 10 })
    .withMessage("Too many tags (max 10)"),

  body("tags.*")
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Tag length invalid")
    .matches(/^[a-zA-Z0-9\-_]+$/)
    .withMessage(
      "Tags can only contain letters, numbers, hyphens, and underscores"
    ),

  handleValidationErrors,
];

/**
 * Search validation rules
 */
export const validateSearchInput = [
  query("search")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search term too long")
    .matches(/^[a-zA-Z0-9\s\-_.]*$/)
    .withMessage("Search contains invalid characters"),

  query("genre")
    .optional()
    .trim()
    .isIn([
      "rock",
      "pop",
      "jazz",
      "classical",
      "electronic",
      "hip-hop",
      "country",
      "blues",
      "reggae",
      "folk",
      "other",
      "all",
    ])
    .withMessage("Invalid genre filter"),

  query("artist")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Artist filter too long")
    .matches(/^[a-zA-Z0-9\s\-_.]*$/)
    .withMessage("Artist filter contains invalid characters"),

  query("page")
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage("Invalid page number"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Invalid limit (max 100)"),

  query("sortBy")
    .optional()
    .isIn(["createdAt", "title", "artist", "plays", "downloads"])
    .withMessage("Invalid sort field"),

  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Invalid sort order"),

  handleValidationErrors,
];

/**
 * Admin validation rules
 */
export const validateAdminInput = [
  body("username")
    .optional()
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage("Username must be between 3 and 50 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers, and underscores"),

  body("password")
    .optional()
    .isLength({ min: 12, max: 128 })
    .withMessage("Password must be between 12 and 128 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "Password must contain uppercase, lowercase, number, and special character"
    ),

  handleValidationErrors,
];

/**
 * ID parameter validation
 */
export const validateObjectId = [
  param("id").isMongoId().withMessage("Invalid ID format"),

  handleValidationErrors,
];

/**
 * File upload validation
 */
export const validateFileUpload = (req, res, next) => {
  try {
    // Skip validation if no file was uploaded (optional uploads)
    if (!req.file) {
      console.log("ℹ️ No file uploaded (optional)");
      return next();
    }

    const file = req.file;

    // Additional validation beyond multer
    const allowedMimeTypes = [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/wave",
      "audio/x-wav",
      "audio/flac",
      "audio/x-flac",
      "audio/aac",
      "audio/ogg",
      "audio/webm",
    ];

    // Double-check file type (belt and suspenders approach)
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        error: "Invalid file type detected in validation",
        allowedTypes: allowedMimeTypes,
        receivedType: file.mimetype,
        timestamp: new Date().toISOString(),
      });
    }

    // Validate file size again
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      return res.status(400).json({
        success: false,
        error: "File size exceeds limit",
        maxSize: "100MB",
        receivedSize: `${Math.round(file.size / 1024 / 1024)}MB`,
        timestamp: new Date().toISOString(),
      });
    }

    // Additional security: Check for minimum file size (avoid empty files)
    if (file.size < 1024) {
      // 1KB minimum
      return res.status(400).json({
        success: false,
        error: "File too small to be a valid audio file",
        minSize: "1KB",
        timestamp: new Date().toISOString(),
      });
    }

    console.log(
      `✅ File validated: ${file.originalname} (${Math.round(
        file.size / 1024
      )}KB, ${file.mimetype})`
    );
    next();
  } catch (error) {
    console.error("❌ File validation error:", error);
    res.status(400).json({
      success: false,
      error: "File validation failed",
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Response sanitization middleware
 */
export const sanitizeResponse = (req, res, next) => {
  const originalJson = res.json;

  res.json = function (data) {
    // Sanitize response data before sending
    if (data && typeof data === "object") {
      // Don't sanitize certain fields that might contain valid HTML/special chars
      const preserveFields = [
        "_id",
        "id",
        "createdAt",
        "updatedAt",
        "timestamp",
      ];

      const sanitizeResponseData = (obj) => {
        if (obj === null || obj === undefined) return obj;

        if (Array.isArray(obj)) {
          return obj.map((item) => sanitizeResponseData(item));
        }

        if (typeof obj === "object") {
          const sanitized = {};
          for (const [key, value] of Object.entries(obj)) {
            if (preserveFields.includes(key) || typeof value !== "string") {
              sanitized[key] = value;
            } else {
              sanitized[key] = sanitizeResponseData(value);
            }
          }
          return sanitized;
        }

        if (typeof obj === "string") {
          return sanitizeHtml(obj);
        }

        return obj;
      };

      data = sanitizeResponseData(data);
    }

    return originalJson.call(this, data);
  };

  next();
};

console.log("✅ Input sanitization middleware loaded");
