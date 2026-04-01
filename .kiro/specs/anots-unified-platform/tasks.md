# Tasks Document: ANOTS Unified Platform

## Overview

This document breaks down the implementation of ANOTS Unified Platform into concrete, testable tasks organized in progressive phases. The implementation follows a bottom-up approach: Core Services → CLI Mode → MCP Server Mode → Standalone Mode.

**Implementation Strategy**: Build and test each deployment mode incrementally, ensuring each mode works before moving to the next.

---

## Phase 1: Core Infrastructure (Week 1)

### Task 1.1: Project Setup and Configuration

**Description:** Set up TypeScript project structure with all necessary tooling.

**Files to Create/Modify:**
- `tsconfig.json` (modify)
- `package.json` (modify)
- `src/core/types.ts` (new)
- `src/core/config.ts` (new)

**Acceptance Criteria:**
- [x] TypeScript configured with strict mode
- [x] ESLint and Prettier configured
- [x] Jest configured with ts-jest
- [x] fast-check installed for property-based testing
- [x] Environment variable loading with dotenv
- [x] Core types defined (DeploymentMode, SearchResult, ChronicleEntry, AgentDefinition)
- [x] Config loader reads from environment variables with defaults

**Estimated Effort:** 2 hours

**Dependencies:** None

**Requirements:** 12.1, 12.2, 12.3, 12.4

---

### Task 1.2: Deployment Manager Implementation

**Description:** Create the DeploymentManager class that handles mode selection and component initialization.

**Files to Create/Modify:**
- `src/core/DeploymentManager.ts` (new)
- `tests/core/DeploymentManager.test.ts` (new)

**Acceptance Criteria:**
- [x] DeploymentManager class with initialize() method
- [x] Mode validation (cli, mcp-server, standalone)
- [x] Service registry (Map<string, Service>)
- [x] Mode-specific initialization methods
- [x] Graceful error handling for invalid modes
- [x] Unit tests for all three modes
- [x] Property test for Property 1 (Mode Validation)
- [x] Property test for Property 2 (Mode Determinism)

**Estimated Effort:** 4 hours

**Dependencies:** Task 1.1

**Requirements:** 1.1, 1.2, 1.3, 1.4, 1.5, 1.6

---

## Phase 2: Memory System Core (Week 1-2)

### Task 2.1: Chronicle Service (L1)

**Description:** Implement Chronicle service with file-based storage and Git versioning.

**Files to Create/Modify:**
- `src/memory/ChronicleService.ts` (new)
- `src/memory/chronicle/parser.ts` (reuse from memory-system spec)
- `src/memory/chronicle/serializer.ts` (reuse from memory-system spec)
- `src/memory/chronicle/writer.ts` (reuse from memory-system spec)
- `tests/memory/ChronicleService.test.ts` (new)

**Acceptance Criteria:**
- [x] ChronicleService class with write(), read(), list(), search() methods
- [x] Append-only file writes (no overwrites)
- [x] YAML frontmatter parsing
- [x] Git auto-commit on write
- [x] Directory structure: data/chronicle/{participant}/{type}/
- [x] Unit tests for all methods
- [x] Property test for Property 5 (Chronicle Immutability)
- [x] Property test for Property 6 (Chronicle Write-Read Round-Trip)

**Estimated Effort:** 6 hours

**Dependencies:** Task 1.1

**Requirements:** 3.1, 3.2, 3.3, 3.4, 3.5, 9.1

---

### Task 2.2: Active Stream Service (L2)

**Description:** Implement Active Stream service with Redis backend and file-based fallback.

**Files to Create/Modify:**
- `src/memory/ActiveStreamService.ts` (new)
- `tests/memory/ActiveStreamService.test.ts` (new)

**Acceptance Criteria:**
- [x] ActiveStreamService class with getContext(), updateContext(), clear() methods
- [x] Redis client integration (optional, graceful degradation)
- [x] File-based fallback when Redis unavailable
- [x] Context serialization/deserialization
- [x] Health check method
- [x] Unit tests with Redis mocked
- [x] Integration test with real Redis (optional)
- [x] Property test for Property 8 (Interactive Context Preservation)

