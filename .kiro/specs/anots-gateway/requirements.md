# Requirements Document

## Introduction

ANOTS.Gateway is the cognitive routing matrix for the TCAM system — the "spinal cord" that intelligently routes LLM requests between cloud and local providers. Built on Bifrost (Go-based, Apache 2.0, ~11µs overhead at 5K RPS), it exposes an OpenAI-compatible proxy API that classifies incoming requests by entropy level and routes them to the appropriate provider: high-entropy tasks (reasoning, dialogue, research) go to the cloud LLM (GLM-5 Pro via Z.ai), while low-entropy tasks (structural, I/O, truth extraction, code gen) go to the local LLM (Qwen 3.5 9B via Ollama). The Gateway manages quota, adaptive load balancing, fallback chains, and performance monitoring — all without blocking the main dialogue.

## Glossary

- **Gateway**: The ANOTS.Gateway TypeScript client that wraps Bifrost and exposes the routing API to the rest of TCAM.
- **Bifrost**: The Go-based LLM gateway process running at localhost:8080, providing an OpenAI-compatible HTTP API with ~11µs overhead at 5K RPS.
- **Task_Classifier**: The component within the Gateway responsible for analyzing a request and assigning it an entropy level and task type.
- **Router**: The component within the Gateway that selects the target provider based on the Task_Classifier output, quota state, and provider health.
- **Cloud_Provider**: The Z.ai API endpoint serving GLM-5 Pro, used for high-entropy tasks.
- **Local_Provider**: The Ollama endpoint serving Qwen 3.5 9B, used for low-entropy tasks.
- **Entropy**: A measure of the cognitive complexity of a task. High-entropy tasks require creative reasoning; low-entropy tasks are deterministic and structural.
- **Quota_Manager**: The component that tracks Cloud_Provider API usage and signals when the quota is exhausted.
- **Health_Monitor**: The component that tracks latency, error rates, and availability for each provider.
- **Fallback_Chain**: The ordered sequence of providers tried when the primary provider is unavailable: Cloud_Provider → Local_Provider → Cached_Response.
- **Cached_Response**: A previously stored response returned as a last-resort fallback when all live providers are unavailable.
- **OpenAI_Compatible_Request**: An HTTP request conforming to the OpenAI Chat Completions API schema (`POST /v1/chat/completions`).
- **Routing_Decision**: A data structure capturing the selected provider, model, task type, entropy level, and fallback chain for a given request.
- **Performance_Record**: A data structure capturing latency, provider, model, task type, success/failure, and timestamp for a completed request.

---

## Requirements

### Requirement 1: OpenAI-Compatible Proxy Interface

**User Story:** As a TCAM dialogue agent (Chip, Ubik, or Axiom), I want to send LLM requests using the standard OpenAI API format, so that I can swap in the Gateway without changing any existing call sites.

#### Acceptance Criteria

1. THE Gateway SHALL expose a `chat(messages, options)` method that accepts an array of OpenAI-format chat messages and returns an OpenAI-format chat completion response.
2. THE Gateway SHALL accept an optional `taskHint` field in the request options to allow callers to explicitly declare the task type.
3. WHEN a caller provides no `taskHint`, THE Task_Classifier SHALL infer the task type from the message content.
4. THE Gateway SHALL be usable as a drop-in replacement for the existing `OllamaClient.invoke()` call signature.

---

### Requirement 2: Task Classification by Entropy

**User Story:** As the Router, I want to know the entropy level of each incoming request, so that I can send it to the right provider.

#### Acceptance Criteria

1. THE Task_Classifier SHALL assign each request exactly one of the following task types: `philosophical-dialogue`, `code-generation`, `mcp-orchestration`, `truth-extraction`, `chronicle-writing`, `research-synthesis`, or `testing-validation`.
2. THE Task_Classifier SHALL assign each request exactly one entropy level: `high` or `low`.
3. THE Task_Classifier SHALL classify `philosophical-dialogue`, `mcp-orchestration`, and `research-synthesis` as `high` entropy.
4. THE Task_Classifier SHALL classify `code-generation`, `truth-extraction`, `chronicle-writing`, and `testing-validation` as `low` entropy.
5. WHEN a `taskHint` is provided in the request options, THE Task_Classifier SHALL use it as the task type without performing content-based inference.
6. WHEN no `taskHint` is provided, THE Task_Classifier SHALL analyze the message content using keyword and pattern matching to determine the task type.
7. IF the Task_Classifier cannot determine a task type from the message content, THEN THE Task_Classifier SHALL default to `philosophical-dialogue` (high entropy) as the safe fallback.

