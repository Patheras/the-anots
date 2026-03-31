# Tasks Document: Modular Agent System

## Overview

This document breaks down the implementation of the Modular Agent System into concrete, testable tasks. Each task includes acceptance criteria, estimated effort, and dependencies.

---

## Phase 1: Core Infrastructure

### Task 1.1: Define Agent Definition Schema

**Description:** Create the TypeScript types and Zod schema for agent definitions.

**Files to Create/Modify:**
- `src/agents/types.ts` (new)

**Acceptance Criteria:**
- [ ] `AgentDefinition` interface defined with all required fields
- [ ] `AgentDefinitionSchema` Zod schema created
- [ ] Schema validates all field types and constraints
- [ ] Agent ID regex validation: `^[a-z0-9-]+$`
- [ ] Memory access enum validation: `'read' | 'write' | 'none'`
- [ ] Unit tests for schema validation (valid and invalid inputs)

**Estimated Effort:** 2 hours

**Dependencies:** None

---

### Task 1.2: Implement Agent Registry

**Description:** Create the singleton AgentRegistry class for managing runtime agents.

**Files to Create/Modify:**
- `src/agents/AgentRegistry.ts` (new)
- `src/agents/__tests__/AgentRegistry.test.ts` (new)

**Acceptance Criteria:**
- [ ] Singleton pattern implemented correctly
- [ ] `register()` method adds agents to internal Map
- [ ] `register()` throws error on duplicate agent ID
- [ ] `get()`, `getAll()`, `has()`, `count()` methods work correctly
- [ ] `clear()` method resets registry
- [ ] Unit tests achieve 100% coverage

**Estimated Effort:** 3 hours

**Dependencies:** Task 1.1

---

### Task 1.3: Create Preset Agent Definitions

**Description:** Create YAML files for Ubik and Axiom preset agents.

**Files to Create/Modify:**
- `src/agents/presets/ubik.yaml` (new)
- `src/agents/presets/axiom.yaml` (new)

**Acceptance Criteria:**
- [ ] `ubik.yaml` matches specification (creative engine, full access)
- [ ] `axiom.yaml` matches specification (analytical engine, full access)
- [ ] Both files validate against `AgentDefinitionSchema`
- [ ] System prompts included for both agents
- [ ] Files are read-only (permissions set to 444)

**Estimated Effort:** 1 hour

**Dependencies:** Task 1.1

---

### Task 1.4: Implement Agent Loader

**Description:** Create the AgentLoader class to load agents from disk.

**Files to Create/Modify:**
- `src/agents/AgentLoader.ts` (new)
- `src/agents/__tests__/AgentLoader.test.ts` (new)

**Acceptance Criteria:**
- [ ] Reads `ANOTS_AGENT_MODE` environment variable (default: `'preset'`)
- [ ] Reads `ANOTS_CUSTOM_AGENTS_DIR` environment variable (default: `'./agents/'`)
- [ ] `loadPresets()` loads ubik.yaml and axiom.yaml
- [ ] `loadCustom()` scans custom directory for .yaml and .json files
- [ ] Validates all loaded files with Zod schema
- [ ] Logs errors for invalid files but continues loading others
- [ ] Unit tests for both preset and custom modes
- [ ] Integration test with real YAML files

**Estimated Effort:** 4 hours

**Dependencies:** Tasks 1.1, 1.2, 1.3

---

### Task 1.5: Add Environment Variable Support

**Description:** Add environment variable configuration to the system.

**Files to Create/Modify:**
- `src/config/AgentConfig.ts` (new)
- `.env.example` (modify)
- `README.md` (modify)

**Acceptance Criteria:**
- [ ] `ANOTS_AGENT_MODE` documented in .env.example
- [ ] `ANOTS_CUSTOM_AGENTS_DIR` documented in .env.example
- [ ] Config class provides typed access to environment variables
- [ ] Sensible defaults for all variables
- [ ] README updated with agent system configuration section

**Estimated Effort:** 1 hour

**Dependencies:** None

---

## Phase 2: Access Control

