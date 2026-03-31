/**
 * Memory Service - Core orchestrator for TCAM memory operations
 * 
 * Runs on Qwen 3.5 9B (local LLM) as a separate process from main dialogue.
 * Coordinates all memory operations across 4 layers (L1-L4).
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 * Whitepaper: Section 7.1 (Memory Service Implementation)
 */

import { OllamaClient } from '../llm/OllamaClient';
import { QdrantClient } from '../vectordb/QdrantClient';
import { Mem0Client } from './Mem0Client';
import { RedisClient } from '../state/RedisClient';

/**
 * Memory Service operating modes
 * 
 * - ACTIVE: Normal operation, processing memory operations
 * - SLEEPING: Consolidating memories (sleeping cycle)
 * - IDLE: No active operations, waiting for requests
 * - DEGRADED: One or more components failed, operating with reduced functionality
 * 
 * Requirement: 2.6
 */
export enum MemoryServiceMode {
  ACTIVE = 'ACTIVE',
  SLEEPING = 'SLEEPING',
  IDLE = 'IDLE',
  DEGRADED = 'DEGRADED',
}

/**
 * Health status for individual components
 */
export interface ComponentHealth {
  name: string;
  healthy: boolean;
  lastCheck: Date;
  errorCount: number;
  lastError?: string;
}

/**
 * Overall Memory Service health
 * 
 * Requirements: 13.1, 13.2, 13.6
 */
export interface MemoryServiceHealth {
  status: 'healthy' | 'degraded' | 'down';
  mode: MemoryServiceMode;
  uptime: number; // seconds
  components: {
    llm: ComponentHealth;
    qdrant: ComponentHealth;
    mem0: ComponentHealth;
    redis: ComponentHealth;
    fileSystem: ComponentHealth;
  };
  lastOperation: {
    type: string;
    timestamp: Date;
    success: boolean;
  } | null;
}

/**
 * Memory Service configuration
 * 
 * Requirement: 2.2
 */
export interface MemoryServiceConfig {
  llm: {
    baseUrl: string;
    model: string;
    temperature: number;
  };
  qdrant: {
    url: string;
    apiKey?: string;
  };
  mem0: {
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
  };
  redis: {
    url: string;
    password?: string;
    database?: number;
  };
  healthCheckInterval?: number; // milliseconds, default 30000 (30s)
}

/**
 * Memory Service State
 */
interface MemoryServiceState {
  mode: MemoryServiceMode;
  startTime: Date;
  health: MemoryServiceHealth;
  isInitialized: boolean;
}

/**
 * Memory Service
 * 
 * Core orchestrator for all memory operations in TCAM.
 * Runs on Qwen 3.5 9B (local LLM) as a separate process.
 * 
 * Features:
 * - Truth extraction from dialogue
 * - Chronicle inscription (L1)
 * - Hive Mind indexing (L3)
 * - Memory search
 * - Health monitoring
 * - Graceful degradation
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 * Whitepaper: Section 7.1
 */
export class MemoryService {
  private config: MemoryServiceConfig;
  private state: MemoryServiceState;
  
  // Clients
  private llm: OllamaClient;
  private qdrant: QdrantClient;
  private mem0: Mem0Client;
  private redis: RedisClient;
  
  // Health monitoring
  private healthCheckTimer?: NodeJS.Timeout;

  constructor(config: MemoryServiceConfig) {
    this.config = {
      healthCheckInterval: 30000, // 30 seconds default
      ...config,
    };

    // Initialize clients
    this.llm = new OllamaClient({
      baseUrl: this.config.llm.baseUrl,
      model: this.config.llm.model,
      temperature: this.config.llm.temperature,
    });

    this.qdrant = new QdrantClient({
      url: this.config.qdrant.url,
      apiKey: this.config.qdrant.apiKey,
    });

    this.mem0 = new Mem0Client(this.config.mem0);

    this.redis = new RedisClient({
      url: this.config.redis.url,
      password: this.config.redis.password,
      database: this.config.redis.database,
    });

    // Initialize state
    this.state = {
      mode: MemoryServiceMode.IDLE,
      startTime: new Date(),
      isInitialized: false,
      health: this.createInitialHealth(),
    };
  }

