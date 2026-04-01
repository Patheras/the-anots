/**
 * UnifiedMemoryService - Orchestrates all 4 memory layers
 * 
 * Coordinates Chronicle (L1), Active Stream (L2), Hive Mind (L3), and Codex (L4)
 * with graceful degradation and automatic fallback chains.
 * 
 * Features:
 * - Unified search across all layers
 * - Automatic fallback: Hive Mind → Chronicle
 * - Layer health aggregation
 * - Graceful error handling
 * - Layer independence (failures don't cascade)
 */

import { Service, SearchResult, ActiveStreamState } from '../core/types';
import { ChronicleService } from './ChronicleService';
import { ActiveStreamService } from './ActiveStreamService';
import { HiveMindService } from './HiveMindService';
import { CodexService } from './CodexService';
import { AgentNode, CodexUpdate } from '../codex/types';

export interface UnifiedMemoryConfig {
  chronicleConfig?: any;
  activeStreamConfig?: any;
  hiveMindConfig?: any;
  codexConfig?: any;
}

export interface LayerHealth {
  chronicle: boolean;
  activeStream: boolean;
  hiveMind: boolean;
  codex: boolean;
}

export class UnifiedMemoryService implements Service {
  name = 'UnifiedMemoryService';
  private initialized = false;

  // Layer services
  private chronicle: ChronicleService;
  private activeStream: ActiveStreamService;
  private hiveMind: HiveMindService;
  private codex: CodexService;