### Task 2.1: Implement Memory Access Control

**Description:** Create the MemoryAccessControl class to enforce memory permissions.

**Files to Create/Modify:**
- `src/agents/MemoryAccessControl.ts` (new)
- `src/agents/__tests__/MemoryAccessControl.test.ts` (new)

**Acceptance Criteria:**
- [ ] `canRead()` method checks read permissions correctly
- [ ] `canWrite()` method checks write permissions correctly
- [ ] `enforceRead()` throws `MemoryAccessError` on violation
- [ ] `enforceWrite()` throws `MemoryAccessError` on violation
- [ ] Handles `'none'` permission correctly (denies both read and write)
- [ ] Unit tests for all permission combinations
- [ ] Property-based tests for permission logic

**Estimated Effort:** 3 hours

**Dependencies:** Task 1.2

---

### Task 2.2: Integrate Access Control with Memory Service

**Description:** Add access control checks to all Memory Service operations.

**Files to Create/Modify:**
- `src/memory/MemoryService.ts` (modify)
- `src/memory/__tests__/MemoryService.test.ts` (modify)

**Acceptance Criteria:**
- [ ] All Chronicle read/write operations check permissions
- [ ] All Active Stream read/write operations check permissions
- [ ] All Hive Mind read/write operations check permissions
- [ ] All Codex read/write operations check permissions
- [ ] Access violations logged with agent ID, operation, and layer
- [ ] Existing tests updated to pass agent ID
- [ ] New tests for access control violations

**Estimated Effort:** 4 hours

**Dependencies:** Task 2.1

---

### Task 2.3: Implement Tool Permission Enforcer

**Description:** Create the ToolPermissionEnforcer class to enforce MCP tool permissions.

**Files to Create/Modify:**
- `src/agents/ToolPermissionEnforcer.ts` (new)
- `src/agents/__tests__/ToolPermissionEnforcer.test.ts` (new)

**Acceptance Criteria:**
- [ ] `canInvoke()` method checks tool permissions correctly
- [ ] Wildcard `'*'` grants access to all tools
- [ ] Exact tool name matching works
- [ ] Pattern matching with `'*'` suffix works (e.g., `'web:*'`)
- [ ] `enforce()` throws `ToolPermissionError` on violation
- [ ] Unit tests for all permission scenarios
- [ ] Property-based tests for pattern matching

**Estimated Effort:** 3 hours

**Dependencies:** Task 1.2

---

### Task 2.4: Integrate Tool Permissions with Gateway

**Description:** Add tool permission checks to Gateway MCP tool invocations.

**Files to Create/Modify:**
- `src/gateway/ANOTSGateway.ts` (modify)
- `src/gateway/__tests__/ANOTSGateway.test.ts` (modify)

**Acceptance Criteria:**
- [ ] All MCP tool invocations check permissions before execution
- [ ] Tool permission violations logged with agent ID, tool name, and timestamp
- [ ] Existing tests updated to pass agent ID
- [ ] New tests for tool permission violations
- [ ] Error responses include descriptive messages

**Estimated Effort:** 3 hours

**Dependencies:** Task 2.3

---

## Phase 3: Orchestration

### Task 3.1: Implement Agent Orchestrator

**Description:** Create the AgentOrchestrator class to manage agent execution.

**Files to Create/Modify:**
- `src/agents/AgentOrchestrator.ts` (new)
- `src/agents/__tests__/AgentOrchestrator.test.ts` (new)

**Acceptance Criteria:**
- [ ] `determineMode()` correctly identifies none/single/multi mode
- [ ] `initialize()` logs the selected mode
- [ ] Single-agent mode skips LangGraph initialization
- [ ] Multi-agent mode initializes LangGraph with one node per agent
- [ ] `processMessage()` routes to correct execution path
- [ ] Unit tests for all three modes
- [ ] Integration test with real agents

**Estimated Effort:** 6 hours

**Dependencies:** Tasks 1.2, 1.4

---

### Task 3.2: Implement Single-Agent Execution

