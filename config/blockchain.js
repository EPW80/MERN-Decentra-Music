import { ethers } from 'ethers';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const provider = new ethers.JsonRpcProvider(
    process.env.RPC_URL || 'http://localhost:8545'
);

let wallet = null;
let musicPlatformContract = null;
let MusicPlatformABI = null;

// Load contract ABI with better error handling
try {
    const abiPath = join(__dirname, '../contracts/MusicPlatform.json');
    if (fs.existsSync(abiPath)) {
        const contractData = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
        
        // Check if ABI exists and is not empty
        if (contractData.abi && Array.isArray(contractData.abi) && contractData.abi.length > 0) {
            MusicPlatformABI = contractData;
            console.log('✅ MusicPlatform ABI loaded successfully');
            console.log(`📄 ABI contains ${contractData.abi.length} functions/events`);
        } else {
            console.error('❌ MusicPlatform ABI is empty or invalid!');
            console.log('🔧 Please add the contract ABI to contracts/MusicPlatform.json');
        }
    } else {
        console.warn('⚠️ MusicPlatform.json not found at:', abiPath);
        console.log('🔧 Please create the contract ABI file');
    }
} catch (error) {
    console.error('❌ Failed to load MusicPlatform ABI:', error.message);
}

// Initialize wallet if private key is provided
if (process.env.PRIVATE_KEY) {
    try {
        const privateKey = process.env.PRIVATE_KEY.startsWith('0x') 
            ? process.env.PRIVATE_KEY 
            : `0x${process.env.PRIVATE_KEY}`;
        
        wallet = new ethers.Wallet(privateKey, provider);
        console.log('✅ Wallet initialized successfully');
        console.log('📱 Wallet address:', wallet.address);
        
        // Initialize MusicPlatform contract if address and ABI are available
        if (process.env.MUSIC_PLATFORM_CONTRACT_ADDRESS && MusicPlatformABI) {
            musicPlatformContract = new ethers.Contract(
                process.env.MUSIC_PLATFORM_CONTRACT_ADDRESS,
                MusicPlatformABI.abi,
                wallet
            );
            console.log('✅ MusicPlatform contract initialized');
            console.log('📄 Contract address:', process.env.MUSIC_PLATFORM_CONTRACT_ADDRESS);
        } else if (!process.env.MUSIC_PLATFORM_CONTRACT_ADDRESS) {
            console.warn('⚠️ MUSIC_PLATFORM_CONTRACT_ADDRESS not set in .env file');
        }
        
    } catch (error) {
        console.error('❌ Failed to initialize wallet:', error.message);
        console.warn('⚠️ Blockchain features will be disabled');
    }
} else {
    console.warn('⚠️ No PRIVATE_KEY provided in .env file');
}

// Export functions
export const getContract = (contractAddress, abi) => {
    if (!wallet) {
        throw new Error('Wallet not initialized. Cannot create contract instance.');
    }
    
    if (!contractAddress || !abi) {
        throw new Error('Contract address and ABI are required.');
    }
    
    try {
        return new ethers.Contract(contractAddress, abi, wallet);
    } catch (error) {
        console.error('Failed to create contract instance:', error);
        throw error;
    }
};

export const getMusicPlatformContract = () => {
    if (!musicPlatformContract) {
        throw new Error('MusicPlatform contract not initialized. Check ABI file and contract address.');
    }
    return musicPlatformContract;
};

export const isMusicPlatformAvailable = () => {
    return musicPlatformContract !== null;
};

export const isWalletAvailable = () => {
    return wallet !== null;
};

export const getWalletAddress = () => {
    return wallet ? wallet.address : null;
};

export const validateABI = () => {
    if (!MusicPlatformABI || !MusicPlatformABI.abi || MusicPlatformABI.abi.length === 0) {
        return {
            valid: false,
            error: 'ABI is empty or invalid'
        };
    }
    
    // Check for required functions
    const requiredFunctions = ['addTrack', 'purchaseTrack', 'hasPurchased'];
    const availableFunctions = MusicPlatformABI.abi
        .filter(item => item.type === 'function')
        .map(item => item.name);
    
    const missingFunctions = requiredFunctions.filter(
        func => !availableFunctions.includes(func)
    );
    
    if (missingFunctions.length > 0) {
        return {
            valid: false,
            error: `Missing required functions: ${missingFunctions.join(', ')}`
        };
    }
    
    return {
        valid: true,
        functions: availableFunctions.length,
        events: MusicPlatformABI.abi.filter(item => item.type === 'event').length
    };
};

export { provider, wallet, musicPlatformContract };