# Requirements Document: ANOTS as MCP Server

## Introduction

The current TCAM system is hardcoded for a triadic architecture with three specific agents: Chip (human orchestrator), Ubik (creative engine), and Axiom (analytical engine). This specification transforms ANOTS into a flexible system that supports three deployment modes:

1. **Standalone Mode** (default): Use the pre-configured Ubik + Axiom triadic system
2. **MCP Server Mode**: Expose ANOTS capabilities (Memory, Gateway, Chronicle) as MCP tools for external agent systems
3. **Hybrid Mode**: Run both standalone agents AND MCP server simultaneously

The goal is to allow users to either use ANOTS as a complete agent system OR integrate its memory/routing capabilities into their existing agent frameworks (Claude Desktop, Cline, Cursor, custom agents) via the Model Context Protocol.

**Key Insight**: Users don't need to build agents in ANOTS - they can use their existing agent systems and simply connect to ANOTS as an MCP server to gain access to the 4-layer memory architecture, intelligent LLM routing, and Chronicle system.

## Glossary

- **Deployment_Mode**: One of `'standalone'`, `'mcp-server'`, or `'hybrid'` — determines how ANOTS operates
- **Standalone_Mode**: ANOTS runs with built-in Ubik + Axiom agents (current behavior)
- **MCP_Server_Mode**: ANOTS exposes its capabilities as MCP tools for external agent systems
- **Hybrid_Mode**: ANOTS runs both standalone agents AND MCP server simultaneously
- **MCP_Tool**: A capability exposed via Model Context Protocol (e.g., `anots/memory/search`, `anots/chronicle/write`)
- **External_Agent**: An agent system outside ANOTS (Claude Desktop, Cline, Cursor, custom frameworks) that connects via MCP
- **ANOTS_MCP_Server**: The MCP server process that exposes ANOTS capabilities
- **Tool_Namespace**: MCP tool naming convention: `anots/<component>/<action>` (e.g., `anots/memory/search`)
- **Memory_Layer_Access**: Permissions defining which memory layers (L1-L4) external agents can access via MCP
- **Gateway_Routing**: Intelligent LLM routing exposed as MCP tool for external agents

---

## Requirements

### Requirement 1: Deployment Mode Selection

**User Story:** As a user, I want to choose how to deploy ANOTS (standalone, MCP server, or hybrid), so that I can either use the built-in agents or integrate ANOTS into my existing agent system.

#### Acceptance Criteria

1. THE system SHALL support three deployment modes: `'standalone'`, `'mcp-server'`, and `'hybrid'`, configured via environment variable `ANOTS_DEPLOYMENT_MODE` (default: `'standalone'`).
2. WHEN `ANOTS_DEPLOYMENT_MODE='standalone'`, THE system SHALL load Ubik and Axiom agents and run the triadic orchestration (current behavior).
3. WHEN `ANOTS_DEPLOYMENT_MODE='mcp-server'`, THE system SHALL start the MCP server and expose ANOTS capabilities as MCP tools WITHOUT loading any internal agents.
4. WHEN `ANOTS_DEPLOYMENT_MODE='hybrid'`, THE system SHALL run both standalone agents AND the MCP server simultaneously.
5. THE system SHALL validate the selected mode at initialization and throw a descriptive error if the mode is invalid.
6. THE system SHALL log the selected deployment mode and MCP server status at startup.

---

### Requirement 2: MCP Server Implementation

**User Story:** As an external agent system, I want to connect to ANOTS via MCP protocol, so that I can use its memory, routing, and chronicle capabilities.

#### Acceptance Criteria

1. THE system SHALL implement an MCP server using the `@modelcontextprotocol/sdk` package.
2. THE MCP server SHALL listen on a configurable port (environment variable `ANOTS_MCP_PORT`, default: `3100`).
3. THE MCP server SHALL support stdio transport for local connections (Claude Desktop, Cline, Cursor).
4. THE MCP server SHALL support HTTP/SSE transport for remote connections (optional, configurable via `ANOTS_MCP_HTTP_ENABLED`).
5. THE MCP server SHALL expose a health check endpoint at `/health`.
6. THE MCP server SHALL log all incoming MCP requests with tool name, arguments, and client identifier.

---

### Requirement 3: MCP Tool Namespace

**User Story:** As a developer, I want all ANOTS MCP tools to follow a consistent naming convention, so that they are easily discoverable and don't conflict with other MCP servers.

#### Acceptance Criteria

