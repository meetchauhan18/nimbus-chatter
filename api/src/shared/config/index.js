// Environment variables are provided by Docker Compose via .env file
export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  
  mongodb: {
    uri: process.env.MONGODB_URI,
  },
  
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },
  
  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '1d',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },
  
  client: {
    url: process.env.CLIENT_URL || 'http://localhost:5173',
  },
  
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  
  email: {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM || 'noreply@nimbuschat.com',
  },
  
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10),
    maxImageSize: parseInt(process.env.MAX_IMAGE_SIZE_MB || '5', 10),
    maxVideoSize: parseInt(process.env.MAX_VIDEO_SIZE_MB || '50', 10),
    maxAudioSize: parseInt(process.env.MAX_AUDIO_SIZE_MB || '10', 10),
  },
};

export const isDevelopment = config.env === 'development';
export const isProduction = config.env === 'production';
