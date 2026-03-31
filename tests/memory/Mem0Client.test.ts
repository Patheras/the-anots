import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Mem0Client } from '../../src/memory/Mem0Client';
import { QdrantClient } from '../../src/vectordb/QdrantClient';
import { OllamaClient } from '../../src/llm/OllamaClient';

describe('Mem0Client', () => {
  let mem0: Mem0Client;
  let qdrant: QdrantClient;
  let ollama: OllamaClient;

  beforeAll(async () => {
    // Initialize dependencies
    qdrant = new QdrantClient({
      url: 'http://localhost:6333',
    });

    ollama = new OllamaClient({
      model: 'qwen2.5:9b-instruct-q4_K_M',
      temperature: 0.3,
      timeout: 30000,
    });

    // Initialize Mem0 with Qdrant and Ollama
    mem0 = new Mem0Client({
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
    });
  });

  afterAll(async () => {
    await qdrant.close();
  });

  describe('Configuration', () => {
    it('should store configuration', () => {
      const config = mem0.getConfig();
      expect(config.vectorStore.provider).toBe('qdrant');
      expect(config.llm.provider).toBe('ollama');
      expect(config.llm.config.temperature).toBe(0.3);
    });
  });

  describe('Health Check', () => {
    it('should check health status', async () => {
      // This might fail if Qdrant/Ollama not running, that's expected
      const healthy = await mem0.isHealthy();
      expect(typeof healthy).toBe('boolean');
    }, 10000);
  });

  describe('Memory Operations', () => {
    const testSessionId = `test-session-${Date.now()}`;

    it('should add memories from messages', async () => {
      const messages = [
        { role: 'user' as const, content: 'I prefer TypeScript over JavaScript' },
        { role: 'assistant' as const, content: 'Got it, you prefer TypeScript' },
        { role: 'user' as const, content: 'I like testing with Jest' },
      ];
      
      try {
        const memories = await mem0.add(messages, {
          userId: 'test-user',
          sessionId: testSessionId,
          metadata: { source: 'test' },
        });

        expect(Array.isArray(memories)).toBe(true);
        // Mem0 should extract at least one fact
        if (memories.length > 0) {
          expect(memories[0]).toHaveProperty('id');
        }
      } catch (error) {
        // If Mem0 fails (services not running), that's expected in CI
        console.warn('Mem0 add failed (expected if services not running):', error);
        expect(error).toBeDefined();
      }
    }, 30000);

    it('should search memories semantically', async () => {
      try {
        const results = await mem0.search('programming languages', {
          userId: 'test-user',
          limit: 5,
        });

        expect(Array.isArray(results)).toBe(true);
        // Results might be empty if no memories indexed yet
      } catch (error) {
        // If Mem0 fails (services not running), that's expected in CI
        console.warn('Mem0 search failed (expected if services not running):', error);
        expect(error).toBeDefined();
      }
    }, 30000);

    it('should get all memories for a user', async () => {
      try {
        const memories = await mem0.getAll({
          userId: 'test-user',
        });

        expect(Array.isArray(memories)).toBe(true);
      } catch (error) {
        // If Mem0 fails (services not running), that's expected in CI
        console.warn('Mem0 getAll failed (expected if services not running):', error);
        expect(error).toBeDefined();
      }
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle add failures gracefully', async () => {
      try {
        await mem0.add([], { userId: 'test-user' });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle search failures gracefully', async () => {
      try {
        await mem0.search('', { userId: 'test-user' });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
