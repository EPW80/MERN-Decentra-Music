import multer from 'multer';
import path from 'path';

console.log('🔄 Configuring upload middleware...');

// Configure multer for file uploads
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        console.log('📁 File filter check:', {
            fieldname: file.fieldname,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size
        });
        
        // Accept audio files - MP3 files often have different MIME types
        const allowedMimes = [
            'audio/mpeg',     // Standard MP3
            'audio/mp3',      // Alternative MP3
            'audio/mpeg3',    // Another MP3 variant
            'audio/x-mpeg-3', // Yet another MP3 variant
            'audio/wav', 
            'audio/mp4',
            'audio/aac',
            'audio/ogg',
            'audio/flac',
            'application/octet-stream' // Sometimes MP3s are detected as this
        ];
        
        // Also check file extension for MP3 files
        const fileExtension = path.extname(file.originalname).toLowerCase();
        const allowedExtensions = ['.mp3', '.wav', '.mp4', '.aac', '.ogg', '.flac'];
        
        if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
            console.log('✅ File accepted:', {
                mimetype: file.mimetype,
                extension: fileExtension
            });
            cb(null, true);
        } else {
            console.log('❌ File type rejected:', {
                mimetype: file.mimetype,
                extension: fileExtension,
                allowedMimes,
                allowedExtensions
            });
            cb(new Error(`File type not allowed: ${file.mimetype} (${fileExtension})`), false);
        }
    }
});

export const uploadMiddleware = upload.single('file');

console.log('✅ Upload middleware configured');