1. ALL MCP tools SHALL use the namespace prefix `anots/`.
2. THE tool naming convention SHALL be: `anots/<component>/<action>` (e.g., `anots/memory/search`, `anots/chronicle/write`).
3. THE system SHALL group tools by component:
   - `anots/memory/*` — Memory Service operations (L2, L3)
   - `anots/chronicle/*` — Chronicle operations (L1)
   - `anots/codex/*` — Agent Codex operations (L4)
   - `anots/gateway/*` — Gateway routing operations
   - `anots/system/*` — System operations (health, status)

4. EACH tool SHALL have a clear description following the format: "ANOTS: <action> <component> - <details>".
5. THE system SHALL expose a tool `anots/system/list-tools` that returns all available MCP tools with descriptions.

---

### Requirement 4: Memory Service MCP Tools

**User Story:** As an external agent, I want to access ANOTS memory layers via MCP, so that I can store and retrieve information across sessions.

#### Acceptance Criteria

1. THE system SHALL expose the following memory MCP tools:
   - `anots/memory/search` — Search Hive Mind (L3) semantic memory
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

4. ALL memory tools SHALL enforce access control based on the external agent's identity (passed via MCP client metadata).
5. THE system SHALL log all memory operations with agent ID, operation type, and timestamp.

---

### Requirement 5: Chronicle MCP Tools

**User Story:** As an external agent, I want to write and read Chronicle entries via MCP, so that I can maintain an immutable historical record.

#### Acceptance Criteria

1. THE system SHALL expose the following Chronicle MCP tools:
   - `anots/chronicle/write` — Write new Chronicle entry
   - `anots/chronicle/read` — Read Chronicle entry by ID
   - `anots/chronicle/list` — List Chronicle entries with filters
   - `anots/chronicle/search` — Search Chronicle by content

2. THE `anots/chronicle/write` tool SHALL accept parameters:
   - `content` (string, required) — Entry content (markdown)
   - `participants` (array of strings, required) — Participant IDs
   - `sessionType` (string, optional) — Session type
   - `metadata` (object, optional) — Additional frontmatter

3. THE `anots/chronicle/read` tool SHALL accept parameters:
   - `chapterId` (string, required) — Chapter ID to read

4. THE `anots/chronicle/list` tool SHALL accept parameters:
   - `startDate` (string, optional) — Filter by start date
   - `endDate` (string, optional) — Filter by end date
   - `participant` (string, optional) — Filter by participant
   - `limit` (number, optional, default: 10) — Max results

5. ALL Chronicle tools SHALL return entries in a structured format with frontmatter and content separated.

---

### Requirement 6: Gateway Routing MCP Tools

**User Story:** As an external agent, I want to use ANOTS Gateway for intelligent LLM routing, so that I can benefit from entropy-based routing and quota management.

#### Acceptance Criteria

1. THE system SHALL expose the following Gateway MCP tools:
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

5. THE Gateway tools SHALL enforce the same routing logic as internal agents (entropy-based, quota-aware, fallback chain).

---

### Requirement 7: Agent Codex MCP Tools

**User Story:** As an external agent, I want to maintain my own Agent Codex via MCP, so that I can store personal knowledge and tasks.

#### Acceptance Criteria

1. THE system SHALL expose the following Codex MCP tools:
   - `anots/codex/read` — Read file from agent's codex
   - `anots/codex/write` — Write file to agent's codex
   - `anots/codex/list` — List files in agent's codex
   - `anots/codex/init` — Initialize codex for new agent

2. THE `anots/codex/read` tool SHALL accept parameters:
   - `agentId` (string, required) — Agent identifier
   - `filePath` (string, required) — Relative path within codex (e.g., `README.md`, `TASKS.md`)

3. THE `anots/codex/write` tool SHALL accept parameters:
   - `agentId` (string, required) — Agent identifier
   - `filePath` (string, required) — Relative path within codex
   - `content` (string, required) — File content (markdown)

4. THE `anots/codex/init` tool SHALL create the standard codex structure for a new agent:
   - `codex/<agentId>/README.md` — Agent identity
   - `codex/<agentId>/TASKS.md` — Active tasks
   - `codex/<agentId>/MEMORY.md` — Personal notes
   - `codex/<agentId>/TOOLS.md` — Tool registry

5. ALL Codex tools SHALL enforce agent isolation (agents can only access their own codex).

---

### Requirement 8: MCP Client Authentication

**User Story:** As a system administrator, I want to control which external agents can access ANOTS via MCP, so that I can enforce security boundaries.

#### Acceptance Criteria

