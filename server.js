import express from 'express';
import dotenv from 'dotenv';
import { connectDB } from './config/database.js';

// Load environment variables first
dotenv.config();

// Fix EventEmitter memory leak warning
process.setMaxListeners(15);

const app = express();

console.log('🚀 Starting server initialization...');

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));
console.log('📁 Static file serving enabled for /uploads');

// Simple request logger
app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.url}`);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Load consolidated API routes
console.log('Loading API routes...');
try {
    const apiRoutes = await import('./routes/index.js');
    app.use('/api', apiRoutes.router);
    console.log('✅ All API routes loaded successfully');
} catch (error) {
    console.error('❌ Failed to load API routes:', error);
    process.exit(1);
}

// Load authentication routes
console.log('Loading authentication routes...');
try {
    const authRoutes = await import('./routes/auth.js');
    app.use('/auth', authRoutes.router);
    console.log('✅ Authentication routes loaded at /auth');
} catch (error) {
    console.error('❌ Failed to load authentication routes:', error);
}

console.log('✅ All routes loaded, starting MongoDB connection...');

// Connect to database
try {
    await connectDB();
    console.log('✅ MongoDB setup complete, initializing services...');
} catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
}

// Initialize services
console.log('🔍 Loading storage services...');
try {
    const storageService = await import('./services/StorageService.js');
    const initResult = await storageService.default.initialize();
    
    if (initResult.success) {
        console.log('✅ Storage service ready:', initResult.provider);
    } else {
        throw new Error(`Storage initialization failed: ${initResult.error}`);
    }
} catch (error) {
    console.error('❌ Storage service failed:', error.message);
    process.exit(1);
}

// Initialize blockchain service (optional)
if (process.env.BLOCKCHAIN_ENABLED === 'true') {
    console.log('🔍 Loading blockchain services...');
    try {
        const blockchainService = await import('./services/BlockchainService.js');
        await blockchainService.default.initialize();
        console.log('✅ Blockchain service loaded');
    } catch (error) {
        console.error('❌ Blockchain service failed:', error.message);
        console.log('🔄 Server will continue without blockchain features');
    }
} else {
    console.log('⚠️ Blockchain service disabled');
}

console.log('✅ All services initialized');

// Global error handler
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err);
    
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    res.status(err.status || 500).json({
        success: false,
        error: isDevelopment ? err.message : 'Internal server error'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.originalUrl,
        availableEndpoints: {
            api: '/api',
            tracks: '/api/tracks',
            admin: '/api/admin',
            blockchain: '/api/blockchain',
            health: '/health'
        }
    });
});

// Start server
const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 API Base: http://localhost:${PORT}/api`);
    console.log(`🎵 Tracks: http://localhost:${PORT}/api/tracks`);
    console.log(`🔐 Admin: http://localhost:${PORT}/api/admin`);
    console.log(`⛓️ Blockchain: http://localhost:${PORT}/api/blockchain`);
    console.log(`📁 Files: http://localhost:${PORT}/uploads/`);
    console.log(`❤️ Health: http://localhost:${PORT}/health`);
    console.log('✅ Server startup complete!');
});

// Graceful shutdown
const gracefulShutdown = () => {
    console.log('👋 Shutting down gracefully...');
    process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
