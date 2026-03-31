# ANOTS Unified Platform Specification

## Quick Overview

ANOTS Unified Platform is a progressive cognitive augmentation system that supports three deployment modes:

1. **CLI Mode**: Zero-setup command-line interface for direct memory and LLM access
2. **MCP Server Mode**: Expose ANOTS capabilities via Model Context Protocol for external agent integration
3. **Standalone Mode**: Full triadic agent system (Ubik + Axiom) with LangGraph orchestration

**Design Philosophy**: Progressive complexity - start with CLI, integrate via MCP, or use full standalone system.

## Key Features

- **Progressive Deployment**: Start simple (CLI), scale to full system (Standalone)
- **4-Layer Memory**: Independent layers (Chronicle, Active Stream, Hive Mind, Codex)
- **Intelligent Routing**: Gateway with entropy-based classification and quota management
- **Standard Protocols**: MCP for external integration, OpenAI-compatible APIs
- **Property-Based Testing**: 19 correctness properties verified with fast-check
- **Graceful Degradation**: Works with zero external dependencies (file system only)

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              ANOTS Unified Platform                  │
│                                                      │
│  CLI Mode    MCP Server Mode    Standalone Mode     │
│  (Commands)  (MCP Tools)        (Ubik + Axiom)      │
│      │            │                    │             │
│      └────────────┴────────────────────┘             │
│                   │                                  │
│                   ▼                                  │
│         Core Services Layer                          │
│         (Memory + Gateway)                           │
│                   │                                  │
│                   ▼                                  │
│         4-Layer Memory Architecture                  │
│         L1: Chronicle | L2: Active Stream           │
│         L3: Hive Mind | L4: Agent Codex             │
└─────────────────────────────────────────────────────┘
```

## Documents

- **[requirements.md](requirements.md)**: 13 functional requirements + 19 correctness properties
- **[design.md](design.md)**: Technical architecture, components, and interfaces
- **[tasks.md](tasks.md)**: 34 implementation tasks organized in 6 phases (~121 hours)

## Quick Start

### For Developers

1. Read `requirements.md` for functional requirements and correctness properties
2. Review `design.md` for technical architecture
3. Follow `tasks.md` for implementation order (Phase 1 → Phase 6)

### For Users (After Implementation)

**CLI Mode** (Zero setup):
```bash
npm install -g anots
anots memory search "quantum computing"
anots chronicle write "Research notes..."
anots chat "Explain quantum entanglement"
```

**MCP Server Mode** (External agent integration):
```json
// Claude Desktop config
{
  "mcpServers": {
    "anots": {
      "command": "node",
      "args": ["/path/to/anots/dist/mcp-server.js"],
      "env": {
        "ANOTS_MODE": "mcp-server"
      }
    }
  }
}
```

**Standalone Mode** (Full ANOTS):
```bash
export ANOTS_MODE=standalone
npm start
# Ubik and Axiom agents start with LangGraph orchestration
```

## Deployment Modes Comparison

| Feature | CLI Mode | MCP Server Mode | Standalone Mode |
|---------|----------|-----------------|-----------------|
| **Setup** | Zero | Minimal | Full |
| **Memory System** | ✅ All 4 layers | ✅ All 4 layers | ✅ All 4 layers |
| **Gateway** | ⚠️ Optional | ✅ Required | ✅ Required |
| **MCP Server** | ❌ | ✅ Required | ❌ |
| **Agents** | ❌ | ❌ (external) | ✅ Ubik + Axiom |
| **LangGraph** | ❌ | ❌ | ✅ Required |
| **Use Case** | Quick tasks | Integration | Full system |

## MCP Tools Overview

### Memory Tools (4 tools)
- `anots/memory/search` - Search semantic memory
- `anots/memory/store` - Store facts
- `anots/memory/get-context` - Get current context
- `anots/memory/update-context` - Update context

### Chronicle Tools (4 tools)
- `anots/chronicle/write` - Write immutable entry
- `anots/chronicle/read` - Read entry by ID
- `anots/chronicle/list` - List entries with filters
- `anots/chronicle/search` - Search by content

### Gateway Tools (3 tools)
- `anots/gateway/chat` - Intelligent LLM routing
- `anots/gateway/classify` - Classify task entropy
- `anots/gateway/status` - Get routing status

### Codex Tools (4 tools)
- `anots/codex/read` - Read from agent's KB
- `anots/codex/write` - Write to agent's KB
- `anots/codex/list` - List codex files
- `anots/codex/init` - Initialize codex

### System Tools (2 tools)
- `anots/system/list-tools` - List all tools
- `anots/system/health` - Get system health

## Correctness Properties

The specification defines 19 correctness properties verified with property-based testing:

1. Mode Validation
2. Mode Determinism
3. Memory Search Idempotence
4. Memory Store-Retrieve Round-Trip
5. Chronicle Immutability
6. Chronicle Write-Read Round-Trip
7. Chat Response Non-Empty
8. Interactive Context Preservation
9. Tool List Completeness
10. Tool Schema Validity
11. MCP Memory Tool Equivalence
12. MCP Tool Error Handling
13. Gateway Routing Determinism
14. Gateway Chat Response Validity
15. Agent Definition Validity
16. Agent Initialization Idempotence
17. Layer Failure Isolation
18. Layer Independence
19. Property Test Coverage

## Implementation Timeline

- **Week 1**: Core infrastructure + Memory system (6 + 23 hours)
- **Week 2**: CLI mode (18 hours)
- **Week 3**: MCP server mode (30 hours)
- **Week 4**: Standalone mode (19 hours)
- **Week 5**: Documentation and testing (25 hours)

**Total Effort**: ~121 hours across 34 tasks

## Success Metrics

| Metric | Target |
|--------|--------|
| CLI Mode Startup Time | < 100ms |
| MCP Server Startup Time | < 500ms |
| Memory Operation Latency | < 200ms |
| Property Test Coverage | 100% (all 19 properties) |
| Integration Test Coverage | 100% (all 3 modes) |
| Layer Failure Isolation | 100% |

## Dependencies

### Core Dependencies
- **@modelcontextprotocol/sdk**: MCP server implementation
- **@langchain/langgraph**: Multi-agent orchestration (standalone mode)
- **@qdrant/js-client-rest**: Vector database client
- **redis**: Active Stream backend
- **mem0ai**: Automatic fact extraction
- **zod**: Schema validation
- **fast-check**: Property-based testing
- **commander**: CLI framework

### Optional Dependencies
- **inquirer**: Interactive CLI prompts
- **chalk**: Colorized CLI output
- **cli-table3**: Table formatting

## Supported MCP Clients

- ✅ **Claude Desktop** - Anthropic's desktop app
- ✅ **Cline** - VS Code extension for AI coding
- ✅ **Cursor** - AI-powered code editor
- ✅ **OpenClaw** - Open-source MCP client
- ✅ **Custom Clients** - Any MCP-compliant tool (stdio or HTTP/SSE)

## Memory Layer Independence

The 4-layer memory architecture remains fully independent:

| Layer | Storage | Independence |
|-------|---------|--------------|
| **L1: Chronicle** | File system | ✅ Zero external dependencies |
| **L2: Active Stream** | Redis | ✅ Isolated state, file fallback |
| **L3: Hive Mind** | Qdrant + Mem0 | ✅ Semantic isolation, file fallback |
| **L4: Agent Codex** | File system | ✅ Per-agent isolation |

**Failure Isolation**: If one layer fails, other layers continue to operate normally.

## Example: CLI Workflow

```bash
# Search memory
anots memory search "quantum computing"

