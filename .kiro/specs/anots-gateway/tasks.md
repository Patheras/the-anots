# Implementation Plan: ANOTS Gateway

## Overview

Implement the ANOTS.Gateway cognitive routing matrix in TypeScript across five phases: core types and stateless components, monitoring and metrics, Bifrost integration, the main orchestrator, and integration tests. Each phase builds on the previous, ending with all components wired together.

## Tasks

- [x] 1. Create shared types and project structure
  - Create `src/gateway/types.ts` with all interfaces and type aliases from the design: `TaskType`, `EntropyLevel`, `ProviderId`, `ProviderStatus`, `ChatMessage`, `ChatOptions`, `ChatCompletion`, `TokenUsage`, `RoutingDecision`, `PerformanceRecord`, `ProviderHealth`, `QuotaStatus`, `GatewayConfig`, `GatewayMetricsSnapshot`, `ClassificationResult`
  - Create `tests/gateway/` directory structure
  - _Requirements: 1.1, 2.1, 2.2, 3.3, 7.1, 11.1_

- [x] 2. Implement TaskClassifier
  - [x] 2.1 Implement `src/gateway/TaskClassifier.ts`
    - Priority-ordered keyword/regex rule table matching the design matrix (mcp → orchestration, research/synthesize/analyze → research-synthesis, why/meaning/consciousness/philosophy/exist → philosophical-dialogue, function/class/implement/code/def/const → code-generation, test/validate/assert/verify/spec → testing-validation, chronicle/inscribe/format entry/write entry → chronicle-writing, extract/truth/fact/is it true → truth-extraction)
    - `taskHint` short-circuits all matching with `confidence: 'hint'`
    - Default to `philosophical-dialogue` / `high` when no rule matches
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x]* 2.2 Write property tests for TaskClassifier (Properties 1, 2, 3)
    - **Property 1: Classification Validity** — `fc.array(arbitraryChatMessage())` → result taskType ∈ 7 valid types, entropy ∈ `['high','low']`
    - **Property 2: Entropy Mapping** — for each of the 7 TaskTypes the entropy mapping is fixed
    - **Property 3: Hint Passthrough** — any valid `taskHint` → `taskType === taskHint` and `confidence === 'hint'`
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
    - File: `tests/gateway/TaskClassifier.test.ts`

  - [x]* 2.3 Write unit tests for TaskClassifier keyword rules
    - One test per keyword group verifying correct task type and entropy
    - Test default fallback when no keywords match
    - File: `tests/gateway/TaskClassifier.test.ts`

- [ ] 3. Implement Router
  - [x] 3.1 Implement `src/gateway/Router.ts`
    - Pure function `decide(classification, quotaStatus, cloudHealth, localHealth): RoutingDecision`
    - High-entropy + cloud healthy + quota not exhausted → cloud/glm-5-pro
    - Low-entropy OR quota exhausted → local/qwen3.5:latest
    - Degraded/down primary → swap to next in fallback chain
    - Always populate `fallbackChain` array in the decision
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.4, 5.4_

  - [x]* 3.2 Write property tests for Router (Properties 4, 5, 6, 8, 11)
    - **Property 4: Routing Determinism** — same inputs → same `selectedProvider`, `model`, `fallbackChain`
    - **Property 5: High-Entropy Cloud Routing** — entropy=high, cloud healthy, quota not exhausted → selectedProvider=cloud
    - **Property 6: Low-Entropy Local Routing** — entropy=low, local healthy → selectedProvider=local
    - **Property 8: Quota Exhaustion Overrides Routing** — quotaStatus.exhausted=true → selectedProvider=local
    - **Property 11: Degraded Provider Excluded** — degraded/down provider never selected
    - **Validates: Requirements 3.1, 3.2, 3.4, 4.4, 5.4**
    - File: `tests/gateway/Router.test.ts`

  - [x]* 3.3 Write unit tests for Router edge cases
    - Both providers degraded → fallback to cache in chain
    - Cloud degraded, high-entropy → falls back to local
    - File: `tests/gateway/Router.test.ts`

- [x] 4. Implement QuotaManager
  - [x] 4.1 Implement `src/gateway/QuotaManager.ts`
    - In-memory token accumulation via `consumeTokens(usage: TokenUsage)`
    - `getQuotaStatus()` returns `{ consumed, limit, exhausted, resetAt }`
    - `reset()` clears consumed count and exhausted flag
    - Periodic auto-reset timer using `ZAI_QUOTA_RESET_INTERVAL_HOURS` config
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6_

  - [ ]* 4.2 Write property tests for QuotaManager (Properties 7, 9)
    - **Property 7: Quota Accumulation and Exhaustion** — sum of consumeTokens calls ≥ limit → exhausted=true, consumed=sum
    - **Property 9: Quota Reset Round-Trip** — after reset(), exhausted=false and consumed=0
    - **Validates: Requirements 4.1, 4.3, 4.6**
    - File: `tests/gateway/QuotaManager.test.ts`

  - [ ]* 4.3 Write unit tests for QuotaManager
    - Partial consumption does not exhaust quota
    - `getQuotaStatus()` returns correct limit from config
    - File: `tests/gateway/QuotaManager.test.ts`

