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

// Load contract ABI if available
try {
  const abiPath = join(__dirname, "../contracts/MusicStore.json");
  if (fs.existsSync(abiPath)) {
    MusicStoreABI = JSON.parse(fs.readFileSync(abiPath, "utf8"));
    console.log("MusicStore ABI loaded successfully");
  } else {
    console.warn(
      "MusicStore.json not found - contract features will be limited"
    );
  }
} catch (error) {
  console.warn("Failed to load MusicStore ABI:", error.message);
}

// Initialize wallet if private key is provided
if (process.env.PRIVATE_KEY) {
  try {
    const privateKey = process.env.PRIVATE_KEY.startsWith("0x")
      ? process.env.PRIVATE_KEY
      : `0x${process.env.PRIVATE_KEY}`;

    wallet = new ethers.Wallet(privateKey, provider);
    console.log("Wallet initialized successfully");
    console.log("Wallet address:", wallet.address);

    // Initialize MusicStore contract if address and ABI are available
    if (process.env.MUSIC_STORE_CONTRACT_ADDRESS && MusicStoreABI) {
      musicStoreContract = new ethers.Contract(
        process.env.MUSIC_STORE_CONTRACT_ADDRESS,
        MusicStoreABI.abi,
        wallet
      );
      console.log(
        "MusicStore contract initialized at:",
        process.env.MUSIC_STORE_CONTRACT_ADDRESS
      );
    } else if (!process.env.MUSIC_STORE_CONTRACT_ADDRESS) {
      console.warn("MUSIC_STORE_CONTRACT_ADDRESS not set in .env file");
    }
  } catch (error) {
    console.error("Failed to initialize wallet:", error.message);
    console.warn("Blockchain features will be disabled");
  }
} else {
  console.warn("No PRIVATE_KEY provided in .env file");
}

// Export functions
export const getContract = (contractAddress, abi) => {
  if (!wallet) {
    throw new Error("Wallet not initialized. Cannot create contract instance.");
  }

  if (!contractAddress || !abi) {
    throw new Error("Contract address and ABI are required.");
  }

  try {
    return new ethers.Contract(contractAddress, abi, wallet);
  } catch (error) {
    console.error("Failed to create contract instance:", error);
    throw error;
  }
};

export const getReadOnlyContract = (contractAddress, abi) => {
  if (!contractAddress || !abi) {
    throw new Error("Contract address and ABI are required.");
  }

  try {
    return new ethers.Contract(contractAddress, abi, provider);
  } catch (error) {
    console.error("Failed to create read-only contract instance:", error);
    throw error;
  }
};

export const getMusicStoreContract = () => {
  if (!musicStoreContract) {
    throw new Error(
      "MusicStore contract not initialized. Make sure MUSIC_STORE_CONTRACT_ADDRESS is set and contract is deployed."
    );
  }
  return musicStoreContract;
};

export const isWalletAvailable = () => {
  return wallet !== null;
};

export const isMusicStoreAvailable = () => {
  return musicStoreContract !== null;
};

export const getWalletAddress = () => {
  return wallet ? wallet.address : null;
};

export const getProviderNetwork = async () => {
  try {
    const network = await provider.getNetwork();
    return {
      name: network.name,
      chainId: network.chainId.toString(),
    };
  } catch (error) {
    console.error("Failed to get network info:", error);
    return null;
  }
};

export const getBalance = async (address) => {
  try {
    const balance = await provider.getBalance(address || wallet.address);
    return ethers.formatEther(balance);
  } catch (error) {
    console.error("Failed to get balance:", error);
    return "0";
  }
};

export { provider, wallet, musicStoreContract };
