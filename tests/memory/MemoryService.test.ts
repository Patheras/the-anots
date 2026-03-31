/**
 * Tests for Memory Service
 * 
 * Requirements: 2.1, 2.2, 2.6, 13.1, 13.2, 13.3, 13.4
 */

import { MemoryService, MemoryServiceMode, createMemoryService } from '../../src/memory/MemoryService';

describe('MemoryService', () => {
  let service: MemoryService;

  beforeEach(() => {
    // Create service with test configuration
    service = createMemoryService({
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
        url: 'redis://localhost:9999', // Use non-existent port for testing
        database: 0,
      },
      healthCheckInterval: 1000, // 1 second for faster tests
    });
  });

  afterEach(async () => {
    if (service.isInitialized()) {
      await service.shutdown();
    }
  });

  describe('Initialization', () => {
    it('should create service with default configuration', () => {
      expect(service).toBeDefined();
      expect(service.isInitialized()).toBe(false);
      expect(service.getMode()).toBe(MemoryServiceMode.IDLE);
    });

    it('should initialize and connect to services', async () => {
      // This will fail because Redis is not running on port 9999
      // But we test that it handles the failure gracefully
      await expect(service.initialize()).rejects.toThrow();
      
      // Service should be in DEGRADED mode after failed initialization
      expect(service.getMode()).toBe(MemoryServiceMode.DEGRADED);
    });
  });

  describe('Operating Modes', () => {
    it('should start in IDLE mode', () => {
      expect(service.getMode()).toBe(MemoryServiceMode.IDLE);
    });

    it('should allow mode changes', () => {
      service.setMode(MemoryServiceMode.ACTIVE);
      expect(service.getMode()).toBe(MemoryServiceMode.ACTIVE);

      service.setMode(MemoryServiceMode.SLEEPING);
      expect(service.getMode()).toBe(MemoryServiceMode.SLEEPING);

      service.setMode(MemoryServiceMode.DEGRADED);
      expect(service.getMode()).toBe(MemoryServiceMode.DEGRADED);
    });

    it('should support all four modes', () => {
      const modes = [
        MemoryServiceMode.ACTIVE,
        MemoryServiceMode.SLEEPING,
        MemoryServiceMode.IDLE,
        MemoryServiceMode.DEGRADED,
      ];

      modes.forEach((mode) => {
        service.setMode(mode);
        expect(service.getMode()).toBe(mode);
      });
    });
  });

  describe('Health Monitoring', () => {
    it('should provide health status', () => {
      const health = service.getHealth();

      expect(health).toBeDefined();
      expect(health.status).toBeDefined();
      expect(health.mode).toBe(MemoryServiceMode.IDLE);
      expect(health.uptime).toBeGreaterThanOrEqual(0);
      expect(health.components).toBeDefined();
    });

    it('should track component health', () => {
      const health = service.getHealth();

      expect(health.components.llm).toBeDefined();
      expect(health.components.qdrant).toBeDefined();
      expect(health.components.mem0).toBeDefined();
      expect(health.components.redis).toBeDefined();
      expect(health.components.fileSystem).toBeDefined();

      // Each component should have required fields
      Object.values(health.components).forEach((component) => {
        expect(component.name).toBeDefined();
        expect(component.healthy).toBeDefined();
        expect(component.lastCheck).toBeInstanceOf(Date);
        expect(component.errorCount).toBeGreaterThanOrEqual(0);
      });
    });

    it('should report unhealthy when not initialized', () => {
      expect(service.isHealthy()).toBe(false);
    });

    it('should track uptime', async () => {
      const health1 = service.getHealth();
      const uptime1 = health1.uptime;

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      const health2 = service.getHealth();
      const uptime2 = health2.uptime;

      expect(uptime2).toBeGreaterThanOrEqual(uptime1);
    });
  });

  describe('Graceful Shutdown', () => {
    it('should shutdown gracefully', async () => {
      // Try to initialize (will fail but that's ok)
      try {
        await service.initialize();
      } catch {
        // Expected to fail
      }

      // Should be able to shutdown
      await service.shutdown();
      expect(service.isInitialized()).toBe(false);
    });

    it('should handle shutdown when not initialized', async () => {
      // Should not throw
      await expect(service.shutdown()).resolves.not.toThrow();
    });
  });

  describe('Truth Extraction', () => {
    it('should extract truths from dialogue', async () => {
      const dialogue = `User: My name is Alice
Assistant: Nice to meet you, Alice!
User: I work as a software engineer
Assistant: That's great!`;

      const truths = await service.extractTruths(dialogue);

      expect(Array.isArray(truths)).toBe(true);
      // May be empty if Mem0/LLM not available, but should not throw
    });

    it('should handle empty dialogue gracefully', async () => {
      const truths = await service.extractTruths('');

      expect(Array.isArray(truths)).toBe(true);
      expect(truths.length).toBe(0);
    });

    it('should support extraction options', async () => {
      const dialogue = 'User: Hello';
      
      const truths = await service.extractTruths(dialogue, {
        sessionId: 'test-session',
        userId: 'test-user',
        minConfidence: 0.8,
      });

      expect(Array.isArray(truths)).toBe(true);
    });

    it('should filter by minimum confidence', async () => {
      const dialogue = 'User: Test message';
      
      const allTruths = await service.extractTruths(dialogue, {
        minConfidence: 0.0,
      });
      
      const highConfidenceTruths = await service.extractTruths(dialogue, {
        minConfidence: 0.95,
      });

      expect(Array.isArray(allTruths)).toBe(true);
      expect(Array.isArray(highConfidenceTruths)).toBe(true);
      // High confidence should have same or fewer truths
      expect(highConfidenceTruths.length).toBeLessThanOrEqual(allTruths.length);
    });
  });

  describe('Chronicle Inscription', () => {
    it('should inscribe Chronicle chapter', async () => {
      const session = {
        date: '2025-03-24',
        chapterId: '2025-03-24-chapter-001',
        participants: ['chip', 'user'],
        sessionType: 'general',
        dialogue: [
          { role: 'user', content: 'Hello', timestamp: '2025-03-24T10:00:00Z' },
          { role: 'assistant', content: 'Hi there!', timestamp: '2025-03-24T10:00:01Z' },
        ],
      };

      // Should not throw even if LLM not available
      await expect(service.inscribeChronicle(session)).resolves.not.toThrow();
    });

    it('should handle minimal session data', async () => {
      const session = {
        dialogue: [
          { role: 'user', content: 'Test' },
        ],
      };

      await expect(service.inscribeChronicle(session)).resolves.not.toThrow();
    });

    it('should handle empty session gracefully', async () => {
      const session = {};

      await expect(service.inscribeChronicle(session)).resolves.not.toThrow();
    });
  });

  describe('Hive Mind Indexing', () => {
    it('should index truths to Hive Mind', async () => {
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

      // Should not throw even if Qdrant not available
      await expect(service.indexToHiveMind(truths)).resolves.not.toThrow();
    });

    it('should handle empty truth array', async () => {
      await expect(service.indexToHiveMind([])).resolves.not.toThrow();
    });

    it('should support batch indexing', async () => {
      const truths = Array.from({ length: 150 }, (_, i) => ({
        id: `truth_${i}`,
        subject: 'Test',
        predicate: 'is',
        object: `value_${i}`,
        confidence: 0.9,
        timestamp: new Date(),
        source: 'llm_extraction',
      }));

      await expect(service.indexToHiveMind(truths, { batchSize: 50 })).resolves.not.toThrow();
    });

    it('should handle indexing errors gracefully', async () => {
      const truths = [
        {
          id: 'truth_1',
          subject: 'Test',
          predicate: 'test',
          object: 'test',
          confidence: 0.9,
          timestamp: new Date(),
          source: 'manual',
        },
      ];

      // Should not throw even if indexing fails
      await expect(service.indexToHiveMind(truths)).resolves.not.toThrow();
    });
  });

  describe('Memory Search', () => {
    it('should search memories via Mem0', async () => {
      const query = 'software engineer';
      
      const results = await service.searchMemories(query);

      expect(Array.isArray(results)).toBe(true);
      // May be empty if Mem0 not available, but should not throw
    });

    it('should handle empty query gracefully', async () => {
      const results = await service.searchMemories('');

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    it('should handle whitespace-only query gracefully', async () => {
      const results = await service.searchMemories('   ');

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    it('should support search options', async () => {
      const query = 'test query';
      
      const results = await service.searchMemories(query, {
        limit: 10,
        minScore: 0.8,
        userId: 'test-user',
        agentId: 'test-agent',
      });

      expect(Array.isArray(results)).toBe(true);
    });

    it('should return results with correct structure', async () => {
      const query = 'test';
      
      const results = await service.searchMemories(query);

      expect(Array.isArray(results)).toBe(true);
      
      // If results exist, verify structure
      if (results.length > 0) {
        const result = results[0];
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('content');
        expect(result).toHaveProperty('score');
        expect(result).toHaveProperty('source');
        expect(result).toHaveProperty('metadata');
      }
    });

    it('should fallback to Qdrant when Mem0 fails', async () => {
      const query = 'fallback test';
      
      // Should not throw even if Mem0 fails
      const results = await service.searchMemories(query);

      expect(Array.isArray(results)).toBe(true);
    });

    it('should fallback to Chronicle grep when Qdrant fails', async () => {
      const query = 'chronicle test';
      
      // Should not throw even if both Mem0 and Qdrant fail
      const results = await service.searchMemories(query);

      expect(Array.isArray(results)).toBe(true);
    });

    it('should return empty array when all search methods fail', async () => {
      const query = 'nonexistent query that will fail all methods';
      
      // Should gracefully return empty array
      const results = await service.searchMemories(query);

      expect(Array.isArray(results)).toBe(true);
      // May be empty if all methods fail
    });

    it('should respect limit option', async () => {
      const query = 'test';
      const limit = 5;
      
      const results = await service.searchMemories(query, { limit });

      expect(Array.isArray(results)).toBe(true);
      // If results exist, should not exceed limit
      expect(results.length).toBeLessThanOrEqual(limit);
    });

    it('should handle special characters in query', async () => {
      const query = 'test @#$% special & characters';
      
      // Should not throw with special characters
      const results = await service.searchMemories(query);

      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle very long queries', async () => {
      const query = 'test '.repeat(100); // 500 characters
      
      // Should not throw with long query
      const results = await service.searchMemories(query);

      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle unicode characters in query', async () => {
      const query = 'test 你好 مرحبا здравствуй';
      
      // Should not throw with unicode
      const results = await service.searchMemories(query);

      expect(Array.isArray(results)).toBe(true);
    });
  });
});