- [x] 5. Implement ResponseCache
  - [x] 5.1 Implement `src/gateway/ResponseCache.ts`
    - `store(taskType, response)` and `get(taskType)` backed by a `Map<TaskType, ChatCompletion>`
    - `get()` returns `null` when no entry exists for the task type
    - _Requirements: 6.3, 6.5_

  - [ ]* 5.2 Write property test for ResponseCache (Property 13)
    - **Property 13: Cache Store-Retrieve Round-Trip** — store then get returns the same response object
    - **Validates: Requirements 6.5**
    - File: `tests/gateway/ResponseCache.test.ts`

- [x] 6. Checkpoint — core stateless components
  - Ensure all tests pass, ask the user if questions arise.

- [-] 7. Implement GatewayHealthMonitor
  - [x] 7.1 Implement `src/gateway/GatewayHealthMonitor.ts`
    - Wraps `PerformanceMonitor` from `src/resilience/PerformanceMonitor.ts` for latency percentile calculations
    - 60-second rolling window per provider
    - `recordRequest(provider, latencyMs, success)` feeds the monitor
    - `getProviderHealth(provider)` computes p50/p95/p99, error rate, and status
    - Mark degraded when error rate > 10% OR p95 > 10,000ms
    - Mark healthy again when error rate < 5% AND p95 < 8,000ms for two consecutive checks
    - `startPeriodicProbes()` / `stopPeriodicProbes()` for 30-second health check loop
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ]* 7.2 Write property tests for GatewayHealthMonitor (Properties 10, 11)
    - **Property 10: Health Degradation Threshold** — error rate > 10% OR p95 > 10,000ms → status=degraded
    - **Property 11: Degraded Provider Excluded** — (shared with Router tests, verify health state feeds Router correctly)
    - **Validates: Requirements 5.2, 5.3, 5.4**
    - File: `tests/gateway/GatewayHealthMonitor.test.ts`

  - [ ]* 7.3 Write unit tests for GatewayHealthMonitor
    - Recovery threshold: two consecutive healthy checks flip status back to healthy
    - Probe request format: `[{ role: 'user', content: 'ping' }]` with 2s timeout
    - File: `tests/gateway/GatewayHealthMonitor.test.ts`

- [ ] 8. Implement GatewayMetrics
  - [x] 8.1 Implement `src/gateway/GatewayMetrics.ts`
    - Circular buffer capped at 1,000 `PerformanceRecord` entries
    - `record(entry)` appends and evicts oldest when over limit
    - `getSnapshot()` computes requestCount, successRate, avgGatewayOverheadMs, and per-provider p50/p95/p99/successRate/requestCount
    - Emit warning log when `gatewayOverheadMs > 100` on any single record
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 8.2 Write property tests for GatewayMetrics (Properties 14, 15)
    - **Property 14: Metrics Accumulation** — N records → snapshot.requestCount = N (for N ≤ 1000)
    - **Property 15: Metrics Bounded Buffer** — more than 1,000 records → only last 1,000 retained
    - **Validates: Requirements 7.1, 7.4**
    - File: `tests/gateway/GatewayMetrics.test.ts`

- [ ] 9. Implement GatewayAuditLog
  - [x] 9.1 Implement `src/gateway/GatewayAuditLog.ts`
    - Circular buffer capped at 1,000 `RoutingDecision` entries
    - `append(decision)` and `getRecent(limit)` — returns at most `limit` entries
    - _Requirements: 11.1, 11.4_

  - [ ]* 9.2 Write property test for GatewayAuditLog (Property 19)
    - **Property 19: Bounded Audit Log Retrieval** — getRecent(limit) returns ≤ limit entries for any limit value
    - **Validates: Requirements 11.4**
    - File: `tests/gateway/GatewayAuditLog.test.ts` (can be co-located in GatewayMetrics.test.ts)

- [ ] 10. Checkpoint — monitoring and metrics components
  - Ensure all tests pass, ask the user if questions arise.

- [-] 11. Implement BifrostClient
  - [ ] 11.1 Implement `src/gateway/BifrostClient.ts`
    - `chat(messages, provider, model, timeoutMs)` sends `POST http://localhost:{port}/v1/chat/completions` via `node-fetch`
    - Uses `AbortController` for per-request timeout enforcement
    - Wraps each call in a per-provider `CircuitBreaker` instance (reuse `src/resilience/CircuitBreaker.ts`): cloud breaker `{ failureThreshold: 3, timeout: 60000 }`, local breaker `{ failureThreshold: 5, timeout: 30000 }`
    - When circuit is open, throws `CircuitOpenError` immediately (no HTTP call)
    - Parses OpenAI-compatible JSON response into `ChatCompletion`
    - _Requirements: 1.1, 8.1, 10.2, 10.3_

  - [ ]* 11.2 Write unit tests for BifrostClient
    - Mock `node-fetch` to verify request format (headers, body shape)
    - Timeout: AbortController fires after `timeoutMs`
    - Circuit breaker open → no fetch call made
    - File: `tests/gateway/BifrostClient.test.ts`

