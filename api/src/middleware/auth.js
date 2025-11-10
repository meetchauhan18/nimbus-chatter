import { verifyAccessToken as verifyToken } from "../config/jwt.js";

export const verifyAccessToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    console.log("🚀 ~ verifyAccessToken ~ token:", token)
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = verifyToken(token);
    console.log("🚀 ~ verifyAccessToken ~ decoded:", decoded)
    req.user = decoded;
    console.log("🚀 ~ verifyAccessToken ~ req.user:", req.user)
    next();
  } catch (error) {
    console.log("🚀 ~ verifyAccessToken ~ error:", error)
    
    // Provide specific error messages for token issues
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        message: 'Your session has expired. Please refresh your token or login again.',
        expiredAt: error.expiredAt
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'The provided token is invalid or malformed.'
      });
    }
    
    return res.status(401).json({ 
      error: 'Authentication failed',
      message: error.message 
    });
  }
};