1. THE MCP server SHALL support optional authentication via API keys (environment variable `ANOTS_MCP_AUTH_ENABLED`, default: `false`).
2. WHEN authentication is enabled, THE MCP server SHALL require an `Authorization` header with format `Bearer <api_key>`.
3. THE system SHALL validate API keys against a configurable list (environment variable `ANOTS_MCP_API_KEYS`, comma-separated).
4. WHEN an invalid or missing API key is provided, THE MCP server SHALL reject the request with a 401 Unauthorized error.
5. THE system SHALL log all authentication attempts (success and failure) with client IP and timestamp.
6. WHEN authentication is disabled, THE MCP server SHALL accept all connections (suitable for local-only deployments).

---

### Requirement 9: MCP Tool Discovery

**User Story:** As an external agent system, I want to discover available ANOTS MCP tools dynamically, so that I can adapt to new capabilities without code changes.

#### Acceptance Criteria

1. THE MCP server SHALL implement the standard MCP `tools/list` method.
2. THE `tools/list` response SHALL include all available ANOTS tools with:
   - Tool name (e.g., `anots/memory/search`)
   - Description
   - Input schema (JSON Schema format)
   - Output schema (optional)

3. THE system SHALL support tool filtering by component (e.g., list only `anots/memory/*` tools).
4. THE system SHALL update the tool list dynamically when new tools are registered (for future autopoiesis support).
5. THE MCP server SHALL cache the tool list and regenerate only when tools change.

---

### Requirement 10: Standalone Mode Compatibility

**User Story:** As an existing TCAM user, I want standalone mode to work exactly as before, so that I don't have to change my workflow.

#### Acceptance Criteria

1. WHEN `ANOTS_DEPLOYMENT_MODE='standalone'` (default), THE system SHALL behave identically to the current implementation.
2. THE Ubik and Axiom agents SHALL load and initialize as before.
3. THE triadic orchestration workflow SHALL remain unchanged.
4. ALL existing tests SHALL pass without modification in standalone mode.
5. THE MCP server SHALL NOT start in standalone mode (unless hybrid mode is enabled).

---

### Requirement 11: Hybrid Mode

**User Story:** As a power user, I want to run both standalone agents and MCP server simultaneously, so that I can use ANOTS internally while also exposing it to external systems.

#### Acceptance Criteria

1. WHEN `ANOTS_DEPLOYMENT_MODE='hybrid'`, THE system SHALL start both standalone agents AND the MCP server.
2. THE standalone agents SHALL have priority access to system resources (Memory Service, Gateway).
3. THE MCP server SHALL share the same Memory Service and Gateway instances as standalone agents.
4. THE system SHALL log both standalone agent activity and MCP requests.
5. THE system SHALL expose a status endpoint showing both standalone and MCP server health.

---

### Requirement 12: MCP Configuration

**User Story:** As a developer, I want all MCP server configuration to be driven by environment variables, so that I can deploy ANOTS in different environments without code changes.

#### Acceptance Criteria

1. THE system SHALL read MCP configuration from environment variables:
   - `ANOTS_DEPLOYMENT_MODE` (default: `'standalone'`)
   - `ANOTS_MCP_PORT` (default: `3100`)
   - `ANOTS_MCP_HTTP_ENABLED` (default: `false`)
   - `ANOTS_MCP_AUTH_ENABLED` (default: `false`)
   - `ANOTS_MCP_API_KEYS` (comma-separated, no default)
   - `ANOTS_MCP_LOG_LEVEL` (default: `'info'`)

2. THE system SHALL provide sensible defaults for all configuration options.
3. THE system SHALL validate configuration at startup and throw descriptive errors for invalid values.
4. THE system SHALL log the active MCP configuration at startup (excluding sensitive values like API keys).

---

### Requirement 13: MCP Client Examples

**User Story:** As a user, I want example MCP client configurations for popular tools, so that I can quickly connect to ANOTS.

#### Acceptance Criteria

1. THE system SHALL include example MCP client configurations for:
   - Claude Desktop (`claude_desktop_config.json`)
   - Cline (VS Code extension settings)
   - Cursor (`.cursor/mcp.json`)
   - OpenClaw (MCP client configuration)
   - Custom Node.js client (TypeScript example)
   - Custom Python client (Python example)

2. EACH example SHALL include:
   - Connection configuration (stdio or HTTP)
   - Authentication setup (if enabled)
   - Example tool invocations

3. THE examples SHALL be documented in `docs/MCP-INTEGRATION.md`.
4. THE system SHALL provide a CLI command `anots mcp config` that generates client configurations interactively.
5. THE system SHALL test compatibility with all listed MCP clients during integration testing.

---

### Requirement 14: Memory Layer Independence

**User Story:** As a system architect, I want to ensure that the 4-layer memory architecture remains independent when exposed via MCP, so that failures in one layer don't cascade to others.

#### Acceptance Criteria

