// api/src/sockets/middleware/socketAuth.js
export const socketAuth = (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) {
      return next(new Error('Authentication token missing'));
    }
    
    const decoded = verifyAccessToken(token);
    if (!decoded || !decoded.userId) {
      return next(new Error('Invalid authentication token'));
    }
    
    // Fix: Use email instead of phone
    socket.userId = decoded.userId;
    socket.user = decoded; // Attach full decoded payload
    next();
  } catch (error) {
    console.error('Socket auth error:', error.message);
    next(new Error('Authentication failed'));
  }
};