**Estimated Effort:** 4 hours

**Dependencies:** Task 1.1

**Requirements:** 2.3, 9.1, 9.2

---

### Task 2.3: Hive Mind Service (L3)

**Description:** Implement Hive Mind service with Qdrant and Mem0 integration.

**Files to Create/Modify:**
- `src/memory/HiveMindService.ts` (new)
- `tests/memory/HiveMindService.test.ts` (new)

**Acceptance Criteria:**
- [x] HiveMindService class with search(), store() methods
- [x] Qdrant client integration (optional, graceful degradation)
- [x] Mem0 client integration for fact extraction
- [x] File-based vector storage fallback
- [x] Embedding generation (local or API)
- [x] Health check method
- [x] Unit tests with Qdrant mocked
- [x] Property test for Property 3 (Memory Search Idempotence)
- [x] Property test for Property 4 (Memory Store-Retrieve Round-Trip)

**Estimated Effort:** 6 hours

**Dependencies:** Task 1.1

**Requirements:** 2.1, 2.2, 6.1, 6.2, 6.3, 9.1, 9.2

---

### Task 2.4: Agent Codex Service (L4)

**Description:** Implement Agent Codex service with per-agent file-based storage.

**Files to Create/Modify:**
- `src/memory/CodexService.ts` (new)
- `tests/memory/CodexService.test.ts` (new)

**Acceptance Criteria:**
- [x] CodexService class with read(), write(), list(), init() methods
- [x] Per-agent directory structure: data/codex/{agentId}/
- [x] Standard files: README.md, TASKS.md, MEMORY.md, TOOLS.md
- [x] Agent isolation (agents can only access their own codex)
- [x] Health check method
- [x] Unit tests for all methods
- [x] Property test for agent isolation

**Estimated Effort:** 3 hours

**Dependencies:** Task 1.1

**Requirements:** 9.1, 9.4

---

### Task 2.5: Unified Memory Service

**Description:** Create unified MemoryService that orchestrates all 4 layers with graceful degradation.

**Files to Create/Modify:**
- `src/memory/MemoryService.ts` (new)
- `tests/memory/MemoryService.test.ts` (new)

**Acceptance Criteria:**
- [x] MemoryService class with search(), store(), getContext(), clearContext() methods
- [x] Automatic fallback chain: Hive Mind → Chronicle for search
- [x] Automatic fallback chain: Hive Mind → Chronicle for store
- [x] Layer health aggregation
- [x] Graceful error handling for each layer
- [x] Unit tests for all methods
- [x] Integration test with all layers
- [x] Property test for Property 17 (Layer Failure Isolation)
- [x] Property test for Property 18 (Layer Independence)

**Estimated Effort:** 4 hours

**Dependencies:** Tasks 2.1, 2.2, 2.3, 2.4

**Requirements:** 9.1, 9.2, 9.3, 9.4, 9.5

---

## Phase 3: CLI Mode (Week 2)

### Task 3.1: CLI Framework Setup

**Description:** Set up CLI framework with commander.js and implement base command structure.

**Files to Create/Modify:**
- `src/cli/index.ts` (new)
- `src/cli/CLIInterface.ts` (new)
- `package.json` (modify - add bin entry)

**Acceptance Criteria:**
- [ ] commander.js configured
- [ ] CLI entry point: `anots <command> <action> [args]`
- [ ] Help text for all commands
- [ ] Version command
- [ ] Error handling with helpful messages
- [ ] Colorized output (chalk or similar)

**Estimated Effort:** 2 hours

**Dependencies:** Task 2.5

**Requirements:** 2.1, 2.2, 2.3, 2.4, 2.5

---

### Task 3.2: CLI Memory Commands

**Description:** Implement CLI commands for memory operations.

**Files to Create/Modify:**
- `src/cli/commands/memory.ts` (new)
- `tests/cli/memory.test.ts` (new)

**Acceptance Criteria:**
- [ ] `anots memory search <query>` command
- [ ] `anots memory store <content>` command
- [ ] `anots memory context` command
- [ ] `anots memory clear` command
- [ ] Table formatting for search results
- [ ] JSON output option (--format json)
- [ ] Limit option (--limit <n>)
- [ ] Unit tests for all commands
- [ ] Integration test with real MemoryService
- [ ] Property test for Property 11 (MCP Memory Tool Equivalence)