**Description:** Implement direct execution path for single-agent mode.

**Files to Create/Modify:**
- `src/agents/AgentOrchestrator.ts` (modify)
- `src/agents/__tests__/AgentOrchestrator.test.ts` (modify)

**Acceptance Criteria:**
- [ ] `executeSingleAgent()` calls Gateway with agent's model preferences
- [ ] Memory access control enforced during execution
- [ ] Tool permissions enforced during execution
- [ ] Agent's system prompt included in LLM call
- [ ] Response returned directly to caller (no orchestration overhead)
- [ ] Unit tests for single-agent execution
- [ ] Integration test with Memory Service and Gateway

**Estimated Effort:** 4 hours

**Dependencies:** Tasks 2.2, 2.4, 3.1

---

### Task 3.3: Implement Multi-Agent Execution

**Description:** Implement LangGraph-based execution for multi-agent mode.

**Files to Create/Modify:**
- `src/agents/AgentOrchestrator.ts` (modify)
- `src/agents/__tests__/AgentOrchestrator.test.ts` (modify)

**Acceptance Criteria:**
- [ ] `initializeMultiAgent()` creates LangGraph with one node per agent
- [ ] Round-robin edges connect all agents
- [ ] First agent in registry is entry point
- [ ] `executeAgent()` calls Gateway with agent's model preferences
- [ ] Inter-agent messages stored in Active Stream (L2)
- [ ] Memory access control enforced during execution
- [ ] Tool permissions enforced during execution
- [ ] Unit tests for multi-agent orchestration
- [ ] Integration test with LangGraph and Redis checkpointer

**Estimated Effort:** 8 hours

**Dependencies:** Tasks 2.2, 2.4, 3.1

---

### Task 3.4: Implement Agent-to-Agent Messaging

**Description:** Add inter-agent messaging support via Active Stream.

**Files to Create/Modify:**
- `src/agents/types.ts` (modify)
- `src/state/types.ts` (modify)
- `src/agents/AgentOrchestrator.ts` (modify)
- `src/agents/__tests__/AgentMessaging.test.ts` (new)

**Acceptance Criteria:**
- [ ] `AgentMessage` interface defined: `{ from, to, content, timestamp }`
- [ ] Messages stored in Active Stream state
- [ ] Agents can query messages addressed to them
- [ ] Message history preserved across orchestration steps
- [ ] Unit tests for message creation and retrieval
- [ ] Integration test with multi-agent workflow

**Estimated Effort:** 4 hours

**Dependencies:** Task 3.3

---

## Phase 4: CLI Tools

### Task 4.1: Implement `anots agent create` Command

**Description:** Build interactive CLI for creating custom agents.

**Files to Create/Modify:**
- `src/cli/commands/agent-create.ts` (new)
- `src/cli/prompts/AgentBuilder.ts` (new)
- `src/cli/__tests__/agent-create.test.ts` (new)

**Acceptance Criteria:**
- [ ] Interactive prompts for all agent fields
- [ ] Agent ID validated for uniqueness and format
- [ ] Model preferences prompted with defaults
- [ ] Memory access prompted with checkboxes
- [ ] MCP tools prompted with multi-select
- [ ] Generated YAML file validates against schema
- [ ] File written to custom agents directory
- [ ] Success message with file path
- [ ] Unit tests for prompt logic
- [ ] Integration test with real file creation

**Estimated Effort:** 6 hours

**Dependencies:** Tasks 1.1, 1.4

**Libraries:** `inquirer` or `prompts` for interactive CLI

---

### Task 4.2: Implement `anots agent list` Command

**Description:** Build CLI command to list all registered agents.

**Files to Create/Modify:**
- `src/cli/commands/agent-list.ts` (new)
- `src/cli/__tests__/agent-list.test.ts` (new)

**Acceptance Criteria:**
- [ ] Displays current mode (preset/custom)
- [ ] Displays agents directory path
- [ ] Table format with ID, Name, Role columns
- [ ] Total agent count displayed
- [ ] Handles zero agents gracefully
- [ ] Unit tests for table formatting
- [ ] Integration test with real agents

