# Design Document: ANOTS Gateway

## Overview

ANOTS.Gateway is the cognitive routing matrix for the TCAM system — the "spinal cord" that intelligently distributes LLM requests between cloud and local providers. It wraps a Bifrost Go process (Apache 2.0, ~11µs overhead at 5K RPS) behind a TypeScript class that exposes an OpenAI-compatible `chat()` interface to the rest of TCAM.

The core design philosophy is **entropy-driven routing**: high-entropy tasks (philosophical dialogue, research synthesis, MCP orchestration) go to the cloud LLM (GLM-5 Pro via Z.ai), while low-entropy tasks (code generation, truth extraction, chronicle writing, testing/validation) go to the local LLM (Qwen 3.5 9B via Ollama). The Gateway adds quota management, adaptive health monitoring, a three-tier fallback chain, and structured audit logging — all without blocking the main dialogue loop.

### Design Goals

- Drop-in replacement for `OllamaClient.invoke()` at existing call sites
- Deterministic, auditable routing decisions
- Never throw to the caller — always return a response or structured error
- All configuration via environment variables with sensible defaults
- Reuse existing resilience infrastructure (`CircuitBreaker`, `PerformanceMonitor`, `HealthMonitor`)

---

## Architecture

```
Main Dialogue (Chip / Ubik / Axiom)
        │
        │  chat(messages, options?)
        ▼
┌─────────────────────────────────────────────────────┐
│                  ANOTSGateway                       │
│                                                     │
│  ┌──────────────────┐   ┌──────────────────────┐   │
│  │  TaskClassifier  │   │    GatewayAuditLog   │   │
│  │  (keyword/regex) │   │  (routing decisions) │   │
│  └────────┬─────────┘   └──────────────────────┘   │
│           │ TaskType + Entropy                      │
│           ▼                                         │
│  ┌──────────────────┐   ┌──────────────────────┐   │
│  │  QuotaManager    │   │   GatewayMetrics     │   │
│  │  (token tracking)│   │  (perf records)      │   │
│  └────────┬─────────┘   └──────────────────────┘   │
│           │ QuotaStatus                             │
│           ▼                                         │
│  ┌──────────────────┐   ┌──────────────────────┐   │
│  │  HealthMonitor   │   │   ResponseCache      │   │
│  │  (rolling window)│   │  (last-response/type)│   │
│  └────────┬─────────┘   └──────────────────────┘   │
│           │ ProviderHealth                          │
│           ▼                                         │
│  ┌──────────────────┐                              │
│  │     Router       │                              │
│  │  (deterministic) │                              │
│  └────────┬─────────┘                              │
│           │ RoutingDecision                         │
│           ▼                                         │
│  ┌──────────────────┐                              │
│  │  BifrostClient   │  ← CircuitBreaker (reused)   │
│  │  (HTTP, OpenAI-  │                              │
│  │   compatible)    │                              │
│  └────────┬─────────┘                              │
└───────────┼─────────────────────────────────────────┘
            │  POST /v1/chat/completions
            ▼
   ┌─────────────────┐
   │  Bifrost :8080  │  ← BifrostProcessManager
   │  (Go process)   │
   ├─────────────────┤
   │ Cloud: GLM-5 Pro│  (Z.ai)
   │ Local: Qwen 3.5 │  (Ollama)
   └─────────────────┘
```

### Key Design Decisions

**Why wrap Bifrost rather than call providers directly?**
Bifrost provides ~11µs overhead at 5K RPS vs. ~550µs for Python-based alternatives. It handles the raw HTTP multiplexing and provider-specific auth. The TypeScript Gateway layer adds TCAM-specific concerns: entropy classification, quota tracking, audit logging, and process lifecycle management.

**Why keyword/pattern classification rather than an LLM classifier?**
Using an LLM to classify tasks would add latency and create a circular dependency. Keyword/regex matching is deterministic, zero-latency, and auditable — matching the "deterministic routing" correctness property.

**Why reuse existing resilience components?**
`CircuitBreaker`, `PerformanceMonitor`, and `HealthMonitor` are already battle-tested in the codebase. The Gateway's `HealthMonitor` (gateway-specific) wraps the existing `PerformanceMonitor` for latency percentile calculations rather than reimplementing them.

---

## Components and Interfaces

### ANOTSGateway

The main orchestrator. Owns all sub-components and exposes the public API.

