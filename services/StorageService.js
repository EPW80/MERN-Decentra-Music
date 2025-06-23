import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Unified Storage Service
 * Supports multiple storage backends with consistent interface
 */
class StorageService {
  constructor() {
    this.provider = null;
    this.config = {};
    this.initialized = false;
  }

  /**
   * Initialize storage service with chosen provider
   */
  async initialize(provider = null) {
    this.provider = provider || process.env.STORAGE_PROVIDER || 'local';
    
    console.log(`🔄 Initializing storage: ${this.provider}`);
    
    try {
      switch (this.provider) {
        case 'local':
          await this.initializeLocal();
          break;
        case 'ipfs':
          await this.initializeIPFS();
          break;
        case 'web3storage':
          await this.initializeWeb3Storage();
          break;
        case 'pinata':
          await this.initializePinata();
          break;
        default:
          throw new Error(`Unsupported storage provider: ${this.provider}`);
      }
      
      this.initialized = true;
      console.log(`✅ Storage initialized: ${this.provider}`);
      
    } catch (error) {
      console.error(`❌ Storage initialization failed: ${error.message}`);
      
      // Fallback to local storage
      if (this.provider !== 'local') {
        console.log('🔄 Falling back to local storage...');
        this.provider = 'local';
        await this.initializeLocal();
        this.initialized = true;
      } else {
        throw error;
      }
    }
    
    return this.getStatus();
  }

  /**
   * Upload file using current provider
   */
  async uploadFile(file, metadata = {}) {
    if (!this.initialized) {
      throw new Error('Storage service not initialized');
    }

    const uploadData = {
      buffer: this.extractBuffer(file),
      filename: metadata.filename || file.originalname || 'untitled',
      mimetype: file.mimetype || 'application/octet-stream',
      size: file.size || (file.buffer ? file.buffer.length : 0),
      metadata
    };

    console.log(`📤 Uploading to ${this.provider}: ${uploadData.filename}`);

    switch (this.provider) {
      case 'local':
        return await this.uploadToLocal(uploadData);
      case 'ipfs':
        return await this.uploadToIPFS(uploadData);
      case 'web3storage':
        return await this.uploadToWeb3Storage(uploadData);
      case 'pinata':
        return await this.uploadToPinata(uploadData);
      default:
        throw new Error(`Upload not implemented for: ${this.provider}`);
    }
  }

  /**
   * Get file URL/access info
   */
  async getFileUrl(cid) {
    switch (this.provider) {
      case 'local':
        return `${this.config.baseUrl}/uploads/${cid.replace('local_', '')}`;
      case 'ipfs':
        return `https://ipfs.io/ipfs/${cid}`;
      case 'web3storage':
        return `https://${cid}.ipfs.w3s.link`;
      case 'pinata':
        return `https://gateway.pinata.cloud/ipfs/${cid}`;
      default:
        throw new Error(`URL generation not implemented for: ${this.provider}`);
    }
  }

  /**
   * Delete file (where supported)
   */
  async deleteFile(cid) {
    switch (this.provider) {
      case 'local':
        return await this.deleteFromLocal(cid);
      case 'ipfs':
        console.warn('IPFS files cannot be deleted (immutable)');
        return { success: false, reason: 'IPFS is immutable' };
      case 'web3storage':
      case 'pinata':
        console.warn('Deletion not implemented for', this.provider);
        return { success: false, reason: 'Deletion not supported' };
      default:
        throw new Error(`Delete not implemented for: ${this.provider}`);
    }
  }

  // ===== PROVIDER IMPLEMENTATIONS =====

  /**
   * Local Storage Implementation
   */
  async initializeLocal() {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    this.config = {
      uploadsDir,
      baseUrl: process.env.BASE_URL || 'http://localhost:8000'
    };
  }

  async uploadToLocal(uploadData) {
    const timestamp = Date.now();
    const sanitizedFilename = this.sanitizeFilename(uploadData.filename);
    const uniqueFilename = `${timestamp}-${sanitizedFilename}`;
    const filePath = path.join(this.config.uploadsDir, uniqueFilename);
    
    fs.writeFileSync(filePath, uploadData.buffer);
    
    const cid = `local_${Buffer.from(uniqueFilename).toString('base64').substring(0, 20)}`;
    const url = `${this.config.baseUrl}/uploads/${uniqueFilename}`;
    
    return {
      success: true,
      provider: 'local',
      cid,
      url,
      filename: uniqueFilename,
      originalFilename: uploadData.filename,
      size: uploadData.size,
      path: filePath,
      metadata: uploadData.metadata
    };
  }

