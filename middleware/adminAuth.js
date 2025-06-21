export const adminAuth = (req, res, next) => {
    const adminKey = req.headers['x-admin-key'] || req.headers['authorization'];
    
    if (!adminKey) {
        return res.status(401).json({ 
            success: false,
            error: 'Admin key required' 
        });
    }
    
    // Remove 'Bearer ' prefix if present
    const key = adminKey.replace('Bearer ', '');
    
    if (key !== process.env.ADMIN_KEY) {
        return res.status(403).json({ 
            success: false,
            error: 'Invalid admin key' 
        });
    }
    
    next();
};
