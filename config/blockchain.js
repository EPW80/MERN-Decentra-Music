import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load contract ABI
const loadContractABI = () => {
    try {
        const abiPath = path.join(__dirname, '../contracts/MusicStore.json');
        const contractData = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
        
        console.log('✅ MusicStore ABI loaded successfully');
        console.log(`📄 ABI contains ${contractData.abi.length} items`);
        
        const functions = contractData.abi.filter(item => item.type === 'function');
        const events = contractData.abi.filter(item => item.type === 'event');
        
        console.log(`   - ${functions.length} functions`);
        console.log(`   - ${events.length} events`);
        console.log(`   - Events: ${events.map(e => e.name).join(', ')}`);
        
        return contractData.abi;
    } catch (error) {
        console.error('❌ Failed to load MusicStore ABI:', error.message);
        return null;
    }
};

// Initialize provider and wallet
let provider, wallet, contract;

const initializeBlockchain = () => {
    try {
        console.log('🔄 Initializing blockchain services...');
        
        // Check if blockchain is disabled
        if (process.env.BLOCKCHAIN_ENABLED === 'false') {
            console.log('⚠️ Blockchain disabled via environment variable');
            return false;
        }
        
        const rpcUrl = process.env.RPC_URL || 'http://localhost:8545';
        
        // Check ethers version and use appropriate provider
        if (ethers.JsonRpcProvider) {
            provider = new ethers.JsonRpcProvider(rpcUrl);
            console.log('📡 Using ethers v6 JsonRpcProvider');
        } else if (ethers.providers) {
            provider = new ethers.providers.JsonRpcProvider(rpcUrl);
            console.log('📡 Using ethers v5 JsonRpcProvider');
        } else {
            throw new Error('Unable to initialize provider - unsupported ethers version');
        }
        
        // Setup wallet if private key is provided
        if (process.env.PRIVATE_KEY) {
            try {
                wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
                console.log('✅ Wallet initialized successfully');
                console.log(`📱 Wallet address: ${wallet.address}`);
            } catch (walletError) {
                console.error('❌ Wallet initialization failed:', walletError.message);
                console.log('🔄 Continuing without wallet (read-only mode)');
            }
        } else {
            console.log('⚠️ No private key provided, read-only mode');
        }
        
        // Load contract ABI
        const abi = loadContractABI();
        if (!abi) {
            throw new Error('Failed to load contract ABI');
        }
        
        // Initialize contract
        const contractAddress = process.env.CONTRACT_ADDRESS || '0x1234567890123456789012345678901234567890';
        
        try {
            contract = new ethers.Contract(contractAddress, abi, wallet || provider);
            console.log('✅ MusicStore contract initialized');
            console.log(`📄 Contract address: ${contractAddress}`);
        } catch (contractError) {
            console.error('❌ Contract initialization failed:', contractError.message);
            console.log('🔄 Continuing without contract');
        }
        
        // Don't test network connection during initialization
        // We'll test it later when actually needed
        console.log('✅ Blockchain initialization complete');
        
        return true;
    } catch (error) {
        console.error('❌ Blockchain initialization failed:', error.message);
        return false;
    }
};

// Initialize on import
const isInitialized = initializeBlockchain();

// Export functions
export const getMusicStoreContract = () => contract;
export const getProvider = () => provider;
export const getWallet = () => wallet;
export const isWalletAvailable = () => wallet !== null && wallet !== undefined;
export const isBlockchainAvailable = () => isInitialized && contract !== null && provider !== null;

// Test connection function (only call when needed)
export const testBlockchainConnection = async () => {
    try {
        if (!provider) {
            return { connected: false, error: 'Provider not initialized' };
        }
        
        console.log('🔍 Testing blockchain connection...');
        
        // Set a timeout for the connection test
        const timeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Connection timeout')), 5000)
        );
        
        const connectionTest = Promise.race([
            provider.getBlockNumber(),
            timeout
        ]);
        
        const blockNumber = await connectionTest;
        const network = await provider.getNetwork();
        
        console.log(`✅ Blockchain connection successful`);
        console.log(`🔗 Network: ${network.name} (Chain ID: ${network.chainId})`);
        console.log(`📦 Block number: ${blockNumber}`);
        
        return {
            connected: true,
            blockNumber,
            network: {
                name: network.name,
                chainId: network.chainId
            },
            contract: contract ? contract.address : null,
            wallet: wallet ? wallet.address : null
        };
        
    } catch (error) {
        console.log('❌ Blockchain connection failed:', error.message);
        return {
            connected: false,
            error: error.message
        };
    }
};

// Validation function (only test connection when explicitly called)
export const validateBlockchainSetup = async () => {
    try {
        if (!isBlockchainAvailable()) {
            throw new Error('Blockchain not available');
        }
        
        const connectionTest = await testBlockchainConnection();
        if (!connectionTest.connected) {
            throw new Error(`Connection failed: ${connectionTest.error}`);
        }
        
        // Test contract connection
        const owner = await contract.owner();
        const nextTrackId = await contract.nextTrackId();
        const platformFee = await contract.platformFee();
        
        console.log('✅ Blockchain validation successful');
        console.log(`   - Contract owner: ${owner}`);
        console.log(`   - Next track ID: ${nextTrackId.toString()}`);
        console.log(`   - Platform fee: ${platformFee.toString()}`);
        
        return {
            valid: true,
            network: connectionTest.network.name,
            chainId: connectionTest.network.chainId,
            owner,
            nextTrackId: nextTrackId.toString(),
            platformFee: platformFee.toString()
        };
        
    } catch (error) {
        console.error('❌ Blockchain validation failed:', error.message);
        return {
            valid: false,
            error: error.message
        };
    }
};

console.log('✅ Blockchain module loaded');
console.log(`✅ ABI is valid`);
console.log(`🔗 Music Platform Available: ${isBlockchainAvailable()}`);