  /**
   * Initialize Memory Service
   * 
   * Connects to all external services and starts health monitoring.
   * 
   * Requirements: 2.1, 2.2
   */
  async initialize(): Promise<void> {
    console.log('[MemoryService] Initializing...');

    try {
      // Connect to Redis
      await this.redis.connect();
      console.log('[MemoryService] ✅ Redis connected');

      // Check other services
      await this.checkAllComponentsHealth();

      // Start health monitoring
      this.startHealthMonitoring();

      // Set mode based on health
      this.updateMode();

      this.state.isInitialized = true;
      console.log(`[MemoryService] ✅ Initialized in ${this.state.mode} mode`);
    } catch (error) {
      console.error('[MemoryService] ❌ Initialization failed:', error);
      this.state.mode = MemoryServiceMode.DEGRADED;
      throw error;
    }
  }

  /**
   * Shutdown Memory Service gracefully
   * 
   * Requirements: 2.5
   */
  async shutdown(): Promise<void> {
    console.log('[MemoryService] Shutting down...');

    // Stop health monitoring
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    // Close connections
    await this.redis.close();
    this.qdrant.close();

    this.state.isInitialized = false;
    console.log('[MemoryService] ✅ Shutdown complete');
  }

  /**
   * Get current operating mode
   * 
   * Requirement: 2.6
   */
  getMode(): MemoryServiceMode {
    return this.state.mode;
  }

  /**
   * Set operating mode
   * 
   * Requirement: 2.6
   */
  setMode(mode: MemoryServiceMode): void {
    const oldMode = this.state.mode;
    this.state.mode = mode;
    console.log(`[MemoryService] Mode changed: ${oldMode} → ${mode}`);
  }

  /**
   * Get health status
   * 
   * Requirements: 13.1, 13.2, 13.6, 13.7
   */
  getHealth(): MemoryServiceHealth {
    return {
      ...this.state.health,
      uptime: Math.floor((Date.now() - this.state.startTime.getTime()) / 1000),
    };
  }

  /**
   * Check if service is healthy
   * 
   * Requirement: 13.1
   */
  isHealthy(): boolean {
    return this.state.health.status === 'healthy';
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.state.isInitialized;
  }

  // ============================================================================
  // PRIVATE METHODS - Health Monitoring
  // ============================================================================

  /**
   * Create initial health state
   */
  private createInitialHealth(): MemoryServiceHealth {
    const now = new Date();
    const createComponent = (name: string): ComponentHealth => ({
      name,
      healthy: false,
      lastCheck: now,
      errorCount: 0,
    });

    return {
      status: 'down',
      mode: MemoryServiceMode.IDLE,
      uptime: 0,
      components: {
        llm: createComponent('Ollama (Qwen 3.5 9B)'),
        qdrant: createComponent('Qdrant'),
        mem0: createComponent('Mem0'),
        redis: createComponent('Redis'),
        fileSystem: createComponent('File System'),
      },
      lastOperation: null,
    };
  }

  /**
   * Start periodic health monitoring
   * 
   * Requirements: 13.3, 13.4
   */
  private startHealthMonitoring(): void {
    // Initial check
    this.checkAllComponentsHealth();

    // Periodic checks
    this.healthCheckTimer = setInterval(
      () => this.checkAllComponentsHealth(),
      this.config.healthCheckInterval
    );

    console.log(
      `[MemoryService] Health monitoring started (interval: ${this.config.healthCheckInterval}ms)`
    );
  }