  async deleteFromLocal(cid) {
    try {
      // Extract filename from CID or find file
      const files = fs.readdirSync(this.config.uploadsDir);
      const targetFile = files.find(file => 
        cid.includes(file) || Buffer.from(file).toString('base64').substring(0, 20) === cid.replace('local_', '')
      );
      
      if (targetFile) {
        const filePath = path.join(this.config.uploadsDir, targetFile);
        fs.unlinkSync(filePath);
        return { success: true, deleted: filePath };
      }
      
      return { success: false, reason: 'File not found' };
    } catch (error) {
      return { success: false, reason: error.message };
    }
  }

  /**
   * IPFS Implementation (using js-ipfs or HTTP API)
   */
  async initializeIPFS() {
    // Try to connect to local IPFS node first
    this.config = {
      apiUrl: process.env.IPFS_API_URL || 'http://localhost:5001',
      gatewayUrl: process.env.IPFS_GATEWAY_URL || 'https://ipfs.io'
    };
    
    // Test connection
    try {
      const response = await fetch(`${this.config.apiUrl}/api/v0/version`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('IPFS node not responding');
      }
      
      console.log('✅ Connected to IPFS node');
    } catch (error) {
      throw new Error(`IPFS connection failed: ${error.message}`);
    }
  }

  async uploadToIPFS(uploadData) {
    const formData = new FormData();
    const blob = new Blob([uploadData.buffer], { type: uploadData.mimetype });
    formData.append('file', blob, uploadData.filename);
    
    const response = await fetch(`${this.config.apiUrl}/api/v0/add`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`IPFS upload failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    const cid = result.Hash;
    const url = `${this.config.gatewayUrl}/ipfs/${cid}`;
    
    return {
      success: true,
      provider: 'ipfs',
      cid,
      url,
      filename: uploadData.filename,
      size: uploadData.size,
      metadata: uploadData.metadata
    };
  }

  /**
   * Web3.Storage Implementation
   */
  async initializeWeb3Storage() {
    if (!process.env.WEB3_STORAGE_TOKEN) {
      throw new Error('WEB3_STORAGE_TOKEN not set in environment');
    }
    
    try {
      // Check if package is available before importing
      const packageName = 'web3.storage';
      let Web3Storage;
      
      try {
        const module = await import(packageName);
        Web3Storage = module.Web3Storage;
      } catch (importError) {
        throw new Error(`Package '${packageName}' not installed. Run: npm install ${packageName}`);
      }
      
      this.config.client = new Web3Storage({ token: process.env.WEB3_STORAGE_TOKEN });
      console.log('✅ Web3.Storage client initialized');
    } catch (error) {
      throw new Error(`Web3.Storage initialization failed: ${error.message}`);
    }
  }

  async uploadToWeb3Storage(uploadData) {
    try {
      const file = new File([uploadData.buffer], uploadData.filename, {
        type: uploadData.mimetype
      });
      
      const cid = await this.config.client.put([file]);
      const url = `https://${cid}.ipfs.w3s.link/${uploadData.filename}`;
      
      return {
        success: true,
        provider: 'web3storage',
        cid,
        url,
        filename: uploadData.filename,
        size: uploadData.size,
        metadata: uploadData.metadata
      };
    } catch (error) {
      throw new Error(`Web3.Storage upload failed: ${error.message}`);
    }
  }

  /**
   * Pinata Implementation
   */
  async initializePinata() {
    if (!process.env.PINATA_JWT) {
      throw new Error('PINATA_JWT not set in environment');
    }
    
    this.config = {
      jwt: process.env.PINATA_JWT,
      apiUrl: 'https://api.pinata.cloud',
      gatewayUrl: process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud'
    };
  }

  async uploadToPinata(uploadData) {
    const formData = new FormData();
    const blob = new Blob([uploadData.buffer], { type: uploadData.mimetype });
    formData.append('file', blob, uploadData.filename);
    
    const metadata = JSON.stringify({
      name: uploadData.filename,
      keyvalues: uploadData.metadata
    });
    formData.append('pinataMetadata', metadata);
    
    const response = await fetch(`${this.config.apiUrl}/pinning/pinFileToIPFS`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.jwt}`
      },
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Pinata upload failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    const cid = result.IpfsHash;
    const url = `${this.config.gatewayUrl}/ipfs/${cid}`;
    
    return {
      success: true,
      provider: 'pinata',
      cid,
      url,
      filename: uploadData.filename,
      size: uploadData.size,
      metadata: uploadData.metadata
    };
  }

  // ===== UTILITY METHODS =====

  extractBuffer(file) {
    if (Buffer.isBuffer(file)) return file;
    if (file.buffer) return file.buffer;
    if (file.data) return file.data;
    throw new Error('Cannot extract buffer from file');
  }

  sanitizeFilename(filename) {
    return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  }

  getStatus() {
    return {
      provider: this.provider,
      initialized: this.initialized,
      config: {
        ...this.config,
        // Hide sensitive data
        jwt: this.config.jwt ? '***hidden***' : undefined,
        token: this.config.token ? '***hidden***' : undefined
      }
    };
  }
}

// Export singleton instance
const storageService = new StorageService();
export default storageService;