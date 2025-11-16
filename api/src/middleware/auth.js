import { UnauthorizedError } from '../shared/errors/index.js';
import { verifyAccessToken as verifyToken } from '../shared/utils/jwt.js';

export const verifyAccessToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Your session has expired. Please refresh your token or login again.',
        expiredAt: error.expiredAt,
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'The provided token is invalid or malformed.',
      });
    }

    return res.status(401).json({
      error: 'Authentication failed',
      message: error.message,
    });
  }
};
