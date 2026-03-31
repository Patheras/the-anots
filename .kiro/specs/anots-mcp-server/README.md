# ANOTS as MCP Server Specification

## Quick Overview

This specification transforms ANOTS from a standalone triadic system (Chip + Ubik + Axiom) into a flexible platform that can operate in three modes:

1. **Standalone Mode** (default): Use the built-in Ubik + Axiom agents
2. **MCP Server Mode**: Expose ANOTS capabilities as MCP tools for external agent systems
3. **Hybrid Mode**: Run both standalone agents AND MCP server simultaneously

**Key Insight**: Users don't need to build agents in ANOTS. They can use their existing agent systems (Claude Desktop, Cline, Cursor, custom frameworks) and connect to ANOTS as an MCP server to gain access to:
- 4-layer memory architecture (Chronicle, Active Stream, Hive Mind, Codex)
- Intelligent LLM routing (entropy-based, quota-aware)
- Immutable historical record (Chronicle)

## Supported MCP Clients

ANOTS MCP server is compatible with any MCP-compliant client:

- ✅ **Claude Desktop** - Anthropic's desktop app
- ✅ **Cline** - VS Code extension for AI coding
- ✅ **Cursor** - AI-powered code editor
- ✅ **OpenClaw** - Open-source MCP client
- ✅ **Custom Clients** - Any tool supporting MCP protocol (stdio or HTTP/SSE)

## Memory Layer Independence

The 4-layer memory architecture remains fully independent when exposed via MCP:

| Layer | Storage | MCP Tools | Independence |
|-------|---------|-----------|--------------|
| **L1: Chronicle** | File system | `anots/chronicle/*` | ✅ Zero external dependencies |
| **L2: Active Stream** | Redis | `anots/memory/*-context` | ✅ Isolated state |
| **L3: Hive Mind** | Qdrant + Mem0 | `anots/memory/search`, `store` | ✅ Semantic isolation |
| **L4: Agent Codex** | File system | `anots/codex/*` | ✅ Per-agent isolation |

**Failure Isolation**: If one layer fails, other layers continue to operate normally. MCP tools return graceful errors indicating which layer is affected.

## Architecture

```
External Agent Systems          ANOTS System
(Claude, Cline, Cursor)         
        │                       
        │ MCP Protocol          
        ▼                       
┌─────────────────┐            ┌──────────────────┐
│  MCP Client     │────────────│  ANOTS MCP       │
│  (stdio/HTTP)   │            │  Server          │
└─────────────────┘            └────────┬─────────┘
                                        │
                                        ▼
                               ┌─────────────────────┐
                               │  MCP Tools          │
                               │  - memory/*         │
                               │  - chronicle/*      │
                               │  - gateway/*        │
                               │  - codex/*          │
                               └────────┬────────────┘
                                        │
                                        ▼
                               ┌─────────────────────┐
                               │  Core Services      │
                               │  - Memory Service   │
                               │  - Gateway          │
                               │  - Chronicle        │
                               │  - Codex            │
                               └─────────────────────┘
```

## Documents

- **[requirements.md](requirements.md)**: 13 functional requirements for MCP server implementation
- **[design.md](design.md)**: Technical architecture, MCP tools, and integration points
- **[tasks.md](tasks.md)**: Implementation tasks organized in phases

## Quick Start

### For Developers

1. Read `requirements.md` for MCP server requirements
2. Review `design.md` for technical architecture
3. Follow `tasks.md` for implementation order

### For Users (After Implementation)

**Standalone Mode** (default):
```bash
# No configuration needed, works out of the box
npm start
```

**MCP Server Mode**:
```bash
# Set environment variable
export ANOTS_DEPLOYMENT_MODE=mcp-server
export ANOTS_MCP_PORT=3100

# Start MCP server
npm start
```

**Connect from Claude Desktop**:
```json
{
  "mcpServers": {
    "anots": {
      "command": "node",
      "args": ["/path/to/anots/dist/mcp-server.js"],
      "env": {
        "ANOTS_DEPLOYMENT_MODE": "mcp-server"
      }
    }
  }
}
```

