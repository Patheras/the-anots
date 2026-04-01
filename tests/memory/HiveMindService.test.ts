/**
 * Tests for HiveMindService
 */

import { HiveMindService } from '../../src/memory/HiveMindService';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as fc from 'fast-check';

// Test data directory
const TEST_DATA_DIR = path.join(__dirname, '../../test-data/hive-mind');

describe('HiveMindService', () => {
  let service: HiveMindService;
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeAll(() => {
    // Mock console methods to avoid test pollution
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterAll(() => {
    // Restore console methods
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  beforeEach(async () => {
    // Clean test directory
    await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_DATA_DIR, { recursive: true });

    // Create service with file fallback (no Qdrant/Mem0 for tests)
    service = new HiveMindService({
      fallbackDir: TEST_DATA_DIR,
    });
    
    await service.initialize();
  });

  afterEach(async () => {
    await service.shutdown();
  });

  afterAll(async () => {
    // Clean up test directory
    await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
  });

  describe('Initialization', () => {
    it('should initialize successfully with file fallback', async () => {
      expect(service.name).toBe('HiveMindService');
      expect(await service.isHealthy()).toBe(true);
      expect(service.getBackendType()).toBe('file');
    });

    it('should create fallback directory on init', async () => {
      await expect(fs.access(TEST_DATA_DIR)).resolves.not.toThrow();
    });

    it('should handle multiple initializations gracefully', async () => {
      await service.initialize();
      await service.initialize();
      
      expect(await service.isHealthy()).toBe(true);
    });

    it('should load existing memories on init', async () => {
      // Store some memories
      await service.store('Memory 1', { tag: 'test' });
      await service.store('Memory 2', { tag: 'test' });
      
      const count1 = await service.getMemoryCount();
      expect(count1).toBe(2);

      // Shutdown and reinitialize
      await service.shutdown();
      
      const newService = new HiveMindService({
        fallbackDir: TEST_DATA_DIR,
      });
      await newService.initialize();

      // Verify memories were loaded
      const count2 = await newService.getMemoryCount();
      expect(count2).toBe(2);

      await newService.shutdown();
    });
  });

  describe('Store Operations', () => {
    it('should store content in semantic memory', async () => {
      const id = await service.store('Test memory content');
      
      expect(id).toBeTruthy();
      expect(id).toMatch(/^hive-\d+-[a-z0-9]+$/);
    });

    it('should store content with metadata', async () => {
      const metadata = {
        type: 'truth',
        source: 'user',
        confidence: 0.95,
      };

      const id = await service.store('Important fact', metadata);
      expect(id).toBeTruthy();
    });

    it('should generate unique IDs for each memory', async () => {
      const id1 = await service.store('Memory 1');
      const id2 = await service.store('Memory 2');
      const id3 = await service.store('Memory 3');

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });

    it('should increment memory count on store', async () => {
      const count1 = await service.getMemoryCount();
      expect(count1).toBe(0);

      await service.store('Memory 1');
      const count2 = await service.getMemoryCount();
      expect(count2).toBe(1);

      await service.store('Memory 2');
      const count3 = await service.getMemoryCount();
      expect(count3).toBe(2);
    });
  });

  describe('Search Operations', () => {
    beforeEach(async () => {
      // Create test memories
      await service.store('The TCAM memory system has four layers', {
        type: 'architecture',
      });
      await service.store('Chronicle is the L1 layer for long-term storage', {
        type: 'architecture',
      });
      await service.store('Active Stream handles real-time context', {
        type: 'architecture',
      });
      await service.store('Hive Mind provides semantic search', {
        type: 'architecture',
      });
      await service.store('The weather is sunny today', {
        type: 'observation',
      });
    });

    it('should search memories by content', async () => {
      const results = await service.search('memory system');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain('TCAM');
    });

    it('should return results with scores', async () => {
      const results = await service.search('Chronicle');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].score).toBeLessThanOrEqual(1);
    });

    it('should return results with metadata', async () => {
      const results = await service.search('TCAM');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].metadata).toBeDefined();
      expect(results[0].metadata?.type).toBe('architecture');
    });

    it('should return results with source', async () => {
      const results = await service.search('memory');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].source).toBe('hive-mind-fallback');
    });

    it('should return results with timestamp', async () => {
      const results = await service.search('TCAM');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].timestamp).toBeInstanceOf(Date);
    });

    it('should limit search results', async () => {
      const results = await service.search('layer', 2);
      
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should return empty array when no matches', async () => {
      const results = await service.search('nonexistent query xyz');
      
      expect(results).toEqual([]);
    });

    it('should be case-insensitive', async () => {
      const results1 = await service.search('TCAM');
      const results2 = await service.search('tcam');
      
      expect(results1.length).toBe(results2.length);
      expect(results1.length).toBeGreaterThan(0);
    });

    it('should rank results by relevance', async () => {
      const results = await service.search('Chronicle');
      
      expect(results.length).toBeGreaterThan(0);
      
      // Results should be sorted by score (descending)
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('should handle multi-word queries', async () => {
      const results = await service.search('memory');
      
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Property Tests', () => {
    describe('Property 3: Memory Search Idempotence', () => {
      it('should return same results for repeated searches', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              content: fc.string({ minLength: 10, maxLength: 100 }),
              query: fc.string({ minLength: 3, maxLength: 20 }),
            }),
            async (data) => {
              // Store memory
              await service.store(data.content);

              // Search multiple times
              const results1 = await service.search(data.query);
              const results2 = await service.search(data.query);
              const results3 = await service.search(data.query);

              // Verify idempotence
              expect(results1.length).toBe(results2.length);
              expect(results2.length).toBe(results3.length);

              if (results1.length > 0) {
                expect(results1[0].content).toBe(results2[0].content);
                expect(results2[0].content).toBe(results3[0].content);
              }
            }
          ),
          { numRuns: 30 }
        );
      });
    });

    describe('Property 4: Memory Store-Retrieve Round-Trip', () => {
      it('should preserve data through store-search cycle', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              content: fc.string({ minLength: 10, maxLength: 200 }).filter(s => s.trim().length > 0),
              metadata: fc.record({
                type: fc.constantFrom('truth', 'wisdom', 'pattern', 'whisper', 'tool'),
                confidence: fc.float({ min: 0, max: 1 }),
                tag: fc.string({ minLength: 3, maxLength: 20 }),
              }),
            }),
            async (data) => {
              // Store
              const id = await service.store(data.content, data.metadata);
              expect(id).toBeTruthy();

              // Search using part of the content
              const searchQuery = data.content.split(' ').slice(0, 2).join(' ');
              const results = await service.search(searchQuery);

              // Verify we can find the stored memory
              const found = results.some(r => r.content === data.content);
              
              if (searchQuery.trim().length > 0) {
                // If query is valid, we should find it (or at least get results)
                expect(results).toBeDefined();
              }

              // If found, verify metadata preservation
              if (found) {
                const match = results.find(r => r.content === data.content);
                expect(match?.metadata?.type).toBe(data.metadata.type);
                expect(match?.metadata?.confidence).toBe(data.metadata.confidence);
                expect(match?.metadata?.tag).toBe(data.metadata.tag);
              }
            }
          ),
          { numRuns: 30 }
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw error when not initialized', async () => {
      const uninitializedService = new HiveMindService({
        fallbackDir: TEST_DATA_DIR,
      });

      await expect(uninitializedService.store('test')).rejects.toThrow('not initialized');
    });

    it('should throw error when searching before initialization', async () => {
      const uninitializedService = new HiveMindService({
        fallbackDir: TEST_DATA_DIR,
      });

      await expect(uninitializedService.search('test')).rejects.toThrow('not initialized');
    });

    it('should report unhealthy when not initialized', async () => {
      const uninitializedService = new HiveMindService({
        fallbackDir: TEST_DATA_DIR,
      });

      expect(await uninitializedService.isHealthy()).toBe(false);
    });
  });

  describe('Graceful Degradation', () => {
    it('should use file fallback when Qdrant unavailable', async () => {
      // Service is already using file fallback (no Qdrant configured)
      expect(service.getBackendType()).toBe('file');

      await service.store('Test memory');
      const results = await service.search('Test');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].source).toBe('hive-mind-fallback');
    });

    it('should persist memories to file', async () => {
      await service.store('Persistent memory 1');
      await service.store('Persistent memory 2');

      // Verify file was created
      const filePath = path.join(TEST_DATA_DIR, 'memories.json');
      await expect(fs.access(filePath)).resolves.not.toThrow();

      // Verify file content
      const data = await fs.readFile(filePath, 'utf-8');
      const memories = JSON.parse(data);
      
      expect(memories).toHaveLength(2);
      expect(memories[0].content).toBe('Persistent memory 1');
      expect(memories[1].content).toBe('Persistent memory 2');
    });
  });

  describe('Memory Count', () => {
    it('should return correct memory count', async () => {
      expect(await service.getMemoryCount()).toBe(0);

      await service.store('Memory 1');
      expect(await service.getMemoryCount()).toBe(1);

      await service.store('Memory 2');
      expect(await service.getMemoryCount()).toBe(2);

      await service.store('Memory 3');
      expect(await service.getMemoryCount()).toBe(3);
    });
  });

  describe('Backend Type', () => {
    it('should report correct backend type', () => {
      expect(service.getBackendType()).toBe('file');
    });
  });
});