**Estimated Effort:** 4 hours

**Dependencies:** Task 3.1

**Requirements:** 2.1, 2.2, 2.3, 2.4, 2.5

---

### Task 3.3: CLI Chronicle Commands

**Description:** Implement CLI commands for Chronicle operations.

**Files to Create/Modify:**
- `src/cli/commands/chronicle.ts` (new)
- `tests/cli/chronicle.test.ts` (new)

**Acceptance Criteria:**
- [ ] `anots chronicle write <content>` command
- [ ] `anots chronicle read <id>` command
- [ ] `anots chronicle list` command
- [ ] `anots chronicle search <query>` command
- [ ] Participants option (--participants <list>)
- [ ] Session type option (--type <type>)
- [ ] Date filtering (--from, --to)
- [ ] Markdown and JSON output formats
- [ ] Unit tests for all commands
- [ ] Integration test with real ChronicleService

**Estimated Effort:** 4 hours

**Dependencies:** Task 3.1

**Requirements:** 3.1, 3.2, 3.3, 3.4, 3.5

---

### Task 3.4: CLI Chat Commands

**Description:** Implement CLI commands for LLM chat.

**Files to Create/Modify:**
- `src/cli/commands/chat.ts` (new)
- `src/llm/OllamaClient.ts` (reuse from memory-system spec)
- `tests/cli/chat.test.ts` (new)

**Acceptance Criteria:**
- [ ] `anots chat <message>` command
- [ ] Interactive mode (--interactive)
- [ ] Model selection (--model <name>)
- [ ] Temperature option (--temperature <n>)
- [ ] Streaming output (--stream)
- [ ] Fallback to Ollama when Gateway unavailable
- [ ] Context preservation in interactive mode
- [ ] Unit tests for all commands
- [ ] Property test for Property 7 (Chat Response Non-Empty)
- [ ] Property test for Property 8 (Interactive Context Preservation)

**Estimated Effort:** 5 hours

**Dependencies:** Task 3.1

**Requirements:** 4.1, 4.2, 4.3, 4.4, 4.5

---

### Task 3.5: CLI Mode Integration Testing

**Description:** End-to-end integration tests for CLI mode.

**Files to Create/Modify:**
- `tests/integration/cli-mode.test.ts` (new)

**Acceptance Criteria:**
- [ ] Test full workflow: store → search → chronicle
- [ ] Test graceful degradation (services unavailable)
- [ ] Test error handling and user-friendly messages
- [ ] Test all output formats (table, JSON, markdown)
- [ ] Test interactive chat session
- [ ] All tests pass with real file system

**Estimated Effort:** 3 hours

**Dependencies:** Tasks 3.2, 3.3, 3.4

**Requirements:** 11.1, 11.2, 11.3

---

## Phase 4: MCP Server Mode (Week 3)

### Task 4.1: MCP Server Setup

**Description:** Set up MCP server with @modelcontextprotocol/sdk.

**Files to Create/Modify:**
- `src/mcp/MCPServer.ts` (new)
- `src/mcp/types.ts` (new)
- `tests/mcp/MCPServer.test.ts` (new)

**Acceptance Criteria:**
- [ ] MCPServer class with start(), stop() methods
- [ ] Stdio transport for local connections
- [ ] HTTP/SSE transport (optional)
- [ ] Tool registration system
- [ ] tools/list handler
- [ ] tools/call handler
- [ ] Error handling with structured responses
- [ ] Unit tests for server lifecycle

**Estimated Effort:** 4 hours

**Dependencies:** Task 2.5

**Requirements:** 5.1, 5.2, 5.3, 5.4, 5.5

---

### Task 4.2: MCP Memory Tools

**Description:** Implement MCP tools for memory operations.

**Files to Create/Modify:**
- `src/mcp/tools/memory.ts` (new)
- `tests/mcp/tools/memory.test.ts` (new)