1. THE MCP server SHALL maintain the independence of all four memory layers:
   - L1 (Chronicle): File system, zero external dependencies
   - L2 (Active Stream): Redis, isolated state
   - L3 (Hive Mind): Qdrant + Mem0, semantic memory
   - L4 (Agent Codex): File system, per-agent isolation

2. WHEN an MCP tool fails to access one memory layer, THE system SHALL NOT block access to other layers.
3. THE MCP server SHALL expose layer-specific health checks via `anots/system/health` showing each layer's status independently.
4. THE system SHALL log layer-specific errors without affecting other layers' operations.
5. WHEN a memory layer is unavailable, THE corresponding MCP tools SHALL return graceful error responses indicating which layer is affected.
6. THE MCP server SHALL NOT introduce any cross-layer dependencies that don't exist in the standalone mode.

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Standalone Mode Compatibility** | 100% | All existing tests pass in standalone mode |
| **MCP Server Startup Time** | < 500ms | Time to start MCP server and register all tools |
| **MCP Tool Response Time** | < 200ms | Average response time for MCP tool invocations (excluding LLM calls) |
| **External Agent Adoption** | > 50% | Percentage of users connecting external agents via MCP within 30 days |
| **MCP Client Compatibility** | 100% | Works with Claude Desktop, Cline, Cursor out of the box |

---

## Non-Functional Requirements

### Performance

- Agent definition loading SHALL complete in < 100ms for up to 10 agents
- Memory access control checks SHALL add < 1ms overhead per operation
- MCP tool permission checks SHALL add < 1ms overhead per tool invocation

### Security

- Agent definitions SHALL be validated against the schema to prevent code injection
- File paths in agent definitions SHALL be sanitized to prevent directory traversal
- MCP tool permissions SHALL be enforced at the Gateway layer (defense in depth)

### Maintainability

- The agent system SHALL be decoupled from the Memory Service and Gateway via interfaces
- Preset agent definitions SHALL be version-controlled and immutable
- Custom agent definitions SHALL be stored outside the codebase (user-managed)

---

## Open Questions

1. **Agent Orchestration Strategy**: Should multi-agent mode use a fixed orchestration pattern (e.g., round-robin, supervisor) or allow users to define custom workflows?
   - **Proposed Answer**: Start with a simple round-robin pattern; add custom workflows in a future iteration.

2. **Agent Identity in Memory**: Should each agent have its own Agent Codex (L4) subdirectory, or share a common codex?
   - **Proposed Answer**: Each agent gets its own codex subdirectory (e.g., `codex/ubik/`, `codex/custom-agent-1/`).

3. **Model Override**: Should users be able to override model preferences per-request, or are agent-level preferences final?
   - **Proposed Answer**: Agent-level preferences are defaults; Gateway can override based on task classification.

4. **Agent Lifecycle Hooks**: Should agents support lifecycle hooks (e.g., `onStart`, `onStop`, `onMessage`)?
   - **Proposed Answer**: Defer to future iteration; start with static configuration only.

---

## Dependencies

- **Zod**: Schema validation for agent definitions
- **js-yaml**: YAML parsing for agent definition files
- **Existing Memory Service**: No changes required, add access control layer
- **Existing Gateway**: No changes required, add tool permission layer
- **LangGraph**: Already used for orchestration, extend to support dynamic agent nodes

---

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
- Define `AgentDefinition` schema and Zod validator
- Implement `AgentRegistry` singleton
- Add `ANOTS_AGENT_MODE` environment variable support
- Create preset agent definitions (Ubik, Axiom)

### Phase 2: Access Control (Week 2)
- Implement memory layer access control in Memory Service
- Implement MCP tool permission enforcement in Gateway
- Add access control violation logging

### Phase 3: Custom Agent Support (Week 3)
- Implement custom agent directory scanning
- Add single-agent mode logic
- Add multi-agent mode logic with LangGraph integration
- Implement agent-to-agent messaging

### Phase 4: CLI Tools (Week 4)
- Build `anots agent create` interactive builder
- Build `anots agent list` command
- Build `anots agent validate` command
- Build `anots agent reload` command (optional)

### Phase 5: Documentation and Testing (Week 5)
- Write `docs/AGENT-SYSTEM.md` guide
- Create example agent definitions
- Write unit tests for all components
- Write integration tests for preset and custom modes
- Write migration guide

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking changes to existing Ubik+Axiom workflow | High | Maintain 100% backward compatibility via preset mode |
| Complex multi-agent orchestration bugs | Medium | Start with simple round-robin; defer complex workflows |
| User confusion about mode selection | Medium | Clear documentation, sensible defaults (preset mode) |
| Performance overhead from access control | Low | Optimize permission checks, cache results |

