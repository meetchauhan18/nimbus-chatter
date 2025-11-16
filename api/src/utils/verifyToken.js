import jwt from 'jsonwebtoken';

/**
 * Utility to decode and inspect JWT tokens without verification
 * Useful for debugging token expiration issues
 */
export const inspectToken = (token) => {
  try {
    // Decode without verification to see the payload
    const decoded = jwt.decode(token, { complete: true });
    
    if (!decoded) {
      return { error: 'Invalid token format' };
    }

    const { header, payload } = decoded;
    const now = Math.floor(Date.now() / 1000);
    
    return {
      header,
      payload,
      issuedAt: payload.iat ? new Date(payload.iat * 1000).toISOString() : null,
      expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
      isExpired: payload.exp ? now > payload.exp : null,
      timeUntilExpiry: payload.exp ? `${Math.floor((payload.exp - now) / 60)} minutes` : null,
      currentServerTime: new Date(now * 1000).toISOString(),
    };
  } catch (error) {
    return { error: error.message };
  }
};

/**
 * Check if server time is synchronized
 */
export const checkServerTime = () => {
  const serverTime = new Date();
  console.log('=== Server Time Check ===');
  console.log('Server Time:', serverTime.toISOString());
  console.log('Unix Timestamp:', Math.floor(serverTime.getTime() / 1000));
  console.log('========================');
  return serverTime;
};