```typescript
class ANOTSGateway {
  async initialize(): Promise<void>
  async shutdown(): Promise<void>
  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatCompletion>
  getMetrics(): GatewayMetricsSnapshot
  getRecentDecisions(limit: number): RoutingDecision[]
}
```

`initialize()` starts the Bifrost process, waits for health, and starts the periodic health check loop.
`chat()` is the hot path: classify → check quota/health → route → call Bifrost → record metrics → return.

### TaskClassifier

Stateless, synchronous. Uses a priority-ordered list of keyword/regex rules.

```typescript
class TaskClassifier {
  classify(messages: ChatMessage[], taskHint?: TaskType): ClassificationResult
}

interface ClassificationResult {
  taskType: TaskType
  entropy: EntropyLevel
  confidence: 'hint' | 'keyword' | 'default'
}
```

Classification rules (evaluated in order, first match wins):

| Keywords / Patterns | Task Type | Entropy |
|---|---|---|
| `taskHint` provided | (use hint) | per mapping |
| `mcp`, `tool call`, `orchestrat` | `mcp-orchestration` | high |
| `research`, `synthesize`, `analyze`, `insight` | `research-synthesis` | high |
| `why`, `meaning`, `consciousness`, `philosophy`, `exist` | `philosophical-dialogue` | high |
| `function`, `class`, `implement`, `code`, `def `, `const ` | `code-generation` | low |
| `test`, `validate`, `assert`, `verify`, `spec` | `testing-validation` | low |
| `chronicle`, `inscribe`, `format entry`, `write entry` | `chronicle-writing` | low |
| `extract`, `truth`, `fact`, `is it true` | `truth-extraction` | low |
| (no match) | `philosophical-dialogue` | high |

### Router

Pure function logic — given classification + quota + health, returns a `RoutingDecision`. No side effects.

```typescript
class Router {
  decide(
    classification: ClassificationResult,
    quotaStatus: QuotaStatus,
    cloudHealth: ProviderHealth,
    localHealth: ProviderHealth
  ): RoutingDecision
}
```

Decision logic:

```
if entropy == high AND cloud available AND quota not exhausted:
  primary = cloud, fallback = [local, cache]
elif entropy == low OR quota exhausted:
  primary = local, fallback = [cloud (if available), cache]
if primary provider is degraded/down:
  swap to next in fallback chain
```

### QuotaManager

Tracks token consumption against a configurable limit with periodic reset.

```typescript
class QuotaManager {
  consumeTokens(usage: TokenUsage): void
  getQuotaStatus(): QuotaStatus
  reset(): void
}
```

Token counts are accumulated in memory. The reset timer fires at the configured interval (`ZAI_QUOTA_RESET_INTERVAL_HOURS`). No persistence — quota resets on process restart, which is acceptable for the TCAM use case.

### GatewayHealthMonitor

Wraps the existing `PerformanceMonitor` to compute rolling-window latency percentiles and error rates per provider. Distinct from the system-level `HealthMonitor` in `src/resilience/`.

```typescript
class GatewayHealthMonitor {
  recordRequest(provider: ProviderId, latencyMs: number, success: boolean): void
  getProviderHealth(provider: ProviderId): ProviderHealth
  startPeriodicProbes(): void
  stopPeriodicProbes(): void
}
```

Uses a 60-second rolling window. Probe requests are minimal: `[{ role: 'user', content: 'ping' }]` with a 2-second timeout.

### BifrostClient

HTTP client for Bifrost's OpenAI-compatible API. Wraps each call in the existing `CircuitBreaker`.

```typescript
class BifrostClient {
  async chat(
    messages: ChatMessage[],
    provider: ProviderId,
    model: string,
    timeoutMs: number
  ): Promise<ChatCompletion>
}
```

Uses `node-fetch` (already in the project via LangChain deps) for HTTP. The circuit breaker is per-provider, reusing the `CircuitBreaker` class from `src/resilience/CircuitBreaker.ts`.

### BifrostProcessManager

Manages the Bifrost Go binary lifecycle.

```typescript
class BifrostProcessManager {
  async start(): Promise<void>      // spawn, wait for /health, retry up to 3x
  async stop(): Promise<void>       // SIGTERM + wait
  isRunning(): boolean
}
```

Writes a Bifrost config JSON to a temp file on start. Monitors the child process `exit` event and auto-restarts up to 3 times with 2s delay.

### ResponseCache

Simple in-memory map: `taskType → last successful ChatCompletion`. Used as the last-resort fallback.

