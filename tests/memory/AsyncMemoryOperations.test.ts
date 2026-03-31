/**
 * Tests for Async Memory Operations
 * 
 * Requirements: 7.7, 8.6, 2.3
 */

import {
  AsyncMemoryOperations,
  createAsyncMemoryOperations,
} from '../../src/memory/AsyncMemoryOperations';
import { createMemoryService } from '../../src/memory/MemoryService';

describe('AsyncMemoryOperations', () => {
  let asyncOps: AsyncMemoryOperations;

  beforeEach(() => {
    const memoryService = createMemoryService({
      llm: {
        baseUrl: 'http://localhost:11434',
        model: 'qwen2.5:9b-instruct-q4_K_M',
        temperature: 0.3,
      },
      qdrant: {
        url: 'http://localhost:6333',
      },
      mem0: {
        vectorStore: {
          provider: 'qdrant',
          config: {
            host: 'localhost',
            port: 6333,
            collection: 'tcam_hive_truths',
          },
        },
        llm: {
          provider: 'ollama',
          config: {
            model: 'qwen2.5:9b-instruct-q4_K_M',
            temperature: 0.3,
          },
        },
      },
      redis: {
        url: 'redis://localhost:9999', // Non-existent for testing
        database: 0,
      },
    });

    asyncOps = createAsyncMemoryOperations(memoryService, 3);
  });

  afterEach(() => {
    asyncOps.clear();
  });

  describe('Initialization', () => {
    it('should create async operations manager', () => {
      expect(asyncOps).toBeDefined();
    });

    it('should start with no operations', () => {
      expect(asyncOps.getAllOperations()).toHaveLength(0);
      expect(asyncOps.hasPendingOperations()).toBe(false);
    });
  });

  describe('Truth Extraction', () => {
    it('should queue truth extraction operation', () => {
      const dialogue = 'User: Hello\nAssistant: Hi there!';
      
      const operationId = asyncOps.queueTruthExtraction(dialogue);
      
      expect(operationId).toBeDefined();
      expect(operationId).toContain('extract_');
      
      const operation = asyncOps.getOperation(operationId);
      expect(operation).toBeDefined();
      expect(operation?.type).toBe('extract_truths');
      expect(operation?.status).toMatch(/pending|running/);
    });

    it('should execute truth extraction asynchronously', async () => {
      const dialogue = 'User: My name is Alice';
      
      const operationId = asyncOps.queueTruthExtraction(dialogue, {
        sessionId: 'test-session',
        userId: 'test-user',
      });
      
      // Wait for operation to complete
      await asyncOps.waitForPendingOperations(10000);
      
      const operation = asyncOps.getOperation(operationId);
      expect(operation?.status).toMatch(/completed|failed/);
      expect(operation?.completedAt).toBeDefined();
    }, 15000);

    it('should not block on truth extraction', () => {
      const dialogue = 'User: Test message';
      
      const startTime = Date.now();
      asyncOps.queueTruthExtraction(dialogue);
      const duration = Date.now() - startTime;
      
      // Should return immediately (< 100ms)
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Truth Indexing', () => {
    it('should queue truth indexing operation', () => {
      const truths = [
        {
          id: 'truth_1',
          subject: 'Alice',
          predicate: 'works as',
          object: 'engineer',
          confidence: 0.95,
          timestamp: new Date(),
          source: 'mem0_extraction',
        },
      ];
      
      const operationId = asyncOps.queueTruthIndexing(truths);
      
      expect(operationId).toBeDefined();
      expect(operationId).toContain('index_');
      
      const operation = asyncOps.getOperation(operationId);
      expect(operation).toBeDefined();
      expect(operation?.type).toBe('index_truths');
    });

    it('should execute truth indexing asynchronously', async () => {
      const truths = [
        {
          id: 'truth_1',
          subject: 'Test',
          predicate: 'is',
          object: 'value',
          confidence: 0.9,
          timestamp: new Date(),
          source: 'manual',
        },
      ];
      
      const operationId = asyncOps.queueTruthIndexing(truths, { batchSize: 10 });
      
      // Wait for operation to complete
      await asyncOps.waitForPendingOperations(10000);
      
      const operation = asyncOps.getOperation(operationId);
      expect(operation?.status).toMatch(/completed|failed/);
    }, 15000);

    it('should not block on truth indexing', () => {
      const truths = [{ id: 'test', subject: 'a', predicate: 'b', object: 'c', confidence: 0.9, timestamp: new Date(), source: 'manual' }];
      
      const startTime = Date.now();
      asyncOps.queueTruthIndexing(truths);
      const duration = Date.now() - startTime;
      
      // Should return immediately
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Chronicle Inscription', () => {
    it('should queue chronicle inscription operation', () => {
      const session = {
        date: '2025-03-24',
        chapterId: 'test-chapter',
        participants: ['chip', 'user'],
        sessionType: 'general',
        dialogue: [],
      };
      
      const operationId = asyncOps.queueChronicleInscription(session);
      
      expect(operationId).toBeDefined();
      expect(operationId).toContain('inscribe_');
      
      const operation = asyncOps.getOperation(operationId);
      expect(operation).toBeDefined();
      expect(operation?.type).toBe('inscribe_chronicle');
    });

    it('should execute chronicle inscription asynchronously', async () => {
      const session = {
        date: '2025-03-24',
        chapterId: 'test-chapter',
        participants: ['chip', 'user'],
        sessionType: 'general',
        dialogue: [
          { role: 'user', content: 'Test', timestamp: new Date().toISOString() },
        ],
      };
      
      const operationId = asyncOps.queueChronicleInscription(session);
      
      // Wait for operation to complete
      await asyncOps.waitForPendingOperations(10000);
      
      const operation = asyncOps.getOperation(operationId);
      expect(operation?.status).toMatch(/completed|failed/);
    }, 15000);
  });

  describe('Operation Management', () => {
    it('should track all operations', () => {
      asyncOps.queueTruthExtraction('Test 1');
      asyncOps.queueTruthExtraction('Test 2');
      asyncOps.queueTruthIndexing([]);
      
      const allOps = asyncOps.getAllOperations();
      expect(allOps.length).toBeGreaterThanOrEqual(3);
    });

    it('should get operation by ID', () => {
      const operationId = asyncOps.queueTruthExtraction('Test');
      
      const operation = asyncOps.getOperation(operationId);
      expect(operation).toBeDefined();
      expect(operation?.id).toBe(operationId);
    });

    it('should filter operations by status', async () => {
      asyncOps.queueTruthExtraction('Test 1');
      asyncOps.queueTruthExtraction('Test 2');
      
      // Give operations a moment to start
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      // Should have some operations (pending or running)
      const allOps = asyncOps.getAllOperations();
      expect(allOps.length).toBeGreaterThan(0);
      
      // Wait for completion
      await asyncOps.waitForPendingOperations(10000);
      
      // Should have completed or failed operations
      const completed = asyncOps.getCompletedOperations();
      const failed = asyncOps.getFailedOperations();
      expect(completed.length + failed.length).toBeGreaterThan(0);
    }, 15000);

    it('should get operation count', () => {
      asyncOps.queueTruthExtraction('Test 1');
      asyncOps.queueTruthExtraction('Test 2');
      
      const totalCount = asyncOps.getOperationCount();
      expect(totalCount).toBeGreaterThanOrEqual(2);
      
      const pendingCount = asyncOps.getOperationCount('pending');
      expect(pendingCount).toBeGreaterThanOrEqual(0);
    });

    it('should clear all operations', () => {
      asyncOps.queueTruthExtraction('Test 1');
      asyncOps.queueTruthExtraction('Test 2');
      
      expect(asyncOps.getAllOperations().length).toBeGreaterThan(0);
      
      asyncOps.clear();
      
      expect(asyncOps.getAllOperations()).toHaveLength(0);
      expect(asyncOps.hasPendingOperations()).toBe(false);
    });
  });

  describe('Concurrent Operations', () => {
    it('should process multiple operations concurrently', async () => {
      // Queue multiple operations
      asyncOps.queueTruthExtraction('Test 1');
      asyncOps.queueTruthExtraction('Test 2');
      asyncOps.queueTruthExtraction('Test 3');
      asyncOps.queueTruthExtraction('Test 4');
      
      // Wait for all to complete
      await asyncOps.waitForPendingOperations(20000);
      
      const allOps = asyncOps.getAllOperations();
      expect(allOps.length).toBe(4);
      
      // All should be completed or failed
      allOps.forEach((op) => {
        expect(op.status).toMatch(/completed|failed/);
      });
    }, 25000);

    it('should respect max concurrent limit', async () => {
      // Create manager with max 2 concurrent
      const memoryService = createMemoryService({
        llm: { baseUrl: 'http://localhost:11434', model: 'qwen2.5:9b-instruct-q4_K_M', temperature: 0.3 },
        qdrant: { url: 'http://localhost:6333' },
        mem0: {
          vectorStore: { provider: 'qdrant', config: { host: 'localhost', port: 6333, collection: 'tcam_hive_truths' } },
          llm: { provider: 'ollama', config: { model: 'qwen2.5:9b-instruct-q4_K_M', temperature: 0.3 } },
        },
        redis: { url: 'redis://localhost:9999', database: 0 },
      });
      
      const limitedOps = createAsyncMemoryOperations(memoryService, 2);
      
      // Queue 5 operations
      limitedOps.queueTruthExtraction('Test 1');
      limitedOps.queueTruthExtraction('Test 2');
      limitedOps.queueTruthExtraction('Test 3');
      limitedOps.queueTruthExtraction('Test 4');
      limitedOps.queueTruthExtraction('Test 5');
      
      // Check running operations (should be <= 2)
      await new Promise((resolve) => setTimeout(resolve, 500));
      const running = limitedOps.getRunningOperations();
      expect(running.length).toBeLessThanOrEqual(2);
      
      // Wait for all to complete
      await limitedOps.waitForPendingOperations(30000);
      
      limitedOps.clear();
    }, 35000);
  });

  describe('Wait for Pending Operations', () => {
    it('should wait for all operations to complete', async () => {
      asyncOps.queueTruthExtraction('Test 1');
      asyncOps.queueTruthExtraction('Test 2');
      
      expect(asyncOps.hasPendingOperations()).toBe(true);
      
      await asyncOps.waitForPendingOperations(10000);
      
      expect(asyncOps.hasPendingOperations()).toBe(false);
    }, 15000);

    it('should timeout if operations take too long', async () => {
      asyncOps.queueTruthExtraction('Test 1');
      asyncOps.queueTruthExtraction('Test 2');
      
      // Very short timeout should fail
      await expect(
        asyncOps.waitForPendingOperations(10)
      ).rejects.toThrow('Timeout');
    });

    it('should return immediately if no pending operations', async () => {
      const startTime = Date.now();
      await asyncOps.waitForPendingOperations(5000);
      const duration = Date.now() - startTime;
      
      // Should return almost immediately
      expect(duration).toBeLessThan(200);
    });
  });

  describe('Error Handling', () => {
    it('should handle operation failures gracefully', async () => {
      // Queue operation with invalid data
      const operationId = asyncOps.queueTruthExtraction('');
      
      // Wait for operation to complete
      await asyncOps.waitForPendingOperations(10000);
      
      const operation = asyncOps.getOperation(operationId);
      
      // Operation should complete (even if it fails internally)
      expect(operation?.status).toMatch(/completed|failed/);
      expect(operation?.completedAt).toBeDefined();
    }, 15000);

    it('should continue processing after failure', async () => {
      // Queue multiple operations, some may fail
      asyncOps.queueTruthExtraction(''); // May fail
      asyncOps.queueTruthExtraction('Valid dialogue');
      asyncOps.queueTruthExtraction('Another valid dialogue');
      
      // Wait for all to complete
      await asyncOps.waitForPendingOperations(15000);
      
      const allOps = asyncOps.getAllOperations();
      
      // All should be completed or failed
      allOps.forEach((op) => {
        expect(op.status).toMatch(/completed|failed/);
      });
    }, 20000);
  });

  describe('Non-Blocking Behavior', () => {
    it('should not block main thread', () => {
      const startTime = Date.now();
      
      // Queue 10 operations
      for (let i = 0; i < 10; i++) {
        asyncOps.queueTruthExtraction(`Test ${i}`);
      }
      
      const duration = Date.now() - startTime;
      
      // Should return immediately (< 200ms for 10 operations)
      expect(duration).toBeLessThan(200);
    });

    it('should allow continued execution while processing', async () => {
      // Queue operations
      asyncOps.queueTruthExtraction('Test 1');
      asyncOps.queueTruthExtraction('Test 2');
      
      // Should be able to do other work immediately
      let counter = 0;
      for (let i = 0; i < 1000; i++) {
        counter++;
      }
      
      expect(counter).toBe(1000);
      expect(asyncOps.hasPendingOperations()).toBe(true);
      
      // Clean up
      await asyncOps.waitForPendingOperations(10000);
    }, 15000);
  });
});
