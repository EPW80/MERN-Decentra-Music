import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Contract Compilation Helper
 */

async function compileContracts() {
    console.log('🔨 Compiling smart contracts...');
    
    try {
        // Check if Hardhat is available
        const { stdout, stderr } = await execAsync('npx hardhat compile');
        
        if (stderr) {
            console.warn('⚠️ Compilation warnings:', stderr);
        }
        
        console.log('✅ Compilation output:');
        console.log(stdout);
        
        // Verify artifacts were created
        const artifactsPath = './artifacts/contracts/MusicStore.sol/MusicStore.json';
        if (fs.existsSync(artifactsPath)) {
            console.log('✅ Contract artifacts generated at:', artifactsPath);
            
            // Copy to contracts directory for deploy script compatibility
            const contractsDir = './contracts';
            if (!fs.existsSync(contractsDir)) {
                fs.mkdirSync(contractsDir, { recursive: true });
            }
            
            fs.copyFileSync(artifactsPath, './contracts/MusicStore.json');
            console.log('✅ Artifacts copied to ./contracts/MusicStore.json');
            
        } else {
            throw new Error('Contract artifacts not found after compilation');
        }
        
        console.log('🎉 Compilation completed successfully!');
        
    } catch (error) {
        console.error('❌ Compilation failed:', error.message);
        throw error;
    }
}

// Run compilation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    compileContracts()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

export { compileContracts };