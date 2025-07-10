# Decentralized Music Streaming Backend

A comprehensive backend system for decentralized music streaming with blockchain integration, featuring track management, purchase verification, and artist royalty distribution.

## 🎵 Features

### Core Features
- **Track Management**: Upload, manage, and stream music tracks
- **Blockchain Integration**: Optional Ethereum blockchain integration for track ownership and purchases
- **Purchase Verification**: Comprehensive purchase verification system with blockchain event sync
- **Artist Royalty System**: Automated royalty distribution to artists
- **Service Layer Architecture**: Clean separation of concerns with dedicated service classes
- **Admin Dashboard**: Full administrative controls for track and user management
- **RESTful API**: Comprehensive API endpoints for all operations

### Technical Features
- **MongoDB Database**: Optimized database with proper indexing for performance
- **File Storage**: Multiple storage providers (local, IPFS, Web3Storage, Pinata)
- **Authentication**: JWT-based authentication with admin privileges
- **Input Validation**: Comprehensive validation using express-validator
- **Error Handling**: Consistent error handling with proper HTTP status codes
- **Blockchain Events**: Real-time blockchain event listening and synchronization
- **Analytics**: Track analytics and reporting capabilities

## 🏗️ Architecture

### Service Layer
- **TrackService**: Complete track business logic and operations
- **BlockchainService**: Ethereum blockchain integration and event handling
- **StorageService**: File upload and management across multiple providers
- **PurchaseService**: Purchase verification and blockchain event synchronization

### Controllers
- **trackController**: Public track operations (search, get, play counts)
- **adminController**: Administrative operations (upload, update, delete)
- **blockchainController**: Blockchain-specific operations
- **purchaseController**: Purchase verification and analytics

### Database Models
- **Track**: Enhanced track model with blockchain integration
- **Purchase**: Purchase records with blockchain verification
- **Artist**: Artist information and Ethereum addresses

## 📋 API Endpoints

### Public Endpoints
```
GET    /api/tracks              - Get all tracks (with filtering, pagination, search)
GET    /api/tracks/:id          - Get single track by ID
GET    /api/tracks/search/:query - Search tracks
GET    /api/tracks/genre/:genre - Get tracks by genre
GET    /api/tracks/artist/:artist - Get tracks by artist
POST   /api/tracks/:id/play     - Increment play count
GET    /api/tracks/:id/analytics - Get track analytics
```

### Admin Endpoints
```
POST   /admin/tracks/upload     - Upload new track
PUT    /admin/tracks/:id        - Update track
DELETE /admin/tracks/:id        - Delete track
GET    /admin/tracks            - Get all tracks (including inactive)
```

### Blockchain Endpoints
```
POST   /blockchain/tracks/:id/add - Add track to blockchain
GET    /blockchain/tracks/:contractId - Get track by blockchain contract ID
POST   /blockchain/tracks/:contractId/purchase - Purchase track
```

### Purchase Verification Endpoints
```
POST   /api/purchases/verify    - Verify purchase transaction
GET    /api/purchases/:txHash   - Get purchase details
GET    /api/purchases/user/:address - Get user's purchases
GET    /api/purchases/track/:trackId - Get track purchase history
```

## 🚀 Setup & Installation

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (v5.0 or higher)
- Ethereum wallet and RPC endpoint (for blockchain features)

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd decentra-music-backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Configuration**:
   Create a `.env` file with the following variables:
   ```env
   # Server Configuration
   PORT=3000
   NODE_ENV=development
   
   # Database
   MONGODB_URI=mongodb://localhost:27017/decentra-music
   
   # Authentication
   JWT_SECRET=your-jwt-secret-here
   ADMIN_KEY=your-admin-key-here
   
   # Blockchain Configuration (Optional)
   BLOCKCHAIN_ENABLED=true
   ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/your-project-id
   PRIVATE_KEY=your-private-key-here
   CONTRACT_ADDRESS=your-deployed-contract-address
   NETWORK_ID=11155111
   
   # Storage Configuration
   STORAGE_PROVIDER=local
   UPLOAD_PATH=./uploads
   MAX_FILE_SIZE=50000000
   
   # IPFS Configuration (Optional)
   IPFS_GATEWAY=https://ipfs.io/ipfs/
   WEB3_STORAGE_TOKEN=your-web3-storage-token
   PINATA_API_KEY=your-pinata-api-key
   PINATA_SECRET_KEY=your-pinata-secret-key
   ```

4. **Database Setup**:
   ```bash
   # Start MongoDB
   mongod
   
   # The application will automatically create indexes on startup
   ```

5. **Smart Contract Deployment** (Optional):
   ```bash
   # Compile contracts
   npx hardhat compile
   
   # Deploy to Sepolia testnet
   npx hardhat run scripts/deploy.js --network sepolia
   
   # Update CONTRACT_ADDRESS in .env file
   ```

6. **Start the server**:
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## 🔧 Configuration

