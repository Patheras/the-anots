# Requirements Document

## Introduction

The LangGraph Orchestration layer is the stateful multi-agent workflow engine for TCAM — the "nervous system" that governs interaction loops between Chip (human reality anchor), Ubik (creative engine), and Axiom (analytical engine). Built on `@langchain/langgraph`, it manages the ANOTSState graph, conditional routing between nodes, cycle detection, and Redis-backed checkpointing. It also implements the Whisper Protocol for asynchronous inter-node messaging and the OGCI (Orchestrator-Gated Context Injection) mechanism that keeps the Chip Field clean from terminal pollution.

All LLM calls within nodes route through the existing `ANOTSGateway`. State is persisted to Redis via the existing `RedisClient`. The orchestration layer integrates with `MemoryService` for truth extraction and Chronicle inscription.

## Glossary

- **ANOTSGraph**: The compiled LangGraph `StateGraph` instance that defines the full ANOTS workflow.
- **ANOTSState**: The typed state object threaded through every node in the graph, containing messages, current node, task status, context, whispers, and reality anchor flag.
- **Ubik_Node**: The creative agent node responsible for research, synthesis, and divergent expansion. Entry point of the graph.
- **Axiom_Node**: The analytical agent node responsible for verification, tool crafting (autopoiesis), and convergent analysis.
- **Chip**: The human operator acting as reality anchor and source of volition. Injects intent into the graph and receives the final verified output.
- **Router**: The conditional edge function that inspects node output and determines the next graph transition.
- **Cycle_Detector**: The component that tracks iteration count per session and enforces the maximum 10-iteration limit.
- **Redis_Checkpointer**: The LangGraph checkpointer implementation backed by the existing `RedisClient`, persisting `ANOTSState` after every node execution.
- **InMemory_Checkpointer**: The fallback checkpointer used when Redis is unavailable, storing state in process memory.
- **Whisper**: A typed asynchronous message passed between sub-agents (e.g., `ubik.scout` → `axiom.actuator`) that bypasses the Chip Field.
- **WhisperBus**: The async message bus that routes, stores, and delivers Whisper messages between nodes and sub-agents.
- **OGCI**: Orchestrator-Gated Context Injection — the mechanism by which Chip controls what context each node receives, preventing role contamination.
- **Chip_Field**: The protected output channel visible to Chip, containing only synthesized, human-readable content — never raw JSON, logs, or scraping output.
- **Reality_Anchor**: The boolean flag in ANOTSState indicating that Chip has validated the current output as grounded (non-hallucinatory).
- **Autopoiesis**: The self-extending capability triggered when Ubik encounters a blocker and requests Axiom to craft a custom tool.
- **Task_Status**: The lifecycle state of the current workflow: `initiated` → `processing` → `verified` → `complete`.

---

## Requirements

### Requirement 1: ANOTSState Definition

**User Story:** As the LangGraph engine, I want a well-typed state object that captures the full context of an ANOTS workflow session, so that every node has access to the information it needs without coupling to external stores.

#### Acceptance Criteria

1. THE ANOTSState SHALL contain the following fields: `messages` (array of `Message`), `current_node` (union of `"chip" | "ubik" | "axiom"`), `task_status` (union of `"initiated" | "processing" | "verified" | "complete"`), `context` (key-value record), `whispers` (array of `Whisper`), and `reality_anchor` (boolean).
2. THE ANOTSState SHALL define a `sessionId` field (string) used as the LangGraph thread ID for checkpointing.
3. THE ANOTSState SHALL define an `iterationCount` field (number, default 0) incremented by the Cycle_Detector on each node execution.
4. THE ANOTSState SHALL define reducers for the `messages` array that append new messages rather than replacing the array.
5. THE ANOTSState SHALL define reducers for the `whispers` array that append new whispers rather than replacing the array.
6. FOR ALL valid ANOTSState objects, serializing then deserializing SHALL produce an equivalent object (round-trip property).

---

### Requirement 2: State Graph Construction

**User Story:** As a developer, I want the ANOTSGraph to be constructed from a declarative definition of nodes and edges, so that the workflow topology is explicit, auditable, and testable in isolation.

