import { ethers } from "ethers";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const provider = new ethers.JsonRpcProvider(
  process.env.RPC_URL || "http://localhost:8545"
);

let wallet = null;
let musicStoreContract = null;
let MusicStoreABI = null;

// Load contract ABI
try {
  const abiPath = join(__dirname, "../contracts/MusicStore.json");
  if (fs.existsSync(abiPath)) {
    const contractData = JSON.parse(fs.readFileSync(abiPath, "utf8"));

    if (
      contractData.abi &&
      Array.isArray(contractData.abi) &&
      contractData.abi.length > 0
    ) {
      MusicStoreABI = contractData;

      // Count functions and events
      const functions = contractData.abi.filter(
        (item) => item.type === "function"
      ).length;
      const events = contractData.abi.filter((item) => item.type === "event")
        .length;

      console.log("🔄 Initializing blockchain services...");
      console.log("✅ MusicStore ABI loaded successfully");
      console.log(`📄 ABI contains ${contractData.abi.length} items`);
      console.log(`   - ${functions} functions`);
      console.log(`   - ${events} events`);
    } else {
      console.error("❌ MusicStore ABI is empty or invalid!");
    }
  } else {
    console.warn("⚠️ MusicStore.json not found at:", abiPath);
  }
} catch (error) {
  console.error("❌ Failed to load MusicStore ABI:", error.message);
}

// Initialize wallet
if (process.env.PRIVATE_KEY) {
  try {
    const privateKey = process.env.PRIVATE_KEY.startsWith("0x")
      ? process.env.PRIVATE_KEY
      : `0x${process.env.PRIVATE_KEY}`;

    wallet = new ethers.Wallet(privateKey, provider);
    console.log("✅ Wallet initialized successfully");
    console.log("📱 Wallet address:", wallet.address);

    // Initialize contract
    if (process.env.MUSIC_STORE_CONTRACT_ADDRESS && MusicStoreABI) {
      musicStoreContract = new ethers.Contract(
        process.env.MUSIC_STORE_CONTRACT_ADDRESS,
        MusicStoreABI.abi,
        wallet
      );
      console.log("✅ MusicStore contract initialized");
      console.log("📄 Contract address:", process.env.MUSIC_STORE_CONTRACT_ADDRESS);
      console.log("🔗 Network: localhost");
      console.log("✅ Blockchain initialization complete");
    } else if (!process.env.MUSIC_STORE_CONTRACT_ADDRESS) {
      console.warn("⚠️ MUSIC_STORE_CONTRACT_ADDRESS not set in .env file");
    }
  } catch (error) {
    console.error("❌ Failed to initialize wallet:", error.message);
  }
} else {
  console.warn("⚠️ No PRIVATE_KEY provided in .env file");
}

// Export functions with consistent naming
export const getContract = (contractAddress, abi) => {
  if (!wallet) {
    throw new Error("Wallet not initialized");
  }
  return new ethers.Contract(contractAddress, abi, wallet);
};

export const getMusicStoreContract = () => {
  if (!musicStoreContract) {
    throw new Error("MusicStore contract not initialized");
  }
  return musicStoreContract;
};

// Fix the naming - use consistent function names
export const isMusicPlatformAvailable = () => {
  return musicStoreContract !== null;
};

export const isMusicStoreAvailable = () => {
  return musicStoreContract !== null;
};

export const isWalletAvailable = () => {
  return wallet !== null;
};

export const getWalletAddress = () => {
  return wallet ? wallet.address : null;
};

export const validateABI = () => {
  if (!MusicStoreABI || !MusicStoreABI.abi || MusicStoreABI.abi.length === 0) {
    return {
      valid: false,
      error: "ABI is empty or invalid",
    };
  }

  const functions = MusicStoreABI.abi.filter(
    (item) => item.type === "function"
  ).length;
  const events = MusicStoreABI.abi.filter((item) => item.type === "event")
    .length;

  return {
    valid: true,
    functions,
    events,
    total: MusicStoreABI.abi.length,
  };
};

export { provider, wallet, musicStoreContract as musicPlatformContract };