**Estimated Effort:** 3 hours

**Dependencies:** Tasks 1.2, 1.4

**Libraries:** `cli-table3` for table formatting

---

### Task 4.3: Implement `anots agent validate` Command

**Description:** Build CLI command to validate agent definition files.

**Files to Create/Modify:**
- `src/cli/commands/agent-validate.ts` (new)
- `src/cli/__tests__/agent-validate.test.ts` (new)

**Acceptance Criteria:**
- [ ] Accepts file path as argument
- [ ] Loads and parses YAML/JSON file
- [ ] Validates against Zod schema
- [ ] Displays validation errors with field names
- [ ] Displays success message with agent details
- [ ] Handles file not found errors
- [ ] Unit tests for validation logic
- [ ] Integration test with valid and invalid files

**Estimated Effort:** 3 hours

**Dependencies:** Task 1.1

---

### Task 4.4: Implement `anots agent reload` Command (Optional)

**Description:** Build CLI command to hot-reload agent definitions.

**Files to Create/Modify:**
- `src/cli/commands/agent-reload.ts` (new)
- `src/agents/AgentRegistry.ts` (modify)
- `src/cli/__tests__/agent-reload.test.ts` (new)

**Acceptance Criteria:**
- [ ] Clears current agent registry
- [ ] Re-scans agent directory
- [ ] Re-validates and registers agents
- [ ] Restarts orchestration layer
- [ ] Preserves Active Stream state
- [ ] Logs reloaded agents and errors
- [ ] Unit tests for reload logic
- [ ] Integration test with orchestrator

**Estimated Effort:** 4 hours

**Dependencies:** Tasks 1.2, 1.4, 3.1

---

## Phase 5: Documentation and Testing

### Task 5.1: Write Agent System Guide

**Description:** Create comprehensive documentation for the agent system.

**Files to Create/Modify:**
- `docs/AGENT-SYSTEM.md` (new)
- `README.md` (modify)

**Acceptance Criteria:**
- [ ] Overview of preset vs. custom mode
- [ ] Agent definition schema documented
- [ ] Memory access control explained
- [ ] MCP tool permissions explained
- [ ] Single-agent vs. multi-agent mode explained
- [ ] CLI commands documented with examples
- [ ] Configuration options documented
- [ ] Troubleshooting section included

**Estimated Effort:** 4 hours

**Dependencies:** All previous tasks

---

### Task 5.2: Create Example Agent Definitions

**Description:** Create example custom agents for documentation.

**Files to Create/Modify:**
- `examples/agents/researcher.yaml` (new)
- `examples/agents/coder.yaml` (new)
- `examples/agents/reviewer.yaml` (new)
- `examples/agents/minimal.yaml` (new)

**Acceptance Criteria:**
- [ ] `researcher.yaml`: single-agent research assistant
- [ ] `coder.yaml` + `reviewer.yaml`: two-agent code review workflow
- [ ] `minimal.yaml`: minimal agent with restricted permissions
- [ ] All examples validate against schema
- [ ] Examples referenced in documentation

**Estimated Effort:** 2 hours

**Dependencies:** Task 1.1

---

### Task 5.3: Write Migration Guide

**Description:** Create guide for migrating from preset to custom mode.

**Files to Create/Modify:**
- `docs/AGENT-MIGRATION.md` (new)

**Acceptance Criteria:**
- [ ] Step-by-step migration instructions
- [ ] How to fork preset agents
- [ ] How to customize agent permissions
- [ ] How to test custom agents
- [ ] Common pitfalls and solutions
- [ ] Rollback instructions

**Estimated Effort:** 2 hours

**Dependencies:** Task 5.1

---

### Task 5.4: Write Integration Tests

**Description:** Create end-to-end integration tests for the agent system.

**Files to Create/Modify:**
- `tests/integration/AgentSystem.integration.test.ts` (new)

