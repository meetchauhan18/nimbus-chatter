import { verifyAccessToken } from '../../config/jwt.js';

export const socketAuth = (socket, next) => {
  try {
    // Extract token from handshake auth or query
    const token = socket.handshake.auth.token || socket.handshake.query.token;

    if (!token) {
      return next(new Error('Authentication token missing'));
    }

    // Verify JWT token
    const decoded = verifyAccessToken(token);
    
    if (!decoded || !decoded.userId) {
      return next(new Error('Invalid authentication token'));
    }

    // Attach user data to socket
    socket.userId = decoded.userId;
    socket.phone = decoded.phone;
    
    next();
  } catch (error) {
    console.error('Socket auth error:', error.message);
    next(new Error('Authentication failed'));
  }
};
