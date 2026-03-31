/**
 * Redis Client Tests
 * 
 * Tests Redis state persistence operations
 * Requires Redis to be running on localhost:6379
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { RedisClient, createRedisClient } from '../../src/state/RedisClient';

describe('RedisClient', () => {
  let client: RedisClient;
  let isRedisAvailable: boolean;

  beforeAll(async () => {
    client = createRedisClient({
      url: 'redis://localhost:6379',
      keyPrefix: 'test:',
    });

    try {
      await client.connect();
      isRedisAvailable = await client.checkHealth();
    } catch (error) {
      isRedisAvailable = false;
    }

    if (!isRedisAvailable) {
      console.warn('⚠️  Redis is not available. Tests will be skipped.');
      console.warn('   Start Redis: docker run -d --name tcam-redis -p 6379:6379 redis');
    }
  });

  afterAll(async () => {
    if (isRedisAvailable) {
      // Clean up test keys
      await client.deletePattern('*');
    }
    await client.close();
  });

  describe('Connection', () => {
    it('should connect to Redis', async () => {
      if (!isRedisAvailable) {
        console.log('Skipping test: Redis not available');
        return;
      }

      const status = client.getConnectionStatus();
      expect(status).toBe(true);
    });

    it('should check health', async () => {
      if (!isRedisAvailable) {
        console.log('Skipping test: Redis not available');
        return;
      }

      const isHealthy = await client.checkHealth();
      expect(isHealthy).toBe(true);
    });
  });

  describe('Key-Value Operations', () => {
    it('should set and get a value', async () => {
      if (!isRedisAvailable) {
        console.log('Skipping test: Redis not available');
        return;
      }

      await client.set('test-key', 'test-value');
      const value = await client.get('test-key');
      
      expect(value).toBe('test-value');
    });

    it('should set value with TTL', async () => {
      if (!isRedisAvailable) {
        console.log('Skipping test: Redis not available');
        return;
      }

      await client.set('ttl-key', 'ttl-value', 10); // 10 seconds TTL
      
      const value = await client.get('ttl-key');
      expect(value).toBe('ttl-value');

      const ttl = await client.ttl('ttl-key');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(10);
    });

    it('should delete a key', async () => {
      if (!isRedisAvailable) {
        console.log('Skipping test: Redis not available');
        return;
      }

      await client.set('delete-key', 'delete-value');
      await client.delete('delete-key');
      
      const value = await client.get('delete-key');
      expect(value).toBeNull();
    });

    it('should check if key exists', async () => {
      if (!isRedisAvailable) {
        console.log('Skipping test: Redis not available');
        return;
      }

      await client.set('exists-key', 'exists-value');
      
      const exists = await client.exists('exists-key');
      expect(exists).toBe(true);

      const notExists = await client.exists('non-existent-key');
      expect(notExists).toBe(false);
    });

    it('should set TTL on existing key', async () => {
      if (!isRedisAvailable) {
        console.log('Skipping test: Redis not available');
        return;
      }

      await client.set('expire-key', 'expire-value');
      await client.expire('expire-key', 5);
      
      const ttl = await client.ttl('expire-key');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(5);
    });
  });

  describe('Pattern Operations', () => {
    it('should get keys by pattern', async () => {
      if (!isRedisAvailable) {
        console.log('Skipping test: Redis not available');
        return;
      }

      await client.set('pattern:1', 'value1');
      await client.set('pattern:2', 'value2');
      await client.set('pattern:3', 'value3');
      
      const keys = await client.keys('pattern:*');
      expect(keys.length).toBeGreaterThanOrEqual(3);
      expect(keys).toContain('pattern:1');
      expect(keys).toContain('pattern:2');
      expect(keys).toContain('pattern:3');
    });

    it('should delete keys by pattern', async () => {
      if (!isRedisAvailable) {
        console.log('Skipping test: Redis not available');
        return;
      }

      await client.set('delete-pattern:1', 'value1');
      await client.set('delete-pattern:2', 'value2');
      
      const deleted = await client.deletePattern('delete-pattern:*');
      expect(deleted).toBeGreaterThanOrEqual(2);

      const keys = await client.keys('delete-pattern:*');
      expect(keys.length).toBe(0);
    });
  });

  describe('Database Operations', () => {
    it('should get database size', async () => {
      if (!isRedisAvailable) {
        console.log('Skipping test: Redis not available');
        return;
      }

      await client.set('size-test-1', 'value1');
      await client.set('size-test-2', 'value2');
      
      const size = await client.dbSize();
      expect(size).toBeGreaterThan(0);
    });

    it('should flush database', async () => {
      if (!isRedisAvailable) {
        console.log('Skipping test: Redis not available');
        return;
      }

      await client.set('flush-test', 'value');
      await client.flushDb();
      
      const size = await client.dbSize();
      expect(size).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors gracefully', async () => {
      const badClient = createRedisClient({
        url: 'redis://localhost:9999',
      });

      try {
        await badClient.connect();
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }

      const status = badClient.getConnectionStatus();
      expect(status).toBe(false);

      // Clean up
      await badClient.close();
    });
  });
});