  /**
   * Check health of all components
   * 
   * Requirements: 13.3, 13.4, 13.5
   */
  private async checkAllComponentsHealth(): Promise<void> {
    const now = new Date();

    // Check LLM (Ollama)
    try {
      const llmHealthy = await this.llm.testConnection();
      this.updateComponentHealth('llm', llmHealthy, now);
    } catch (error) {
      this.updateComponentHealth('llm', false, now, (error as Error).message);
    }

    // Check Qdrant
    try {
      const qdrantHealthy = await this.qdrant.checkHealth();
      this.updateComponentHealth('qdrant', qdrantHealthy, now);
    } catch (error) {
      this.updateComponentHealth('qdrant', false, now, (error as Error).message);
    }

    // Check Mem0
    try {
      const mem0Healthy = await this.mem0.isHealthy();
      this.updateComponentHealth('mem0', mem0Healthy, now);
    } catch (error) {
      this.updateComponentHealth('mem0', false, now, (error as Error).message);
    }

    // Check Redis
    try {
      const redisHealthy = await this.redis.checkHealth();
      this.updateComponentHealth('redis', redisHealthy, now);
    } catch (error) {
      this.updateComponentHealth('redis', false, now, (error as Error).message);
    }

    // Check File System (always healthy for now)
    this.updateComponentHealth('fileSystem', true, now);

    // Update overall status
    this.updateOverallHealth();
    this.updateMode();
  }

  /**
   * Update individual component health
   */
  private updateComponentHealth(
    component: keyof MemoryServiceHealth['components'],
    healthy: boolean,
    lastCheck: Date,
    error?: string
  ): void {
    const comp = this.state.health.components[component];
    
    if (!healthy) {
      comp.errorCount++;
      comp.lastError = error;
    }
    
    comp.healthy = healthy;
    comp.lastCheck = lastCheck;
  }

  /**
   * Update overall health status
   * 
   * Requirements: 13.1, 13.2
   */
  private updateOverallHealth(): void {
    const components = Object.values(this.state.health.components);
    const healthyCount = components.filter((c) => c.healthy).length;
    const totalCount = components.length;

    if (healthyCount === totalCount) {
      this.state.health.status = 'healthy';
    } else if (healthyCount === 0) {
      this.state.health.status = 'down';
    } else {
      this.state.health.status = 'degraded';
    }

    this.state.health.mode = this.state.mode;
  }

  /**
   * Update operating mode based on health
   * 
   * Requirement: 2.6
   */
  private updateMode(): void {
    const { status } = this.state.health;

    // Don't change mode if sleeping
    if (this.state.mode === MemoryServiceMode.SLEEPING) {
      return;
    }

    // Update mode based on health
    if (status === 'down') {
      this.setMode(MemoryServiceMode.DEGRADED);
    } else if (status === 'degraded') {
      this.setMode(MemoryServiceMode.DEGRADED);
    } else if (status === 'healthy') {
      // Only set to ACTIVE if we have operations
      // Otherwise stay IDLE
      if (this.state.mode === MemoryServiceMode.DEGRADED) {
        this.setMode(MemoryServiceMode.IDLE);
      }
    }
  }

  /**
   * Record last operation
   */
  private recordOperation(type: string, success: boolean): void {
    this.state.health.lastOperation = {
      type,
      timestamp: new Date(),
      success,
    };
  }

  // ============================================================================
  // PUBLIC API - Memory Operations (to be implemented in next tasks)
  // ============================================================================