**Acceptance Criteria:**
- [ ] anots/memory/search tool
- [ ] anots/memory/store tool
- [ ] anots/memory/get-context tool
- [ ] anots/memory/update-context tool
- [ ] JSON Schema for all tool inputs
- [ ] Structured responses (success/error)
- [ ] Client ID logging
- [ ] Unit tests for all tools
- [ ] Property test for Property 11 (MCP Memory Tool Equivalence)
- [ ] Property test for Property 12 (MCP Tool Error Handling)

**Estimated Effort:** 4 hours

**Dependencies:** Task 4.1

**Requirements:** 6.1, 6.2, 6.3, 6.4, 6.5

---

### Task 4.3: MCP Chronicle Tools

**Description:** Implement MCP tools for Chronicle operations.

**Files to Create/Modify:**
- `src/mcp/tools/chronicle.ts` (new)
- `tests/mcp/tools/chronicle.test.ts` (new)

**Acceptance Criteria:**
- [ ] anots/chronicle/write tool
- [ ] anots/chronicle/read tool
- [ ] anots/chronicle/list tool
- [ ] anots/chronicle/search tool
- [ ] JSON Schema for all tool inputs
- [ ] Structured responses
- [ ] Unit tests for all tools

**Estimated Effort:** 3 hours

**Dependencies:** Task 4.1

**Requirements:** 5.2

---

### Task 4.4: MCP Gateway Tools

**Description:** Implement MCP tools for Gateway operations (requires Gateway from anots-gateway spec).

**Files to Create/Modify:**
- `src/mcp/tools/gateway.ts` (new)
- `tests/mcp/tools/gateway.test.ts` (new)

**Acceptance Criteria:**
- [ ] anots/gateway/chat tool
- [ ] anots/gateway/classify tool
- [ ] anots/gateway/status tool
- [ ] JSON Schema for all tool inputs
- [ ] Entropy-based routing
- [ ] Quota management integration
- [ ] Unit tests for all tools
- [ ] Property test for Property 13 (Gateway Routing Determinism)
- [ ] Property test for Property 14 (Gateway Chat Response Validity)

**Estimated Effort:** 4 hours

**Dependencies:** Task 4.1, anots-gateway spec implementation

**Requirements:** 7.1, 7.2, 7.3, 7.4, 7.5

---

### Task 4.5: MCP Codex Tools

**Description:** Implement MCP tools for Agent Codex operations.

**Files to Create/Modify:**
- `src/mcp/tools/codex.ts` (new)
- `tests/mcp/tools/codex.test.ts` (new)

**Acceptance Criteria:**
- [ ] anots/codex/read tool
- [ ] anots/codex/write tool
- [ ] anots/codex/list tool
- [ ] anots/codex/init tool
- [ ] Agent isolation enforcement
- [ ] JSON Schema for all tool inputs
- [ ] Unit tests for all tools

**Estimated Effort:** 3 hours

**Dependencies:** Task 4.1

**Requirements:** 5.2

---

### Task 4.6: MCP System Tools

**Description:** Implement MCP tools for system operations.

**Files to Create/Modify:**
- `src/mcp/tools/system.ts` (new)
- `tests/mcp/tools/system.test.ts` (new)

**Acceptance Criteria:**
- [ ] anots/system/list-tools tool
- [ ] anots/system/health tool
- [ ] Dynamic tool list generation
- [ ] Layer-specific health checks
- [ ] Unit tests for all tools
- [ ] Property test for Property 9 (Tool List Completeness)
- [ ] Property test for Property 10 (Tool Schema Validity)

**Estimated Effort:** 2 hours

**Dependencies:** Task 4.1

**Requirements:** 5.2, 5.3, 5.4, 5.5, 9.3

---

### Task 4.7: MCP Authentication

**Description:** Implement optional API key authentication for MCP server.

**Files to Create/Modify:**
- `src/mcp/auth/MCPAuthMiddleware.ts` (new)
- `tests/mcp/auth/MCPAuthMiddleware.test.ts` (new)

**Acceptance Criteria:**
- [ ] MCPAuthMiddleware class
- [ ] Bearer token validation
- [ ] API key configuration from env vars
- [ ] 401 Unauthorized responses
- [ ] Authentication logging
- [ ] Unit tests for auth flow
- [ ] Integration test with authenticated client

