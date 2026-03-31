# Requirements Document: ANOTS Unified Platform

## Introduction

ANOTS (Autonomous Network of Triadic Systems) is a unified cognitive augmentation platform that supports three progressive deployment modes:

1. **CLI Mode**: Zero-setup command-line interface for direct memory and LLM access
2. **MCP Server Mode**: Expose ANOTS capabilities via Model Context Protocol for external agent integration
3. **Standalone Mode**: Full triadic agent system (Ubik + Axiom) with LangGraph orchestration

The platform is built on a resilient 4-layer memory architecture (Chronicle, Active Stream, Hive Mind, Agent Codex) and intelligent LLM routing (Gateway). Each deployment mode builds upon the previous, allowing users to start simple and scale to full cognitive augmentation.

**Design Philosophy**: Progressive complexity - start with CLI, integrate via MCP, or use full standalone system.

## Glossary

- **Deployment_Mode**: One of `'cli'`, `'mcp-server'`, or `'standalone'` — determines how ANOTS operates
- **CLI_Mode**: Command-line interface for direct access to memory and LLM capabilities
- **MCP_Server_Mode**: ANOTS exposes capabilities as MCP tools for external agent systems
- **Standalone_Mode**: Full ANOTS with Ubik + Axiom agents and LangGraph orchestration
- **Memory_System**: 4-layer architecture (L1: Chronicle, L2: Active Stream, L3: Hive Mind, L4: Agent Codex)
- **Gateway**: Intelligent LLM routing system with entropy-based classification and quota management
- **MCP_Tool**: A capability exposed via Model Context Protocol (e.g., `anots/memory/search`)
- **External_Agent**: An agent system outside ANOTS (Claude Desktop, Cline, Cursor, OpenClaw) that connects via MCP
- **Layer_Independence**: Each memory layer operates independently; failures don't cascade
- **Property_Based_Test**: A test that verifies a property holds for all valid inputs (using fast-check)

---

## Requirements

### Requirement 1: Deployment Mode Selection

**User Story:** As a user, I want to choose how to deploy ANOTS (CLI, MCP server, or standalone), so that I can start simple and scale as needed.

#### Acceptance Criteria

1. THE system SHALL support three deployment modes: `'cli'`, `'mcp-server'`, and `'standalone'`, configured via environment variable `ANOTS_MODE` (default: `'cli'`).
2. WHEN `ANOTS_MODE='cli'`, THE system SHALL start in CLI mode with command-line interface only.
3. WHEN `ANOTS_MODE='mcp-server'`, THE system SHALL start the MCP server and expose ANOTS capabilities as MCP tools.
4. WHEN `ANOTS_MODE='standalone'`, THE system SHALL load Ubik and Axiom agents and initialize LangGraph orchestration.
5. THE system SHALL validate the selected mode at initialization and throw a descriptive error if invalid.
6. THE system SHALL log the selected deployment mode and active components at startup.

#### Correctness Properties

**Property 1: Mode Validation**
*For any* string value assigned to `ANOTS_MODE`, the system SHALL either accept it as a valid mode (`'cli'`, `'mcp-server'`, `'standalone'`) or reject it with a descriptive error.

**Property 2: Mode Determinism**
*For any* valid deployment mode, starting the system twice with the same mode SHALL result in identical component initialization (same services started, same ports bound).

---

### Requirement 2: CLI Mode - Memory Commands

**User Story:** As a CLI user, I want to search, store, and manage memory via command-line, so that I can use ANOTS without any external dependencies.

#### Acceptance Criteria

1. THE CLI SHALL provide the following memory commands:
   - `anots memory search <query>` — Search Hive Mind (L3) semantic memory
   - `anots memory store <content>` — Store fact in Hive Mind (L3)
   - `anots memory context` — Display Active Stream (L2) context
   - `anots memory clear` — Clear Active Stream (L2) context

2. THE `anots memory search` command SHALL accept:
   - `<query>` (required) — Search query string
   - `--limit <n>` (optional, default: 5) — Max results
   - `--format <json|table>` (optional, default: table) — Output format

3. THE `anots memory store` command SHALL accept:
   - `<content>` (required) — Fact to store
   - `--source <name>` (optional) — Source identifier
   - `--metadata <json>` (optional) — Additional metadata