  /**
   * Extract truths from dialogue
   * 
   * Uses Mem0 for automatic fact extraction with fallback to direct LLM.
   * 
   * Requirements: 8.1, 8.2, 8.4, 8.5, 14.2
   */
  async extractTruths(
    dialogue: string,
    options: {
      sessionId?: string;
      userId?: string;
      agentId?: string;
      minConfidence?: number;
    } = {}
  ): Promise<any[]> {
    try {
      this.recordOperation('extractTruths', true);
      
      // Try Mem0 extraction first
      const truths = await this.extractTruthsWithMem0(dialogue, options);
      
      console.log(`[MemoryService] ✅ Extracted ${truths.length} truths via Mem0`);
      return truths;
    } catch (mem0Error) {
      console.warn('[MemoryService] Mem0 extraction failed, falling back to LLM:', (mem0Error as Error).message);
      
      try {
        // Fallback to direct LLM extraction
        const truths = await this.extractTruthsWithLLM(dialogue, options);
        
        console.log(`[MemoryService] ✅ Extracted ${truths.length} truths via LLM fallback`);
        return truths;
      } catch (llmError) {
        console.error('[MemoryService] LLM extraction failed:', (llmError as Error).message);
        
        // Graceful degradation: return empty array
        this.recordOperation('extractTruths', false);
        return [];
      }
    }
  }

  /**
   * Extract truths using Mem0
   * 
   * Requirements: 8.1, 8.2, 14.2
   */
  private async extractTruthsWithMem0(
    dialogue: string,
    options: {
      sessionId?: string;
      userId?: string;
      agentId?: string;
      minConfidence?: number;
    }
  ): Promise<any[]> {
    // Convert dialogue to messages format
    const messages = this.parseDialogueToMessages(dialogue);
    
    // Extract memories using Mem0
    const memories = await this.mem0.add(messages, {
      userId: options.userId || 'chip',
      agentId: options.agentId,
      sessionId: options.sessionId,
    });

    // Convert Mem0 memories to Truth objects
    const truths = memories
      .filter((m) => m.memory) // Only keep memories with content
      .map((m) => this.convertMem0MemoryToTruth(m, options));

    // Filter by confidence if specified
    const minConfidence = options.minConfidence ?? 0.0;
    return truths.filter((t) => t.confidence >= minConfidence);
  }

  /**
   * Extract truths using direct LLM (fallback)
   * 
   * Requirements: 8.4
   */
  private async extractTruthsWithLLM(
    dialogue: string,
    options: {
      sessionId?: string;
      userId?: string;
      minConfidence?: number;
    }
  ): Promise<any[]> {
    const prompt = `Extract semantic facts from the following dialogue in subject-predicate-object format.
Return a JSON array of facts with this structure:
[
  {
    "subject": "who/what",
    "predicate": "relationship/action",
    "object": "what/whom",
    "confidence": 0.95
  }
]

Dialogue:
${dialogue}

Extract only factual statements, not opinions or questions. Return valid JSON only.`;

    const response = await this.llm.invoke(prompt, { reasoning: false });
    
    try {
      // Parse LLM response
      const facts = JSON.parse(response);
      
      // Convert to Truth objects
      return facts.map((fact: any, index: number) => ({
        id: `truth_${Date.now()}_${index}`,
        subject: fact.subject || '',
        predicate: fact.predicate || '',
        object: fact.object || '',
        confidence: fact.confidence || 0.85,
        timestamp: new Date(),
        source: 'llm_extraction',
        metadata: {
          sessionId: options.sessionId,
          userId: options.userId,
        },
      }));
    } catch (parseError) {
      console.error('[MemoryService] Failed to parse LLM response:', parseError);
      return [];
    }
  }

  /**
   * Parse dialogue text into messages format
   */
  private parseDialogueToMessages(dialogue: string): Array<{ role: 'user' | 'assistant'; content: string }> {
    const lines = dialogue.split('\n').filter((line) => line.trim());
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    for (const line of lines) {
      // Try to parse "Role: Content" format
      const match = line.match(/^(User|Assistant|Chip|Ubik|Axiom):\s*(.+)$/i);
      
      if (match) {
        const role = match[1].toLowerCase();
        const content = match[2].trim();
        
        // Map roles to user/assistant
        const messageRole = ['user', 'chip'].includes(role) ? 'user' : 'assistant';
        
        messages.push({
          role: messageRole,
          content,
        });
      } else if (line.trim()) {
        // If no role prefix, treat as user message
        messages.push({
          role: 'user',
          content: line.trim(),
        });
      }
    }

    return messages;
  }

