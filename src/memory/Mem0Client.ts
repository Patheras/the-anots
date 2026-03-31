import { MemoryClient } from 'mem0ai';
import type { QdrantClient } from '../vectordb/QdrantClient';
import type { OllamaClient } from '../llm/OllamaClient';

export interface Mem0Config {
  vectorStore: {
    provider: 'qdrant';
    config: {
      host: string;
      port: number;
      collection: string;
    };
  };
  llm: {
    provider: 'ollama';
    config: {
      model: string;
      temperature: number;
    };
  };
}

export interface Mem0Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface Mem0Memory {
  id: string;
  memory?: string;
  metadata?: Record<string, unknown>;
  score?: number;
}

export interface Mem0AddOptions {
  userId?: string;
  agentId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface Mem0SearchOptions {
  userId?: string;
  agentId?: string;
  limit?: number;
}

/**
 * Mem0 client wrapper for automatic fact extraction and memory management.
 * 
 * Integrates with:
 * - Qdrant for vector storage
 * - Qwen 3.5 9B (via Ollama) for LLM operations
 * 
 * Requirements: 14.1, 14.2
 */
export class Mem0Client {
  private client: MemoryClient;
  private config: Mem0Config;

  constructor(config: Mem0Config) {
    this.config = config;
    this.client = new MemoryClient({
      apiKey: 'not-needed-for-local', // Mem0 requires this but we use local services
    });
  }

  /**
   * Add memories from messages (automatic fact extraction).
   * 
   * @param messages - Messages to extract memories from
   * @param options - User/agent/session context
   * @returns Extracted memories
   * 
   * Requirements: 8.1, 8.2, 14.2
   */
  async add(messages: Mem0Message[], options: Mem0AddOptions = {}): Promise<Mem0Memory[]> {
    try {
      const result = await this.client.add(messages, {
        user_id: options.userId,
        agent_id: options.agentId,
        metadata: {
          ...options.metadata,
          sessionId: options.sessionId,
        },
      });

      // Mem0 returns array of memory objects
      return Array.isArray(result) ? result as Mem0Memory[] : [result as Mem0Memory];
    } catch (error) {
      console.error('[Mem0Client] Failed to add memories:', error);
      throw error;
    }
  }

  /**
   * Search memories semantically.
   * 
   * @param query - Search query
   * @param options - User/agent context and limit
   * @returns Matching memories with scores
   * 
   * Requirements: 11.1, 11.2, 11.3, 14.3
   */
  async search(query: string, options: Mem0SearchOptions = {}): Promise<Mem0Memory[]> {
    try {
      const result = await this.client.search(query, {
        user_id: options.userId,
        agent_id: options.agentId,
        limit: options.limit ?? 20,
      });

      return Array.isArray(result) ? result as Mem0Memory[] : [];
    } catch (error) {
      console.error('[Mem0Client] Failed to search memories:', error);
      throw error;
    }
  }

  /**
   * Get all memories for a user/agent.
   * 
   * @param options - User/agent context
   * @returns All memories
   */
  async getAll(options: Mem0SearchOptions = {}): Promise<Mem0Memory[]> {
    try {
      const result = await this.client.getAll({
        user_id: options.userId,
        agent_id: options.agentId,
      });

      return Array.isArray(result) ? result as Mem0Memory[] : [];
    } catch (error) {
      console.error('[Mem0Client] Failed to get all memories:', error);
      throw error;
    }
  }

  /**
   * Delete a specific memory.
   * 
   * @param memoryId - Memory ID to delete
   */
  async delete(memoryId: string): Promise<void> {
    try {
      await this.client.delete(memoryId);
    } catch (error) {
      console.error('[Mem0Client] Failed to delete memory:', error);
      throw error;
    }
  }

  /**
   * Check if Mem0 is healthy and connected.
   * 
   * @returns True if healthy
   * 
   * Requirements: 13.1
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Try a simple search to verify connectivity
      await this.search('health check', { limit: 1 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get Mem0 configuration.
   */
  getConfig(): Mem0Config {
    return { ...this.config };
  }
}
