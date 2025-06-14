import { create } from "@web3-storage/w3up-client";

class Web3StorageService {
    constructor() {
        this.client = null;
        this.space = null;
    }

    async initialize() {
        try {
            // Create the client
            this.client = await create();

            // Login with email (you'll need to set this in your .env)
            const account = await this.client.login(process.env.WEB3_STORAGE_EMAIL);
            
            // Wait for payment plan
            await account.plan.wait();

            // Create or use existing space
            this.space = await this.client.createSpace("decentra-music-space", { account });
            
            console.log("Web3.Storage initialized successfully");
            return this.client;
        } catch (error) {
            console.error("Failed to initialize Web3.Storage:", error);
            throw error;
        }
    }

    async uploadFile(file) {
        if (!this.client) {
            await this.initialize();
        }

        try {
            const cid = await this.client.uploadFile(file);
            return {
                cid: cid.toString(),
                url: `https://${cid}.ipfs.w3s.link`
            };
        } catch (error) {
            console.error("Failed to upload file:", error);
            throw error;
        }
    }

    async uploadDirectory(files) {
        if (!this.client) {
            await this.initialize();
        }

        try {
            const cid = await this.client.uploadDirectory(files);
            return {
                cid: cid.toString(),
                url: `https://${cid}.ipfs.w3s.link`
            };
        } catch (error) {
            console.error("Failed to upload directory:", error);
            throw error;
        }
    }
}

export default new Web3StorageService();