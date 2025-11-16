/**
 * Socket.IO Input Sanitizer Middleware
 * Protects against NoSQL injection in Socket events
 */

export const sanitizeSocketInput = (packet, next) => {
  if (packet && packet[1]) {
    packet[1] = sanitizeData(packet[1]);
  }
  next();
};

/**
 * Recursively sanitize data
 */
function sanitizeData(data) {
  if (data === null || data === undefined) {
    return data;
  }

  // Handle strings - remove $ and . characters that can be used in NoSQL injection
  if (typeof data === "string") {
    return data.replace(/[$\.]/g, "");
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item));
  }

  // Handle objects
  if (typeof data === "object") {
    const sanitized = {};

    Object.keys(data).forEach((key) => {
      // Remove keys that start with $ (MongoDB operators)
      if (key.startsWith("$") || key.startsWith(".")) {
        console.warn(`⚠️ Removed potentially malicious key: ${key}`);
        return;
      }

      // Sanitize the key and value
      const cleanKey = key.replace(/[$\.]/g, "");
      sanitized[cleanKey] = sanitizeData(data[key]);
    });

    return sanitized;
  }

  return data;
}
