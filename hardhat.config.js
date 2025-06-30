import '@nomicfoundation/hardhat-toolbox';
import dotenv from 'dotenv';

dotenv.config();

/** @type import('hardhat/config').HardhatUserConfig */
const config = {
    solidity: {
        version: '0.8.20',
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            },
            viaIR: true // Enable for better optimization
        }
    },
    networks: {
        hardhat: {
            chainId: 1337,
            accounts: {
                count: 10,
                accountsBalance: "10000000000000000000000" // 10000 ETH
            }
        },
        localhost: {
            url: 'http://127.0.0.1:8545',
            chainId: 1337,
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            timeout: 60000
        },
        sepolia: {
            url: process.env.RPC_URL || 'https://sepolia.infura.io/v3/YOUR_PROJECT_ID',
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            chainId: 11155111,
            gasPrice: 20000000000, // 20 gwei
            gasLimit: 3000000, // Changed from 'gas' to 'gasLimit'
            timeout: 120000, // 2 minutes timeout for Sepolia
            confirmations: 2 // Wait for 2 confirmations
        },
        mainnet: {
            url: process.env.MAINNET_RPC_URL || 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID',
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            chainId: 1,
            gasPrice: 30000000000, // 30 gwei
            gasLimit: 3000000, // Changed from 'gas' to 'gasLimit'
            timeout: 120000,
            confirmations: 3 // Wait for 3 confirmations on mainnet
        }
    },
    etherscan: {
        apiKey: {
            mainnet: process.env.ETHERSCAN_API_KEY,
            sepolia: process.env.ETHERSCAN_API_KEY
        },
        customChains: [
            {
                network: "sepolia",
                chainId: 11155111,
                urls: {
                    apiURL: "https://api-sepolia.etherscan.io/api",
                    browserURL: "https://sepolia.etherscan.io"
                }
            }
        ]
    },
    gasReporter: {
        enabled: process.env.REPORT_GAS !== undefined,
        currency: 'USD',
        gasPrice: 21,
        coinmarketcap: process.env.COINMARKETCAP_API_KEY,
        showTimeSpent: true,
        showMethodSig: true
    },
    mocha: {
        timeout: 60000 // Increased timeout for network operations
    },
    paths: {
        sources: './contracts',
        tests: './test',
        cache: './cache',
        artifacts: './artifacts'
    },
    // Add default network
    defaultNetwork: "hardhat"
};

export default config;