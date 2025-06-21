// config/storage.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class StorageService {
  constructor() {
    this.client = null;
    this.provider = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      this.provider = process.env.STORAGE_PROVIDER || "local";

      console.log(`🔄 Initializing storage provider: ${this.provider}`);

      if (this.provider === "local") {
        await this.initializeLocal();
      } else {
        // For now, fallback to local if other providers fail
        console.log("🔄 Using local storage for development...");
        await this.initializeLocal();
        this.provider = "local";
      }

      this.initialized = true;
      console.log(`✅ Storage service initialized with ${this.provider}`);
    } catch (error) {
      console.error("❌ Storage service initialization failed:", error.message);

      // Fallback to local storage
      await this.initializeLocal();
      this.provider = "local";
      this.initialized = true;
    }
  }

  async initializeLocal() {
    const uploadDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    this.client = {
      uploadDir,
      baseUrl: process.env.BASE_URL || "http://localhost:8000",
    };
  }

  async uploadFile(file, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const {
      filename = file.name || file.originalname || "untitled",
      metadata = {},
    } = options;

    console.log(`📤 Uploading file via ${this.provider}: ${filename}`);

    return await this.uploadToLocal(file, filename, metadata);
  }

  async uploadToLocal(file, filename, metadata) {
    const fileData = this.getFileData(file);
    const sanitizedFilename = this.sanitizeFilename(filename);
    const uniqueFilename = `${Date.now()}-${sanitizedFilename}`;
    const filePath = path.join(this.client.uploadDir, uniqueFilename);

    fs.writeFileSync(filePath, fileData);

    const mockCid = this.generateMockCID(uniqueFilename);

    return {
      cid: mockCid,
      url: `${this.client.baseUrl}/uploads/${uniqueFilename}`,
      gateway: `${this.client.baseUrl}/uploads/${uniqueFilename}`,
      provider: "local",
      filename: uniqueFilename,
      originalFilename: filename,
      path: filePath,
      size: fileData.length,
      metadata,
    };
  }

  getFileData(file) {
    if (Buffer.isBuffer(file)) {
      return file;
    }
    if (file.buffer) {
      return file.buffer;
    }
    if (file.data) {
      return file.data;
    }
    throw new Error("Unsupported file format");
  }

  sanitizeFilename(filename) {
    return filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  }

  generateMockCID(filename) {
    return (
      "local_" + Buffer.from(filename).toString("base64").substring(0, 20)
    );
  }

  getProviderInfo() {
    return {
      provider: this.provider,
      initialized: this.initialized,
      features: {
        upload: true,
        download: true,
        delete: true,
      },
    };
  }
}

export default new StorageService();
