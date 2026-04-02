/**
 * Active Stream State Types
 * 
 * L2: Active Stream - Ephemeral working memory stored in Redis
 * 
 * Requirements: 4.1, 4.4, 4.5, 4.6
 * Whitepaper: Section 7.2 (L2: Active Stream)
 */

/**
 * Message in the active dialogue
 */
export interface DialogueMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string; // ISO 8601
  metadata?: Record<string, any>;
}

/**
 * Task status in the active session
 */
export interface TaskStatus {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

/**
 * Whisper - Ephemeral insight that may become a truth
 */
export interface Whisper {
  id: string;
  content: string;
  confidence: number; // 0.0-1.0
  timestamp: string;
  source: 'observation' | 'inference' | 'user_hint';
  metadata?: Record<string, any>;
}

/**
 * Reality Anchor - Grounding facts for the current session
 */
export interface RealityAnchor {
  id: string;
  fact: string;
  source: 'user_provided' | 'codex' | 'hive_mind';
  confidence: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * Codex Snapshot - Relevant Agent Codex content for this session
 */
export interface CodexSnapshot {
  agentId: string;
  loadedAt: string;
  sections: {
    readme?: string;
    tasks?: string;
    notes?: string;
    context?: string;
    tools?: string;
    diary?: string;
  };
  metadata?: Record<string, any>;
}

/**
 * Recent Truth - Truth extracted during this session
 */
export interface RecentTruth {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  extractedAt: string;
  indexed: boolean; // Whether it's been indexed to Hive Mind yet
  metadata?: Record<string, any>;
}

/**
 * Active Stream State (Full — legacy MemoryService)
 * 
 * Complete state of the active dialogue session.
 * Stored in Redis with TTL (7 days default).
 * 
 * Requirements: 4.1, 4.4, 4.5
 */
export interface ActiveStreamStateFull {
  // Session metadata
  sessionId: string;
  agentId: string;
  userId: string;
  startedAt: string;
  lastUpdatedAt: string;
  
  // Current node in the graph
  currentNode: string;
  
  // Dialogue history
  messages: DialogueMessage[];
  
  // Task tracking
  tasks: TaskStatus[];
  
  // Context and insights
  context: Record<string, any>; // Flexible context storage
  whispers: Whisper[]; // Ephemeral insights
  realityAnchors: RealityAnchor[]; // Grounding facts
  
  // Memory references
  codexSnapshot: CodexSnapshot | null;
  recentTruths: RecentTruth[];
  
  // Capacity tracking
  estimatedTokens: number;
  capacityPercentage: number; // 0-100
  
  // Metadata
  metadata?: Record<string, any>;
}

/**
 * Checkpoint configuration
 * 
 * Requirements: 4.6, 15.2, 15.3
 */
export interface CheckpointConfig {
  // Checkpoint interval (number of messages)
  interval: number; // Default: 10
  
  // Redis TTL (seconds)
  ttl: number; // Default: 604800 (7 days)
  
  // Enable compression
  compression: boolean; // Default: true
  
  // Key prefix for Redis
  keyPrefix: string; // Default: 'tcam:checkpoint:'
}

/**
 * Capacity thresholds
 * 
 * Requirements: 7.1, 7.4
 */
export interface CapacityThresholds {
  // Soft warning threshold (70%)
  preSleep: number;
  
  // Hard sleep threshold (80%)
  sleep: number;
  
  // Maximum capacity (100%)
  maximum: number;
}

/**
 * Default capacity thresholds
 */
export const DEFAULT_CAPACITY_THRESHOLDS: CapacityThresholds = {
  preSleep: 70,
  sleep: 80,
  maximum: 100,
};

/**
 * Default checkpoint configuration
 */
export const DEFAULT_CHECKPOINT_CONFIG: CheckpointConfig = {
  interval: 10,
  ttl: 604800, // 7 days
  compression: true,
  keyPrefix: 'tcam:checkpoint:',
};

/**
 * Create empty Active Stream state
 */
export function createEmptyActiveStreamState(
  sessionId: string,
  agentId: string,
  userId: string
): ActiveStreamStateFull {
  const now = new Date().toISOString();
  
  return {
    sessionId,
    agentId,
    userId,
    startedAt: now,
    lastUpdatedAt: now,
    currentNode: 'start',
    messages: [],
    tasks: [],
    context: {},
    whispers: [],
    realityAnchors: [],
    codexSnapshot: null,
    recentTruths: [],
    estimatedTokens: 0,
    capacityPercentage: 0,
  };
}

/**
 * Estimate token count from messages
 * 
 * Simple heuristic: ~4 characters per token
 * 
 * Requirements: 7.1
 */
export function estimateTokenCount(messages: DialogueMessage[]): number {
  const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
  return Math.ceil(totalChars / 4);
}

/**
 * Calculate capacity percentage
 * 
 * Requirements: 7.1, 7.4
 */
export function calculateCapacity(
  estimatedTokens: number,
  maxTokens: number = 128000 // Qwen 3.5 9B context window
): number {
  return Math.min(100, Math.round((estimatedTokens / maxTokens) * 100));
}