```typescript
class ResponseCache {
  store(taskType: TaskType, response: ChatCompletion): void
  get(taskType: TaskType): ChatCompletion | null
}
```

### GatewayMetrics

Circular buffer of the last 1,000 `PerformanceRecord` entries. Computes aggregate stats on demand.

```typescript
class GatewayMetrics {
  record(entry: PerformanceRecord): void
  getSnapshot(): GatewayMetricsSnapshot
}
```

### GatewayAuditLog

Circular buffer of the last 1,000 `RoutingDecision` entries.

```typescript
class GatewayAuditLog {
  append(decision: RoutingDecision): void
  getRecent(limit: number): RoutingDecision[]
}
```

---

## Data Models

```typescript
// src/gateway/types.ts

export type TaskType =
  | 'philosophical-dialogue'
  | 'code-generation'
  | 'mcp-orchestration'
  | 'truth-extraction'
  | 'chronicle-writing'
  | 'research-synthesis'
  | 'testing-validation';

export type EntropyLevel = 'high' | 'low';
export type ProviderId = 'cloud' | 'local';
export type ProviderStatus = 'healthy' | 'degraded' | 'down';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  taskHint?: TaskType;
  timeoutMs?: number;
  temperature?: number;
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

export interface RoutingDecision {
  requestId: string;           // UUID v4
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

export interface ProviderHealth {
  provider: ProviderId;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  errorRate: number;           // 0.0 – 1.0
  status: ProviderStatus;
  lastChecked: Date;
}

export interface QuotaStatus {
  consumed: number;            // tokens
  limit: number;               // tokens
  exhausted: boolean;
  resetAt: Date;
}

export interface GatewayConfig {
  // Cloud provider
  zaiApiKey: string;
  zaiBaseUrl: string;          // default: https://api.z.ai/api/coding/paas/v4
  zaiModel: string;            // default: glm-5-pro
  // Local provider
  ollamaBaseUrl: string;       // default: http://localhost:11434
  ollamaModel: string;         // default: qwen3.5:latest
  // Bifrost
  bifrostBinPath: string;      // default: ./bin/bifrost
  bifrostPort: number;         // default: 8080
  // Quota
  quotaLimit: number;          // default: 1_000_000 tokens
  quotaResetIntervalHours: number; // default: 24
  // Runtime
  requestTimeoutMs: number;    // default: 30_000
  logLevel: 'info' | 'debug' | 'warn' | 'error';
}

export interface GatewayMetricsSnapshot {
  requestCount: number;
  successRate: number;
  avgGatewayOverheadMs: number;
  perProvider: Record<ProviderId, {
    p50: number; p95: number; p99: number;
    successRate: number;
    requestCount: number;
  }>;
}

export interface ClassificationResult {
  taskType: TaskType;
  entropy: EntropyLevel;
  confidence: 'hint' | 'keyword' | 'default';
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Classification Validity

*For any* array of `ChatMessage` objects, `TaskClassifier.classify()` shall return a result whose `taskType` is one of the seven defined `TaskType` values and whose `entropy` is either `'high'` or `'low'`.

**Validates: Requirements 2.1, 2.2**

---

### Property 2: Entropy Mapping

*For any* `TaskType`, the entropy assigned by `TaskClassifier` shall be `'high'` for `philosophical-dialogue`, `mcp-orchestration`, and `research-synthesis`, and `'low'` for `code-generation`, `truth-extraction`, `chronicle-writing`, and `testing-validation`.

**Validates: Requirements 2.3, 2.4**

---

### Property 3: Hint Passthrough

*For any* valid `TaskType` provided as `taskHint`, `TaskClassifier.classify()` shall return a result with `taskType === taskHint` and `confidence === 'hint'`, regardless of message content.

**Validates: Requirements 2.5**

---

### Property 4: Routing Determinism

*For any* `ClassificationResult`, `QuotaStatus`, and pair of `ProviderHealth` values, calling `Router.decide()` twice with identical inputs shall produce identical `RoutingDecision` outputs (same `selectedProvider`, `model`, and `fallbackChain`).

**Validates: Requirements 3.4**

---

### Property 5: High-Entropy Cloud Routing

*For any* classification with `entropy === 'high'`, when the cloud provider is `'healthy'` and quota is not exhausted, `Router.decide()` shall select `'cloud'` as the provider.

**Validates: Requirements 3.1**

---

### Property 6: Low-Entropy Local Routing

*For any* classification with `entropy === 'low'`, when the local provider is `'healthy'`, `Router.decide()` shall select `'local'` as the provider.

**Validates: Requirements 3.2**

---

### Property 7: Quota Accumulation and Exhaustion

*For any* sequence of `consumeTokens()` calls whose total sum reaches or exceeds the configured `quotaLimit`, `QuotaManager.getQuotaStatus()` shall return `exhausted === true` and `consumed` equal to the sum of all consumed tokens.

**Validates: Requirements 4.1, 4.3**

---

### Property 8: Quota Exhaustion Overrides Routing

*For any* classification (including `entropy === 'high'`) when `QuotaStatus.exhausted === true`, `Router.decide()` shall select `'local'` as the provider regardless of entropy level.

**Validates: Requirements 4.4**

---

### Property 9: Quota Reset Round-Trip

*For any* `QuotaManager` in an exhausted state, calling `reset()` shall result in `getQuotaStatus()` returning `exhausted === false` and `consumed === 0`.

**Validates: Requirements 4.6**

---

### Property 10: Health Degradation Threshold

*For any* provider, after recording a sequence of requests where the error rate exceeds 10% within the 60-second rolling window, OR where the p95 latency exceeds 10,000ms, `GatewayHealthMonitor.getProviderHealth()` shall return `status === 'degraded'`.

**Validates: Requirements 5.2, 5.3**

---

### Property 11: Degraded Provider Excluded from Routing

*For any* routing decision where a provider's `ProviderHealth.status` is `'degraded'` or `'down'`, `Router.decide()` shall not select that provider as `selectedProvider`.

**Validates: Requirements 5.4**

---

### Property 12: Fallback Chain Never Throws

*For any* request where the primary provider throws an error or times out, `ANOTSGateway.chat()` shall not throw to the caller — it shall either return a valid `ChatCompletion` from the next provider in the fallback chain, or return a structured error response object.

**Validates: Requirements 6.1, 6.2, 10.4**

---

### Property 13: Cache Store-Retrieve Round-Trip

*For any* `TaskType` and `ChatCompletion`, after calling `ResponseCache.store(taskType, response)`, calling `ResponseCache.get(taskType)` shall return the same response.

**Validates: Requirements 6.5**

---

### Property 14: Metrics Accumulation

*For any* sequence of N completed requests, `GatewayMetrics.getSnapshot().requestCount` shall equal N (up to the 1,000-record buffer limit).

**Validates: Requirements 7.1**

---

### Property 15: Metrics Bounded Buffer

*For any* sequence of more than 1,000 completed requests, `GatewayMetrics` shall retain only the last 1,000 `PerformanceRecord` entries, and `getSnapshot()` shall reflect only those records.

**Validates: Requirements 7.4**

---

### Property 16: Bifrost Restart Limit

*For any* sequence of unexpected Bifrost process exits, `BifrostProcessManager` shall attempt at most 3 restart attempts before stopping and marking the process as permanently failed.

**Validates: Requirements 8.5**

---

### Property 17: Request Timeout Enforcement

*For any* request where the provider call takes longer than `REQUEST_TIMEOUT_MS`, `ANOTSGateway.chat()` shall cancel the in-flight request and attempt the next provider in the fallback chain rather than waiting indefinitely.

**Validates: Requirements 10.2, 10.3**

---

### Property 18: Unique Request IDs

*For any* two distinct calls to `ANOTSGateway.chat()`, the `requestId` assigned to each shall be different, and each `requestId` shall conform to the UUID v4 format.

**Validates: Requirements 11.2**

---

### Property 19: Bounded Audit Log Retrieval

*For any* value of `limit` passed to `GatewayAuditLog.getRecent(limit)`, the returned array shall contain at most `limit` entries.

**Validates: Requirements 11.4**

---

## Error Handling

### Initialization Errors

- Missing `ZAI_API_KEY`: log warning, disable cloud provider, route all requests to local
- Bifrost binary not found at `BIFROST_BIN_PATH`: throw `GatewayInitError` with descriptive message
- Bifrost fails health check within 5,000ms: throw `GatewayInitError`; caller must handle

### Runtime Errors

All runtime errors are handled internally via the fallback chain. The caller never receives a thrown exception from `chat()`.

| Condition | Handling |
|---|---|
| Cloud provider HTTP error | Log, mark attempt failed, try local |
| Local provider HTTP error | Log, mark attempt failed, try cache |
| Request timeout | Cancel via `AbortController`, try next in chain |
| All providers failed + no cache | Return `{ error: 'all_providers_unavailable', message: '...' }` |
| Circuit breaker open | Skip provider immediately, try next in chain |
| Bifrost process crash | Auto-restart up to 3x; if all fail, disable Bifrost, return structured error |

### Circuit Breaker Integration

Each provider gets its own `CircuitBreaker` instance (reusing `src/resilience/CircuitBreaker.ts`):

```typescript
const cloudCircuitBreaker = new CircuitBreaker({ name: 'gateway-cloud', failureThreshold: 3, timeout: 60000 });
const localCircuitBreaker = new CircuitBreaker({ name: 'gateway-local', failureThreshold: 5, timeout: 30000 });
```

When a circuit is open, `BifrostClient.chat()` skips the provider immediately (no HTTP call), and the Router treats it as `'down'`.

### Structured Error Response

When all fallbacks are exhausted:

```typescript
{
  id: requestId,
  choices: [{
    message: { role: 'assistant', content: '[Gateway Error] All providers unavailable. Please retry.' },
    finish_reason: 'error'
  }],
  model: 'none',
  error: { code: 'all_providers_unavailable', details: [...attemptLog] }
}
```

---

## Testing Strategy

### Dual Testing Approach

Both unit tests and property-based tests are required. They are complementary:
- Unit tests catch concrete bugs at specific inputs and integration points
- Property tests verify universal correctness across the full input space

### Property-Based Testing

**Library**: `fast-check` (TypeScript-native, well-maintained, works with Jest)

Each correctness property (Properties 1–19) maps to exactly one property-based test. Tests run a minimum of 100 iterations each.

Tag format for each test:
```
// Feature: anots-gateway, Property N: <property_text>
```

Example:

```typescript
// Feature: anots-gateway, Property 4: Routing Determinism
it('Router.decide() is deterministic for identical inputs', () => {
  fc.assert(fc.property(
    arbitraryClassification(),
    arbitraryQuotaStatus(),
    arbitraryProviderHealth(),
    arbitraryProviderHealth(),
    (classification, quota, cloudHealth, localHealth) => {
      const result1 = router.decide(classification, quota, cloudHealth, localHealth);
      const result2 = router.decide(classification, quota, cloudHealth, localHealth);
      expect(result1.selectedProvider).toBe(result2.selectedProvider);
      expect(result1.model).toBe(result2.model);
    }
  ), { numRuns: 100 });
});
```

**Arbitraries needed**:
- `arbitraryTaskType()` — random element from the 7 TaskType values
- `arbitraryEntropyLevel()` — `'high'` | `'low'`
- `arbitraryClassification()` — random `ClassificationResult`
- `arbitraryQuotaStatus()` — random consumed/limit/exhausted combination
- `arbitraryProviderHealth()` — random latency stats + status
- `arbitraryChatMessages()` — random arrays of `ChatMessage` objects
- `arbitraryTokenUsage()` — random `TokenUsage` with positive integers

### Unit Tests

Focus on:
- Specific keyword → task type mappings (one test per keyword group)
- Default classification when no keywords match
- Bifrost process start/stop lifecycle (integration, mocked child_process)
- Config loading: defaults when env vars absent, overrides when present
- Missing `ZAI_API_KEY` → cloud disabled
- Structured error response format when all providers fail
- Health check probe request format

### Test File Structure

```
src/gateway/__tests__/
  TaskClassifier.test.ts      — unit + property tests (Properties 1, 2, 3)
  Router.test.ts              — unit + property tests (Properties 4, 5, 6, 8, 11)
  QuotaManager.test.ts        — unit + property tests (Properties 7, 8, 9)
  GatewayHealthMonitor.test.ts — unit + property tests (Properties 10, 11)
  ResponseCache.test.ts       — unit + property tests (Property 13)
  GatewayMetrics.test.ts      — unit + property tests (Properties 14, 15)
  BifrostProcessManager.test.ts — unit tests (Properties 16, examples 8.1–8.4)
  ANOTSGateway.test.ts        — integration + property tests (Properties 12, 17, 18, 19)
```

### Coverage Targets

- Unit test coverage: ≥ 80% line coverage for all gateway modules
- Every correctness property (1–19) must have a corresponding `fast-check` property test
- Integration tests for Bifrost lifecycle use a mock child process (no real binary required)
