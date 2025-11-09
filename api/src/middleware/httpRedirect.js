/**
 * HTTPS Redirect Middleware
 * Forces HTTPS in production environments
 */

export const httpsRedirect = (req, res, next) => {
  // Skip in development
  if (process.env.NODE_ENV !== "production") {
    return next();
  }

  // Check if request is already secure
  const isSecure =
    req.secure ||
    req.headers["x-forwarded-proto"] === "https" ||
    req.connection.encrypted;

  if (!isSecure) {
    const httpsUrl = `https://${req.hostname}${req.url}`;
    console.warn(`⚠️ Redirecting insecure request to: ${httpsUrl}`);
    return res.redirect(301, httpsUrl);
  }

  next();
};

/**
 * Strict Transport Security Header
 * Tells browsers to always use HTTPS
 */
export const hstsMiddleware = (req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    // HSTS: 1 year, include subdomains, allow preloading
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }
  next();
};
