import hre from "hardhat";
const { ethers } = hre;
import fs from "fs";

async function main() {
    console.log("🚀 Deploying MusicStore to Sepolia testnet...");
    
    // Get deployer
    const [deployer] = await ethers.getSigners();
    console.log("📝 Deploying from address:", deployer.address);
    
    // Check balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");
    
    if (balance < ethers.parseEther("0.01")) {
        console.log("⚠️  Low balance warning! Get more test ETH from:");
        console.log("   - https://faucets.chain.link/sepolia");
        console.log("   - https://sepoliafaucet.com/");
        throw new Error("Insufficient balance for deployment");
    }
    
    // Get network info
    const network = await ethers.provider.getNetwork();
    console.log("🌐 Network:", network.name, "Chain ID:", network.chainId.toString());
    
    // Deploy contract
    console.log("🏭 Getting contract factory...");
    const MusicStore = await ethers.getContractFactory("MusicStore");
    
    console.log("🚀 Deploying contract...");
    const startTime = Date.now();
    
    const musicStore = await MusicStore.deploy(deployer.address, {
        gasLimit: 3000000,
        gasPrice: ethers.parseUnits("20", "gwei")
    });
    
    console.log("⏳ Waiting for deployment...");
    console.log("📝 Transaction hash:", musicStore.deploymentTransaction()?.hash);
    
    await musicStore.waitForDeployment();
    
    const contractAddress = await musicStore.getAddress();
    const endTime = Date.now();
    const deployTime = (endTime - startTime) / 1000;
    
    console.log("✅ MusicStore deployed successfully!");
    console.log("📍 Contract address:", contractAddress);
    console.log("⏱️  Deployment time:", deployTime, "seconds");
    console.log("🔗 Sepolia Etherscan:", `https://sepolia.etherscan.io/address/${contractAddress}`);
    
    // Verify deployment
    console.log("🔍 Verifying deployment...");
    try {
        const owner = await musicStore.owner();
        const platformFee = await musicStore.platformFee();
        const nextTrackId = await musicStore.nextTrackId();
        
        console.log("✅ Contract verification:");
        console.log("   - Owner:", owner);
        console.log("   - Platform fee:", platformFee.toString() / 100, "%");
        console.log("   - Next track ID:", nextTrackId.toString());
        
    } catch (error) {
        console.log("⚠️  Contract verification skipped:", error.message);
    }
    
    // Save deployment info
    const deploymentInfo = {
        contractAddress,
        network: {
            name: "sepolia",
            chainId: 11155111,
            rpcUrl: process.env.RPC_URL
        },
        deployment: {
            deployer: deployer.address,
            deployedAt: new Date().toISOString(),
            transactionHash: musicStore.deploymentTransaction()?.hash,
            deploymentTime: deployTime,
            gasUsed: musicStore.deploymentTransaction()?.gasLimit?.toString()
        },
        contract: {
            name: "MusicStore",
            version: "1.0.0",
            compiler: "0.8.20"
        },
        links: {
            etherscan: `https://sepolia.etherscan.io/address/${contractAddress}`,
            transaction: `https://sepolia.etherscan.io/tx/${musicStore.deploymentTransaction()?.hash}`
        }
    };
    
    // Save files
    fs.writeFileSync("./deployment-sepolia.json", JSON.stringify(deploymentInfo, null, 2));
    
    const envContent = `# MusicStore Sepolia Deployment
CONTRACT_ADDRESS=${contractAddress}
NETWORK=sepolia
CHAIN_ID=11155111
DEPLOYER_ADDRESS=${deployer.address}
DEPLOYED_AT=${new Date().toISOString()}
ETHERSCAN_URL=https://sepolia.etherscan.io/address/${contractAddress}`;
    
    fs.writeFileSync("./contract-sepolia.env", envContent);
    
    console.log("💾 Deployment info saved to:");
    console.log("   - deployment-sepolia.json");
    console.log("   - contract-sepolia.env");
    
    console.log("\n🎉 Sepolia deployment completed!");
    console.log("📱 Add to MetaMask: Contract Address", contractAddress);
    
    return contractAddress;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error.message);
        if (error.message.includes("insufficient funds")) {
            console.error("💡 Get test ETH from: https://faucets.chain.link/sepolia");
        }
        process.exit(1);
    });