4. ALL memory commands SHALL work without requiring Qdrant, Redis, or any external services (graceful degradation to file-based storage).
5. THE CLI SHALL display helpful error messages when operations fail, including suggestions for resolution.

#### Correctness Properties

**Property 3: Memory Search Idempotence**
*For any* query string, calling `anots memory search <query>` multiple times SHALL return the same results (assuming no new facts stored between calls).

**Property 4: Memory Store-Retrieve Round-Trip**
*For any* content string, after calling `anots memory store <content>`, calling `anots memory search` with keywords from the content SHALL return the stored fact in the results.

---

### Requirement 3: CLI Mode - Chronicle Commands

**User Story:** As a CLI user, I want to write and read Chronicle entries via command-line, so that I can maintain an immutable historical record.

#### Acceptance Criteria

1. THE CLI SHALL provide the following Chronicle commands:
   - `anots chronicle write <content>` — Write new Chronicle entry
   - `anots chronicle read <id>` — Read Chronicle entry by ID
   - `anots chronicle list` — List Chronicle entries
   - `anots chronicle search <query>` — Search Chronicle by content

2. THE `anots chronicle write` command SHALL accept:
   - `<content>` (required) — Entry content (markdown or file path)
   - `--participants <list>` (optional) — Comma-separated participant IDs
   - `--type <general|research|...>` (optional) — Session type

3. THE `anots chronicle read` command SHALL accept:
   - `<id>` (required) — Chapter ID to read
   - `--format <markdown|json>` (optional, default: markdown) — Output format

4. THE `anots chronicle list` command SHALL accept:
   - `--from <date>` (optional) — Filter by start date
   - `--to <date>` (optional) — Filter by end date
   - `--participant <name>` (optional) — Filter by participant
   - `--limit <n>` (optional, default: 10) — Max results

5. ALL Chronicle commands SHALL work with zero external dependencies (file system only).

#### Correctness Properties

**Property 5: Chronicle Immutability**
*For any* Chronicle entry written via `anots chronicle write`, attempting to write to the same chapter ID again SHALL fail with an error (append-only, no overwrites).

**Property 6: Chronicle Write-Read Round-Trip**
*For any* content string, after calling `anots chronicle write <content>`, calling `anots chronicle read` with the returned chapter ID SHALL return the exact same content.

---

### Requirement 4: CLI Mode - Chat Commands

**User Story:** As a CLI user, I want to chat with LLMs via command-line, so that I can get AI assistance without external tools.

#### Acceptance Criteria

1. THE CLI SHALL provide the following chat commands:
   - `anots chat <message>` — Send message to LLM and get response
   - `anots chat --interactive` — Start interactive chat session
   - `anots chat --model <name>` — Specify model to use

2. THE `anots chat` command SHALL accept:
   - `<message>` (required) — User message
   - `--model <name>` (optional) — Model name (e.g., `qwen3.5:latest`, `glm-5-pro`)
   - `--temperature <n>` (optional, default: 0.7) — Temperature setting
   - `--stream` (optional) — Stream response token-by-token

3. WHEN Gateway is available, THE chat command SHALL use intelligent routing (entropy-based).
4. WHEN Gateway is unavailable, THE chat command SHALL fall back to direct Ollama connection.
5. THE interactive mode SHALL maintain conversation context across messages.

#### Correctness Properties

**Property 7: Chat Response Non-Empty**
*For any* non-empty message string, calling `anots chat <message>` SHALL return a non-empty response (or a structured error if LLM unavailable).

**Property 8: Interactive Context Preservation**
*For any* sequence of messages in interactive mode, the LLM SHALL have access to all previous messages in the conversation (context preserved).

---

### Requirement 5: MCP Server - Tool Registration

**User Story:** As an MCP server, I want to register all ANOTS capabilities as MCP tools, so that external agents can discover and use them.

#### Acceptance Criteria

1. THE MCP server SHALL implement the standard MCP `tools/list` method.
2. THE MCP server SHALL register the following tool namespaces:
   - `anots/memory/*` — Memory operations (search, store, context)
   - `anots/chronicle/*` — Chronicle operations (write, read, list, search)
   - `anots/gateway/*` — Gateway operations (chat, classify, status)
   - `anots/codex/*` — Codex operations (read, write, list, init)
   - `anots/system/*` — System operations (health, list-tools)