## MCP Tools Overview

### Memory Tools
- `anots/memory/search` - Search semantic memory (Hive Mind)
- `anots/memory/store` - Store facts in memory
- `anots/memory/get-context` - Get current context (Active Stream)
- `anots/memory/update-context` - Update context

### Chronicle Tools
- `anots/chronicle/write` - Write immutable entry
- `anots/chronicle/read` - Read entry by ID
- `anots/chronicle/list` - List entries with filters
- `anots/chronicle/search` - Search by content

### Gateway Tools
- `anots/gateway/chat` - Route LLM request with intelligent routing
- `anots/gateway/classify` - Classify task entropy
- `anots/gateway/status` - Get routing status and quota

### Codex Tools
- `anots/codex/read` - Read from agent's personal knowledge base
- `anots/codex/write` - Write to agent's codex
- `anots/codex/list` - List codex files
- `anots/codex/init` - Initialize codex for new agent

### System Tools
- `anots/system/list-tools` - List all available tools
- `anots/system/health` - Get system health status

## Implementation Timeline

- **Week 1**: MCP server infrastructure (server setup, tool registration, stdio/HTTP transport)
- **Week 2**: Memory and Chronicle MCP tools
- **Week 3**: Gateway and Codex MCP tools
- **Week 4**: Authentication, client examples, documentation
- **Week 5**: Testing and integration with popular MCP clients

**Total Effort**: ~60-80 hours

## Success Metrics

| Metric | Target |
|--------|--------|
| Standalone Mode Compatibility | 100% (all existing tests pass) |
| MCP Server Startup Time | < 500ms |
| MCP Tool Response Time | < 200ms (excluding LLM calls) |
| Client Compatibility | Works with Claude Desktop, Cline, Cursor |

## Key Design Decisions

1. **MCP as Primary Interface**: External agents connect via standard MCP protocol
2. **Standalone Mode Default**: Zero-config experience for existing users
3. **Tool Namespace**: All tools prefixed with `anots/` for clarity
4. **Hybrid Mode Support**: Run standalone agents + MCP server simultaneously

## Example: Using ANOTS from Claude Desktop

```typescript
// Claude Desktop automatically discovers and uses ANOTS tools

// Search memory
const results = await use_mcp_tool("anots/memory/search", {
  query: "quantum computing research",
  limit: 5
});

// Write to Chronicle
await use_mcp_tool("anots/chronicle/write", {
  content: "# Research Session\n\nDiscussed quantum entanglement...",
  participants: ["claude", "user"],
  sessionType: "research"
});

// Route LLM request via Gateway
const response = await use_mcp_tool("anots/gateway/chat", {
  messages: [{ role: "user", content: "Explain quantum computing" }],
  taskHint: "research-synthesis"
});
```

## Dependencies

- **@modelcontextprotocol/sdk**: Official MCP SDK for TypeScript
- **Zod**: Schema validation for MCP tool inputs
- **Existing ANOTS Services**: Memory Service, Gateway, Chronicle, Codex (no changes required)

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking changes to standalone mode | 100% backward compatibility, comprehensive tests |
| MCP protocol complexity | Use official SDK, follow spec strictly |
| Performance overhead | Async tool execution, caching, benchmarking |
| Client compatibility issues | Test with Claude Desktop, Cline, Cursor |

## Next Steps

1. Review and approve this specification
2. Begin Phase 1 implementation (MCP server infrastructure)
3. Set up test environment with Claude Desktop
4. Create example MCP client configurations

## Questions?

- **Why MCP instead of custom API?** MCP is a standard protocol supported by Claude Desktop, Cline, Cursor, and many other tools
- **Can I use both standalone and MCP modes?** Yes, hybrid mode runs both simultaneously
- **Will this slow down standalone mode?** No, MCP server only runs when explicitly enabled
- **What about authentication?** Optional API key authentication for remote connections

