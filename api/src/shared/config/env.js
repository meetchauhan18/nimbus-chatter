import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

/**
 * Universal .env loader for local dev + Docker
 * Searches upward from current file location
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Find .env file by traversing upward
 */
function findEnvFile(startPath, maxDepth = 5) {
  let currentPath = startPath;
  
  for (let i = 0; i < maxDepth; i++) {
    const envPath = join(currentPath, '.env');
    
    if (existsSync(envPath)) {
      return envPath;
    }
    
    // Move up one directory
    const parentPath = join(currentPath, '..');
    
    // Stop if we've reached filesystem root
    if (parentPath === currentPath) {
      break;
    }
    
    currentPath = parentPath;
  }
  
  return null;
}

// Find and load .env
const envPath = findEnvFile(__dirname);

if (envPath) {
  const result = dotenv.config({ path: envPath });
  
  if (result.error) {
    console.error('❌ Failed to load .env:', result.error.message);
  } else {
    console.log(`✅ Loaded environment from: ${envPath}`);
  }
} else {
  // Docker scenario: env vars injected by docker-compose
  console.log('ℹ️  No .env file found - using system environment variables');
}

// Export loader for testing
export { findEnvFile };
