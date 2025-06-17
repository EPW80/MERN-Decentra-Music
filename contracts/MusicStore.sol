// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract MusicStore is Ownable, ReentrancyGuard {
    struct Track {
        uint256 price;
        address artist;
        bool isActive;
        uint256 totalSales;
    }
    
    mapping(uint256 => Track) public tracks;
    mapping(address => mapping(uint256 => bool)) public purchases;
    mapping(address => uint256) public artistBalances;
    
    uint256 public platformFee = 250; // 2.5% (out of 10000)
    uint256 public nextTrackId = 1;
    
    event TrackAdded(uint256 indexed trackId, address indexed artist, uint256 price);
    event TrackPurchased(uint256 indexed trackId, address indexed buyer, uint256 price);
    event Withdrawal(address indexed artist, uint256 amount);
    
    constructor() {}
    
    function addTrack(uint256 price, address artist) external onlyOwner returns (uint256) {
        uint256 trackId = nextTrackId++;
        tracks[trackId] = Track({
            price: price,
            artist: artist,
            isActive: true,
            totalSales: 0
        });
        
        emit TrackAdded(trackId, artist, price);
        return trackId;
    }
    
    function purchaseTrack(uint256 trackId) external payable nonReentrant {
        Track storage track = tracks[trackId];
        require(track.isActive, "Track not available");
        require(msg.value >= track.price, "Insufficient payment");
        require(!purchases[msg.sender][trackId], "Already purchased");
        
        purchases[msg.sender][trackId] = true;
        track.totalSales++;
        
        // Calculate fees
        uint256 fee = (msg.value * platformFee) / 10000;
        uint256 artistPayment = msg.value - fee;
        
        // Add to artist balance
        artistBalances[track.artist] += artistPayment;
        
        emit TrackPurchased(trackId, msg.sender, msg.value);
        
        // Refund excess payment
        if (msg.value > track.price) {
            payable(msg.sender).transfer(msg.value - track.price);
        }
    }
    
    function hasPurchased(address buyer, uint256 trackId) external view returns (bool) {
        return purchases[buyer][trackId];
    }
    
    function withdrawArtistBalance() external nonReentrant {
        uint256 balance = artistBalances[msg.sender];
        require(balance > 0, "No balance to withdraw");
        
        artistBalances[msg.sender] = 0;
        payable(msg.sender).transfer(balance);
        
        emit Withdrawal(msg.sender, balance);
    }
    
    function updateTrackPrice(uint256 trackId, uint256 newPrice) external {
        Track storage track = tracks[trackId];
        require(track.artist == msg.sender || msg.sender == owner(), "Not authorized");
        track.price = newPrice;
    }
    
    function deactivateTrack(uint256 trackId) external {
        Track storage track = tracks[trackId];
        require(track.artist == msg.sender || msg.sender == owner(), "Not authorized");
        track.isActive = false;
    }
    
    function withdrawPlatformFees() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    function updatePlatformFee(uint256 newFee) external onlyOwner {
        require(newFee <= 1000, "Fee too high"); // Max 10%
        platformFee = newFee;
    }
}