3. EACH tool SHALL have a JSON Schema defining its input parameters.
4. EACH tool SHALL have a clear description following the format: "ANOTS: <action> <component> - <details>".
5. THE tool list SHALL be generated dynamically based on available services (e.g., if Gateway unavailable, `anots/gateway/*` tools not listed).

#### Correctness Properties

**Property 9: Tool List Completeness**
*For any* deployment with all services running, the `tools/list` response SHALL include at least 15 tools covering all five namespaces.

**Property 10: Tool Schema Validity**
*For any* tool in the `tools/list` response, the `inputSchema` field SHALL be a valid JSON Schema that can be validated using a JSON Schema validator.

---

### Requirement 6: MCP Server - Memory Tools

**User Story:** As an external agent, I want to access ANOTS memory via MCP tools, so that I can store and retrieve information across sessions.

#### Acceptance Criteria

1. THE MCP server SHALL expose the following memory tools:
   - `anots/memory/search` — Search Hive Mind (L3)
   - `anots/memory/store` — Store fact in Hive Mind (L3)
   - `anots/memory/get-context` — Get Active Stream (L2) context
   - `anots/memory/update-context` — Update Active Stream (L2) context

2. THE `anots/memory/search` tool SHALL accept parameters:
   - `query` (string, required) — Search query
   - `limit` (number, optional, default: 5) — Max results
   - `filter` (object, optional) — Metadata filters

3. THE `anots/memory/store` tool SHALL accept parameters:
   - `content` (string, required) — Fact to store
   - `metadata` (object, optional) — Additional metadata
   - `source` (string, optional) — Source identifier

4. ALL memory tools SHALL return structured responses with success/error status and data/error message.
5. THE MCP server SHALL log all memory tool invocations with client ID, tool name, and timestamp.

#### Correctness Properties

**Property 11: MCP Memory Tool Equivalence**
*For any* valid input, calling `anots/memory/search` via MCP SHALL return the same results as calling `anots memory search` via CLI (modulo formatting differences).

**Property 12: MCP Tool Error Handling**
*For any* invalid input to an MCP memory tool, the tool SHALL return a structured error response (not throw an exception) with a descriptive error message.

---

### Requirement 7: MCP Server - Gateway Tools

**User Story:** As an external agent, I want to use ANOTS Gateway for intelligent LLM routing via MCP, so that I benefit from entropy-based routing and quota management.

#### Acceptance Criteria

1. THE MCP server SHALL expose the following Gateway tools:
   - `anots/gateway/chat` — Route LLM request via Gateway
   - `anots/gateway/classify` — Classify task entropy without routing
   - `anots/gateway/status` — Get Gateway health and quota status

2. THE `anots/gateway/chat` tool SHALL accept parameters:
   - `messages` (array of chat messages, required) — OpenAI-format messages
   - `taskHint` (string, optional) — Task type hint for classification
   - `temperature` (number, optional) — Temperature override
   - `maxTokens` (number, optional) — Max tokens override

3. THE `anots/gateway/classify` tool SHALL accept parameters:
   - `messages` (array of chat messages, required) — Messages to classify

4. THE `anots/gateway/status` tool SHALL return:
   - Current quota status (consumed, limit, exhausted)
   - Provider health (cloud, local)
   - Recent routing decisions (last 10)

5. THE Gateway tools SHALL enforce the same routing logic as CLI and standalone modes.

#### Correctness Properties

**Property 13: Gateway Routing Determinism**
*For any* set of messages and task hint, calling `anots/gateway/classify` multiple times SHALL return the same task type and entropy level (deterministic classification).

**Property 14: Gateway Chat Response Validity**
*For any* valid messages array, calling `anots/gateway/chat` SHALL return either a valid chat completion response OR a structured error (never throw unhandled exception).

---

### Requirement 8: Standalone Mode - Agent Initialization

**User Story:** As a standalone user, I want ANOTS to load Ubik and Axiom agents automatically, so that I can use the full triadic system.

#### Acceptance Criteria

1. WHEN `ANOTS_MODE='standalone'`, THE system SHALL load agent definitions for Ubik and Axiom from `src/agents/presets/`.
2. THE Ubik agent SHALL be configured with:
   - Role: Creative Engine - Divergent processing
   - Model preferences: high_entropy=glm-5-pro, low_entropy=qwen3.5:latest
   - Full memory access (all layers read/write)