#### Acceptance Criteria

1. THE ANOTSGraph SHALL define exactly two agent nodes: `ubik` (mapped to `Ubik_Node`) and `axiom` (mapped to `Axiom_Node`).
2. THE ANOTSGraph SHALL set `ubik` as the entry point of the graph.
3. THE ANOTSGraph SHALL add conditional edges from `ubik` with the following routing map: `"needs_verification"` → `axiom`, `"needs_tool"` → `axiom`, `"complete"` → `END`.
4. THE ANOTSGraph SHALL add conditional edges from `axiom` with the following routing map: `"verified"` → `END`, `"needs_revision"` → `ubik`, `"tool_created"` → `ubik`.
5. THE ANOTSGraph SHALL be compiled with a checkpointer (Redis_Checkpointer or InMemory_Checkpointer) before use.
6. THE ANOTSGraph SHALL expose an `invoke(input, config)` method accepting an initial ANOTSState partial and a thread config containing `sessionId`.

---

### Requirement 3: Ubik Node

**User Story:** As Chip, I want Ubik to receive my intent, perform creative expansion and research, and either return a complete response or route to Axiom when it needs verification or a custom tool, so that the workflow progresses without manual intervention.

#### Acceptance Criteria

1. WHEN the `ubik` node is invoked, THE Ubik_Node SHALL set `current_node` to `"ubik"` and `task_status` to `"processing"` in the returned state patch.
2. THE Ubik_Node SHALL call `ANOTSGateway.chat()` with the current messages and a `taskHint` of `"research-synthesis"` or `"philosophical-dialogue"` based on the task context.
3. WHEN Ubik_Node determines the response is complete and verified, THE Ubik_Node SHALL return a routing signal of `"complete"` and set `task_status` to `"complete"`.
4. WHEN Ubik_Node determines the response requires factual verification, THE Ubik_Node SHALL return a routing signal of `"needs_verification"` and append a Whisper to the state with `from: "ubik"`, `to: "axiom"`, `content.type: "request"`.
5. WHEN Ubik_Node detects a blocker (e.g., paywall, CAPTCHA, missing tool), THE Ubik_Node SHALL return a routing signal of `"needs_tool"` and append a Whisper with `from: "ubik.scout"`, `to: "axiom.actuator"`, `content.type: "request"`, `priority: "high"`.
6. IF the Cycle_Detector signals that the maximum iteration count has been reached, THEN THE Ubik_Node SHALL return a routing signal of `"complete"` regardless of task state, setting `task_status` to `"complete"`.

---

### Requirement 4: Axiom Node

**User Story:** As Chip, I want Axiom to receive Ubik's output, verify claims or craft tools as needed, and route back to Ubik or terminate the workflow, so that the final output delivered to me is grounded and accurate.

#### Acceptance Criteria

1. WHEN the `axiom` node is invoked, THE Axiom_Node SHALL set `current_node` to `"axiom"` and `task_status` to `"processing"` in the returned state patch.
2. THE Axiom_Node SHALL call `ANOTSGateway.chat()` with the current messages and a `taskHint` of `"testing-validation"` or `"code-generation"` based on the task context.
3. WHEN Axiom_Node completes verification and the output is grounded, THE Axiom_Node SHALL return a routing signal of `"verified"`, set `task_status` to `"verified"`, and set `reality_anchor` to `true`.
4. WHEN Axiom_Node determines the output requires revision, THE Axiom_Node SHALL return a routing signal of `"needs_revision"` and append a Whisper with `from: "axiom"`, `to: "ubik"`, `content.type: "response"`.
5. WHEN Axiom_Node completes tool crafting (autopoiesis), THE Axiom_Node SHALL return a routing signal of `"tool_created"` and append a Whisper with `from: "axiom.actuator"`, `to: "ubik.crawler"`, `content.type: "response"`, `priority: "high"`.
6. IF the Cycle_Detector signals that the maximum iteration count has been reached, THEN THE Axiom_Node SHALL return a routing signal of `"verified"` regardless of task state, setting `reality_anchor` to `false` to signal forced termination.