**Estimated Effort:** 2 hours

**Dependencies:** Task 4.1

**Requirements:** 12.1

---

### Task 4.8: MCP Client Examples

**Description:** Create example MCP client configurations for popular tools.

**Files to Create/Modify:**
- `examples/mcp/claude-desktop.json` (new)
- `examples/mcp/cline-config.json` (new)
- `examples/mcp/cursor-config.json` (new)
- `examples/mcp/openclaw-config.json` (new)
- `examples/mcp/nodejs-client.ts` (new)
- `examples/mcp/python-client.py` (new)
- `docs/MCP-INTEGRATION.md` (new)

**Acceptance Criteria:**
- [ ] Claude Desktop config with stdio transport
- [ ] Cline config for VS Code
- [ ] Cursor config
- [ ] OpenClaw config
- [ ] Node.js client example with all tools
- [ ] Python client example with all tools
- [ ] Documentation with setup instructions
- [ ] Example tool invocations for each client

**Estimated Effort:** 4 hours

**Dependencies:** Tasks 4.2, 4.3, 4.4, 4.5, 4.6

**Requirements:** 13.1, 13.2, 13.3

---

### Task 4.9: MCP Mode Integration Testing

**Description:** End-to-end integration tests for MCP server mode.

**Files to Create/Modify:**
- `tests/integration/mcp-server.test.ts` (new)

**Acceptance Criteria:**
- [ ] Test MCP server startup and tool registration
- [ ] Test all memory tools via MCP client
- [ ] Test all chronicle tools via MCP client
- [ ] Test gateway tools via MCP client
- [ ] Test authentication (enabled and disabled)
- [ ] Test error handling and structured responses
- [ ] Test with real MCP client (stdio transport)

**Estimated Effort:** 4 hours

**Dependencies:** Tasks 4.2, 4.3, 4.4, 4.5, 4.6, 4.7

**Requirements:** 11.1, 11.2, 11.3

---

## Phase 5: Standalone Mode (Week 4)

### Task 5.1: Agent Definition Schema

**Description:** Define agent definition schema and validation.

**Files to Create/Modify:**
- `src/agents/types.ts` (new)
- `src/agents/presets/ubik.yaml` (new)
- `src/agents/presets/axiom.yaml` (new)
- `tests/agents/schema.test.ts` (new)

**Acceptance Criteria:**
- [ ] AgentDefinition interface
- [ ] Zod schema for validation
- [ ] Ubik preset definition
- [ ] Axiom preset definition
- [ ] Unit tests for schema validation
- [ ] Property test for Property 15 (Agent Definition Validity)
- [ ] Property test for Property 16 (Agent Initialization Idempotence)

**Estimated Effort:** 3 hours

**Dependencies:** Task 1.1

**Requirements:** 8.1, 8.2, 8.3, 8.4

---

### Task 5.2: Agent Class Implementation

**Description:** Implement Agent class that executes agent logic.

**Files to Create/Modify:**
- `src/agents/Agent.ts` (new)
- `tests/agents/Agent.test.ts` (new)

**Acceptance Criteria:**
- [ ] Agent class with execute() method
- [ ] Model preference handling (high/low entropy)
- [ ] Memory access enforcement
- [ ] System prompt integration
- [ ] Gateway integration for LLM calls
- [ ] Unit tests for agent execution

**Estimated Effort:** 4 hours

**Dependencies:** Task 5.1, anots-gateway spec implementation

**Requirements:** 8.2, 8.3

---

### Task 5.3: Agent System Orchestration

**Description:** Implement AgentSystem class with LangGraph orchestration.

**Files to Create/Modify:**
- `src/agents/AgentSystem.ts` (new)
- `tests/agents/AgentSystem.test.ts` (new)

**Acceptance Criteria:**
- [ ] AgentSystem class with loadAgents() method
- [ ] Agent definition loading from YAML
- [ ] LangGraph state machine initialization
- [ ] Round-robin agent edges
- [ ] processMessage() method for user input
- [ ] Agent initialization logging
- [ ] Unit tests for orchestration
- [ ] Integration test with Ubik and Axiom

**Estimated Effort:** 6 hours

