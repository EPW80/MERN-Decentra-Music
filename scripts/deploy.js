import { ethers } from "ethers";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

async function deployMusicStore() {
  try {
    // Connect to network
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    console.log("Deploying from address:", wallet.address);
    console.log(
      "Balance:",
      ethers.formatEther(await provider.getBalance(wallet.address))
    );

    // Read contract bytecode and ABI (you'll need to compile first)
    const contractJson = JSON.parse(
      fs.readFileSync("./contracts/MusicStore.json", "utf8")
    );

    // Deploy contract
    const contractFactory = new ethers.ContractFactory(
      contractJson.abi,
      contractJson.bytecode,
      wallet
    );

    console.log("Deploying MusicStore contract...");
    const contract = await contractFactory.deploy();
    await contract.waitForDeployment();

    const contractAddress = await contract.getAddress();
    console.log("MusicStore deployed to:", contractAddress);

    // Save deployment info
    const deploymentInfo = {
      contractAddress,
      network: process.env.RPC_URL,
      deployedAt: new Date().toISOString(),
      deployer: wallet.address,
    };

    fs.writeFileSync(
      "./deployment.json",
      JSON.stringify(deploymentInfo, null, 2)
    );

    return contractAddress;
  } catch (error) {
    console.error("Deployment failed:", error);
    throw error;
  }
}

// Run deployment
deployMusicStore()
  .then((address) => console.log("Deployment successful!", address))
  .catch((error) => console.error("Deployment failed:", error));