# Store a fact
anots memory store "Quantum entanglement is a physical phenomenon"

# Write to Chronicle
anots chronicle write "Research session on quantum physics"

# Chat with LLM
anots chat "Explain quantum superposition"

# Interactive chat
anots chat --interactive
```

## Example: MCP Integration (Claude Desktop)

```typescript
// Claude automatically discovers and uses ANOTS tools

// Search memory
const results = await use_mcp_tool("anots/memory/search", {
  query: "quantum computing",
  limit: 5
});

// Write to Chronicle
await use_mcp_tool("anots/chronicle/write", {
  content: "# Research Session\n\nDiscussed quantum entanglement...",
  participants: ["claude", "user"]
});

// Route LLM request via Gateway
const response = await use_mcp_tool("anots/gateway/chat", {
  messages: [{ role: "user", content: "Explain quantum computing" }],
  taskHint: "research-synthesis"
});
```

## Example: Standalone Mode

```typescript
// Ubik and Axiom collaborate via LangGraph

// User message enters the system
const response = await agentSystem.processMessage(
  "Research quantum computing and create a summary"
);

// Ubik (Creative Engine) researches
// Axiom (Analytical Engine) validates and structures
// Result: Comprehensive, validated summary
```

## Testing Strategy

### Property-Based Tests
- 19 properties tested with fast-check
- Minimum 100 iterations per property
- Custom arbitraries for all domain types

### Integration Tests
- CLI mode: All commands with real file system
- MCP server mode: All tools with real MCP client
- Standalone mode: Full agent orchestration

### Unit Tests
- All components tested in isolation
- Mocked external dependencies
- ≥ 80% code coverage

## Next Steps

1. Review and approve this specification
2. Begin Phase 1 implementation (Core Infrastructure)
3. Set up CI/CD with property-based testing
4. Create example configurations for MCP clients

## Questions?

- **Why three deployment modes?** Progressive complexity - users can start simple and scale as needed
- **Can I use multiple modes simultaneously?** No, choose one mode per deployment
- **What if I don't have Qdrant/Redis?** System gracefully degrades to file-based storage
- **How do I migrate between modes?** Data is compatible across all modes (same memory architecture)

