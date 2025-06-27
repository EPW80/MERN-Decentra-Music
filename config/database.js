import mongoose from 'mongoose';

/**
 * Database Configuration and Connection
 */

let isConnected = false;

export const connectDB = async () => {
    if (isConnected) {
        console.log('✅ Database already connected');
        return;
    }

    try {
        console.log('🔄 Connecting to MongoDB...');
        
        const mongoUri = process.env.MONGODB_URI;
        
        if (!mongoUri) {
            throw new Error('MONGODB_URI is not defined in environment variables');
        }

        // Modern MongoDB connection options (compatible with MongoDB 4.0+)
        const options = {
            // No need for useNewUrlParser and useUnifiedTopology in newer versions
            serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
            socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
            maxPoolSize: 10, // Maintain up to 10 socket connections
            serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
            socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
            family: 4 // Use IPv4, skip trying IPv6
        };

        const conn = await mongoose.connect(mongoUri, options);
        
        isConnected = true;
        console.log('✅ MongoDB connected');
        console.log(`Database: ${conn.connection.name}`);
        console.log(`Host: ${conn.connection.host}`);
        
        // Connection event listeners
        mongoose.connection.on('connected', () => {
            console.log('📡 Mongoose connected to MongoDB');
            isConnected = true;
        });
        
        mongoose.connection.on('error', (err) => {
            console.error('❌ Mongoose connection error:', err);
            isConnected = false;
        });
        
        mongoose.connection.on('disconnected', () => {
            console.log('📡 Mongoose disconnected from MongoDB');
            isConnected = false;
        });
        
        mongoose.connection.on('reconnected', () => {
            console.log('📡 Mongoose reconnected to MongoDB');
            isConnected = true;
        });
        
        // Handle process termination gracefully
        const gracefulExit = async () => {
            try {
                await mongoose.connection.close();
                console.log('👋 MongoDB connection closed through app termination');
                process.exit(0);
            } catch (error) {
                console.error('❌ Error closing MongoDB connection:', error);
                process.exit(1);
            }
        };
        
        process.on('SIGINT', gracefulExit);
        process.on('SIGTERM', gracefulExit);
        process.on('SIGUSR2', gracefulExit); // For nodemon restarts

    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        isConnected = false;
        
        // In development, we might want to continue without DB for testing
        if (process.env.NODE_ENV === 'development') {
            console.log('⚠️ Continuing without database in development mode');
            console.log('⚠️ Some features may not work properly');
            return;
        }
        
        throw error;
    }
};

export const getConnectionStatus = () => {
    return {
        isConnected,
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host,
        name: mongoose.connection.name,
        port: mongoose.connection.port,
        states: {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        }[mongoose.connection.readyState]
    };
};

// Helper function to check if database is ready
export const isDatabaseReady = () => {
    return isConnected && mongoose.connection.readyState === 1;
};

// Helper function to wait for database connection
export const waitForDatabase = async (timeout = 10000) => {
    return new Promise((resolve, reject) => {
        if (isDatabaseReady()) {
            resolve(true);
            return;
        }
        
        const timer = setTimeout(() => {
            reject(new Error('Database connection timeout'));
        }, timeout);
        
        const checkConnection = () => {
            if (isDatabaseReady()) {
                clearTimeout(timer);
                resolve(true);
            } else {
                setTimeout(checkConnection, 100);
            }
        };
        
        checkConnection();
    });
};

console.log('✅ Database configuration loaded');
