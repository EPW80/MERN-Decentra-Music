import Track from '../models/Track.js';
import Purchase from '../models/Purchase.js';
import storageService from '../config/storage.js';

export const uploadTrack = async (req, res) => {
    try {
        console.log('Uploading track...');
        const { title, artist, genre, album, price } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'No audio file uploaded' });
        }

        // Upload file
        const uploadResult = await storageService.uploadFile(file, {
            filename: file.originalname,
            metadata: { title, artist, genre }
        });

        // Save to database
        const newTrack = new Track({
            title,
            artist,
            genre: genre || 'other',
            album,
            price: price || '0.001',
            ipfs: {
                cid: uploadResult.cid,
                url: uploadResult.url
            },
            fileSize: file.size,
            mimeType: file.mimetype,
            isActive: true,
            storageProvider: uploadResult.provider
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
        const updatedTrack = await Track.findByIdAndUpdate(
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
        const deletedTrack = await Track.findByIdAndDelete(req.params.id);

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
        const totalTracks = await Track.countDocuments();
        
        res.json({
            success: true,
            totalTracks,
            totalSales: 0,
            revenue: 0
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