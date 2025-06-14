import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider(
  process.env.RPC_URL || "http://localhost:8545"
);

const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

export default {
  provider,
  wallet,
};
