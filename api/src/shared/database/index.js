import mongoose from 'mongoose';
import { config } from '../config/index.js';

class Database {
  constructor() {
    this.connection = null;
  }

  async connect() {
    try {
      const mongoUri = config.mongodb.uri;
      if (!mongoUri) {
        throw new Error('MONGODB_URI not found in environment variables');
      }

      const options = {
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000,
        retryWrites: true,
        retryReads: true,
        family: 4,
        autoIndex: config.env !== 'production',
      };

      const conn = await mongoose.connect(mongoUri, options);
      this.connection = conn.connection;

      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
      console.log(`📊 Database: ${conn.connection.name}`);

      this._setupEventListeners();
      return this.connection;
    } catch (error) {
      console.error('❌ MongoDB Connection Error:', error.message);
      process.exit(1);
    }
  }

  _setupEventListeners() {
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });
  }

  async disconnect() {
    if (this.connection) {
      await mongoose.disconnect();
      console.log('MongoDB disconnected');
    }
  }

  async checkHealth() {
    try {
      if (!this.connection) return { status: 'disconnected' };

      const state = mongoose.connection.readyState;
      const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];

      return {
        status: states[state] || 'unknown',
        host: this.connection.host,
        name: this.connection.name,
        isConnected: state === 1,
      };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  getConnection() {
    return this.connection;
  }
}

export default Database;
