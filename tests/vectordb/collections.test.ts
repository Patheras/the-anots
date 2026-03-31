/**
 * Hive Mind Collections Tests
 * 
 * Tests collection initialization and management
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createQdrantClient } from '../../src/vectordb/QdrantClient';
import {
  HIVE_COLLECTIONS,
  HIVE_COLLECTION_CONFIGS,
  initializeHiveMind,
  checkHiveMindCollections,
  deleteHiveMindCollections,
  getHiveMindStats,
} from '../../src/vectordb/collections';

describe('Hive Mind Collections', () => {
  const client = createQdrantClient({
    url: 'http://localhost:6335',
  });

  let isQdrantAvailable: boolean;

  beforeAll(async () => {
    isQdrantAvailable = await client.checkHealth();

    if (!isQdrantAvailable) {
      console.warn('⚠️  Qdrant is not available. Tests will be skipped.');
    }
  });

  afterAll(async () => {
    if (isQdrantAvailable) {
      // Clean up test collections
      await deleteHiveMindCollections(client);
    }
    client.close();
  });

  describe('Collection Configuration', () => {
    it('should have 5 collection configs', () => {
      expect(HIVE_COLLECTION_CONFIGS).toHaveLength(5);
    });

    it('should have correct collection names', () => {
      expect(HIVE_COLLECTIONS.TRUTHS).toBe('tcam_hive_truths');
      expect(HIVE_COLLECTIONS.WISDOM).toBe('tcam_hive_wisdom');
      expect(HIVE_COLLECTIONS.PATTERNS).toBe('tcam_hive_patterns');
      expect(HIVE_COLLECTIONS.WHISPERS).toBe('tcam_hive_whispers');
      expect(HIVE_COLLECTIONS.TOOLS).toBe('tcam_hive_tools');
    });

    it('should use 768-dimensional vectors', () => {
      HIVE_COLLECTION_CONFIGS.forEach((config) => {
        expect(config.vectorSize).toBe(768);
      });
    });

    it('should use Cosine distance', () => {
      HIVE_COLLECTION_CONFIGS.forEach((config) => {
        expect(config.distance).toBe('Cosine');
      });
    });
  });

  describe('Collection Initialization', () => {
    it('should initialize all Hive Mind collections', async () => {
      if (!isQdrantAvailable) {
        console.log('Skipping test: Qdrant not available');
        return;
      }

      await initializeHiveMind(client);

      // Verify all collections exist
      const allExist = await checkHiveMindCollections(client);
      expect(allExist).toBe(true);
    });

    it('should not fail when initializing existing collections', async () => {
      if (!isQdrantAvailable) {
        console.log('Skipping test: Qdrant not available');
        return;
      }

      // Initialize twice - should not throw
      await initializeHiveMind(client);
      await initializeHiveMind(client);

      const allExist = await checkHiveMindCollections(client);
      expect(allExist).toBe(true);
    });

    it('should check if all collections exist', async () => {
      if (!isQdrantAvailable) {
        console.log('Skipping test: Qdrant not available');
        return;
      }

      const allExist = await checkHiveMindCollections(client);
      expect(allExist).toBe(true);
    });
  });

  describe('Collection Stats', () => {
    it('should get stats for all collections', async () => {
      if (!isQdrantAvailable) {
        console.log('Skipping test: Qdrant not available');
        return;
      }

      const stats = await getHiveMindStats(client);

      expect(stats).toHaveProperty(HIVE_COLLECTIONS.TRUTHS);
      expect(stats).toHaveProperty(HIVE_COLLECTIONS.WISDOM);
      expect(stats).toHaveProperty(HIVE_COLLECTIONS.PATTERNS);
      expect(stats).toHaveProperty(HIVE_COLLECTIONS.WHISPERS);
      expect(stats).toHaveProperty(HIVE_COLLECTIONS.TOOLS);

      // All should be 0 (empty collections)
      Object.values(stats).forEach((count) => {
        expect(count).toBe(0);
      });
    });
  });

  describe('Collection Deletion', () => {
    it('should delete all Hive Mind collections', async () => {
      if (!isQdrantAvailable) {
        console.log('Skipping test: Qdrant not available');
        return;
      }

      await deleteHiveMindCollections(client);

      // Verify all collections are deleted
      const allExist = await checkHiveMindCollections(client);
      expect(allExist).toBe(false);
    });

    it('should not fail when deleting non-existent collections', async () => {
      if (!isQdrantAvailable) {
        console.log('Skipping test: Qdrant not available');
        return;
      }

      // Delete twice - should not throw
      await deleteHiveMindCollections(client);
      await deleteHiveMindCollections(client);
    });
  });
});