**Dependencies:** Task 5.2, langgraph-orchestration spec

**Requirements:** 8.1, 8.4, 8.5

---

### Task 5.4: Standalone Mode Integration

**Description:** Integrate standalone mode into DeploymentManager.

**Files to Create/Modify:**
- `src/core/DeploymentManager.ts` (modify)
- `tests/core/DeploymentManager.test.ts` (modify)

**Acceptance Criteria:**
- [ ] initializeStandalone() method
- [ ] Gateway initialization
- [ ] AgentSystem initialization
- [ ] Agent loading (ubik, axiom)
- [ ] Integration test for standalone mode startup

**Estimated Effort:** 2 hours

**Dependencies:** Task 5.3

**Requirements:** 1.4, 8.1

---

### Task 5.5: Standalone Mode Integration Testing

**Description:** End-to-end integration tests for standalone mode.

**Files to Create/Modify:**
- `tests/integration/standalone-mode.test.ts` (new)

**Acceptance Criteria:**
- [ ] Test standalone mode initialization
- [ ] Test Ubik and Axiom agent loading
- [ ] Test LangGraph orchestration
- [ ] Test agent-to-agent communication
- [ ] Test memory access from agents
- [ ] Test Gateway routing from agents
- [ ] All tests pass with real components

**Estimated Effort:** 4 hours

**Dependencies:** Task 5.4

**Requirements:** 11.1, 11.2, 11.3

---

## Phase 6: Documentation and Polish (Week 5)

### Task 6.1: CLI Guide Documentation

**Description:** Write comprehensive CLI usage guide.

**Files to Create/Modify:**
- `docs/CLI-GUIDE.md` (new)

**Acceptance Criteria:**
- [ ] Installation instructions
- [ ] All CLI commands documented with examples
- [ ] Common workflows (search → store → chronicle)
- [ ] Troubleshooting section
- [ ] Configuration options

**Estimated Effort:** 3 hours

**Dependencies:** Phase 3 complete

**Requirements:** 13.1, 13.3

---

### Task 6.2: MCP Integration Documentation

**Description:** Write MCP server integration guide.

**Files to Create/Modify:**
- `docs/MCP-INTEGRATION.md` (modify/expand)

**Acceptance Criteria:**
- [ ] MCP server setup instructions
- [ ] Client configuration for all supported tools
- [ ] Tool reference (all 15+ tools)
- [ ] Authentication setup
- [ ] Troubleshooting section
- [ ] Example workflows

**Estimated Effort:** 4 hours

**Dependencies:** Phase 4 complete

**Requirements:** 13.1, 13.2, 13.3

---

### Task 6.3: Standalone Mode Documentation

**Description:** Write standalone mode and agent system guide.

**Files to Create/Modify:**
- `docs/STANDALONE-GUIDE.md` (new)

**Acceptance Criteria:**
- [ ] Standalone mode setup instructions
- [ ] Ubik and Axiom agent descriptions
- [ ] LangGraph orchestration explanation
- [ ] Agent customization guide
- [ ] Troubleshooting section

**Estimated Effort:** 3 hours

**Dependencies:** Phase 5 complete

**Requirements:** 13.1, 13.3

---

### Task 6.4: Architecture Documentation

**Description:** Write system architecture and design decisions document.

**Files to Create/Modify:**
- `docs/ARCHITECTURE.md` (new)

**Acceptance Criteria:**
- [ ] System overview diagram
- [ ] 4-layer memory architecture explanation
- [ ] Gateway routing explanation
- [ ] Deployment mode comparison
- [ ] Design decisions and rationale
- [ ] Performance considerations
- [ ] Security considerations

**Estimated Effort:** 4 hours

**Dependencies:** All phases complete

**Requirements:** 13.1

---

### Task 6.5: Example Scripts

**Description:** Create example scripts demonstrating all deployment modes.

**Files to Create/Modify:**
- `examples/cli-workflow.sh` (new)
- `examples/mcp-workflow.ts` (new)
- `examples/standalone-workflow.ts` (new)

**Acceptance Criteria:**
- [ ] CLI workflow: search → store → chronicle → chat
- [ ] MCP workflow: external agent using ANOTS tools
- [ ] Standalone workflow: Ubik + Axiom collaboration
- [ ] All scripts executable and documented

