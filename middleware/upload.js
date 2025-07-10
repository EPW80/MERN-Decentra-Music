import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

/**
 * Enhanced File Upload Middleware Configuration
 */

// Ensure uploads directory exists
const uploadsDir = "./uploads";
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("📁 Created uploads directory");
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate cryptographically secure filename
    const randomBytes = crypto.randomBytes(16).toString("hex");
    const timestamp = Date.now();
    const ext = path.extname(file.originalname).toLowerCase();

    // Remove potentially dangerous characters from original name
    const safeName = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .substring(0, 50); // Limit length

    const secureFilename = `${safeName}_${timestamp}_${randomBytes}${ext}`;
    cb(null, secureFilename);
  },
});

// Enhanced file filter for audio files
const fileFilter = (req, file, cb) => {
  console.log("📁 File filter check:", {
    fieldname: file.fieldname,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
  });

  // Allowed audio file types (more restrictive for security)
  const allowedTypes = [
    "audio/mpeg", // .mp3
    "audio/mp3", // .mp3 (alternative)
    "audio/wav", // .wav
    "audio/wave", // .wav (alternative)
    "audio/x-wav", // .wav (alternative)
    "audio/flac", // .flac
    "audio/x-flac", // .flac (alternative)
    "audio/aac", // .aac
    "audio/ogg", // .ogg
    "audio/webm", // .webm
  ];

  // Allowed file extensions (more secure than generic binary)
  const allowedExtensions = [".mp3", ".wav", ".flac", ".aac", ".ogg", ".webm"];
  const fileExt = path.extname(file.originalname).toLowerCase();

  // Security checks
  const securityChecks = {
    mimeTypeValid: allowedTypes.includes(file.mimetype),
    extensionValid: allowedExtensions.includes(fileExt),
    filenameSecure: !file.originalname.match(/[<>:"/\\|?*\x00-\x1f]/), // No dangerous chars
    extensionMatches: true, // We'll implement this below
  };

  // Additional security: Check if extension matches mime type
  const mimeToExtMap = {
    "audio/mpeg": [".mp3"],
    "audio/mp3": [".mp3"],
    "audio/wav": [".wav"],
    "audio/wave": [".wav"],
    "audio/x-wav": [".wav"],
    "audio/flac": [".flac"],
    "audio/x-flac": [".flac"],
    "audio/aac": [".aac"],
    "audio/ogg": [".ogg"],
    "audio/webm": [".webm"],
  };

  if (mimeToExtMap[file.mimetype]) {
    securityChecks.extensionMatches =
      mimeToExtMap[file.mimetype].includes(fileExt);
  }

  // Check all security conditions
  const isSecure = Object.values(securityChecks).every(
    (check) => check === true
  );

  if (isSecure) {
    console.log("✅ File accepted:", {
      mimetype: file.mimetype,
      extension: fileExt,
      checks: securityChecks,
    });
    cb(null, true);
  } else {
    console.log("❌ File rejected:", {
      mimetype: file.mimetype,
      extension: fileExt,
      checks: securityChecks,
    });

    const failedChecks = Object.entries(securityChecks)
      .filter(([key, value]) => value === false)
      .map(([key]) => key);

    cb(
      new Error(
        `Security check failed: ${failedChecks.join(
          ", "
        )}. Allowed types: ${allowedExtensions.join(", ")}`
      ),
      false
    );
  }
};

// Enhanced multer configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
    fieldSize: 10 * 1024 * 1024, // 10MB for text fields
    fieldNameSize: 100, // Limit field name length
    fields: 20, // Maximum number of fields
    files: 1, // Only one file per request
  },
});

// Enhanced error handling middleware
const handleUploadError = (error, req, res, next) => {
  console.error("❌ Upload error:", error);

  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case "LIMIT_FILE_SIZE":
        return res.status(400).json({
          success: false,
          error: "File too large",
          maxSize: "100MB",
          timestamp: new Date().toISOString(),
        });
      case "LIMIT_FILE_COUNT":
        return res.status(400).json({
          success: false,
          error: "Too many files",
          maxFiles: 1,
          timestamp: new Date().toISOString(),
        });
      case "LIMIT_UNEXPECTED_FILE":
        return res.status(400).json({
          success: false,
          error: "Unexpected file field",
          expectedField: "file",
          timestamp: new Date().toISOString(),
        });
      default:
        return res.status(400).json({
          success: false,
          error: "Upload error",
          details: error.message,
          timestamp: new Date().toISOString(),
        });
    }
  } else {
    return res.status(400).json({
      success: false,
      error: error.message || "File upload failed",
      timestamp: new Date().toISOString(),
    });
  }
};

// Export middleware with error handling
export const uploadSingle = (req, res, next) => {
  upload.single("file")(req, res, (error) => {
    if (error) {
      return handleUploadError(error, req, res, next);
    }
    next();
  });
};

// Export multer instance for custom configurations
export { upload };

console.log("✅ Enhanced upload middleware configured with security features");
