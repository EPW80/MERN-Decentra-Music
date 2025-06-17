import Music from '../models/Music.js';
import Purchase from '../models/Purchase.js';
import web3StorageService from '../config/web3storage.js';

export const uploadTrack = async (req, res) => {
    try {
        const { title, artist, genre, album, price } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'No audio file uploaded' });
        }

        // Create a File object for Web3.Storage
        const web3File = new File([file.buffer], file.originalname, {
            type: file.mimetype
        });

        // Upload to Web3.Storage
        const ipfsResult = await web3StorageService.uploadFile(web3File);

        // Save to MongoDB
        const newTrack = new Music({
            title,
            artist,
            genre,
            album,
            price: price || 0.001,
            ipfs: {
                cid: ipfsResult.cid,
                url: ipfsResult.url
            },
            fileSize: file.size,
            mimeType: file.mimetype
        });

        const savedTrack = await newTrack.save();

        res.status(201).json({
            message: 'Track uploaded successfully',
            track: savedTrack
        });

    } catch (error) {
        console.error('Upload track error:', error);
        res.status(500).json({ error: 'Failed to upload track' });
    }
};

export const updateTrack = async (req, res) => {
    try {
        const updatedTrack = await Music.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!updatedTrack) {
            return res.status(404).json({ error: 'Track not found' });
        }

        res.json({
            message: 'Track updated successfully',
            track: updatedTrack
        });
    } catch (error) {
        console.error('Update track error:', error);
        res.status(500).json({ error: 'Failed to update track' });
    }
};

export const deleteTrack = async (req, res) => {
    try {
        const deletedTrack = await Music.findByIdAndDelete(req.params.id);

        if (!deletedTrack) {
            return res.status(404).json({ error: 'Track not found' });
        }

        res.json({ message: 'Track deleted successfully' });
    } catch (error) {
        console.error('Delete track error:', error);
        res.status(500).json({ error: 'Failed to delete track' });
    }
};

export const getAnalytics = async (req, res) => {
    try {
        const totalTracks = await Music.countDocuments();
        const totalPurchases = await Purchase.countDocuments();
        
        const salesData = await Purchase.aggregate([
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: { $toDouble: '$amount' } },
                    avgSale: { $avg: { $toDouble: '$amount' } }
                }
            }
        ]);

        const topTracks = await Purchase.aggregate([
            {
                $group: {
                    _id: '$trackId',
                    sales: { $sum: 1 },
                    revenue: { $sum: { $toDouble: '$amount' } }
                }
            },
            { $sort: { sales: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'musics',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'track'
                }
            }
        ]);

        res.json({
            totalTracks,
            totalPurchases,
            totalRevenue: salesData[0]?.totalRevenue || 0,
            avgSale: salesData[0]?.avgSale || 0,
            topTracks
        });
    } catch (error) {
        console.error('Get analytics error:', error);
        res.status(500).json({ error: 'Failed to get analytics' });
    }
};

export const getSalesData = async (req, res) => {
    try {
        const { startDate, endDate, limit = 50 } = req.query;
        
        let filter = {};
        if (startDate || endDate) {
            filter.purchaseDate = {};
            if (startDate) filter.purchaseDate.$gte = new Date(startDate);
            if (endDate) filter.purchaseDate.$lte = new Date(endDate);
        }

        const sales = await Purchase.find(filter)
            .populate('trackId', 'title artist')
            .sort({ purchaseDate: -1 })
            .limit(parseInt(limit));

        res.json(sales);
    } catch (error) {
        console.error('Get sales data error:', error);
        res.status(500).json({ error: 'Failed to get sales data' });
    }
};