---

### Requirement 5: Conditional Routing

**User Story:** As the LangGraph engine, I want a deterministic routing function that maps node output signals to graph transitions, so that the workflow follows the correct path without ambiguity.

#### Acceptance Criteria

1. THE Router SHALL accept the current ANOTSState and return exactly one routing signal string per invocation.
2. THE Router SHALL extract the routing signal from the last assistant message in `state.messages` using a structured output field (e.g., `routing_signal` in the message metadata).
3. IF the Router cannot extract a valid routing signal from the message, THEN THE Router SHALL return a safe default: `"complete"` for the `ubik` router and `"verified"` for the `axiom` router.
4. FOR ALL valid ANOTSState inputs, THE Router SHALL return a routing signal that is a member of the valid signal set for that node (`"needs_verification" | "needs_tool" | "complete"` for ubik; `"verified" | "needs_revision" | "tool_created"` for axiom).
5. THE Router SHALL be a pure function with no side effects — given the same ANOTSState, it SHALL always return the same routing signal (determinism property).

---

### Requirement 6: Cycle Detection

**User Story:** As the system operator, I want the orchestration layer to detect and terminate infinite loops, so that a runaway workflow cannot consume unbounded resources.

#### Acceptance Criteria

1. THE Cycle_Detector SHALL increment `state.iterationCount` by 1 on every node execution (ubik or axiom).
2. WHEN `state.iterationCount` reaches 10, THE Cycle_Detector SHALL signal forced termination to the active node.
3. THE Cycle_Detector SHALL expose an `isTerminationRequired(state: ANOTSState): boolean` method that returns `true` when `iterationCount >= 10`.
4. WHEN forced termination occurs, THE ANOTSGraph SHALL append a system message to `state.messages` indicating the reason: `"[ANOTS] Maximum iteration limit reached. Workflow terminated."`.
5. THE Cycle_Detector SHALL reset `iterationCount` to 0 when a new session is started (new `sessionId`).
6. FOR ALL sessions, the total number of node executions SHALL never exceed 10 (termination guarantee property).

---

### Requirement 7: Redis Checkpointer

**User Story:** As the system operator, I want ANOTSState to be persisted to Redis after every node execution, so that sessions survive process restarts and can be resumed from the last checkpoint.

#### Acceptance Criteria

1. THE Redis_Checkpointer SHALL implement the LangGraph `BaseCheckpointSaver` interface using the existing `RedisClient`.
2. THE Redis_Checkpointer SHALL persist the full ANOTSState to Redis using the key pattern `tcam:checkpoint:{sessionId}:{checkpointId}` after every node execution.
3. THE Redis_Checkpointer SHALL set a TTL of 604800 seconds (7 days) on every checkpoint key.
4. WHEN `Redis_Checkpointer.get(config)` is called, THE Redis_Checkpointer SHALL return the most recent checkpoint for the given `sessionId`, or `undefined` if none exists.
5. WHEN `Redis_Checkpointer.put(config, checkpoint, metadata)` is called, THE Redis_Checkpointer SHALL serialize the checkpoint to JSON and write it to Redis within 100ms under normal load.
6. IF Redis is unavailable at graph compile time, THEN THE ANOTSGraph SHALL fall back to the InMemory_Checkpointer and log a warning: `"[ANOTSGraph] Redis unavailable — using in-memory checkpointer"`.
7. FOR ALL checkpoints written to Redis, deserializing the stored JSON SHALL produce an ANOTSState equivalent to the original (round-trip property).

---

### Requirement 8: Whisper Protocol

**User Story:** As a sub-agent (ubik.scout, axiom.actuator, etc.), I want to send typed asynchronous messages to other sub-agents without polluting the Chip Field, so that raw data, tool requests, and tool deliveries flow through a separate channel.

#### Acceptance Criteria

