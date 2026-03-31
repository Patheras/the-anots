/**
 * Redis Client for State Persistence
 * 
 * Wrapper for Redis operations with graceful error handling
 * Used for LangGraph checkpointer (L2: Active Stream)
 */

import { createClient, RedisClientType } from 'redis';

/**
 * Redis configuration
 */
export interface RedisConfig {
  url: string;
  password?: string;
  database?: number;
  keyPrefix?: string;
}

/**
 * Redis Client Wrapper
 * 
 * Features:
 * - Connection management
 * - Key-value operations
 * - TTL support
 * - Graceful error handling
 */
export class RedisClient {
  private client: RedisClientType;
  private config: RedisConfig;
  private isConnected: boolean = false;

  constructor(config: RedisConfig) {
    this.config = {
      database: 0,
      keyPrefix: 'tcam:',
      ...config,
    };

    this.client = createClient({
      url: this.config.url,
      password: this.config.password,
      database: this.config.database,
      socket: {
        connectTimeout: 5000, // 5 seconds
        reconnectStrategy: false, // Disable auto-reconnect for faster failures
      },
    });

    // Error handling
    this.client.on('error', (err) => {
      console.error('Redis error:', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      console.log('Redis connected');
      this.isConnected = true;
    });
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.isConnected = true;
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Check if Redis is available
   */
  async checkHealth(): Promise<boolean> {
    try {
      await this.client.ping();
      this.isConnected = true;
      return true;
    } catch (error) {
      this.isConnected = false;
      console.warn('Redis health check failed:', (error as Error).message);
      return false;
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Add key prefix
   */
  private prefixKey(key: string): string {
    return `${this.config.keyPrefix}${key}`;
  }

  /**
   * Set a key-value pair
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      const prefixedKey = this.prefixKey(key);
      
      if (ttl) {
        await this.client.setEx(prefixedKey, ttl, value);
      } else {
        await this.client.set(prefixedKey, value);
      }
    } catch (error) {
      console.error('Failed to set key:', error);
      throw error;
    }
  }

  /**
   * Get a value by key
   */
  async get(key: string): Promise<string | null> {
    try {
      const prefixedKey = this.prefixKey(key);
      return await this.client.get(prefixedKey);
    } catch (error) {
      console.error('Failed to get key:', error);
      throw error;
    }
  }

  /**
   * Delete a key
   */
  async delete(key: string): Promise<void> {
    try {
      const prefixedKey = this.prefixKey(key);
      await this.client.del(prefixedKey);
    } catch (error) {
      console.error('Failed to delete key:', error);
      throw error;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const prefixedKey = this.prefixKey(key);
      const result = await this.client.exists(prefixedKey);
      return result === 1;
    } catch (error) {
      console.error('Failed to check key existence:', error);
      return false;
    }
  }

  /**
   * Set TTL on existing key
   */
  async expire(key: string, ttl: number): Promise<void> {
    try {
      const prefixedKey = this.prefixKey(key);
      await this.client.expire(prefixedKey, ttl);
    } catch (error) {
      console.error('Failed to set TTL:', error);
      throw error;
    }
  }

  /**
   * Get TTL of a key
   */
  async ttl(key: string): Promise<number> {
    try {
      const prefixedKey = this.prefixKey(key);
      return await this.client.ttl(prefixedKey);
    } catch (error) {
      console.error('Failed to get TTL:', error);
      return -1;
    }
  }

  /**
   * Get all keys matching pattern
   */
  async keys(pattern: string = '*'): Promise<string[]> {
    try {
      const prefixedPattern = this.prefixKey(pattern);
      const keys = await this.client.keys(prefixedPattern);
      
      // Remove prefix from returned keys
      return keys.map((key) => key.replace(this.config.keyPrefix!, ''));
    } catch (error) {
      console.error('Failed to get keys:', error);
      return [];
    }
  }

  /**
   * Delete all keys matching pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.keys(pattern);
      
      if (keys.length === 0) {
        return 0;
      }

      const prefixedKeys = keys.map((key) => this.prefixKey(key));
      return await this.client.del(prefixedKeys);
    } catch (error) {
      console.error('Failed to delete keys by pattern:', error);
      return 0;
    }
  }

  /**
   * Flush all keys in current database
   */
  async flushDb(): Promise<void> {
    try {
      await this.client.flushDb();
    } catch (error) {
      console.error('Failed to flush database:', error);
      throw error;
    }
  }

  /**
   * Get database size (number of keys)
   */
  async dbSize(): Promise<number> {
    try {
      return await this.client.dbSize();
    } catch (error) {
      console.error('Failed to get database size:', error);
      return 0;
    }
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    try {
      await this.client.quit();
      this.isConnected = false;
    } catch (error) {
      console.error('Failed to close Redis connection:', error);
    }
  }
}

/**
 * Create Redis client with default configuration
 */
export function createRedisClient(config?: Partial<RedisConfig>): RedisClient {
  const defaultConfig: RedisConfig = {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD,
    database: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: 'tcam:',
  };

  return new RedisClient({ ...defaultConfig, ...config });
}
