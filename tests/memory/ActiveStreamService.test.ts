/**
 * Tests for ActiveStreamService
 */

import { ActiveStreamService } from '../../src/memory/ActiveStreamService';
import { ActiveStreamState } from '../../src/core/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as fc from 'fast-check';

// Test data directory
const TEST_DATA_DIR = path.join(__dirname, '../../test-data/active-stream');

describe('ActiveStreamService', () => {
  let service: ActiveStreamService;

  beforeEach(async () => {
    // Clean test directory
    await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_DATA_DIR, { recursive: true });

    // Create service with file fallback (no Redis for tests)
    service = new ActiveStreamService({
      fallbackDir: TEST_DATA_DIR,
      defaultTTL: 3600,
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
      expect(service.name).toBe('ActiveStreamService');
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
  });

  describe('Context Operations', () => {
    it('should store and retrieve context', async () => {
      const sessionId = 'test-session-1';
      const state: ActiveStreamState = {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ],
        currentAgent: 'ubik',
        context: { topic: 'testing' },
        timestamp: new Date(),
      };

      await service.updateContext(sessionId, state);
      const retrieved = await service.getContext(sessionId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.messages).toHaveLength(2);
      expect(retrieved?.messages[0].content).toBe('Hello');
      expect(retrieved?.currentAgent).toBe('ubik');
      expect(retrieved?.context.topic).toBe('testing');
    });

    it('should return null for non-existent session', async () => {
      const context = await service.getContext('non-existent');
      expect(context).toBeNull();
    });

    it('should update existing context', async () => {
      const sessionId = 'test-session-2';
      
      const state1: ActiveStreamState = {
        messages: [{ role: 'user', content: 'First' }],
        context: {},
        timestamp: new Date(),
      };

      const state2: ActiveStreamState = {
        messages: [
          { role: 'user', content: 'First' },
          { role: 'assistant', content: 'Second' },
        ],
        context: {},
        timestamp: new Date(),
      };

      await service.updateContext(sessionId, state1);
      await service.updateContext(sessionId, state2);

      const retrieved = await service.getContext(sessionId);
      expect(retrieved?.messages).toHaveLength(2);
    });

    it('should handle empty messages array', async () => {
      const sessionId = 'test-session-3';
      const state: ActiveStreamState = {
        messages: [],
        context: {},
        timestamp: new Date(),
      };

      await service.updateContext(sessionId, state);
      const retrieved = await service.getContext(sessionId);

      expect(retrieved?.messages).toEqual([]);
    });

    it('should preserve complex context data', async () => {
      const sessionId = 'test-session-4';
      const state: ActiveStreamState = {
        messages: [{ role: 'user', content: 'Test' }],
        currentAgent: 'axiom',
        context: {
          nested: {
            data: {
              value: 42,
              array: [1, 2, 3],
            },
          },
          metadata: {
            tags: ['test', 'complex'],
          },
        },
        timestamp: new Date(),
      };

      await service.updateContext(sessionId, state);
      const retrieved = await service.getContext(sessionId);

      expect(retrieved?.context.nested.data.value).toBe(42);
      expect(retrieved?.context.nested.data.array).toEqual([1, 2, 3]);
      expect(retrieved?.context.metadata.tags).toEqual(['test', 'complex']);
    });
  });

  describe('Clear Operations', () => {
    it('should clear session context', async () => {
      const sessionId = 'test-session-5';
      const state: ActiveStreamState = {
        messages: [{ role: 'user', content: 'Test' }],
        context: {},
        timestamp: new Date(),
      };

      await service.updateContext(sessionId, state);
      await service.clear(sessionId);

      const retrieved = await service.getContext(sessionId);
      expect(retrieved).toBeNull();
    });

    it('should handle clearing non-existent session', async () => {
      await expect(service.clear('non-existent')).resolves.not.toThrow();
    });
  });

  describe('List Operations', () => {
    it('should list all active sessions', async () => {
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
      expect(listed).toContain('session-2');
      expect(listed).toContain('session-3');
    });

    it('should return empty array when no sessions exist', async () => {
      const sessions = await service.listSessions();
      expect(sessions).toEqual([]);
    });
  });

  describe('Message History', () => {
    it('should maintain message order', async () => {
      const sessionId = 'test-session-6';
      const messages = [
        { role: 'user' as const, content: 'Message 1' },
        { role: 'assistant' as const, content: 'Response 1' },
        { role: 'user' as const, content: 'Message 2' },
        { role: 'assistant' as const, content: 'Response 2' },
      ];

      const state: ActiveStreamState = {
        messages,
        context: {},
        timestamp: new Date(),
      };

      await service.updateContext(sessionId, state);
      const retrieved = await service.getContext(sessionId);

      expect(retrieved?.messages).toHaveLength(4);
      expect(retrieved?.messages[0].content).toBe('Message 1');
      expect(retrieved?.messages[1].content).toBe('Response 1');
      expect(retrieved?.messages[2].content).toBe('Message 2');
      expect(retrieved?.messages[3].content).toBe('Response 2');
    });

    it('should handle long message history', async () => {
      const sessionId = 'test-session-7';
      const messages = Array.from({ length: 100 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
        content: `Message ${i}`,
      }));

      const state: ActiveStreamState = {
        messages,
        context: {},
        timestamp: new Date(),
      };

      await service.updateContext(sessionId, state);
      const retrieved = await service.getContext(sessionId);

      expect(retrieved?.messages).toHaveLength(100);
      expect(retrieved?.messages[99].content).toBe('Message 99');
    });
  });

  describe('Property Tests', () => {
    describe('Property 8: Interactive Context Preservation', () => {
      it('should preserve context through multiple updates', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              sessionId: fc.string({ minLength: 5, maxLength: 20 })
                .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)), // Valid filename characters only
              messages: fc.array(
                fc.record({
                  role: fc.constantFrom('user' as const, 'assistant' as const, 'system' as const),
                  content: fc.string({ minLength: 1, maxLength: 100 }),
                }),
                { minLength: 1, maxLength: 10 }
              ),
              contextData: fc.record({
                key1: fc.string(),
                key2: fc.integer(),
              }),
            }),
            async (data) => {
              const state: ActiveStreamState = {
                messages: data.messages,
                context: data.contextData,
                timestamp: new Date(),
              };

              // Write
              await service.updateContext(data.sessionId, state);

              // Read
              const retrieved = await service.getContext(data.sessionId);

              // Verify
              expect(retrieved).not.toBeNull();
              expect(retrieved?.messages).toHaveLength(data.messages.length);
              expect(retrieved?.context.key1).toBe(data.contextData.key1);
              expect(retrieved?.context.key2).toBe(data.contextData.key2);

              // Cleanup
              await service.clear(data.sessionId);
            }
          ),
          { numRuns: 50 }
        );
      });

      it('should handle rapid context updates', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.string({ minLength: 5, maxLength: 20 })
              .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)), // Valid filename characters only
            fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
            async (sessionId, contents) => {
              // Rapid updates
              for (const content of contents) {
                const state: ActiveStreamState = {
                  messages: [{ role: 'user', content }],
                  context: { lastUpdate: content },
                  timestamp: new Date(),
                };
                
                await service.updateContext(sessionId, state);
              }

              // Verify last update
              const retrieved = await service.getContext(sessionId);
              expect(retrieved?.context.lastUpdate).toBe(contents[contents.length - 1]);

              // Cleanup
              await service.clear(sessionId);
            }
          ),
          { numRuns: 30 }
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw error when not initialized', async () => {
      const uninitializedService = new ActiveStreamService({
        fallbackDir: TEST_DATA_DIR,
      });

      const state: ActiveStreamState = {
        messages: [],
        context: {},
        timestamp: new Date(),
      };

      await expect(uninitializedService.updateContext('test', state)).rejects.toThrow('not initialized');
    });

    it('should report unhealthy when not initialized', async () => {
      const uninitializedService = new ActiveStreamService({
        fallbackDir: TEST_DATA_DIR,
      });

      expect(await uninitializedService.isHealthy()).toBe(false);
    });
  });

  describe('Graceful Degradation', () => {
    it('should use file fallback when Redis unavailable', async () => {
      // Service is already using file fallback (no Redis configured)
      expect(service.getBackendType()).toBe('file');

      const sessionId = 'fallback-test';
      const state: ActiveStreamState = {
        messages: [{ role: 'user', content: 'Test fallback' }],
        context: {},
        timestamp: new Date(),
      };

      await service.updateContext(sessionId, state);
      const retrieved = await service.getContext(sessionId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.messages[0].content).toBe('Test fallback');
    });
  });

  describe('Timestamp Handling', () => {
    it('should preserve timestamp', async () => {
      const sessionId = 'timestamp-test';
      const now = new Date();
      
      const state: ActiveStreamState = {
        messages: [{ role: 'user', content: 'Test' }],
        context: {},
        timestamp: now,
      };

      await service.updateContext(sessionId, state);
      const retrieved = await service.getContext(sessionId);

      expect(retrieved?.timestamp).toBeTruthy();
      // Note: JSON serialization converts Date to string, so we compare ISO strings
      expect(new Date(retrieved!.timestamp).toISOString()).toBe(now.toISOString());
    });
  });
});
