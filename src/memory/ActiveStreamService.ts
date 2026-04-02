/**
 * ActiveStreamService - L2 Memory Layer
 * 
 * Short-term context storage with Redis backend and file-based fallback
 * Stores active conversation context and session state
 * 
 * Features:
 * - Redis backend for fast access
 * - File-based fallback when Redis unavailable
 * - Context serialization/deserialization
 * - TTL support for automatic cleanup
 * - Graceful degradation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Service, ActiveStreamState } from '../core/types';
import { RedisClient, createRedisClient } from '../state/RedisClient';

export interface ActiveStreamConfig {
  redisUrl?: string;
  fallbackDir?: string;
  defaultTTL?: number; // seconds
}

export class ActiveStreamService implements Service {
  name = 'ActiveStreamService';
  private initialized = false;
  private redisClient: RedisClient | null = null;
  private useRedis = false;
  private fallbackDir: string;
  private defaultTTL: number;

  constructor(config?: ActiveStreamConfig) {
    this.fallbackDir = config?.fallbackDir || 'data/active-stream';
    this.defaultTTL = config?.defaultTTL || 3600; // 1 hour default

    // Try to create Redis client
    if (config?.redisUrl || process.env.REDIS_URL) {
      try {
        this.redisClient = createRedisClient({
          url: config?.redisUrl || process.env.REDIS_URL,
        });
      } catch (error) {
        console.warn('Failed to create Redis client, will use file fallback:', error);
        this.redisClient = null;
      }
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Try to connect to Redis
    if (this.redisClient) {
      try {
        await this.redisClient.connect();
        const healthy = await this.redisClient.checkHealth();
        
        if (healthy) {
          this.useRedis = true;
          console.log('✓ ActiveStreamService initialized (Redis backend)');
        } else {
          console.warn('Redis unhealthy, falling back to file storage');
          this.useRedis = false;
        }
      } catch (error) {
        console.warn('Redis connection failed, using file fallback:', error);
        this.useRedis = false;
      }
    }

    // Ensure fallback directory exists
    await fs.mkdir(this.fallbackDir, { recursive: true });

    if (!this.useRedis) {
      console.log('✓ ActiveStreamService initialized (File fallback)');
    }

    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    if (this.redisClient && this.useRedis) {
      await this.redisClient.close();
    }
    
    this.initialized = false;
    console.log('✓ ActiveStreamService shutdown');
  }

  async isHealthy(): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }

    // Check Redis health if using it
    if (this.useRedis && this.redisClient) {
      return await this.redisClient.checkHealth();
    }

    // Check file system access
    try {
      await fs.access(this.fallbackDir, fs.constants.R_OK | fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get context for a session
   */
  async getContext(sessionId: string): Promise<ActiveStreamState | null> {
    this.ensureInitialized();

    try {
      if (this.useRedis && this.redisClient) {
        return await this.getContextFromRedis(sessionId);
      } else {
        return await this.getContextFromFile(sessionId);
      }
    } catch (error) {
      console.error('Failed to get context:', error);
      
      // Try fallback if Redis fails
      if (this.useRedis) {
        console.warn('Redis failed, trying file fallback');
        return await this.getContextFromFile(sessionId);
      }
      
      return null;
    }
  }

  /**
   * Update context for a session
   */
  async updateContext(sessionId: string, state: ActiveStreamState): Promise<void> {
    this.ensureInitialized();

    try {
      if (this.useRedis && this.redisClient) {
        await this.updateContextInRedis(sessionId, state);
      } else {
        await this.updateContextInFile(sessionId, state);
      }
    } catch (error) {
      console.error('Failed to update context:', error);
      
      // Try fallback if Redis fails
      if (this.useRedis) {
        console.warn('Redis failed, using file fallback');
        await this.updateContextInFile(sessionId, state);
      } else {
        throw error;
      }
    }
  }

  /**
   * Clear context for a session
   */
  async clear(sessionId: string): Promise<void> {
    this.ensureInitialized();

    try {
      if (this.useRedis && this.redisClient) {
        await this.redisClient.delete(`session:${sessionId}`);
      }
      
      // Also clear from file fallback
      const filePath = this.getFilePath(sessionId);
      await fs.unlink(filePath).catch(() => {}); // Ignore if doesn't exist
    } catch (error) {
      console.error('Failed to clear context:', error);
    }
  }

  /**
   * List all active sessions
   */
  async listSessions(): Promise<string[]> {
    this.ensureInitialized();

    try {
      if (this.useRedis && this.redisClient) {
        const keys = await this.redisClient.keys('session:*');
        return keys.map(key => key.replace('session:', ''));
      } else {
        const files = await fs.readdir(this.fallbackDir);
        return files
          .filter(file => file.endsWith('.json'))
          .map(file => file.replace('.json', ''));
      }
    } catch (error) {
      console.error('Failed to list sessions:', error);
      return [];
    }
  }

  /**
   * Get context from Redis
   */
  private async getContextFromRedis(sessionId: string): Promise<ActiveStreamState | null> {
    if (!this.redisClient) {
      return null;
    }

    const data = await this.redisClient.get(`session:${sessionId}`);
    
    if (!data) {
      return null;
    }

    return JSON.parse(data);
  }

  /**
   * Update context in Redis
   */
  private async updateContextInRedis(sessionId: string, state: ActiveStreamState): Promise<void> {
    if (!this.redisClient) {
      throw new Error('Redis client not available');
    }

    const data = JSON.stringify(state);
    await this.redisClient.set(`session:${sessionId}`, data, this.defaultTTL);
  }

  /**
   * Get context from file
   */
  private async getContextFromFile(sessionId: string): Promise<ActiveStreamState | null> {
    try {
      const filePath = this.getFilePath(sessionId);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null; // File doesn't exist
      }
      throw error;
    }
  }

  /**
   * Update context in file
   */
  private async updateContextInFile(sessionId: string, state: ActiveStreamState): Promise<void> {
    const filePath = this.getFilePath(sessionId);
    const data = JSON.stringify(state, null, 2);
    await fs.writeFile(filePath, data, 'utf-8');
  }

  /**
   * Get file path for session — sanitized against path traversal
   */
  private getFilePath(sessionId: string): string {
    // Strip any path separators and dots to prevent traversal
    const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
    const resolved = path.resolve(this.fallbackDir, `${safe}.json`);
    // Ensure the resolved path stays inside fallbackDir
    const base = path.resolve(this.fallbackDir);
    if (!resolved.startsWith(base + path.sep) && resolved !== base) {
      throw new Error(`Invalid sessionId: path traversal detected`);
    }
    return resolved;
  }

  /**
   * Ensure service is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('ActiveStreamService not initialized');
    }
  }

  /**
   * Get backend type (for testing/debugging)
   */
  getBackendType(): 'redis' | 'file' {
    return this.useRedis ? 'redis' : 'file';
  }
}