---

### Requirement 3: Routing Decision Matrix

**User Story:** As the Router, I want a deterministic mapping from task type to provider, so that routing is predictable and auditable.

#### Acceptance Criteria

1. WHEN the entropy level is `high` and the Cloud_Provider is available and quota is not exhausted, THE Router SHALL route the request to the Cloud_Provider using model `glm-5-pro`.
2. WHEN the entropy level is `low`, THE Router SHALL route the request to the Local_Provider using model `qwen3.5:latest`.
3. THE Router SHALL produce a Routing_Decision record for every request, capturing provider, model, task type, entropy, and fallback chain.
4. FOR ALL requests with the same task type and provider health state, THE Router SHALL produce the same Routing_Decision (deterministic routing property).

---

### Requirement 4: Quota Management

**User Story:** As the system operator, I want the Gateway to track Z.ai API usage and automatically fall back to local when the quota is exhausted, so that the system never hard-fails due to quota limits.

#### Acceptance Criteria

1. THE Quota_Manager SHALL track the number of tokens consumed against the Cloud_Provider quota limit configured via environment variable `ZAI_QUOTA_LIMIT`.
2. WHEN a Cloud_Provider response is received, THE Quota_Manager SHALL update the consumed token count using the `usage` field from the response.
3. WHEN the consumed token count reaches or exceeds the configured quota limit, THE Quota_Manager SHALL mark the Cloud_Provider quota as exhausted.
4. WHILE the Cloud_Provider quota is exhausted, THE Router SHALL route all requests to the Local_Provider regardless of entropy level.
5. THE Quota_Manager SHALL expose a `getQuotaStatus()` method returning current usage, limit, and exhaustion state.
6. WHEN the quota resets (configurable reset interval), THE Quota_Manager SHALL clear the exhausted state and resume normal routing.

---

### Requirement 5: Adaptive Load Balancing and Health Monitoring

**User Story:** As the system operator, I want the Gateway to monitor provider health in real time and avoid routing to degraded providers, so that latency and error rates stay within acceptable bounds.

#### Acceptance Criteria

1. THE Health_Monitor SHALL track latency (p50, p95, p99), error rate, and availability for each provider on a rolling 60-second window.
2. WHEN a provider's error rate exceeds 10% within the rolling window, THE Health_Monitor SHALL mark that provider as degraded.
3. WHEN a provider's p95 latency exceeds 10,000ms, THE Health_Monitor SHALL mark that provider as degraded.
4. WHILE a provider is marked as degraded, THE Router SHALL not route new requests to that provider.
5. WHEN a degraded provider's error rate drops below 5% and p95 latency drops below 8,000ms for two consecutive health checks, THE Health_Monitor SHALL mark that provider as healthy.
6. THE Health_Monitor SHALL perform a health check every 30 seconds by sending a minimal probe request to each provider.
7. THE Health_Monitor SHALL expose a `getProviderHealth(provider)` method returning current latency stats, error rate, and health status.

---

### Requirement 6: Fallback Chain

**User Story:** As a dialogue agent, I want the Gateway to automatically try alternative providers when the primary fails, so that I always get a response even under degraded conditions.

#### Acceptance Criteria

1. THE Fallback_Chain SHALL attempt providers in this order: Cloud_Provider → Local_Provider → Cached_Response.
2. WHEN a provider returns an error or times out, THE Router SHALL immediately attempt the next provider in the Fallback_Chain without surfacing the error to the caller.
3. WHEN the Local_Provider is also unavailable, THE Router SHALL return the most recent Cached_Response for a semantically similar request if one exists.
4. IF no Cached_Response is available and all live providers have failed, THEN THE Gateway SHALL return a structured error response indicating all providers are unavailable.
5. THE Gateway SHALL cache the last successful response per task type to serve as Cached_Response candidates.
6. WHEN a fallback occurs, THE Gateway SHALL log the fallback event including the failed provider, reason, and the provider ultimately used.

---

### Requirement 7: Performance Monitoring

**User Story:** As the system operator, I want to observe Gateway performance metrics, so that I can verify the ~11µs overhead target is met and identify routing inefficiencies.

#### Acceptance Criteria

