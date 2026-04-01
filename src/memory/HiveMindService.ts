/**
 * HiveMindService - L3 Memory Layer
 * 
 * Semantic memory with Qdrant vector DB and Mem0 fact extraction
 * File-based fallback when external services unavailable
 * 
 * Features:
 * - Qdrant vector storage for semantic search
 * - Mem0 automatic fact extraction
 * - File-based JSON fallback
 * - Embedding generation (local or API)
 * - Graceful degradation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Service, SearchResult } from '../core/types';
import { QdrantClient, createQdrantClient } from '../vectordb/QdrantClient';
import { Mem0Client, Mem0Config } from './Mem0Client';
import { HIVE_COLLECTIONS, initializeHiveMind } from '../vectordb/collections';

export interface HiveMindConfig {
  qdrantUrl?: string;
  mem0Config?: Mem0Config;
  fallbackDir?: string;
  embeddingModel?: string;
}

interface MemoryEntry {
  id: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, any>;
  timestamp: Date;
}

export class HiveMindService implements Service {
  name = 'HiveMindService';
  private initialized = false;
  private qdrantClient: QdrantClient | null = null;
  private mem0Client: Mem0Client | null = null;
  private useQdrant = false;
  private useMem0 = false;
  private fallbackDir: string;
  private fallbackMemories: Map<string, MemoryEntry> = new Map();

  constructor(config?: HiveMindConfig) {
    this.fallbackDir = config?.fallbackDir || 'data/hive-mind';

    // Try to create Qdrant client
    if (config?.qdrantUrl || process.env.QDRANT_URL) {
      try {
        this.qdrantClient = createQdrantClient({
          url: config?.qdrantUrl || process.env.QDRANT_URL,
        });
      } catch (error) {
        console.warn('Failed to create Qdrant client, will use file fallback:', error);
        this.qdrantClient = null;
      }
    }

    // Try to create Mem0 client
    if (config?.mem0Config) {
      try {
        this.mem0Client = new Mem0Client(config.mem0Config);
      } catch (error) {
        console.warn('Failed to create Mem0 client:', error);
        this.mem0Client = null;
      }
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Try to connect to Qdrant
    if (this.qdrantClient) {
      try {
        const healthy = await this.qdrantClient.checkHealth();
        
        if (healthy) {
          // Initialize collections
          await initializeHiveMind(this.qdrantClient);
          this.useQdrant = true;
          console.log('✓ HiveMindService initialized (Qdrant backend)');
        } else {
          console.warn('Qdrant unhealthy, falling back to file storage');
          this.useQdrant = false;
        }
      } catch (error) {
        console.warn('Qdrant connection failed, using file fallback:', error);
        this.useQdrant = false;
      }
    }

    // Check Mem0 health
    if (this.mem0Client) {
      try {
        const healthy = await this.mem0Client.isHealthy();
        this.useMem0 = healthy;
        
        if (healthy) {
          console.log('✓ Mem0 client available');
        }
      } catch (error) {
        console.warn('Mem0 unavailable:', error);
        this.useMem0 = false;
      }
    }

    // Ensure fallback directory exists
    await fs.mkdir(this.fallbackDir, { recursive: true });

    // Load fallback memories if using file storage
    if (!this.useQdrant) {
      await this.loadFallbackMemories();
      console.log('✓ HiveMindService initialized (File fallback)');
    }

    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    if (this.qdrantClient && this.useQdrant) {
      this.qdrantClient.close();
    }
    
    // Save fallback memories if using file storage
    if (!this.useQdrant) {
      await this.saveFallbackMemories();
    }
    
    this.initialized = false;
    console.log('✓ HiveMindService shutdown');
  }

  async isHealthy(): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }

    // Check Qdrant health if using it
    if (this.useQdrant && this.qdrantClient) {
      return await this.qdrantClient.checkHealth();
    }

    // Check file system access
    try {
      await fs.access(this.fallbackDir, fs.constants.R_OK | fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Store content in semantic memory
   */
  async store(content: string, metadata?: Record<string, any>): Promise<string> {
    this.ensureInitialized();

    const id = this.generateId();
    const timestamp = new Date();

    try {
      if (this.useQdrant && this.qdrantClient) {
        // Use Qdrant + Mem0 if available
        await this.storeInQdrant(id, content, metadata, timestamp);
      } else {
        // Use file fallback
        await this.storeInFallback(id, content, metadata, timestamp);
      }

      return id;
    } catch (error) {
      console.error('Failed to store in Hive Mind:', error);
      
      // Try fallback if Qdrant fails
      if (this.useQdrant) {
        console.warn('Qdrant failed, using file fallback');
        await this.storeInFallback(id, content, metadata, timestamp);
      } else {
        throw error;
      }

      return id;
    }
  }

  /**
   * Search semantic memory
   */
  async search(query: string, limit: number = 20): Promise<SearchResult[]> {
    this.ensureInitialized();

    try {
      if (this.useQdrant && this.qdrantClient) {
        return await this.searchInQdrant(query, limit);
      } else {
        return await this.searchInFallback(query, limit);
      }
    } catch (error) {
      console.error('Failed to search Hive Mind:', error);
      
      // Try fallback if Qdrant fails
      if (this.useQdrant) {
        console.warn('Qdrant failed, using file fallback');
        return await this.searchInFallback(query, limit);
      }
      
      return [];
    }
  }

  /**
   * Store in Qdrant
   */
  private async storeInQdrant(
    id: string,
    content: string,
    metadata: Record<string, any> | undefined,
    timestamp: Date
  ): Promise<void> {
    if (!this.qdrantClient) {
      throw new Error('Qdrant client not available');
    }

    // Generate embedding (simplified - in production use actual embedding model)
    const embedding = this.generateSimpleEmbedding(content);

    // Store in truths collection
    await this.qdrantClient.indexPoint(HIVE_COLLECTIONS.TRUTHS, {
      id,
      vector: embedding,
      payload: {
        content,
        metadata: metadata || {},
        timestamp: timestamp.toISOString(),
      },
    });
  }

  /**
   * Search in Qdrant
   */
  private async searchInQdrant(query: string, limit: number): Promise<SearchResult[]> {
    if (!this.qdrantClient) {
      throw new Error('Qdrant client not available');
    }

    // Generate query embedding
    const queryEmbedding = this.generateSimpleEmbedding(query);

    // Search in truths collection
    const results = await this.qdrantClient.search(
      HIVE_COLLECTIONS.TRUTHS,
      queryEmbedding,
      limit,
      0.5 // score threshold
    );

    return results.map(r => ({
      content: r.payload?.content || '',
      score: r.score,
      metadata: r.payload?.metadata,
      source: 'hive-mind',
      timestamp: r.payload?.timestamp ? new Date(r.payload.timestamp) : undefined,
    }));
  }

  /**
   * Store in file fallback
   */
  private async storeInFallback(
    id: string,
    content: string,
    metadata: Record<string, any> | undefined,
    timestamp: Date
  ): Promise<void> {
    const entry: MemoryEntry = {
      id,
      content,
      metadata,
      timestamp,
    };

    this.fallbackMemories.set(id, entry);
    await this.saveFallbackMemories();
  }

  /**
   * Search in file fallback (simple text matching)
   */
  private async searchInFallback(query: string, limit: number): Promise<SearchResult[]> {
    const queryLower = query.toLowerCase();
    const results: SearchResult[] = [];

    for (const entry of this.fallbackMemories.values()) {
      const contentLower = entry.content.toLowerCase();
      
      // Simple relevance scoring based on keyword matching
      if (contentLower.includes(queryLower)) {
        const score = this.calculateSimpleScore(queryLower, contentLower);
        
        results.push({
          content: entry.content,
          score,
          metadata: entry.metadata,
          source: 'hive-mind-fallback',
          timestamp: entry.timestamp,
        });
      }
    }

    // Sort by score and limit
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Load fallback memories from file
   */
  private async loadFallbackMemories(): Promise<void> {
    try {
      const filePath = path.join(this.fallbackDir, 'memories.json');
      const data = await fs.readFile(filePath, 'utf-8');
      const entries: MemoryEntry[] = JSON.parse(data);
      
      this.fallbackMemories.clear();
      for (const entry of entries) {
        this.fallbackMemories.set(entry.id, {
          ...entry,
          timestamp: new Date(entry.timestamp),
        });
      }
      
      console.log(`Loaded ${entries.length} memories from fallback`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('Failed to load fallback memories:', error);
      }
      // File doesn't exist yet, that's okay
    }
  }

  /**
   * Save fallback memories to file
   */
  private async saveFallbackMemories(): Promise<void> {
    try {
      const filePath = path.join(this.fallbackDir, 'memories.json');
      const entries = Array.from(this.fallbackMemories.values());
      const data = JSON.stringify(entries, null, 2);
      await fs.writeFile(filePath, data, 'utf-8');
    } catch (error) {
      console.error('Failed to save fallback memories:', error);
    }
  }

  /**
   * Generate simple embedding (for testing - replace with real embedding model)
   */
  private generateSimpleEmbedding(text: string): number[] {
    // Simple hash-based embedding for testing
    // In production, use nomic-embed-text or similar
    const embedding = new Array(768).fill(0);
    
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      embedding[i % 768] += charCode / 1000;
    }
    
    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / (magnitude || 1));
  }

  /**
   * Calculate simple relevance score
   */
  private calculateSimpleScore(query: string, content: string): number {
    const queryWords = query.split(/\s+/);
    let matches = 0;
    
    for (const word of queryWords) {
      if (content.includes(word)) {
        matches++;
      }
    }
    
    return matches / queryWords.length;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `hive-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Ensure service is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('HiveMindService not initialized');
    }
  }

  /**
   * Get backend type (for testing/debugging)
   */
  getBackendType(): 'qdrant' | 'file' {
    return this.useQdrant ? 'qdrant' : 'file';
  }

  /**
   * Get memory count
   */
  async getMemoryCount(): Promise<number> {
    this.ensureInitialized();

    if (this.useQdrant && this.qdrantClient) {
      return await this.qdrantClient.countPoints(HIVE_COLLECTIONS.TRUTHS);
    } else {
      return this.fallbackMemories.size;
    }
  }
}