- [ ] 12. Implement BifrostProcessManager
  - [ ] 12.1 Implement `src/gateway/BifrostProcessManager.ts`
    - `start()`: write Bifrost config JSON to temp file, `child_process.spawn` the binary, poll `GET http://localhost:{port}/health` up to 5,000ms
    - `stop()`: send SIGTERM to child process and await exit
    - `isRunning()`: returns boolean based on child process state
    - On unexpected `exit` event: auto-restart up to 3 times with 2,000ms delay; after 3 failures mark permanently failed
    - Config JSON includes cloud and local provider endpoint definitions from `GatewayConfig`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ]* 12.2 Write property test for BifrostProcessManager (Property 16)
    - **Property 16: Bifrost Restart Limit** — simulate N unexpected exits → at most 3 restart attempts before permanently failed
    - **Validates: Requirements 8.5**
    - File: `tests/gateway/BifrostProcessManager.test.ts`

  - [ ]* 12.3 Write unit tests for BifrostProcessManager lifecycle
    - Mock `child_process.spawn`; verify config file written to temp dir
    - Health check timeout: fails if `/health` not reachable within 5,000ms
    - `stop()` sends SIGTERM
    - File: `tests/gateway/BifrostProcessManager.test.ts`

- [ ] 13. Checkpoint — Bifrost integration components
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Implement ANOTSGateway orchestrator
  - [ ] 14.1 Implement `src/gateway/ANOTSGateway.ts`
    - Constructor reads all config from environment variables with defaults per Requirement 9
    - `initialize()`: start `BifrostProcessManager`, start `GatewayHealthMonitor` periodic probes
    - `shutdown()`: stop probes, stop Bifrost process
    - `chat(messages, options?)` hot path:
      1. Assign UUID v4 `requestId`
      2. `TaskClassifier.classify(messages, options?.taskHint)`
      3. `QuotaManager.getQuotaStatus()` + `GatewayHealthMonitor.getProviderHealth()` for both providers
      4. `Router.decide(...)` → `RoutingDecision`
      5. `GatewayAuditLog.append(decision)`
      6. Attempt `BifrostClient.chat()` for selected provider; on error/timeout try fallback chain
      7. On fallback: try next provider, then `ResponseCache.get(taskType)`
      8. On success: `ResponseCache.store(taskType, response)`, `QuotaManager.consumeTokens(response.usage)`
      9. Record `PerformanceRecord` in `GatewayMetrics`; warn if overhead > 100ms
      10. Never throw — return structured error response if all fallbacks exhausted
    - `getMetrics()` delegates to `GatewayMetrics.getSnapshot()`
    - `getRecentDecisions(limit)` delegates to `GatewayAuditLog.getRecent(limit)`
    - Missing `ZAI_API_KEY`: log warning, disable cloud provider
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 6.1, 6.2, 6.3, 6.4, 6.6, 7.2, 7.3, 8.1, 9.1–9.5, 10.1, 10.4, 11.1, 11.2, 11.3_

  - [ ]* 14.2 Write property tests for ANOTSGateway (Properties 12, 17, 18, 19)
    - **Property 12: Fallback Chain Never Throws** — mock primary provider to throw → chat() returns ChatCompletion or structured error, never throws
    - **Property 17: Request Timeout Enforcement** — mock provider to delay > timeoutMs → next provider attempted
    - **Property 18: Unique Request IDs** — two distinct chat() calls → different requestIds, both UUID v4 format
    - **Property 19: Bounded Audit Log Retrieval** — getRecentDecisions(limit) returns ≤ limit entries
    - **Validates: Requirements 6.1, 6.2, 10.2, 10.3, 10.4, 11.2, 11.4**
    - File: `tests/gateway/ANOTSGateway.test.ts`

  - [ ]* 14.3 Write integration tests for ANOTSGateway
    - Missing ZAI_API_KEY → cloud disabled, all requests route to local
    - Structured error response format when all providers fail (verify `choices[0].finish_reason === 'error'`)
    - Fallback log entry emitted when fallback occurs (Requirement 6.6)
    - File: `tests/gateway/ANOTSGateway.test.ts`

- [ ] 15. Final checkpoint — wire everything together
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- All property tests use `fast-check` with a minimum of 100 iterations (`numRuns: 100`)
- Tag each property test: `// Feature: anots-gateway, Property N: <property_text>`
- Reuse `src/resilience/CircuitBreaker.ts` in BifrostClient — do not reimplement
- Reuse `src/resilience/PerformanceMonitor.ts` in GatewayHealthMonitor — do not reimplement
- Test files live in `tests/gateway/` (not `src/gateway/__tests__/`) per the implementation notes
- No real Bifrost binary required for tests — mock `child_process.spawn`
