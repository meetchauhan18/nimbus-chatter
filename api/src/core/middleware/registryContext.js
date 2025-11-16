/**
 * Registry Context Middleware
 * Injects registry into req.registry for easy service access
 */
export const registryContext = (registry) => {
  return (req, res, next) => {
    req.registry = registry;
    next();
  };
};

/**
 * Helper to resolve service from request
 */
export const getService = (req, key) => {
  if (!req.registry) {
    throw new Error('Registry not available in request context');
  }
  return req.registry.resolveAsync(key);
};

export default { registryContext, getService };
