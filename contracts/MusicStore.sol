// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;  // Updated to match OpenZeppelin v5.x

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title MusicStore
 * @dev Secure decentralized music marketplace with comprehensive security measures
 */
contract MusicStore is Ownable, ReentrancyGuard, Pausable {
    
    // ===== STRUCTS =====
    
    struct Track {
        uint256 price;
        address artist;
        bool isActive;
        uint256 totalSales;
        uint256 createdAt;
        string metadataHash; // IPFS hash for additional metadata
    }
    
    struct ArtistInfo {
        uint256 totalEarnings;
        uint256 totalTracks;
        bool isVerified;
        uint256 joinedAt;
    }

    // ===== STATE VARIABLES =====
    
    mapping(uint256 => Track) public tracks;
    mapping(address => mapping(uint256 => bool)) public purchases;
    mapping(address => uint256) public artistBalances;
    mapping(address => ArtistInfo) public artists;
    mapping(address => bool) public authorizedOperators; // For platform operations
    
    uint256 public platformFee = 250; // 2.5% (out of 10000)
    uint256 public constant MAX_PLATFORM_FEE = 1000; // 10% maximum
    uint256 public constant MIN_TRACK_PRICE = 0.001 ether; // Minimum track price
    uint256 public constant MAX_TRACK_PRICE = 100 ether; // Maximum track price
    uint256 public nextTrackId = 1;
    uint256 public totalPlatformFees;
    
    // ===== EVENTS =====
    
    event TrackAdded(
        uint256 indexed trackId, 
        address indexed artist, 
        uint256 price, 
        string metadataHash,
        uint256 timestamp
    );
    
    event TrackPurchased(
        uint256 indexed trackId, 
        address indexed buyer, 
        address indexed artist,
        uint256 price,
        uint256 artistPayment,
        uint256 platformFee,
        uint256 timestamp
    );
    
    event Withdrawal(
        address indexed artist, 
        uint256 amount, 
        uint256 timestamp
    );
    
    event PlatformFeesWithdrawn(
        address indexed owner,
        uint256 amount,
        uint256 timestamp
    );
    
    event TrackUpdated(
        uint256 indexed trackId,
        uint256 oldPrice,
        uint256 newPrice,
        bool wasActive,
        bool isActive,
        uint256 timestamp
    );
    
    event ArtistVerified(address indexed artist, uint256 timestamp);
    event OperatorAdded(address indexed operator, uint256 timestamp);
    event OperatorRemoved(address indexed operator, uint256 timestamp);
    event EmergencyWithdrawal(address indexed to, uint256 amount, uint256 timestamp);

    // ===== MODIFIERS =====
    
    modifier onlyArtistOrOwner(uint256 trackId) {
        Track storage track = tracks[trackId];
        require(
            track.artist == msg.sender || 
            msg.sender == owner() || 
            authorizedOperators[msg.sender],
            "Not authorized"
        );
        _;
    }
    
    modifier validTrackId(uint256 trackId) {
        require(trackId > 0 && trackId < nextTrackId, "Invalid track ID");
        _;
    }
    
    modifier validPrice(uint256 price) {
        require(price >= MIN_TRACK_PRICE && price <= MAX_TRACK_PRICE, "Invalid price range");
        _;
    }

    // ===== CONSTRUCTOR =====
    
    constructor(address initialOwner) Ownable(initialOwner) {
        // OpenZeppelin v5.x requires explicit owner in constructor
    }

    // ===== TRACK MANAGEMENT =====
    
    /**
     * @dev Add a new track to the marketplace
     */
    function addTrack(
        uint256 price, 
        address artist, 
        string calldata metadataHash
    ) 
        external 
        onlyOwner 
        validPrice(price) 
        whenNotPaused 
        returns (uint256) 
    {
        require(artist != address(0), "Invalid artist address");
        require(bytes(metadataHash).length > 0, "Metadata hash required");
        
        uint256 trackId = nextTrackId;
        nextTrackId += 1;
        
        tracks[trackId] = Track({
            price: price,
            artist: artist,
            isActive: true,
            totalSales: 0,
            createdAt: block.timestamp,
            metadataHash: metadataHash
        });
        
        // Update artist info
        if (artists[artist].joinedAt == 0) {
            artists[artist].joinedAt = block.timestamp;
        }
        artists[artist].totalTracks += 1;
        
        emit TrackAdded(trackId, artist, price, metadataHash, block.timestamp);
        return trackId;
    }
    
    /**
     * @dev Purchase a track (SECURE VERSION)
     */
    function purchaseTrack(uint256 trackId) 
        external 
        payable 
        nonReentrant 
        validTrackId(trackId) 
        whenNotPaused 
    {
        Track storage track = tracks[trackId];
        require(track.isActive, "Track not available");
        require(msg.value >= track.price, "Insufficient payment");
        require(!purchases[msg.sender][trackId], "Already purchased");
        require(msg.sender != track.artist, "Artists cannot purchase own tracks");
        
        // Calculate amounts FIRST (before state changes)
        uint256 trackPrice = track.price;
        uint256 refundAmount = msg.value - trackPrice;
        uint256 platformFeeAmount = (trackPrice * platformFee) / 10000;
        uint256 artistPayment = trackPrice - platformFeeAmount;
        
        // UPDATE STATE (follow checks-effects-interactions pattern)
        purchases[msg.sender][trackId] = true;
        track.totalSales += 1;
        artistBalances[track.artist] += artistPayment;
        artists[track.artist].totalEarnings += artistPayment;
        totalPlatformFees += platformFeeAmount;
        
        // EMIT EVENT
        emit TrackPurchased(
            trackId, 
            msg.sender, 
            track.artist,
            trackPrice,
            artistPayment,
            platformFeeAmount,
            block.timestamp
        );
        
        // EXTERNAL INTERACTIONS LAST (refund excess payment)
        if (refundAmount > 0) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: refundAmount}("");
            require(refundSuccess, "Refund failed");
        }
    }
    
    /**
     * @dev Update track price (artist or owner only)
     */
    function updateTrackPrice(uint256 trackId, uint256 newPrice) 
        external 
        validTrackId(trackId) 
        onlyArtistOrOwner(trackId) 
        validPrice(newPrice) 
        whenNotPaused 
    {
        Track storage track = tracks[trackId];
        uint256 oldPrice = track.price;
        track.price = newPrice;
        
        emit TrackUpdated(
            trackId, 
            oldPrice, 
            newPrice, 
            track.isActive, 
            track.isActive, 
            block.timestamp
        );
    }
    
    /**
     * @dev Activate/deactivate track
     */
    function setTrackActive(uint256 trackId, bool isActive) 
        external 
        validTrackId(trackId) 
        onlyArtistOrOwner(trackId) 
        whenNotPaused 
    {
        Track storage track = tracks[trackId];
        bool wasActive = track.isActive;
        track.isActive = isActive;
        
        emit TrackUpdated(
            trackId, 
            track.price, 
            track.price, 
            wasActive, 
            isActive, 
            block.timestamp
        );
    }

    // ===== FINANCIAL OPERATIONS =====
    
    /**
     * @dev Withdraw artist earnings (SECURE VERSION)
     */
    function withdrawArtistBalance() external nonReentrant whenNotPaused {
        uint256 balance = artistBalances[msg.sender];
        require(balance > 0, "No balance to withdraw");
        
        // UPDATE STATE FIRST
        artistBalances[msg.sender] = 0;
        
        // EXTERNAL INTERACTION LAST
        (bool success, ) = payable(msg.sender).call{value: balance}("");
        require(success, "Withdrawal failed");
        
        emit Withdrawal(msg.sender, balance, block.timestamp);
    }
    
    /**
     * @dev Withdraw platform fees (owner only, SECURE VERSION)
     */
    function withdrawPlatformFees() external onlyOwner nonReentrant {
        uint256 amount = totalPlatformFees;
        require(amount > 0, "No fees to withdraw");
        
        // UPDATE STATE FIRST
        totalPlatformFees = 0;
        
        // EXTERNAL INTERACTION LAST
        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Platform fee withdrawal failed");
        
        emit PlatformFeesWithdrawn(owner(), amount, block.timestamp);
    }
    
    /**
     * @dev Emergency withdrawal (owner only, when paused)
     */
    function emergencyWithdraw(address to) external onlyOwner whenPaused {
        require(to != address(0), "Invalid address");
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");
        
        (bool success, ) = payable(to).call{value: balance}("");
        require(success, "Emergency withdrawal failed");
        
        emit EmergencyWithdrawal(to, balance, block.timestamp);
    }

    // ===== ADMIN FUNCTIONS =====
    
    /**
     * @dev Update platform fee (owner only)
     */
    function updatePlatformFee(uint256 newFee) external onlyOwner {
        require(newFee <= MAX_PLATFORM_FEE, "Fee exceeds maximum");
        platformFee = newFee;
    }
    
    /**
     * @dev Add authorized operator
     */
    function addOperator(address operator) external onlyOwner {
        require(operator != address(0), "Invalid operator address");
        require(!authorizedOperators[operator], "Already authorized");
        
        authorizedOperators[operator] = true;
        emit OperatorAdded(operator, block.timestamp);
    }
    
    /**
     * @dev Remove authorized operator
     */
    function removeOperator(address operator) external onlyOwner {
        require(authorizedOperators[operator], "Not authorized");
        
        authorizedOperators[operator] = false;
        emit OperatorRemoved(operator, block.timestamp);
    }
    
    /**
     * @dev Verify artist
     */
    function verifyArtist(address artist) external onlyOwner {
        require(artist != address(0), "Invalid artist address");
        artists[artist].isVerified = true;
        emit ArtistVerified(artist, block.timestamp);
    }
    
    /**
     * @dev Pause contract (emergency)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ===== VIEW FUNCTIONS =====
    
    /**
     * @dev Check if buyer has purchased a track
     */
    function hasPurchased(address buyer, uint256 trackId) 
        external 
        view 
        validTrackId(trackId) 
        returns (bool) 
    {
        return purchases[buyer][trackId];
    }
    
    /**
     * @dev Get track details
     */
    function getTrack(uint256 trackId) 
        external 
        view 
        validTrackId(trackId) 
        returns (
            uint256 price,
            address artist,
            bool isActive,
            uint256 totalSales,
            uint256 createdAt,
            string memory metadataHash
        ) 
    {
        Track storage track = tracks[trackId];
        return (
            track.price,
            track.artist,
            track.isActive,
            track.totalSales,
            track.createdAt,
            track.metadataHash
        );
    }
    
    /**
     * @dev Get artist information
     */
    function getArtistInfo(address artist) 
        external 
        view 
        returns (
            uint256 totalEarnings,
            uint256 totalTracks,
            bool isVerified,
            uint256 joinedAt,
            uint256 currentBalance
        ) 
    {
        ArtistInfo storage info = artists[artist];
        return (
            info.totalEarnings,
            info.totalTracks,
            info.isVerified,
            info.joinedAt,
            artistBalances[artist]
        );
    }
    
    /**
     * @dev Get contract statistics
     */
    function getContractStats() 
        external 
        view 
        returns (
            uint256 totalTracks,
            uint256 totalPlatformFeesCollected,
            uint256 currentPlatformFee,
            uint256 contractBalance
        ) 
    {
        return (
            nextTrackId - 1,
            totalPlatformFees,
            platformFee,
            address(this).balance
        );
    }
    
    /**
     * @dev Calculate purchase details
     */
    function calculatePurchase(uint256 trackId) 
        external 
        view 
        validTrackId(trackId) 
        returns (
            uint256 trackPrice,
            uint256 platformFeeAmount,
            uint256 artistPayment
        ) 
    {
        Track storage track = tracks[trackId];
        uint256 price = track.price;
        uint256 fee = (price * platformFee) / 10000;
        return (price, fee, price - fee);
    }

    // ===== FALLBACK =====
    
    /**
     * @dev Reject direct ETH transfers
     */
    receive() external payable {
        revert("Direct payments not accepted");
    }
    
    fallback() external payable {
        revert("Function not found");
    }
}
