const { Client, Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env (which should NOT be in git)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

class Database {
  constructor() {
    this.pool = null;
    this.config = this.getConfig();
  }

  getConfig() {
    // Validation - fail early if required vars are missing
    const required = ['PG_USER', 'PG_HOST', 'PG_DATABASE', 'PG_PASSWORD'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(', ')}\n` +
        'Please check your .env file or environment configuration.'
      );
    }

    const config = {
      user: process.env.PG_USER,
      password: process.env.PG_PASSWORD,
      host: process.env.PG_HOST,
      port: Number(process.env.PG_PORT || 5432),
      database: process.env.PG_DATABASE,
      max: 20, // Max connections in pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

    // SSL configuration based on environment
    if (process.env.NODE_ENV === 'production' || process.env.PG_SSL === 'true') {
      config.ssl = {
        rejectUnauthorized: true, // Set to false only for testing
        // For self-signed certificates:
        // ca: process.env.PG_CA_CERT ? fs.readFileSync(process.env.PG_CA_CERT).toString() : undefined
      };
    }

    return config;
  }

  async connect() {
    try {
      this.pool = new Pool(this.config);
      
      // Test connection
      const client = await this.pool.connect();
      console.log('✓ PostgreSQL connected successfully');
      client.release();
      
      // Handle pool errors
      this.pool.on('error', (err) => {
        console.error('Unexpected PostgreSQL error:', err.message);
      });
      
      return this.pool;
    } catch (error) {
      console.error('✗ PostgreSQL connection failed:', error.message);
      throw error;
    }
  }

  async query(text, params) {
    if (!this.pool) {
      await this.connect();
    }
    
    try {
      const start = Date.now();
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      // Log slow queries in development
      if (process.env.NODE_ENV !== 'production' && duration > 1000) {
        console.warn(`⚠️ Slow query (${duration}ms): ${text}`);
      }
      
      return result;
    } catch (error) {
      console.error('Query error:', error.message);
      throw error;
    }
  }

  async getClient() {
    if (!this.pool) {
      await this.connect();
    }
    return this.pool.connect();
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('✓ PostgreSQL connection pool closed');
    }
  }
}

// Singleton instance
let instance = null;

const getDatabase = () => {
  if (!instance) {
    instance = new Database();
  }
  return instance;
};

module.exports = { getDatabase, Database };
