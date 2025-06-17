export const adminAuth = (req, res, next) => {
  const adminKey =
    req.headers["x-admin-key"] ||
    req.headers["authorization"]?.replace("Bearer ", "") ||
    req.query.adminKey;

  if (!adminKey) {
    return res.status(401).json({
      error: "Admin authentication required",
      message:
        "Provide admin key in x-admin-key header, Authorization header, or adminKey query parameter",
    });
  }

  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({
      error: "Invalid admin key",
      timestamp: new Date().toISOString(),
    });
  }

  // Log admin access (optional)
  console.log(
    `Admin access: ${req.method} ${req.path} at ${new Date().toISOString()}`
  );

  next();
};