  /**
   * Convert Mem0 memory to Truth object
   */
  private convertMem0MemoryToTruth(
    memory: any,
    options: {
      sessionId?: string;
      userId?: string;
    }
  ): any {
    // Mem0 returns unstructured memories, we need to parse them
    // For now, create a simple truth structure
    const memoryText = memory.memory || '';
    
    return {
      id: memory.id || `truth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      subject: 'extracted',
      predicate: 'contains',
      object: memoryText,
      confidence: memory.score || 0.95,
      timestamp: new Date(),
      source: 'mem0_extraction',
      metadata: {
        sessionId: options.sessionId,
        userId: options.userId,
        originalMemory: memoryText,
      },
    };
  }

  /**
   * Inscribe Chronicle chapter
   * 
   * Formats session as Chronicle chapter and writes to file system.
   * Uses Qwen 3.5 9B for formatting.
   * 
   * Requirements: 9.1, 9.2, 9.4, 9.5, 9.6, 9.7
   */
  async inscribeChronicle(session: any): Promise<void> {
    try {
      this.recordOperation('inscribeChronicle', true);
      
      // Format session as Chronicle chapter using LLM
      const chapter = await this.formatChronicleChapter(session);
      
      // Write to file system (using Chronicle writer from Phase 1)
      const { writeChronicle } = await import('../chronicle/writer');
      
      await writeChronicle(chapter);
      
      console.log(`[MemoryService] ✅ Chronicle chapter inscribed: ${chapter.metadata.chapterId}`);
    } catch (error) {
      console.error('[MemoryService] Failed to inscribe Chronicle:', (error as Error).message);
      this.recordOperation('inscribeChronicle', false);
      // Graceful degradation: log error but don't throw
    }
  }

  /**
   * Format session as Chronicle chapter using LLM
   * 
   * Requirements: 9.1
   */
  private async formatChronicleChapter(session: any): Promise<any> {
    // If session already has Chronicle format, use it
    if (session.metadata && session.content) {
      return session;
    }

    // Otherwise, format using LLM
    const prompt = `Format the following session as a Chronicle chapter summary.

Session:
Date: ${session.date || new Date().toISOString().split('T')[0]}
Participants: ${session.participants?.join(', ') || 'chip, user'}
Type: ${session.sessionType || 'general'}

Dialogue:
${this.formatDialogueForPrompt(session.dialogue || [])}

Generate a concise summary (2-3 sentences) of the key points discussed.`;

    const summary = await this.llm.invoke(prompt, { reasoning: false });

    // Create Chronicle chapter structure
    return {
      metadata: {
        date: session.date || new Date().toISOString().split('T')[0],
        chapterId: session.chapterId || this.generateChapterId(session.date),
        participants: session.participants || ['chip', 'user'],
        sessionType: session.sessionType || 'general',
        timestamp: new Date().toISOString(),
      },
      content: {
        summary: summary.trim(),
        dialogue: session.dialogue || [],
        truths: session.truths || [],
        insights: session.insights || [],
      },
    };
  }

  /**
   * Format dialogue for LLM prompt
   */
  private formatDialogueForPrompt(dialogue: any[]): string {
    return dialogue
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join('\n');
  }

  /**
   * Generate unique chapter ID
   */
  private generateChapterId(date?: string): string {
    const dateStr = date || new Date().toISOString().split('T')[0];
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 3);
    return `${dateStr}-chapter-${timestamp}-${random}`;
  }

  /**
   * Index truths to Hive Mind (L3)
   * 
   * Generates embeddings and indexes to Qdrant vector database.
   * Supports batch indexing for efficiency.
   * 
   * Requirements: 10.1, 10.2, 10.4
   */
  async indexToHiveMind(truths: any[], options?: { batchSize?: number }): Promise<void> {
    if (truths.length === 0) {
      console.log('[MemoryService] No truths to index');
      return;
    }

    try {
      this.recordOperation('indexToHiveMind', true);
      
      const batchSize = options?.batchSize || 100;
      
      // Process in batches
      for (let i = 0; i < truths.length; i += batchSize) {
        const batch = truths.slice(i, i + batchSize);
        await this.indexTruthBatch(batch);
      }
      
      console.log(`[MemoryService] ✅ Indexed ${truths.length} truths to Hive Mind`);
    } catch (error) {
      console.error('[MemoryService] Hive Mind indexing failed:', (error as Error).message);
      
      // Fallback: write to file backup
      await this.fallbackToFileStorage(truths);
      
      this.recordOperation('indexToHiveMind', false);
    }
  }

  /**
   * Index a batch of truths
   * 
   * Requirements: 10.1, 10.2, 10.4
   */
  private async indexTruthBatch(truths: any[]): Promise<void> {
    // Generate embeddings for all truths in batch
    const texts = truths.map((t) => `${t.subject} ${t.predicate} ${t.object}`);
    const embeddings = await this.llm.embedBatch(texts);
    
    // Create vector points
    const points = truths.map((truth, index) => ({
      id: truth.id || `truth_${Date.now()}_${index}`,
      vector: embeddings[index],
      payload: {
        subject: truth.subject,
        predicate: truth.predicate,
        object: truth.object,
        confidence: truth.confidence,
        timestamp: truth.timestamp?.toISOString() || new Date().toISOString(),
        source: truth.source,
        metadata: truth.metadata || {},
      },
    }));
    
    // Index to Qdrant
    await this.qdrant.indexPoints('tcam_hive_truths', points);
  }

  /**
   * Fallback to file-based storage
   * 
   * Requirements: 10.3
   */
  private async fallbackToFileStorage(truths: any[]): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const backupFile = path.join(process.cwd(), 'data', 'hive_backup.jsonl');
      
      // Ensure directory exists
      await fs.mkdir(path.dirname(backupFile), { recursive: true });
      
      // Append truths as JSONL
      const lines = truths.map((t) => JSON.stringify(t)).join('\n') + '\n';
      await fs.appendFile(backupFile, lines, 'utf-8');
      
      console.warn(`[MemoryService] ⚠️ Truths backed up to file: ${backupFile}`);
    } catch (fileError) {
      console.error('[MemoryService] File backup also failed:', (fileError as Error).message);
    }
  }

  /**
   * Search memories (Task 12)
   * 
   * Requirements: 11.1, 11.2
   */
  async searchMemories(query: string, options?: {
    limit?: number;
    minScore?: number;
    userId?: string;
    agentId?: string;
  }): Promise<any[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    try {
      this.recordOperation('searchMemories', true);
      
      // Try Mem0 search first
      const results = await this.searchWithMem0(query, options);
      
      console.log(`[MemoryService] ✅ Found ${results.length} memories via Mem0`);
      return results;
    } catch (mem0Error) {
      console.warn('[MemoryService] Mem0 search failed, falling back to Qdrant:', (mem0Error as Error).message);
      
      try {
        // Fallback to direct Qdrant search
        const results = await this.searchWithQdrant(query, options);
        
        console.log(`[MemoryService] ✅ Found ${results.length} memories via Qdrant`);
        return results;
      } catch (qdrantError) {
        console.warn('[MemoryService] Qdrant search failed, falling back to Chronicle grep:', (qdrantError as Error).message);
        
        try {
          // Fallback to Chronicle grep search
          const results = await this.searchWithChronicleGrep(query, options);
          
          console.log(`[MemoryService] ✅ Found ${results.length} memories via Chronicle grep`);
          return results;
        } catch (grepError) {
          console.error('[MemoryService] All search methods failed:', (grepError as Error).message);
          
          // Graceful degradation: return empty array
          this.recordOperation('searchMemories', false);
          return [];
        }
      }
    }
  }

  /**
   * Search using Mem0
   * 
   * Requirements: 11.1, 11.2, 11.3, 14.3
   */
  private async searchWithMem0(query: string, options?: {
    limit?: number;
    userId?: string;
    agentId?: string;
  }): Promise<any[]> {
    const memories = await this.mem0.search(query, {
      userId: options?.userId || 'chip',
      agentId: options?.agentId,
      limit: options?.limit || 20,
    });

    // Convert Mem0 memories to search results
    return memories.map((m) => ({
      id: m.id,
      content: m.memory || '',
      score: m.score || 0.0,
      source: 'mem0',
      metadata: m.metadata || {},
    }));
  }

  /**
   * Search using direct Qdrant
   * 
   * Requirements: 11.4
   */
  private async searchWithQdrant(query: string, options?: {
    limit?: number;
    minScore?: number;
  }): Promise<any[]> {
    // Generate query embedding
    const queryVector = await this.llm.embed(query);
    
    // Search Qdrant
    const results = await this.qdrant.search(
      'tcam_hive_truths',
      queryVector,
      options?.limit || 20,
      options?.minScore || 0.7
    );

    // Convert to search results
    return results.map((r) => ({
      id: r.id,
      content: `${r.payload?.subject} ${r.payload?.predicate} ${r.payload?.object}`,
      score: r.score,
      source: 'qdrant',
      metadata: r.payload || {},
    }));
  }

  /**
   * Search using Chronicle grep (fallback)
   * 
   * Requirements: 11.5
   */
  private async searchWithChronicleGrep(query: string, options?: {
    limit?: number;
  }): Promise<any[]> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const chronicleDir = path.join(process.cwd(), 'data', 'chronicle', 'chip');
    
    try {
      // Read all Chronicle files
      const files = await this.getAllChronicleFiles(chronicleDir);
      
      // Search for query in files
      const results: any[] = [];
      const queryLower = query.toLowerCase();
      
      for (const file of files.slice(0, 100)) { // Limit to 100 files for performance
        try {
          const content = await fs.readFile(file, 'utf-8');
          
          if (content.toLowerCase().includes(queryLower)) {
            results.push({
              id: path.basename(file, '.md'),
              content: this.extractRelevantSnippet(content, queryLower),
              score: 0.5, // Lower confidence for grep search
              source: 'chronicle_grep',
              metadata: {
                file: path.relative(process.cwd(), file),
              },
            });
          }
          
          if (results.length >= (options?.limit || 20)) {
            break;
          }
        } catch (fileError) {
          // Skip files that can't be read
          continue;
        }
      }
      
      return results;
    } catch (error) {
      console.error('[MemoryService] Chronicle grep failed:', (error as Error).message);
      return [];
    }
  }

  /**
   * Get all Chronicle files recursively
   */
  private async getAllChronicleFiles(dir: string): Promise<string[]> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this.getAllChronicleFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }
    
    return files;
  }

  /**
   * Extract relevant snippet from content
   */
  private extractRelevantSnippet(content: string, query: string, contextLength: number = 200): string {
    const index = content.toLowerCase().indexOf(query);
    
    if (index === -1) {
      return content.substring(0, contextLength);
    }
    
    const start = Math.max(0, index - contextLength / 2);
    const end = Math.min(content.length, index + query.length + contextLength / 2);
    
    let snippet = content.substring(start, end);
    
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';
    
    return snippet;
  }
}

/**
 * Create Memory Service with default configuration
 */
export function createMemoryService(config?: Partial<MemoryServiceConfig>): MemoryService {
  const defaultConfig: MemoryServiceConfig = {
    llm: {
      baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'qwen2.5:9b-instruct-q4_K_M',
      temperature: 0.3,
    },
    qdrant: {
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY,
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
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      password: process.env.REDIS_PASSWORD,
      database: parseInt(process.env.REDIS_DB || '0'),
    },
    healthCheckInterval: 30000,
  };

  return new MemoryService({ ...defaultConfig, ...config });
}
