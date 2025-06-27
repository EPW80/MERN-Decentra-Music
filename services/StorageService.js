import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
        
        // Return success status
        return {
            success: true,
            provider: this.provider,
            initialized: this.initialized,
            config: this.getStatus()
        };
        
    } catch (error) {
        console.error(`❌ Storage initialization failed: ${error.message}`);
        
        // Fallback to local storage
        if (this.provider !== 'local') {
            console.log('🔄 Falling back to local storage...');
            this.provider = 'local';
            await this.initializeLocal();
            this.initialized = true;
            
            return {
                success: true,
                provider: 'local',
                initialized: true,
                fallback: true,
                originalError: error.message,
                config: this.getStatus()
            };
        } else {
            // If local storage fails, that's a critical error
            this.initialized = false;
            return {
                success: false,
                error: error.message,
                provider: this.provider,
                initialized: false
            };
        }
    }
  }

  /**
   * Upload file using current provider
   */
  async uploadFile(file, metadata = {}) {
    if (!this.initialized) {
      console.log('⚠️ Storage not initialized, attempting to initialize...');
      await this.initialize();
    }

    // Handle different file input types
    let uploadData;
    
    if (file.path && fs.existsSync(file.path)) {
      // File uploaded by multer to disk
      const buffer = fs.readFileSync(file.path);
      uploadData = {
        buffer,
        filename: metadata.filename || file.originalname || `file-${Date.now()}`,
        mimetype: file.mimetype || 'application/octet-stream',
        size: file.size || buffer.length,
        metadata,
        tempPath: file.path // Store temp path for cleanup
      };
    } else if (file.buffer) {
      // File in memory
      uploadData = {
        buffer: file.buffer,
        filename: metadata.filename || file.originalname || `file-${Date.now()}`,
        mimetype: file.mimetype || 'application/octet-stream',
        size: file.size || file.buffer.length,
        metadata
      };
    } else {
      throw new Error('Invalid file object - no path or buffer found');
    }

    console.log(`📤 Uploading to ${this.provider}: ${uploadData.filename} (${uploadData.size} bytes)`);

    let result;
    switch (this.provider) {
      case 'local':
        result = await this.uploadToLocal(uploadData);
        break;
      case 'ipfs':
        result = await this.uploadToIPFS(uploadData);
        break;
      case 'web3storage':
        result = await this.uploadToWeb3Storage(uploadData);
        break;
      case 'pinata':
        result = await this.uploadToPinata(uploadData);
        break;
      default:
        throw new Error(`Upload not implemented for: ${this.provider}`);
    }

    // Clean up temp file if it exists
    if (uploadData.tempPath && fs.existsSync(uploadData.tempPath)) {
      try {
        fs.unlinkSync(uploadData.tempPath);
        console.log('🧹 Cleaned up temp file');
      } catch (error) {
        console.warn('⚠️ Failed to clean up temp file:', error.message);
      }
    }

    return result;
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
      console.log('📁 Created uploads directory:', uploadsDir);
    }
    
    this.config = {
      uploadsDir,
      baseUrl: process.env.BASE_URL || 'http://localhost:8000'
    };
    
    console.log('✅ Local storage configured:', {
      uploadsDir,
      baseUrl: this.config.baseUrl
    });
  }

  async uploadToLocal(uploadData) {
    try {
      const timestamp = Date.now();
      const random = Math.round(Math.random() * 1E9);
      const ext = path.extname(uploadData.filename);
      const baseName = path.basename(uploadData.filename, ext);
      const sanitizedBaseName = this.sanitizeFilename(baseName);
      const uniqueFilename = `${sanitizedBaseName}-${timestamp}-${random}${ext}`;
      
      const filePath = path.join(this.config.uploadsDir, uniqueFilename);
      
      // Write file to uploads directory
      fs.writeFileSync(filePath, uploadData.buffer);
      
      // Get file stats
      const stats = fs.statSync(filePath);
      
      const cid = `local_${Buffer.from(uniqueFilename).toString('base64').substring(0, 20)}`;
      const url = `${this.config.baseUrl}/uploads/${uniqueFilename}`;
      
      console.log('✅ Local upload successful:', {
        filename: uniqueFilename,
        size: stats.size,
        url
      });
      
      return {
        success: true,
        provider: 'local',
        cid,
        url,
        filename: uniqueFilename,
        originalFilename: uploadData.filename,
        size: stats.size,
        path: filePath,
        metadata: uploadData.metadata
      };
    } catch (error) {
      console.error('❌ Local upload failed:', error);
      throw new Error(`Local storage upload failed: ${error.message}`);
    }
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
        console.log('🗑️ File deleted:', targetFile);
        return { success: true, deleted: filePath };
      }
      
      return { success: false, reason: 'File not found' };
    } catch (error) {
      console.error('❌ Delete failed:', error);
      return { success: false, reason: error.message };
    }
  }

  /**
   * IPFS Implementation (using HTTP API)
   */
  async initializeIPFS() {
    // Try to connect to local IPFS node first
    this.config = {
      apiUrl: process.env.IPFS_API_URL || 'http://localhost:5001',
      gatewayUrl: process.env.IPFS_GATEWAY_URL || 'https://ipfs.io'
    };
    
    // Test connection
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.config.apiUrl}/api/v0/version`, {
        method: 'POST',
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      if (!response.ok) {
        throw new Error('IPFS node not responding');
      }
      
      console.log('✅ Connected to IPFS node');
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('IPFS connection timeout');
      }
      throw new Error(`IPFS connection failed: ${error.message}`);
    }
  }

  async uploadToIPFS(uploadData) {
    try {
      // Create FormData for IPFS API
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
    } catch (error) {
      throw new Error(`IPFS upload failed: ${error.message}`);
    }
  }

  /**
   * Web3.Storage Implementation
   */
  async initializeWeb3Storage() {
    if (!process.env.WEB3_STORAGE_TOKEN) {
      throw new Error('WEB3_STORAGE_TOKEN not set in environment');
    }
    
    try {
      // Dynamic import with error handling
      const { Web3Storage } = await import('web3.storage').catch(() => {
        throw new Error('web3.storage package not installed. Run: npm install web3.storage');
      });
      
      this.config.client = new Web3Storage({ token: process.env.WEB3_STORAGE_TOKEN });
      console.log('✅ Web3.Storage client initialized');
    } catch (error) {
      throw new Error(`Web3.Storage initialization failed: ${error.message}`);
    }
  }

  async uploadToWeb3Storage(uploadData) {
    try {
      // Web3.Storage expects File objects
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
    
    console.log('✅ Pinata configured');
  }

  async uploadToPinata(uploadData) {
    try {
      const formData = new FormData();
      const blob = new Blob([uploadData.buffer], { type: uploadData.mimetype });
      formData.append('file', blob, uploadData.filename);
      
      const metadata = JSON.stringify({
        name: uploadData.filename,
        keyvalues: uploadData.metadata || {}
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
        const errorText = await response.text();
        throw new Error(`Pinata upload failed: ${response.statusText} - ${errorText}`);
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
    } catch (error) {
      throw new Error(`Pinata upload failed: ${error.message}`);
    }
  }

  // ===== UTILITY METHODS =====

  sanitizeFilename(filename) {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .substring(0, 255);
  }

  getStatus() {
    return {
      provider: this.provider,
      initialized: this.initialized,
      config: {
        uploadsDir: this.config.uploadsDir,
        baseUrl: this.config.baseUrl,
        apiUrl: this.config.apiUrl,
        gatewayUrl: this.config.gatewayUrl,
        // Hide sensitive data
        jwt: this.config.jwt ? 'configured' : undefined,
        token: this.config.token ? 'configured' : undefined,
        client: this.config.client ? 'initialized' : undefined
      }
    };
  }
}

// Export singleton instance
const storageService = new StorageService();
export default storageService;

console.log('✅ Storage service loaded');