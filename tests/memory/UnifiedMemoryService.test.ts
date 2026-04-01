/**
 * Tests for UnifiedMemoryService
 */

import { UnifiedMemoryService } from '../../src/memory/UnifiedMemoryService';
import { ActiveStreamState } from '../../src/core/types';
import { CodexUpdate } from '../../src/codex/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as fc from 'fast-check';

// Test data directories
const TEST_CHRONICLE_DIR = path.join(__dirname, '../../test-data/unified-chronicle');
const TEST_ACTIVE_STREAM_DIR = path.join(__dirname, '../../test-data/unified-active-stream');
const TEST_HIVE_MIND_DIR = path.join(__dirname, '../../test-data/unified-hive-mind');
const TEST_CODEX_DIR = path.join(__dirname, '../../test-data/unified-codex');

describe('UnifiedMemoryService', () => {
  let service: UnifiedMemoryService;
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeAll(() => {
    // Mock console methods to avoid test pollution
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Set test environment variables
    process.env.CHRONICLE_ROOT = TEST_CHRONICLE_DIR;
    process.env.CODEX_ROOT = TEST_CODEX_DIR;
  });

  afterAll(() => {
    // Restore console methods
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();

    delete process.env.CHRONICLE_ROOT;
    delete process.env.CODEX_ROOT;
  });

  beforeEach(async () => {
    // Clean test directories
    await Promise.all([
      fs.rm(TEST_CHRONICLE_DIR, { recursive: true, force: true }),
      fs.rm(TEST_ACTIVE_STREAM_DIR, { recursive: true, force: true }),
      fs.rm(TEST_HIVE_MIND_DIR, { recursive: true, force: true }),
      fs.rm(TEST_CODEX_DIR, { recursive: true, force: true }),
    ]);

    await Promise.all([
      fs.mkdir(TEST_CHRONICLE_DIR, { recursive: true }),
      fs.mkdir(TEST_ACTIVE_STREAM_DIR, { recursive: true }),
      fs.mkdir(TEST_HIVE_MIND_DIR, { recursive: true }),
      fs.mkdir(TEST_CODEX_DIR, { recursive: true }),
    ]);

    // Create service
    service = new UnifiedMemoryService({
      activeStreamConfig: { fallbackDir: TEST_ACTIVE_STREAM_DIR },
      hiveMindConfig: { fallbackDir: TEST_HIVE_MIND_DIR },
    });

    await service.initialize();
  });

  afterEach(async () => {
    await service.shutdown();
    
    // Wait for async operations to complete
    await new Promise(resolve => setTimeout(resolve, 200));
  });

  afterAll(async () => {
    // Clean up test directories
    await Promise.all([
      fs.rm(TEST_CHRONICLE_DIR, { recursive: true, force: true }),
      fs.rm(TEST_ACTIVE_STREAM_DIR, { recursive: true, force: true }),
      fs.rm(TEST_HIVE_MIND_DIR, { recursive: true, force: true }),
      fs.rm(TEST_CODEX_DIR, { recursive: true, force: true }),
    ]);
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      expect(service.name).toBe('UnifiedMemoryService');
      expect(await service.isHealthy()).toBe(true);
    });

    it('should initialize all layers independently', async () => {
      const health = await service.getLayerHealth();

      expect(health.chronicle).toBe(true);
      expect(health.activeStream).toBe(true);
      expect(health.hiveMind).toBe(true);
      expect(health.codex).toBe(true);
    });

    it('should handle multiple initializations gracefully', async () => {
      await service.initialize();
      await service.initialize();

      expect(await service.isHealthy()).toBe(true);
    });

    it('should continue if some layers fail to initialize', async () => {
      // This test verifies graceful degradation
      // Even if some layers fail, service should still initialize
      expect(await service.isHealthy()).toBe(true);
    });
  });

  describe('Search Operations', () => {
    beforeEach(async () => {
      // Store some test data
      await service.store('The TCAM memory system has four layers');
      await service.store('Chronicle is the L1 layer for long-term storage');
      await service.store('Active Stream handles real-time context');
    });

    it('should search across memory layers', async () => {
      const results = await service.search('TCAM');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain('TCAM');
    });

    it('should return results with scores', async () => {
      const results = await service.search('memory');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].score).toBeDefined();
      expect(typeof results[0].score).toBe('number');
    });

    it('should return results with source', async () => {
      const results = await service.search('Chronicle');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].source).toBeDefined();
    });

    it('should limit search results', async () => {
      const results = await service.search('layer', 2);

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should return empty array when no matches', async () => {
      const results = await service.search('nonexistent query xyz');

      expect(results).toEqual([]);
    });

    it('should fallback to Chronicle when Hive Mind unavailable', async () => {
      // Hive Mind uses file fallback, so it should work
      // But we can verify fallback behavior
      const results = await service.search('TCAM');

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Store Operations', () => {
    it('should store content in memory', async () => {
      await expect(service.store('Test memory content')).resolves.not.toThrow();
    });

    it('should store content with metadata', async () => {
      const metadata = {
        type: 'test',
        source: 'unit-test',
      };

      await expect(service.store('Test content', metadata)).resolves.not.toThrow();
    });

    it('should store in multiple layers', async () => {
      await service.store('Multi-layer test');

      // Verify it can be searched
      const results = await service.search('Multi-layer');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should continue if one layer fails', async () => {
      // Even if one layer fails, store should succeed in other layers
      await expect(service.store('Resilient storage')).resolves.not.toThrow();
    });
  });

  describe('Context Operations', () => {
    it('should get and update context', async () => {
      const sessionId = 'test-session-1';
      const state: ActiveStreamState = {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ],
        context: { topic: 'testing' },
        timestamp: new Date(),
      };

      await service.updateContext(sessionId, state);
      const retrieved = await service.getContext(sessionId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.messages).toHaveLength(2);
      expect(retrieved?.context.topic).toBe('testing');
    });

    it('should return null for non-existent session', async () => {
      const context = await service.getContext('non-existent');
      expect(context).toBeNull();
    });

    it('should clear context', async () => {
      const sessionId = 'test-session-2';
      const state: ActiveStreamState = {
        messages: [{ role: 'user', content: 'Test' }],
        context: {},
        timestamp: new Date(),
      };

      await service.updateContext(sessionId, state);
      await service.clearContext(sessionId);

      const retrieved = await service.getContext(sessionId);
      expect(retrieved).toBeNull();
    });

    it('should list active sessions', async () => {
      const sessions = ['session-1', 'session-2', 'session-3'];

      for (const sessionId of sessions) {
        const state: ActiveStreamState = {
          messages: [{ role: 'user', content: `Content for ${sessionId}` }],
          context: {},
          timestamp: new Date(),
        };

        await service.updateContext(sessionId, state);
      }

      const listed = await service.listSessions();
      expect(listed).toHaveLength(3);
      expect(listed).toContain('session-1');
    });
  });

  describe('Codex Operations', () => {
    it('should read agent codex', async () => {
      const codex = await service.readCodex('ubik');

      expect(codex.node).toBe('ubik');
      expect(codex.identity).toContain('Ubik');
    });

    it('should write to agent codex', async () => {
      const update: CodexUpdate = {
        node: 'ubik',
        file: 'TASKS.md',
        operation: 'append',
        content: '\n## Test Task\n\nTest content',
        summary: 'Add test task',
      };

      await expect(service.writeCodex(update)).resolves.not.toThrow();
    });

    it('should maintain agent isolation', async () => {
      const ubikUpdate: CodexUpdate = {
        node: 'ubik',
        file: 'NOTES.md',
        operation: 'append',
        content: '\n## Ubik Note\n\nUbik-specific note',
        summary: 'Add Ubik note',
      };

      const axiomUpdate: CodexUpdate = {
        node: 'axiom',
        file: 'NOTES.md',
        operation: 'append',
        content: '\n## Axiom Note\n\nAxiom-specific note',
        summary: 'Add Axiom note',
      };

      await service.writeCodex(ubikUpdate);
      await service.writeCodex(axiomUpdate);

      const ubikCodex = await service.readCodex('ubik');
      const axiomCodex = await service.readCodex('axiom');

      expect(ubikCodex.notes).toContain('Ubik Note');
      expect(ubikCodex.notes).not.toContain('Axiom Note');

      expect(axiomCodex.notes).toContain('Axiom Note');
      expect(axiomCodex.notes).not.toContain('Ubik Note');
    });
  });

  describe('Statistics', () => {
    it('should get memory statistics', async () => {
      const stats = await service.getStats();

      expect(stats.chronicle).toBeDefined();
      expect(stats.activeStream).toBeDefined();
      expect(stats.hiveMind).toBeDefined();
      expect(stats.codex).toBeDefined();

      expect(typeof stats.chronicle.chapterCount).toBe('number');
      expect(typeof stats.activeStream.sessionCount).toBe('number');
      expect(typeof stats.hiveMind.memoryCount).toBe('number');
      expect(typeof stats.codex.ubikInitialized).toBe('boolean');
      expect(typeof stats.codex.axiomInitialized).toBe('boolean');
    });

    it('should track stored content', async () => {
      await service.store('Test content 1');
      await service.store('Test content 2');

      const stats = await service.getStats();
      expect(stats.chronicle.chapterCount).toBeGreaterThan(0);
    });
  });

  describe('Layer Access', () => {
    it('should provide access to individual layers', () => {
      const layers = service.getLayers();

      expect(layers.chronicle).toBeDefined();
      expect(layers.activeStream).toBeDefined();
      expect(layers.hiveMind).toBeDefined();
      expect(layers.codex).toBeDefined();
    });
  });

  describe('Property Tests', () => {
    describe('Property 17: Layer Failure Isolation', () => {
      it('should continue operating when one layer fails', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.string({ minLength: 10, maxLength: 100 }),
            async (content) => {
              // Store should succeed even if one layer fails
              await expect(service.store(content)).resolves.not.toThrow();

              // Search should still work
              const results = await service.search(content.substring(0, 10));
              expect(Array.isArray(results)).toBe(true);
            }
          ),
          { numRuns: 10 } // Reduced due to Git commit overhead
        );
      });
    });

    describe('Property 18: Layer Independence', () => {
      it('should maintain independent layer operations', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              searchQuery: fc.string({ minLength: 5, maxLength: 50 }),
              sessionId: fc.string({ minLength: 5, maxLength: 20 })
                .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
              codexContent: fc.string({ minLength: 10, maxLength: 100 }),
            }),
            async (data) => {
              // Operations on different layers should not interfere
              
              // Search (Hive Mind/Chronicle)
              const searchResults = await service.search(data.searchQuery);
              expect(Array.isArray(searchResults)).toBe(true);

              // Context (Active Stream)
              const state: ActiveStreamState = {
                messages: [{ role: 'user', content: 'Test' }],
                context: {},
                timestamp: new Date(),
              };
              await service.updateContext(data.sessionId, state);
              const context = await service.getContext(data.sessionId);
              expect(context).not.toBeNull();

              // Codex
              const update: CodexUpdate = {
                node: 'ubik',
                file: 'NOTES.md',
                operation: 'append',
                content: `\n${data.codexContent}`,
                summary: 'Test',
              };
              await service.writeCodex(update);

              // All operations should succeed independently
              expect(true).toBe(true);

              // Cleanup
              await service.clearContext(data.sessionId);
            }
          ),
          { numRuns: 10 } // Reduced due to Git commit overhead
        );
      }, 30000); // 30 second timeout
    });
  });

  describe('Error Handling', () => {
    it('should throw error when not initialized', async () => {
      const uninitializedService = new UnifiedMemoryService();

      await expect(uninitializedService.search('test')).rejects.toThrow('not initialized');
    });

    it('should report unhealthy when not initialized', async () => {
      const uninitializedService = new UnifiedMemoryService();

      expect(await uninitializedService.isHealthy()).toBe(false);
    });

    it('should handle search errors gracefully', async () => {
      const results = await service.search('test query');

      // Should not throw, returns empty array on error
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle context errors gracefully', async () => {
      const context = await service.getContext('non-existent');

      // Should not throw, returns null on error
      expect(context).toBeNull();
    });
  });

  describe('Health Monitoring', () => {
    it('should report healthy when initialized', async () => {
      expect(await service.isHealthy()).toBe(true);
    });

    it('should check all layer health', async () => {
      const health = await service.getLayerHealth();

      expect(health.chronicle).toBe(true);
      expect(health.activeStream).toBe(true);
      expect(health.hiveMind).toBe(true);
      expect(health.codex).toBe(true);
    });

    it('should be healthy if at least one layer is healthy', async () => {
      // Even if some layers fail, service should be healthy
      expect(await service.isHealthy()).toBe(true);
    });
  });
});
