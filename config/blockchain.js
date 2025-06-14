import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider(
  process.env.RPC_URL || "http://localhost:8545"
);

// Only create wallet if private key is provided and valid
let wallet = null;

if (process.env.PRIVATE_KEY) {
  try {
    // Ensure private key starts with 0x
    const privateKey = process.env.PRIVATE_KEY.startsWith("0x")
      ? process.env.PRIVATE_KEY
      : `0x${process.env.PRIVATE_KEY}`;

    wallet = new ethers.Wallet(privateKey, provider);
    console.log("Wallet initialized successfully");
  } catch (error) {
    console.warn("Failed to initialize wallet:", error.message);
    console.warn("Blockchain features will be limited");
  }
} else {
  console.warn("No PRIVATE_KEY provided in .env file");
}

// Add the getContract function
export const getContract = (contractAddress, abi) => {
  if (!wallet) {
    throw new Error("Wallet not initialized. Cannot create contract instance.");
  }
  return new ethers.Contract(contractAddress, abi, wallet);
};

export { provider, wallet };