**Estimated Effort:** 2 hours

**Dependencies:** All phases complete

**Requirements:** 13.3

---

### Task 6.6: Init Command

**Description:** Implement `anots init` command for project setup.

**Files to Create/Modify:**
- `src/cli/commands/init.ts` (new)
- `tests/cli/init.test.ts` (new)

**Acceptance Criteria:**
- [ ] Interactive prompts for configuration
- [ ] Generate .env file with defaults
- [ ] Create data directories
- [ ] Copy example configurations
- [ ] Display next steps
- [ ] Unit tests for init command

**Estimated Effort:** 3 hours

**Dependencies:** Phase 3 complete

**Requirements:** 13.4

---

### Task 6.7: Property Test Coverage Verification

**Description:** Verify all 19 correctness properties have corresponding tests.

**Files to Create/Modify:**
- `tests/properties/coverage.test.ts` (new)

**Acceptance Criteria:**
- [ ] Verify Property 1-19 all have tests
- [ ] All property tests run minimum 100 iterations
- [ ] All property tests tagged correctly
- [ ] Coverage report shows 100% property coverage
- [ ] Property test for Property 19 (Property Test Coverage)

**Estimated Effort:** 2 hours

**Dependencies:** All phases complete

**Requirements:** 10.1, 10.2, 10.3, 10.4, 10.5

---

### Task 6.8: Final Integration Testing

**Description:** Comprehensive end-to-end testing across all modes.

**Files to Create/Modify:**
- `tests/integration/full-system.test.ts` (new)

**Acceptance Criteria:**
- [ ] Test mode switching (CLI → MCP → Standalone)
- [ ] Test data persistence across modes
- [ ] Test graceful degradation scenarios
- [ ] Test concurrent operations
- [ ] Test error recovery
- [ ] All success metrics met (startup times, latency)

**Estimated Effort:** 4 hours

**Dependencies:** All phases complete

**Requirements:** 11.1, 11.2, 11.3, 11.4

---

## Summary

### Total Estimated Effort

| Phase | Tasks | Hours |
|-------|-------|-------|
| Phase 1: Core Infrastructure | 2 | 6 |
| Phase 2: Memory System Core | 5 | 23 |
| Phase 3: CLI Mode | 5 | 18 |
| Phase 4: MCP Server Mode | 9 | 30 |
| Phase 5: Standalone Mode | 5 | 19 |
| Phase 6: Documentation | 8 | 25 |
| **Total** | **34** | **121** |

### Critical Path

1. Task 1.1 → 1.2 (Core infrastructure)
2. Task 2.1 → 2.2 → 2.3 → 2.4 → 2.5 (Memory system)
3. Task 3.1 → 3.2 → 3.3 → 3.4 (CLI mode)
4. Task 4.1 → 4.2 → 4.3 → 4.4 → 4.5 → 4.6 (MCP server)
5. Task 5.1 → 5.2 → 5.3 → 5.4 (Standalone mode)
6. Task 6.7 → 6.8 (Final testing)

### Milestones

- **Milestone 1** (Week 1): Core infrastructure + Memory system complete
- **Milestone 2** (Week 2): CLI mode fully functional
- **Milestone 3** (Week 3): MCP server mode fully functional
- **Milestone 4** (Week 4): Standalone mode fully functional
- **Milestone 5** (Week 5): Documentation complete, all tests passing, ready for release

### Dependencies on Other Specs

- **anots-gateway**: Required for Tasks 4.4, 5.2 (Gateway tools and agent LLM calls)
- **langgraph-orchestration**: Required for Task 5.3 (Agent orchestration)
- **memory-system**: Can reuse Chronicle, Codex implementations from Tasks 2.1, 2.4

### Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Gateway spec not complete | High | Implement basic Gateway stub for testing, integrate full Gateway later |
| LangGraph complexity | Medium | Start with simple round-robin, defer complex orchestration |
| External service dependencies | Medium | Implement graceful degradation and file-based fallbacks |
| Property test complexity | Low | Start with simple properties, add complex ones incrementally |