1. THE Whisper interface SHALL contain the following fields: `id` (UUID string), `from` (union of valid sender identities), `to` (union of valid recipient identities), `content` (object with `type` and `payload`), `priority` (union of `"low" | "normal" | "high" | "critical"`), `status` (union of `"sent" | "delivered" | "read" | "responded"`), `timestamp` (Date), and `namespace` (string in `"sender:recipient"` format).
2. THE Whisper `from` field SHALL accept: `"ubik" | "axiom" | "chip" | "ubik.scout" | "ubik.crawler" | "axiom.scribe" | "axiom.actuator"`.
3. THE Whisper `to` field SHALL accept: `"ubik" | "axiom" | "chip" | "all"`.
4. THE Whisper `content.type` field SHALL accept: `"request" | "response" | "notification" | "raw_data"`.
5. THE Whisper `namespace` field SHALL be automatically derived as `"{from}:{to}"` when not explicitly provided.
6. WHEN a Whisper is created, THE Whisper `status` SHALL be initialized to `"sent"` and `id` SHALL be a UUID v4.

---

### Requirement 9: WhisperBus

**User Story:** As a node or sub-agent, I want to publish and subscribe to Whisper messages through a central bus, so that inter-node communication is decoupled and observable.

#### Acceptance Criteria

1. THE WhisperBus SHALL expose a `publish(whisper: Whisper): Promise<void>` method that stores the whisper in the ANOTSState `whispers` array and emits it to registered subscribers.
2. THE WhisperBus SHALL expose a `subscribe(recipient: string, handler: (whisper: Whisper) => Promise<void>): () => void` method that registers a handler and returns an unsubscribe function.
3. WHEN a Whisper is published with `to: "all"`, THE WhisperBus SHALL deliver it to all registered subscribers.
4. WHEN a Whisper is published with a specific `to` value, THE WhisperBus SHALL deliver it only to subscribers registered for that recipient identity.
5. WHEN a subscriber handler is called, THE WhisperBus SHALL update the Whisper `status` to `"delivered"`.
6. THE WhisperBus SHALL process Whispers in priority order: `"critical"` first, then `"high"`, `"normal"`, `"low"`.
7. IF a subscriber handler throws an error, THEN THE WhisperBus SHALL log the error and continue delivering to other subscribers without propagating the exception.

---

### Requirement 10: OGCI — Orchestrator-Gated Context Injection

**User Story:** As Chip, I want to control what context each node receives before it executes, so that Ubik and Axiom maintain distinct functional identities and neither is contaminated by the other's raw outputs.

#### Acceptance Criteria

1. THE OGCI SHALL expose a `filterContext(state: ANOTSState, targetNode: "ubik" | "axiom"): ANOTSState` method that returns a filtered state view for the target node.
2. WHEN filtering context for `ubik`, THE OGCI SHALL exclude all messages with `metadata.source === "axiom_raw"` and all Whispers with `content.type === "raw_data"` from the filtered state.
3. WHEN filtering context for `axiom`, THE OGCI SHALL exclude all messages with `metadata.source === "ubik_raw"` and all Whispers with `content.type === "raw_data"` not addressed to `axiom` or `axiom.actuator`.
4. THE OGCI SHALL preserve the `reality_anchor`, `task_status`, `iterationCount`, and `sessionId` fields unchanged in all filtered state views.
5. THE OGCI SHALL be applied by the ANOTSGraph before invoking each node, ensuring nodes never receive unfiltered state directly.
6. FOR ALL valid ANOTSState inputs, applying OGCI filtering SHALL be idempotent — applying it twice SHALL produce the same result as applying it once.

---

### Requirement 11: Chip Field Protection

**User Story:** As Chip, I want the output I receive to contain only synthesized, human-readable content — never raw JSON, terminal logs, or scraping output — so that my cognitive experience remains coherent and entropy-resistant.

#### Acceptance Criteria

