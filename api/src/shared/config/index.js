// CRITICAL: Import env loader BEFORE accessing process.env
import './env.js';

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),

  mongodb: {
    uri: process.env.MONGODB_URI,
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    url: process.env.REDIS_URL,
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

  email: {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM,
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },

  fileUpload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10) * 1024 * 1024,
    maxImageSize: parseInt(process.env.MAX_IMAGE_SIZE_MB || '5', 10) * 1024 * 1024,
    maxVideoSize: parseInt(process.env.MAX_VIDEO_SIZE_MB || '50', 10) * 1024 * 1024,
    maxAudioSize: parseInt(process.env.MAX_AUDIO_SIZE_MB || '10', 10) * 1024 * 1024,
  },

  logLevel: process.env.LOG_LEVEL || 'info',
  instanceId: process.env.INSTANCE_ID || `instance-${Math.random().toString(36).substr(2, 9)}`,
};

// Validation - only in non-test environments
if (process.env.NODE_ENV !== 'test') {
  const required = ['MONGODB_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error('\n❌ ENVIRONMENT VALIDATION FAILED');
    console.error(`   Missing required variables: ${missing.join(', ')}`);
    console.error(`   Working directory: ${process.cwd()}`);
    console.error(`   NODE_ENV: ${process.env.NODE_ENV || 'undefined'}\n`);
    
    process.exit(1);
  }
}

console.log('✅ Environment configuration validated');

export default { config };