3. THE Axiom agent SHALL be configured with:
   - Role: Analytical Engine - Convergent processing
   - Model preferences: high_entropy=glm-5-pro, low_entropy=qwen3.5:latest
   - Full memory access (all layers read/write)

4. THE system SHALL initialize LangGraph orchestration with nodes for Ubik and Axiom.
5. THE system SHALL log successful agent initialization with agent names and roles.

#### Correctness Properties

**Property 15: Agent Definition Validity**
*For any* agent definition file in `src/agents/presets/`, the file SHALL parse successfully and validate against the AgentDefinition schema.

**Property 16: Agent Initialization Idempotence**
*For any* valid agent definition, initializing the agent twice SHALL result in identical agent state (same ID, role, permissions).

---

### Requirement 9: Memory System - Layer Independence

**User Story:** As a system architect, I want each memory layer to operate independently, so that failures in one layer don't cascade to others.

#### Acceptance Criteria

1. THE Memory System SHALL maintain four independent layers:
   - L1 (Chronicle): File system, zero external dependencies
   - L2 (Active Stream): Redis, isolated state
   - L3 (Hive Mind): Qdrant + Mem0, semantic memory
   - L4 (Agent Codex): File system, per-agent isolation

2. WHEN one memory layer fails, THE other layers SHALL continue to operate normally.
3. THE system SHALL expose layer-specific health checks showing each layer's status independently.
4. THE system SHALL log layer-specific errors without affecting other layers' operations.
5. WHEN a memory layer is unavailable, THE corresponding operations SHALL return graceful error responses indicating which layer is affected.

#### Correctness Properties