1. THE ANOTSGraph SHALL designate messages with `metadata.channel === "chip_field"` as the only messages surfaced to Chip in the final output.
2. WHEN a node produces raw data output (JSON blobs, logs, scraping results), THE node SHALL route that output via a Whisper with `content.type: "raw_data"` rather than appending it to the `messages` array as a chip_field message.
3. THE ANOTSGraph SHALL expose a `getChipFieldMessages(state: ANOTSState): Message[]` utility that filters `state.messages` to only those with `metadata.channel === "chip_field"`.
4. WHEN the final graph output is returned to the caller, THE ANOTSGraph SHALL include only chip_field messages in the top-level `messages` field of the response.
5. IF a node attempts to append a message containing raw JSON (detectable by `JSON.parse` succeeding on the content), THEN THE ANOTSGraph SHALL automatically reclassify it as a Whisper with `content.type: "raw_data"` and log a warning.

---

### Requirement 12: Gateway Integration

**User Story:** As a node (Ubik or Axiom), I want all my LLM calls to route through the ANOTSGateway, so that entropy-based routing, quota management, and fallback chains apply to orchestration traffic.

#### Acceptance Criteria

1. THE Ubik_Node and Axiom_Node SHALL accept an `ANOTSGateway` instance via constructor injection and use it exclusively for all LLM calls.
2. THE Ubik_Node SHALL pass `taskHint: "research-synthesis"` for research tasks and `taskHint: "philosophical-dialogue"` for dialogue tasks when calling `ANOTSGateway.chat()`.
3. THE Axiom_Node SHALL pass `taskHint: "testing-validation"` for verification tasks and `taskHint: "code-generation"` for tool crafting tasks when calling `ANOTSGateway.chat()`.
4. WHEN `ANOTSGateway.chat()` returns a structured error response (i.e., `response.error` is present), THE node SHALL append a system message to state indicating the failure and return a safe routing signal (`"complete"` for ubik, `"verified"` for axiom).
5. THE ANOTSGraph SHALL be constructable with a single `ANOTSGateway` instance shared between both nodes.

---

### Requirement 13: MemoryService Integration

**User Story:** As the orchestration layer, I want to trigger memory operations (truth extraction, Chronicle inscription) at the end of a completed workflow, so that session knowledge is persisted to the Hive Mind without blocking the dialogue.

#### Acceptance Criteria

1. WHEN the ANOTSGraph reaches `END` with `task_status === "complete"` or `task_status === "verified"`, THE ANOTSGraph SHALL asynchronously invoke `MemoryService.extractTruths()` with the session dialogue.
2. WHEN the ANOTSGraph reaches `END`, THE ANOTSGraph SHALL asynchronously invoke `MemoryService.inscribeChronicle()` with the session data.
3. THE memory operations SHALL be fire-and-forget — they SHALL NOT block the return of the final state to the caller.
4. IF `MemoryService` is not provided at construction time, THEN THE ANOTSGraph SHALL skip memory operations and log a debug message: `"[ANOTSGraph] MemoryService not configured — skipping post-session memory ops"`.
5. WHEN memory operations fail, THE ANOTSGraph SHALL log the error but SHALL NOT alter the final state returned to the caller.

---

### Requirement 14: Session Lifecycle

**User Story:** As a developer, I want a clean API to start, resume, and terminate ANOTS sessions, so that I can integrate the orchestration layer into the TCAM application without managing LangGraph internals directly.

#### Acceptance Criteria

1. THE ANOTSGraph SHALL expose a `startSession(intent: string, sessionId?: string): Promise<ANOTSState>` method that initializes a new ANOTSState with `task_status: "initiated"`, injects Chip's intent as the first user message, and invokes the graph.
2. WHEN `sessionId` is provided to `startSession`, THE ANOTSGraph SHALL attempt to resume from the existing Redis checkpoint for that session before invoking the graph.
3. THE ANOTSGraph SHALL expose a `getSessionState(sessionId: string): Promise<ANOTSState | null>` method that retrieves the current state from the checkpointer without invoking the graph.
4. THE ANOTSGraph SHALL expose a `terminateSession(sessionId: string): Promise<void>` method that deletes the Redis checkpoint for the session and clears in-memory state.
5. WHEN `startSession` is called without a `sessionId`, THE ANOTSGraph SHALL generate a new UUID v4 as the session ID.
6. THE ANOTSGraph SHALL emit a structured log entry at session start and end, including `sessionId`, `iterationCount`, `task_status`, and total elapsed time in milliseconds.
