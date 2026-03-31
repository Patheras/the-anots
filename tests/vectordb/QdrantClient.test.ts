/**
 * Qdrant Client Tests
 * 
 * Tests Qdrant vector database operations
 * Requires Qdrant to be running on localhost:6333
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { QdrantClient, createQdrantClient } from '../../src/vectordb/QdrantClient';

// Test configuration
const TEST_COLLECTION = 'test_collection';
const VECTOR_SIZE = 768;

describe('QdrantClient', () => {
  let client: QdrantClient;
  let isQdrantAvailable: boolean;

  beforeAll(async () => {
    // Create client (using port 6335 for TCAM-specific Qdrant)
    client = createQdrantClient({
      url: 'http://localhost:6335',
    });

    // Check if Qdrant is available
    isQdrantAvailable = await client.checkHealth();

    if (!isQdrantAvailable) {
      console.warn('⚠️  Qdrant is not available. Tests will be skipped.');
      console.warn('   Start Qdrant: docker run -d --name tcam-qdrant -p 6335:6333 qdrant/qdrant');
    }
  });

  afterAll(async () => {
    if (isQdrantAvailable) {
      // Clean up test collection
      try {
        await client.deleteCollection(TEST_COLLECTION);
      } catch (error) {
        // Ignore if collection doesn't exist
      }
    }

    client.close();
  });

  describe('Connection', () => {
    it('should check health', async () => {
      const isHealthy = await client.checkHealth();
      expect(typeof isHealthy).toBe('boolean');
    });

    it('should get connection status', () => {
      const status = client.getConnectionStatus();
      expect(typeof status).toBe('boolean');
    });
  });

  describe('Collection Management', () => {
    it('should create a collection', async () => {
      if (!isQdrantAvailable) {
        console.log('Skipping test: Qdrant not available');
        return;
      }

      await client.createCollection({
        name: TEST_COLLECTION,
        vectorSize: VECTOR_SIZE,
        distance: 'Cosine',
      });

      const exists = await client.collectionExists(TEST_COLLECTION);
      expect(exists).toBe(true);
    });

    it('should not fail when creating existing collection', async () => {
      if (!isQdrantAvailable) {
        console.log('Skipping test: Qdrant not available');
        return;
      }

      // Create collection twice - should not throw
      await client.createCollection({
        name: TEST_COLLECTION,
        vectorSize: VECTOR_SIZE,
        distance: 'Cosine',
      });

      await client.createCollection({
        name: TEST_COLLECTION,
        vectorSize: VECTOR_SIZE,
        distance: 'Cosine',
      });

      const exists = await client.collectionExists(TEST_COLLECTION);
      expect(exists).toBe(true);
    });

    it('should check if collection exists', async () => {
      if (!isQdrantAvailable) {
        console.log('Skipping test: Qdrant not available');
        return;
      }

      const exists = await client.collectionExists(TEST_COLLECTION);
      expect(exists).toBe(true);

      const notExists = await client.collectionExists('non_existent_collection');
      expect(notExists).toBe(false);
    });

    it('should get collection info', async () => {
      if (!isQdrantAvailable) {
        console.log('Skipping test: Qdrant not available');
        return;
      }

      const info = await client.getCollectionInfo(TEST_COLLECTION);
      expect(info).toBeDefined();
      expect(info.config).toBeDefined();
    });
  });

  describe('Vector Indexing', () => {
    it('should index a single point', async () => {
      if (!isQdrantAvailable) {
        console.log('Skipping test: Qdrant not available');
        return;
      }

      const vector = Array(VECTOR_SIZE).fill(0).map(() => Math.random());

      await client.indexPoint(TEST_COLLECTION, {
        id: 1, // Use integer ID instead of string
        vector,
        payload: {
          text: 'Test point 1',
          timestamp: new Date().toISOString(),
        },
      });

      const count = await client.countPoints(TEST_COLLECTION);
      expect(count).toBeGreaterThan(0);
    });

    it('should index multiple points (batch)', async () => {
      if (!isQdrantAvailable) {
        console.log('Skipping test: Qdrant not available');
        return;
      }

      const points = Array(10).fill(0).map((_, i) => ({
        id: i + 2, // Use integer IDs (2-11)
        vector: Array(VECTOR_SIZE).fill(0).map(() => Math.random()),
        payload: {
          text: `Test point ${i + 2}`,
          index: i + 2,
        },
      }));

      await client.indexPoints(TEST_COLLECTION, points);

      const count = await client.countPoints(TEST_COLLECTION);
      expect(count).toBeGreaterThanOrEqual(10);
    });

    it('should count points in collection', async () => {
      if (!isQdrantAvailable) {
        console.log('Skipping test: Qdrant not available');
        return;
      }

      const count = await client.countPoints(TEST_COLLECTION);
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('Vector Search', () => {
    it('should search for similar vectors', async () => {
      if (!isQdrantAvailable) {
        console.log('Skipping test: Qdrant not available');
        return;
      }

      // Create a query vector
      const queryVector = Array(VECTOR_SIZE).fill(0).map(() => Math.random());

      // Search
      const results = await client.search(TEST_COLLECTION, queryVector, 5);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(5);

      // Verify result structure
      const firstResult = results[0];
      expect(firstResult).toHaveProperty('id');
      expect(firstResult).toHaveProperty('score');
      expect(firstResult).toHaveProperty('payload');
    });

    it('should apply score threshold', async () => {
      if (!isQdrantAvailable) {
        console.log('Skipping test: Qdrant not available');
        return;
      }

      const queryVector = Array(VECTOR_SIZE).fill(0).map(() => Math.random());

      // Search with high threshold (may return fewer results)
      const results = await client.search(TEST_COLLECTION, queryVector, 10, 0.9);

      expect(Array.isArray(results)).toBe(true);
      
      // All results should have score >= threshold
      results.forEach((result) => {
        expect(result.score).toBeGreaterThanOrEqual(0.9);
      });
    });

    it('should limit search results', async () => {
      if (!isQdrantAvailable) {
        console.log('Skipping test: Qdrant not available');
        return;
      }

      const queryVector = Array(VECTOR_SIZE).fill(0).map(() => Math.random());

      // Search with limit of 3
      const results = await client.search(TEST_COLLECTION, queryVector, 3);

      expect(results.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Point Deletion', () => {
    it('should delete points by IDs', async () => {
      if (!isQdrantAvailable) {
        console.log('Skipping test: Qdrant not available');
        return;
      }

      const countBefore = await client.countPoints(TEST_COLLECTION);

      // Delete some points (use integer IDs)
      await client.deletePoints(TEST_COLLECTION, [1, 2]);

      const countAfter = await client.countPoints(TEST_COLLECTION);
      expect(countAfter).toBeLessThan(countBefore);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent collection gracefully', async () => {
      if (!isQdrantAvailable) {
        console.log('Skipping test: Qdrant not available');
        return;
      }

      await expect(
        client.search('non_existent_collection', Array(VECTOR_SIZE).fill(0), 5)
      ).rejects.toThrow();
    });

    it('should handle connection errors gracefully', async () => {
      // Create client with invalid URL
      const badClient = createQdrantClient({
        url: 'http://localhost:9999',
      });

      const isHealthy = await badClient.checkHealth();
      expect(isHealthy).toBe(false);
      expect(badClient.getConnectionStatus()).toBe(false);
    });
  });
});