**Property 17: Layer Failure Isolation**
*For any* memory layer L, if L becomes unavailable, operations on other layers SHALL continue to succeed (failures don't cascade).

**Property 18: Layer Independence**
*For any* two distinct memory layers L1 and L2, operations on L1 SHALL NOT depend on the state or availability of L2.

---

### Requirement 10: Testing - Property-Based Tests

**User Story:** As a developer, I want property-based tests for all critical system properties, so that I can verify correctness across the full input space.

#### Acceptance Criteria

1. THE system SHALL include property-based tests using `fast-check` for all 18 correctness properties defined in this specification.
2. EACH property test SHALL run a minimum of 100 iterations with randomly generated inputs.
3. THE property tests SHALL be tagged with the format: `// Feature: anots-unified, Property N: <property_text>`.
4. THE system SHALL provide custom arbitraries for:
   - `arbitraryDeploymentMode()` — Random deployment mode
   - `arbitraryMemoryQuery()` — Random memory search query
   - `arbitraryChronicleContent()` — Random Chronicle entry content
   - `arbitraryChatMessages()` — Random array of chat messages
   - `arbitraryMCPToolInput()` — Random MCP tool input

5. ALL property tests SHALL be included in the main test suite and run on every CI build.

#### Correctness Properties

**Property 19: Property Test Coverage**
*For any* correctness property (Properties 1-18), there SHALL exist at least one property-based test that validates that property.

---

### Requirement 11: Testing - Integration Tests

**User Story:** As a developer, I want integration tests for each deployment mode, so that I can verify end-to-end functionality.

#### Acceptance Criteria

1. THE system SHALL include integration tests for:
   - CLI mode: Test all CLI commands with real file system and memory operations
   - MCP server mode: Test MCP tool invocations with real MCP client
   - Standalone mode: Test agent orchestration with real LangGraph execution

2. THE integration tests SHALL use real components (no mocks) except for:
   - External LLM APIs (mocked to avoid API costs)
   - External services (Qdrant, Redis) can be mocked or use test containers

3. THE integration tests SHALL verify:
   - Successful initialization in each mode
   - Successful execution of core operations
   - Graceful error handling when services unavailable
   - Proper cleanup on shutdown

4. THE integration tests SHALL be tagged with `@integration` and run separately from unit tests.

---

### Requirement 12: Configuration and Environment

**User Story:** As a developer, I want all configuration to be driven by environment variables with sensible defaults, so that I can deploy ANOTS in different environments without code changes.

#### Acceptance Criteria

1. THE system SHALL read configuration from environment variables:
   - `ANOTS_MODE` (default: `'cli'`) — Deployment mode
   - `ANOTS_DATA_DIR` (default: `'./data'`) — Data directory for Chronicle and Codex
   - `ANOTS_MCP_PORT` (default: `3100`) — MCP server port
   - `ANOTS_MCP_AUTH_ENABLED` (default: `false`) — Enable MCP authentication
   - `ANOTS_GATEWAY_ENABLED` (default: `true`) — Enable Gateway routing
   - `OLLAMA_BASE_URL` (default: `'http://localhost:11434'`) — Ollama endpoint
   - `ZAI_API_KEY` (optional) — Z.ai API key for cloud LLM

2. THE system SHALL provide sensible defaults for all configuration options.
3. THE system SHALL validate configuration at startup and throw descriptive errors for invalid values.
4. THE system SHALL log the active configuration at startup (excluding sensitive values like API keys).

---

### Requirement 13: Documentation and Examples

**User Story:** As a new user, I want clear documentation and examples for each deployment mode, so that I can get started quickly.

#### Acceptance Criteria

1. THE system SHALL include documentation covering:
   - `docs/CLI-GUIDE.md` — CLI mode usage and commands
   - `docs/MCP-INTEGRATION.md` — MCP server mode and client examples
   - `docs/STANDALONE-GUIDE.md` — Standalone mode and agent system
   - `docs/ARCHITECTURE.md` — System architecture and design decisions

2. THE system SHALL include example configurations for:
   - Claude Desktop MCP client
   - Cline (VS Code) MCP client
   - Cursor MCP client
   - OpenClaw MCP client
   - Custom Node.js MCP client
   - Custom Python MCP client

3. THE system SHALL include example scripts demonstrating:
   - CLI workflow: search → store → chronicle
   - MCP workflow: external agent using ANOTS tools
   - Standalone workflow: Ubik + Axiom collaboration

4. THE system SHALL provide a CLI command `anots init` that generates example configurations and documentation.

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **CLI Mode Startup Time** | < 100ms | Time from command to first output |
| **MCP Server Startup Time** | < 500ms | Time to start server and register all tools |
| **Memory Operation Latency** | < 200ms | Average time for memory search/store (excluding LLM) |
| **Property Test Coverage** | 100% | All 18 properties have corresponding tests |
| **Integration Test Coverage** | 100% | All 3 deployment modes have integration tests |
| **Layer Failure Isolation** | 100% | Failures in one layer don't affect others |

---

## Non-Functional Requirements

### Performance

- CLI commands SHALL complete in < 1 second (excluding LLM calls)
- MCP tool invocations SHALL add < 50ms overhead vs. direct API calls
- Memory layer operations SHALL be non-blocking and async
- System SHALL support concurrent operations across all layers

### Security

- MCP server SHALL support optional API key authentication
- File system operations SHALL validate paths to prevent directory traversal
- LLM API keys SHALL never be logged or exposed in error messages
- Memory operations SHALL enforce access control based on client identity

### Maintainability

- Each deployment mode SHALL be independently testable
- Core services (Memory, Gateway) SHALL be decoupled from deployment modes
- Configuration SHALL be centralized and validated at startup
- All public APIs SHALL have TypeScript type definitions

---

## Dependencies

- **@modelcontextprotocol/sdk**: Official MCP SDK for TypeScript
- **@langchain/langgraph**: Multi-agent orchestration (standalone mode only)
- **@qdrant/js-client-rest**: Qdrant vector database client
- **redis**: Redis client for Active Stream
- **mem0ai**: Automatic fact extraction
- **zod**: Schema validation
- **fast-check**: Property-based testing
- **commander**: CLI framework
- **inquirer**: Interactive CLI prompts

---

## Open Questions

1. **CLI Interactive Mode**: Should we support a REPL-style interactive mode for all commands, or just chat?
   - **Proposed Answer**: Start with chat-only interactive mode; add REPL for other commands in future iteration.

2. **MCP Authentication**: Should we support OAuth2 in addition to API keys?
   - **Proposed Answer**: Start with API keys; add OAuth2 if users request it.

3. **Standalone Mode UI**: Should standalone mode have a web UI in addition to CLI?
   - **Proposed Answer**: Defer web UI to future iteration; focus on CLI and MCP first.

4. **Memory Layer Fallbacks**: Should we support automatic fallback from Qdrant to file-based vector storage?
   - **Proposed Answer**: Yes, implement graceful degradation for all external services.

