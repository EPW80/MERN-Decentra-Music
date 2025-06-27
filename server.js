import express from 'express';
import dotenv from 'dotenv';
import { connectDB } from './config/database.js';

// Load environment variables first
dotenv.config();

const app = express();

console.log('🚀 Starting server initialization...');

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

// Load routes
console.log('Loading public routes...');
try {
    const publicRoutes = await import('./routes/public.js');
    app.use('/api', publicRoutes.router);
    console.log('✅ Public routes loaded successfully');
} catch (error) {
    console.error('❌ Failed to load public routes:', error);
    process.exit(1);
}

console.log('Loading admin routes...');
try {
    const adminRoutes = await import('./routes/admin.js');
    app.use('/api/admin', adminRoutes.router);
    console.log('✅ Admin routes loaded successfully');
} catch (error) {
    console.error('❌ Failed to load admin routes:', error);
    process.exit(1);
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
console.log('🔍 Loading blockchain services...');
try {
    const blockchainModule = await import('./config/blockchain.js');
    console.log('✅ Blockchain module loaded');
    
    if (blockchainModule.isWalletAvailable && blockchainModule.isWalletAvailable()) {
        const blockchainService = await import('./services/BlockchainService.js');
        const result = await blockchainService.default.initialize();
        
        if (result.success) {
            console.log('✅ Blockchain service ready');
        } else {
            console.log('⚠️ Blockchain service initialization failed:', result.error);
        }
    } else {
        console.log('⚠️ Blockchain service disabled (wallet not available)');
    }
} catch (error) {
    console.error('❌ Blockchain service failed:', error.message);
    console.log('🔄 Server will continue without blockchain features');
}

console.log('🔍 Loading storage services...');
try {
    const storageService = await import('./services/StorageService.js');
    const status = await storageService.default.getStatus();
    console.log('✅ Storage service ready:', status);
} catch (error) {
    console.error('❌ Storage service failed:', error);
    process.exit(1);
}

console.log('✅ All services initialized, setting up error handlers...');

// Global error handler
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err);
    
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    res.status(err.status || 500).json({
        success: false,
        error: isDevelopment ? err.message : 'Internal server error',
        ...(isDevelopment && { stack: err.stack })
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.originalUrl
    });
});

// Start server
console.log('🔄 Starting HTTP server...');
const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Public API: http://localhost:${PORT}/api`);
    console.log(`🔐 Admin API: http://localhost:${PORT}/api/admin`);
    console.log(`❤️ Health Check: http://localhost:${PORT}/health`);
    console.log('✅ Server startup complete!');
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('👋 SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('👋 SIGINT received, shutting down gracefully');
    process.exit(0);
});