  constructor(config?: UnifiedMemoryConfig) {
    this.chronicle = new ChronicleService();
    this.activeStream = new ActiveStreamService(config?.activeStreamConfig);
    this.hiveMind = new HiveMindService(config?.hiveMindConfig);
    this.codex = new CodexService(config?.codexConfig);
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('Initializing Unified Memory Service...');

    // Initialize all layers independently (failures don't cascade)
    const results = await Promise.allSettled([
      this.chronicle.initialize(),
      this.activeStream.initialize(),
      this.hiveMind.initialize(),
      this.codex.initialize(),
    ]);

    // Log initialization results
    const layerNames = ['Chronicle', 'Active Stream', 'Hive Mind', 'Codex'];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        console.log(`✓ ${layerNames[index]} initialized`);
      } else {
        console.warn(`⚠ ${layerNames[index]} initialization failed:`, result.reason);
      }
    });

    this.initialized = true;
    console.log('✓ Unified Memory Service initialized');
  }

  async shutdown(): Promise<void> {
    console.log('Shutting down Unified Memory Service...');

    // Shutdown all layers
    await Promise.allSettled([
      this.chronicle.shutdown(),
      this.activeStream.shutdown(),
      this.hiveMind.shutdown(),
      this.codex.shutdown(),
    ]);

    this.initialized = false;
    console.log('✓ Unified Memory Service shutdown');
  }

  async isHealthy(): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }

    // Service is healthy if at least one layer is healthy
    const health = await this.getLayerHealth();
    return health.chronicle || health.activeStream || health.hiveMind || health.codex;
  }

  /**
   * Get health status of all layers
   */
  async getLayerHealth(): Promise<LayerHealth> {
    const [chronicle, activeStream, hiveMind, codex] = await Promise.all([
      this.chronicle.isHealthy().catch(() => false),
      this.activeStream.isHealthy().catch(() => false),
      this.hiveMind.isHealthy().catch(() => false),
      this.codex.isHealthy().catch(() => false),
    ]);

    return { chronicle, activeStream, hiveMind, codex };
  }

  /**
   * Search across all memory layers with automatic fallback
   * 
   * Search order:
   * 1. Hive Mind (semantic search) - if available
   * 2. Chronicle (text search) - fallback
   */
  async search(query: string, limit: number = 20): Promise<SearchResult[]> {
    this.ensureInitialized();

    try {
      // Try Hive Mind first (semantic search)
      const hiveMindHealthy = await this.hiveMind.isHealthy();
      
      if (hiveMindHealthy) {
        const results = await this.hiveMind.search(query, limit);
        
        if (results.length > 0) {
          return results;
        }
        
        // Hive Mind returned no results, fall back to Chronicle
        console.log('Hive Mind returned no results, falling back to Chronicle');
      } else {
        console.log('Hive Mind unavailable, using Chronicle');
      }

      // Fallback to Chronicle (text search)
      const chronicleHealthy = await this.chronicle.isHealthy();
      
      if (chronicleHealthy) {
        const chapters = await this.chronicle.search({ content: query });
        
        return chapters.slice(0, limit).map(chapter => ({
          content: chapter.content,
          score: 0.5, // Default score for text search
          metadata: chapter.metadata,
          source: 'chronicle',
          timestamp: new Date(chapter.date),
        }));
      }

      // No layers available
      console.warn('No memory layers available for search');
      return [];

    } catch (error) {
      console.error('Search failed:', error);
      return [];
    }
  }

  /**
   * Store content in memory with automatic layer selection
   * 
   * Storage strategy:
   * 1. Hive Mind (semantic indexing) - if available
   * 2. Chronicle (long-term storage) - always attempted
   */
  async store(content: string, metadata?: Record<string, any>): Promise<void> {
    this.ensureInitialized();

    const errors: string[] = [];

    // Try to store in Hive Mind (semantic indexing)
    try {
      const hiveMindHealthy = await this.hiveMind.isHealthy();
      
      if (hiveMindHealthy) {
        await this.hiveMind.store(content, metadata);
        console.log('✓ Stored in Hive Mind');
      }
    } catch (error) {
      errors.push(`Hive Mind: ${(error as Error).message}`);
      console.warn('Failed to store in Hive Mind:', error);
    }

    // Always try to store in Chronicle (long-term storage)
    try {
      const chronicleHealthy = await this.chronicle.isHealthy();
      
      if (chronicleHealthy) {
        await this.chronicle.write({
          chapterId: '', // Auto-generate
          date: new Date().toISOString().split('T')[0],
          participants: ['System'],
          sessionType: 'general',
          content,
          metadata,
        });
        console.log('✓ Stored in Chronicle');
      }
    } catch (error) {
      errors.push(`Chronicle: ${(error as Error).message}`);
      console.warn('Failed to store in Chronicle:', error);
    }

    // If both failed, throw error
    if (errors.length === 2) {
      throw new Error(`Failed to store in all layers: ${errors.join(', ')}`);
    }
  }

  /**
   * Get active context from Active Stream (L2)
   */
  async getContext(sessionId: string): Promise<ActiveStreamState | null> {
    this.ensureInitialized();

    try {
      return await this.activeStream.getContext(sessionId);
    } catch (error) {
      console.error('Failed to get context:', error);
      return null;
    }
  }

  /**
   * Update active context in Active Stream (L2)
   */
  async updateContext(sessionId: string, state: ActiveStreamState): Promise<void> {
    this.ensureInitialized();

    try {
      await this.activeStream.updateContext(sessionId, state);
    } catch (error) {
      console.error('Failed to update context:', error);
      throw error;
    }
  }

  /**
   * Clear active context from Active Stream (L2)
   */
  async clearContext(sessionId: string): Promise<void> {
    this.ensureInitialized();

    try {
      await this.activeStream.clear(sessionId);
    } catch (error) {
      console.error('Failed to clear context:', error);
      throw error;
    }
  }

  /**
   * List active sessions from Active Stream (L2)
   */
  async listSessions(): Promise<string[]> {
    this.ensureInitialized();

    try {
      return await this.activeStream.listSessions();
    } catch (error) {
      console.error('Failed to list sessions:', error);
      return [];
    }
  }

  /**
   * Read agent codex from Codex (L4)
   */
  async readCodex(node: AgentNode): Promise<any> {
    this.ensureInitialized();

    try {
      return await this.codex.read(node);
    } catch (error) {
      console.error(`Failed to read ${node} codex:`, error);
      throw error;
    }
  }

  /**
   * Write to agent codex in Codex (L4)
   */
  async writeCodex(update: CodexUpdate): Promise<void> {
    this.ensureInitialized();

    try {
      await this.codex.write(update);
    } catch (error) {
      console.error(`Failed to write to ${update.node} codex:`, error);
      throw error;
    }
  }

  /**
   * Get memory statistics across all layers
   */
  async getStats(): Promise<{
    chronicle: { chapterCount: number };
    activeStream: { sessionCount: number };
    hiveMind: { memoryCount: number };
    codex: { ubikInitialized: boolean; axiomInitialized: boolean };
  }> {
    this.ensureInitialized();

    const [chronicleChapters, sessions, hiveMindCount, ubikInit, axiomInit] = await Promise.all([
      this.chronicle.list().catch(() => []),
      this.activeStream.listSessions().catch(() => []),
      this.hiveMind.getMemoryCount().catch(() => 0),
      this.codex.isInitialized('ubik').catch(() => false),
      this.codex.isInitialized('axiom').catch(() => false),
    ]);

    return {
      chronicle: { chapterCount: chronicleChapters.length },
      activeStream: { sessionCount: sessions.length },
      hiveMind: { memoryCount: hiveMindCount },
      codex: { ubikInitialized: ubikInit, axiomInitialized: axiomInit },
    };
  }

  /**
   * Get individual layer services (for advanced usage)
   */
  getLayers() {
    return {
      chronicle: this.chronicle,
      activeStream: this.activeStream,
      hiveMind: this.hiveMind,
      codex: this.codex,
    };
  }

  /**
   * Ensure service is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('UnifiedMemoryService not initialized');
    }
  }
}