### Blockchain Configuration
The system supports optional blockchain integration. Set `BLOCKCHAIN_ENABLED=true` to enable:
- Track ownership on Ethereum
- Purchase verification
- Artist royalty distribution
- Blockchain event synchronization

### Storage Providers
Multiple storage providers are supported:
- **local**: Local file system storage
- **ipfs**: IPFS distributed storage
- **web3storage**: Web3.Storage service
- **pinata**: Pinata IPFS service

### Database Indexes
The system automatically creates optimized indexes for:
- Text search across tracks
- Blockchain contract ID lookup
- Purchase transaction hash lookup
- Artist and genre filtering
- Performance optimization

## 📊 Usage Examples

### Upload a Track
```javascript
const formData = new FormData();
formData.append('title', 'My Song');
formData.append('artist', 'Artist Name');
formData.append('artistAddress', '0x123...'); // Optional for blockchain
formData.append('genre', 'rock');
formData.append('price', '0.001');
formData.append('file', audioFile);

const response = await fetch('/admin/tracks/upload', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-jwt-token'
  },
  body: formData
});
```

### Search Tracks
```javascript
const response = await fetch('/api/tracks/search/my%20song');
const { data: tracks } = await response.json();
```

### Verify Purchase
```javascript
const response = await fetch('/api/purchases/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    txHash: '0xabc123...',
    trackId: 'track-id-here'
  })
});
```

## 🧪 Testing

### API Testing
```bash
# Install testing dependencies
npm install --save-dev jest supertest

# Run tests
npm test
```

### Manual Testing
Use the provided Postman collection or test endpoints directly:
```bash
# Get all tracks
curl http://localhost:3000/api/tracks

# Search tracks
curl http://localhost:3000/api/tracks/search/rock

# Get track details
curl http://localhost:3000/api/tracks/TRACK_ID
```

## 📁 Project Structure

```
decentra-music-backend/
├── config/                 # Configuration files
│   ├── blockchain.js      # Blockchain configuration
│   ├── database.js        # Database configuration
│   └── env.js            # Environment variables
├── contracts/             # Smart contracts
│   ├── MusicStore.sol    # Main music store contract
│   └── test/             # Contract tests
├── controllers/           # HTTP request handlers
│   ├── trackController.js
│   ├── adminController.js
│   ├── blockchainController.js
│   └── purchaseController.js
├── middleware/            # Express middleware
│   ├── auth.js           # Authentication middleware
│   ├── validation.js     # Input validation
│   ├── security.js       # Security middleware
│   └── upload.js         # File upload handling
├── models/               # Database models
│   ├── Track.js          # Track model with blockchain integration
│   ├── Purchase.js       # Purchase verification model
│   └── Artist.js         # Artist model
├── routes/               # API routes
│   ├── api/              # Public API routes
│   ├── admin.js          # Admin routes
│   ├── blockchain.js     # Blockchain routes
│   └── index.js          # Main router
├── services/             # Business logic layer
│   ├── TrackService.js   # Track business logic
│   ├── BlockchainService.js # Blockchain operations
│   ├── StorageService.js # File storage management
│   └── PurchaseService.js # Purchase verification
├── scripts/              # Utility scripts
│   ├── deploy.js         # Contract deployment
│   └── generateAdminKey.js # Admin key generation
├── uploads/              # File uploads (local storage)
└── artifacts/            # Compiled contracts
```

## 🔐 Security Features

- **JWT Authentication**: Secure API access with JWT tokens
- **Input Validation**: Comprehensive validation for all inputs
- **Rate Limiting**: Protection against abuse and spam
- **File Upload Security**: Secure file handling with type validation
- **Blockchain Security**: Secure private key management
- **SQL Injection Protection**: MongoDB query sanitization

## 🚦 Error Handling

All API responses follow a consistent format:
```json
{
  "success": true|false,
  "data": {...},           // On success
  "message": "string",     // Human-readable message
  "error": "string",       // Error details (on failure)
  "pagination": {...}      // For paginated responses
}
```

HTTP Status Codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## 🎯 Performance Optimization

- **Database Indexes**: Optimized indexes for common queries
- **Pagination**: Efficient pagination for large datasets
- **Caching**: Response caching for frequently accessed data
- **File Compression**: Compressed file uploads
- **Blockchain Batching**: Efficient blockchain operations

## 📖 Documentation

Additional documentation available:
- [Service Layer Implementation](./SERVICE_LAYER_IMPLEMENTATION.md)
- [Blockchain Integration](./BLOCKCHAIN_FIX.md)
- [Purchase System](./PURCHASE_SYSTEM.md)
- [Database Optimization](./DATABASE_OPTIMIZATION.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🔗 Links

- [Smart Contract on Etherscan](https://sepolia.etherscan.io/address/YOUR_CONTRACT_ADDRESS)
- [API Documentation](./API_DOCS.md)
- [Deployment Guide](./DEPLOYMENT.md)

---

**Built with ❤️ for decentralized music streaming**
