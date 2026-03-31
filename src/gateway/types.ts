/**
 * ANOTS Gateway - Shared Types
 *
 * All interfaces and type aliases for the cognitive routing matrix.
 * Whitepaper: Section 3 (The Cognitive Gateway)
 */

// ─── Task Classification ──────────────────────────────────────────────────────

export type TaskType =
  | 'philosophical-dialogue'   // high-entropy: creative reasoning
  | 'code-generation'          // low-entropy: structural, deterministic
  | 'mcp-orchestration'        // high-entropy: complex multi-step
  | 'truth-extraction'         // low-entropy: pattern recognition
  | 'chronicle-writing'        // low-entropy: deterministic formatting
  | 'research-synthesis'       // high-entropy: creative analysis
  | 'testing-validation';      // low-entropy: deterministic I/O

export type EntropyLevel = 'high' | 'low';

export const HIGH_ENTROPY_TASKS: TaskType[] = [
  'philosophical-dialogue',
  'mcp-orchestration',
  'research-synthesis',
];

export const LOW_ENTROPY_TASKS: TaskType[] = [
  'code-generation',
  'truth-extraction',
  'chronicle-writing',
  'testing-validation',
];

export interface ClassificationResult {
  taskType: TaskType;
  entropy: EntropyLevel;
  /** How the classification was determined */
  confidence: 'hint' | 'keyword' | 'default';
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export type ProviderId = 'cloud' | 'local';
export type ProviderStatus = 'healthy' | 'degraded' | 'down';

export interface ProviderHealth {
  provider: ProviderId;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  errorRate: number;       // 0.0 – 1.0
  status: ProviderStatus;
  lastChecked: Date;
}

// ─── OpenAI-Compatible Chat ───────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  taskHint?: TaskType;
  timeoutMs?: number;
  temperature?: number;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatCompletion {
  id: string;
  choices: Array<{
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage?: TokenUsage;
  model: string;
  /** Present only on error responses */
  error?: {
    code: string;
    details?: unknown[];
  };
}

// ─── Routing ──────────────────────────────────────────────────────────────────

export interface RoutingDecision {
  requestId: string;              // UUID v4
  taskType: TaskType;
  entropy: EntropyLevel;
  selectedProvider: ProviderId;
  model: string;
  fallbackChain: ProviderId[];
  quotaStatus: QuotaStatus;
  cloudHealthStatus: ProviderStatus;
  localHealthStatus: ProviderStatus;
  timestamp: Date;
}

// ─── Quota ────────────────────────────────────────────────────────────────────

export interface QuotaStatus {
  consumed: number;    // tokens used
  limit: number;       // token limit
  exhausted: boolean;
  resetAt: Date;
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

export interface PerformanceRecord {
  requestId: string;
  totalLatencyMs: number;
  providerLatencyMs: number;
  gatewayOverheadMs: number;
  provider: ProviderId;
  model: string;
  taskType: TaskType;
  entropy: EntropyLevel;
  success: boolean;
  timestamp: Date;
}

export interface GatewayMetricsSnapshot {
  requestCount: number;
  successRate: number;
  avgGatewayOverheadMs: number;
  perProvider: Partial<Record<ProviderId, {
    p50: number;
    p95: number;
    p99: number;
    successRate: number;
    requestCount: number;
  }>>;
}

// ─── Configuration ────────────────────────────────────────────────────────────

export interface GatewayConfig {
  // Cloud provider (Z.ai)
  zaiApiKey: string;
  zaiBaseUrl: string;              // default: https://api.z.ai/api/coding/paas/v4
  zaiModel: string;                // default: glm-5-pro

  // Local provider (Ollama)
  ollamaBaseUrl: string;           // default: http://localhost:11434
  ollamaModel: string;             // default: qwen3.5:latest

  // Bifrost process
  bifrostBinPath: string;          // default: ./bin/bifrost
  bifrostPort: number;             // default: 8080

  // Quota
  quotaLimit: number;              // default: 1_000_000 tokens
  quotaResetIntervalHours: number; // default: 24

  // Runtime
  requestTimeoutMs: number;        // default: 30_000
  logLevel: 'info' | 'debug' | 'warn' | 'error';

  // Derived: cloud disabled when ZAI_API_KEY is missing
  cloudEnabled: boolean;
}

/** Load GatewayConfig from environment variables with defaults */
export function loadGatewayConfig(): GatewayConfig {
  const zaiApiKey = process.env.ZAI_API_KEY ?? '';
  return {
    zaiApiKey,
    zaiBaseUrl: process.env.ZAI_BASE_URL ?? 'https://api.z.ai/api/coding/paas/v4',
    zaiModel: process.env.ZAI_MODEL ?? 'glm-5-pro',
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
    ollamaModel: process.env.OLLAMA_MODEL ?? 'qwen3.5:latest',
    bifrostBinPath: process.env.BIFROST_BIN_PATH ?? './bin/bifrost',
    bifrostPort: parseInt(process.env.BIFROST_PORT ?? '8080', 10),
    quotaLimit: parseInt(process.env.ZAI_QUOTA_LIMIT ?? '1000000', 10),
    quotaResetIntervalHours: parseInt(process.env.ZAI_QUOTA_RESET_INTERVAL_HOURS ?? '24', 10),
    requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS ?? '30000', 10),
    logLevel: (process.env.GATEWAY_LOG_LEVEL as GatewayConfig['logLevel']) ?? 'info',
    cloudEnabled: zaiApiKey.length > 0,
  };
}