1. THE Gateway SHALL record a Performance_Record for every completed request, capturing: total latency (ms), provider latency (ms), Gateway overhead (ms), provider name, model, task type, entropy level, success/failure, and timestamp.
2. THE Gateway SHALL expose a `getMetrics()` method returning aggregate statistics: request count, success rate, p50/p95/p99 latency per provider, and average Gateway overhead.
3. WHEN Gateway overhead exceeds 100ms for any single request, THE Gateway SHALL emit a warning log entry.
4. THE Gateway SHALL retain the last 1,000 Performance_Records in memory for metrics aggregation.

---

### Requirement 8: Bifrost Process Integration

**User Story:** As a developer, I want the Gateway TypeScript client to manage the Bifrost Go process lifecycle, so that I don't have to manually start and stop Bifrost.

#### Acceptance Criteria

1. THE Gateway SHALL start the Bifrost process on `initialize()` if it is not already running, using the binary path configured via environment variable `BIFROST_BIN_PATH`.
2. THE Gateway SHALL verify Bifrost is reachable at `http://localhost:8080/health` within 5,000ms of starting the process.
3. IF Bifrost fails to start or become reachable within 5,000ms, THEN THE Gateway SHALL throw an initialization error with a descriptive message.
4. THE Gateway SHALL stop the Bifrost process on `shutdown()`.
5. WHEN the Bifrost process exits unexpectedly, THE Gateway SHALL attempt to restart it up to 3 times with a 2,000ms delay between attempts.
6. THE Gateway SHALL configure Bifrost via a generated config file written to a temp directory on `initialize()`, including Cloud_Provider and Local_Provider endpoint definitions.

---

### Requirement 9: Configuration and Environment

**User Story:** As a developer, I want all Gateway configuration to be driven by environment variables with sensible defaults, so that I can deploy the Gateway in different environments without code changes.

#### Acceptance Criteria

1. THE Gateway SHALL read Cloud_Provider configuration from environment variables: `ZAI_API_KEY`, `ZAI_BASE_URL` (default: `https://api.z.ai/api/coding/paas/v4`), `ZAI_MODEL` (default: `glm-5-pro`).
2. THE Gateway SHALL read Local_Provider configuration from environment variables: `OLLAMA_BASE_URL` (default: `http://localhost:11434`), `OLLAMA_MODEL` (default: `qwen3.5:latest`).
3. THE Gateway SHALL read Bifrost configuration from environment variables: `BIFROST_BIN_PATH` (default: `./bin/bifrost`), `BIFROST_PORT` (default: `8080`).
4. THE Gateway SHALL read quota configuration from: `ZAI_QUOTA_LIMIT` (default: `1000000` tokens), `ZAI_QUOTA_RESET_INTERVAL_HOURS` (default: `24`).
5. IF a required environment variable (`ZAI_API_KEY`) is missing at initialization time, THEN THE Gateway SHALL log a warning and disable the Cloud_Provider, routing all requests to the Local_Provider.

---

### Requirement 10: Non-Blocking Async Operation

**User Story:** As a dialogue agent, I want all Gateway calls to be non-blocking, so that the main dialogue loop is never stalled waiting for an LLM response.

#### Acceptance Criteria

1. THE Gateway SHALL expose all public methods as `async` functions returning Promises.
2. THE Gateway SHALL enforce a per-request timeout configurable via `REQUEST_TIMEOUT_MS` environment variable (default: `30000`ms).
3. WHEN a request exceeds the timeout, THE Gateway SHALL cancel the in-flight request and proceed to the next provider in the Fallback_Chain.
4. THE Gateway SHALL never throw unhandled promise rejections; all errors SHALL be caught and either handled via the Fallback_Chain or returned as structured error responses.

---

### Requirement 11: Routing Observability and Audit Log

**User Story:** As a developer debugging routing decisions, I want a structured audit log of every routing decision, so that I can trace why a request went to a particular provider.

#### Acceptance Criteria

1. THE Gateway SHALL emit a structured log entry for every Routing_Decision, including: request ID, task type, entropy level, selected provider, model, quota state, and provider health state at decision time.
2. THE Gateway SHALL assign a unique `requestId` (UUID v4) to every incoming request.
3. WHEN debug logging is enabled via `GATEWAY_LOG_LEVEL=debug`, THE Gateway SHALL also log the message content summary (first 100 characters) used for task classification.
4. THE Gateway SHALL expose a `getRecentDecisions(limit)` method returning the last N Routing_Decision records for inspection.