**Acceptance Criteria:**
- [ ] Test preset mode loads Ubik and Axiom
- [ ] Test custom mode loads custom agents
- [ ] Test single-agent mode execution
- [ ] Test multi-agent mode execution
- [ ] Test memory access control violations
- [ ] Test tool permission violations
- [ ] Test agent-to-agent messaging
- [ ] All tests pass with real components (no mocks)

**Estimated Effort:** 6 hours

**Dependencies:** All Phase 1-3 tasks

---

### Task 5.5: Achieve Test Coverage Targets

**Description:** Ensure all components meet coverage targets.

**Acceptance Criteria:**
- [ ] AgentRegistry: 100% coverage
- [ ] AgentLoader: ≥ 90% coverage
- [ ] MemoryAccessControl: 100% coverage
- [ ] ToolPermissionEnforcer: 100% coverage
- [ ] AgentOrchestrator: ≥ 85% coverage
- [ ] CLI commands: ≥ 80% coverage
- [ ] Overall agent system: ≥ 85% coverage

**Estimated Effort:** 4 hours

**Dependencies:** All previous tasks

---

## Phase 6: Backward Compatibility Verification

### Task 6.1: Verify Preset Mode Compatibility

**Description:** Ensure preset mode works identically to the current system.

**Files to Create/Modify:**
- `tests/compatibility/PresetMode.test.ts` (new)

**Acceptance Criteria:**
- [ ] All existing Memory Service tests pass in preset mode
- [ ] All existing Gateway tests pass in preset mode
- [ ] All existing Chronicle tests pass in preset mode
- [ ] Ubik and Axiom agents load correctly
- [ ] Triadic orchestration workflow unchanged
- [ ] No performance regression (< 5% overhead)

**Estimated Effort:** 4 hours

**Dependencies:** All Phase 1-3 tasks

---

### Task 6.2: Update Existing Tests

**Description:** Update existing tests to work with the new agent system.

**Files to Create/Modify:**
- `src/memory/__tests__/*.test.ts` (modify)
- `src/gateway/__tests__/*.test.ts` (modify)
- `src/chronicle/__tests__/*.test.ts` (modify)

**Acceptance Criteria:**
- [ ] All tests updated to pass agent ID where required
- [ ] Mock agents created for test isolation
- [ ] No tests skipped or disabled
- [ ] All tests pass in both preset and custom modes
- [ ] Test execution time not significantly increased

**Estimated Effort:** 6 hours

**Dependencies:** Tasks 2.2, 2.4

---

## Summary

### Total Estimated Effort

| Phase | Tasks | Hours |
|-------|-------|-------|
| Phase 1: Core Infrastructure | 5 | 11 |
| Phase 2: Access Control | 4 | 13 |
| Phase 3: Orchestration | 4 | 22 |
| Phase 4: CLI Tools | 4 | 16 |
| Phase 5: Documentation | 5 | 18 |
| Phase 6: Compatibility | 2 | 10 |
| **Total** | **24** | **90** |

### Critical Path

1. Task 1.1 → 1.2 → 1.4 → 3.1 → 3.2 → 3.3 (Core orchestration)
2. Task 2.1 → 2.2 (Memory access control)
3. Task 2.3 → 2.4 (Tool permissions)
4. Task 5.4 (Integration tests)

### Milestones

- **Milestone 1** (Week 1): Core infrastructure complete, preset mode working
- **Milestone 2** (Week 2): Access control implemented, integrated with Memory Service and Gateway
- **Milestone 3** (Week 3): Orchestration complete, single and multi-agent modes working
- **Milestone 4** (Week 4): CLI tools complete, custom agents fully supported
- **Milestone 5** (Week 5): Documentation complete, all tests passing, ready for release

### Risk Mitigation

- **Risk**: LangGraph integration complexity
  - **Mitigation**: Start with simple round-robin pattern, defer complex workflows
  
- **Risk**: Performance overhead from access control
  - **Mitigation**: Benchmark early, optimize hot paths, cache permission checks

- **Risk**: Breaking changes to existing code
  - **Mitigation**: Maintain 100% backward compatibility in preset mode, comprehensive tests

