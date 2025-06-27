import multer from 'multer';
import path from 'path';
import fs from 'fs';

/**
 * File Upload Middleware Configuration
 */

// Ensure uploads directory exists
const uploadsDir = './uploads';
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('📁 Created uploads directory');
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        cb(null, `${name}-${uniqueSuffix}${ext}`);
    }
});

// File filter for audio files
const fileFilter = (req, file, cb) => {
    console.log('📁 File filter check:', {
        fieldname: file.fieldname,
        originalname: file.originalname,
        mimetype: file.mimetype
    });

    // Allowed audio file types
    const allowedTypes = [
        'audio/mpeg',           // .mp3
        'audio/mp3',            // .mp3 (alternative)
        'audio/wav',            // .wav
        'audio/wave',           // .wav (alternative)
        'audio/x-wav',          // .wav (alternative)
        'audio/flac',           // .flac
        'audio/x-flac',         // .flac (alternative)
        'audio/aac',            // .aac
        'audio/ogg',            // .ogg
        'audio/webm',           // .webm
        'application/octet-stream' // Generic binary (sometimes used for audio)
    ];

    // Check file extension as backup
    const allowedExtensions = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.webm'];
    const fileExt = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExt)) {
        console.log('✅ File accepted:', { mimetype: file.mimetype, extension: fileExt });
        cb(null, true);
    } else {
        console.log('❌ File rejected:', { mimetype: file.mimetype, extension: fileExt });
        cb(new Error(`Invalid file type. Allowed: ${allowedExtensions.join(', ')}`), false);
    }
};

// Configure multer
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit
        fieldSize: 10 * 1024 * 1024   // 10MB for text fields
    }
});

// Export middleware
export const uploadSingle = upload.single('file');

// Export multer instance for custom configurations
export { upload };

console.log('✅ Upload middleware configured');