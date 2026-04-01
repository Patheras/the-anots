/**
 * Core types for ANOTS Unified Platform
 */

// ============================================================================
// Deployment Configuration
// ============================================================================

export type DeploymentMode = 'cli' | 'mcp-server' | 'standalone';

export interface DeploymentConfig {
  mode: DeploymentMode;
  dataDir: string;
  mcpPort?: number;
  mcpAuthEnabled?: boolean;
  mcpApiKeys?: string[];
  gatewayEnabled: boolean;
  ollamaBaseUrl: string;
  ollamaModel: string;
  zaiApiKey?: string;
  zaiBaseUrl?: string;
  zaiModel?: string;
  redisUrl?: string;
  qdrantUrl?: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

// ============================================================================
// Memory System Types
// ============================================================================

export interface SearchResult {
  content: string;
  score: number;
  metadata?: Record<string, any>;
  source?: string;
  timestamp?: Date;
}

export interface ChronicleEntry {
  chapterId?: string; // Optional - will be auto-generated if not provided
  date: string;
  participants: string[];
  sessionType: string;
  content: string;
  metadata?: Record<string, any>;
  truthsCount?: number;
  durationMinutes?: number;
}

export interface ChronicleMetadata {
  date: string;
  chapterId: string;
  participants: string[];
  sessionType: string;
  truthsCount?: number;
  durationMinutes?: number;
  [key: string]: any;
}

export interface MemoryHealth {
  chronicle: boolean;
  activeStream: boolean;
  hiveMind: boolean;
  codex: boolean;
}

// ============================================================================
// Agent System Types (Standalone Mode)
// ============================================================================

export interface AgentDefinition {
  id: string;
  name: string;
  role: string;
  personality?: string;
  modelPreference: {
    high_entropy: string;
    low_entropy: string;
  };
  memoryAccess: {
    chronicle: 'read' | 'write' | 'none';
    activeStream: 'read' | 'write';
    hiveMind: 'read' | 'write' | 'none';
    codex: 'read' | 'write' | 'none';
  };
  systemPrompt?: string;
}

export interface ActiveStreamState {
  messages: Array<{ role: string; content: string }>;
  currentAgent?: string;
  context: Record<string, any>;
  timestamp: Date;
}

// ============================================================================
// MCP Types
// ============================================================================

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: object;
  handler: (args: any) => Promise<any>;
}

export interface MCPToolResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

// ============================================================================
// Gateway Types (from anots-gateway spec)
// ============================================================================

export type TaskType =
  | 'philosophical-dialogue'
  | 'code-generation'
  | 'mcp-orchestration'
  | 'truth-extraction'
  | 'chronicle-writing'
  | 'research-synthesis'
  | 'testing-validation';

export type EntropyLevel = 'high' | 'low';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  taskHint?: TaskType;
  timeoutMs?: number;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatCompletion {
  id: string;
  choices: Array<{
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage?: TokenUsage;
  model: string;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// ============================================================================
// Service Interface
// ============================================================================

export interface Service {
  name: string;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  isHealthy(): Promise<boolean>;
}

// ============================================================================
// Error Types
// ============================================================================

export class DeploymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeploymentError';
  }
}

export class MemoryLayerError extends Error {
  constructor(public layer: string, message: string) {
    super(`Memory layer ${layer}: ${message}`);
    this.name = 'MemoryLayerError';
  }
}

export class MCPToolError extends Error {
  constructor(public toolName: string, message: string) {
    super(`MCP tool ${toolName}: ${message}`);
    this.name = 'MCPToolError';
  }
}
