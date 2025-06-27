import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function cleanIndexes() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        const db = mongoose.connection.db;
        const collection = db.collection('tracks');
        
        // Get all current indexes
        const indexes = await collection.indexes();
        console.log('📋 Current indexes:', indexes.map(i => i.name));
        
        // Drop any problematic indexes
        const problematicIndexes = ['blockchainId_1', 'blockchain.contractId_1'];
        
        for (const indexName of problematicIndexes) {
            try {
                await collection.dropIndex(indexName);
                console.log(`✅ Dropped index: ${indexName}`);
            } catch (error) {
                if (error.message.includes('index not found')) {
                    console.log(`⚠️ Index ${indexName} not found (already removed)`);
                } else {
                    console.error(`❌ Error dropping ${indexName}:`, error.message);
                }
            }
        }
        
        await mongoose.disconnect();
        console.log('✅ Index cleanup complete');
        
    } catch (error) {
        console.error('❌ Index cleanup failed:', error);
        process.exit(1);
    }
}

cleanIndexes();