import multer from 'multer';

// Configure multer for memory storage
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept audio files only
        if (file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed!'), false);
        }
    }
});

// Export the middleware
export const uploadMiddleware = upload.single('track');

// Optional: Export additional configurations for different use cases
export const uploadMultiple = upload.array('tracks', 10); // For multiple files
export const uploadFields = upload.fields([
    { name: 'track', maxCount: 1 },
    { name: 'cover', maxCount: 1 }
]); // For both audio and cover image

// Optional: Export error handler for multer errors
export const handleUploadError = (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ 
                error: 'File too large. Maximum size is 50MB.' 
            });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ 
                error: 'Too many files uploaded.' 
            });
        }
        if (error.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({ 
                error: 'Unexpected field name in form data.' 
            });
        }
    }
    
    if (error.message === 'Only audio files are allowed!') {
        return res.status(400).json({ 
            error: 'Invalid file type. Only audio files are allowed.' 
        });
    }
    
    next(error);
};