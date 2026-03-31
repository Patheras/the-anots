# Design Document: ANOTS Unified Platform

## Overview

ANOTS Unified Platform is a progressive cognitive augmentation system that supports three deployment modes: CLI (command-line interface), MCP Server (Model Context Protocol integration), and Standalone (full triadic agent system). The platform is built on a resilient 4-layer memory architecture and intelligent LLM routing, with each deployment mode building upon the previous.

### Design Goals

- **Progressive Complexity**: Start simple (CLI), scale to full system (Standalone)
- **Layer Independence**: Memory layers operate independently; failures don't cascade
- **Zero External Dependencies**: CLI mode works with file system only
- **Standard Protocols**: MCP for external integration, OpenAI-compatible APIs
- **Property-Based Correctness**: All critical properties verified with fast-check

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     ANOTS Unified Platform                       │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐   │
│  │ CLI Mode   │  │ MCP Server │  │ Standalone Mode        │   │
│  │            │  │ Mode       │  │                        │   │
│  │ Commands   │  │            │  │ Ubik + Axiom          │   │
│  │ - memory   │  │ MCP Tools  │  │ (LangGraph)           │   │
│  │ - chronicle│  │ - anots/*  │  │                        │   │
│  │ - chat     │  │            │  │                        │   │
│  └─────┬──────┘  └─────┬──────┘  └──────────┬─────────────┘   │
│        │               │                     │                  │
│        └───────────────┴─────────────────────┘                  │
│                        │                                         │
│                        ▼                                         │
│        ┌───────────────────────────────────────────┐           │
│        │         Core Services Layer                │           │
│        │                                            │           │
│        │  ┌──────────────┐    ┌──────────────┐   │           │
│        │  │ Memory       │    │ Gateway      │   │           │
│        │  │ Service      │    │ (Routing)    │   │           │
│        │  └──────┬───────┘    └──────┬───────┘   │           │
│        └─────────┼────────────────────┼───────────┘           │
│                  │                    │                         │
│                  ▼                    ▼                         │
│        ┌─────────────────────────────────────────┐            │
│        │      4-Layer Memory Architecture         │            │
│        │                                           │            │
│        │  L1: Chronicle (File System)             │            │
│        │  L2: Active Stream (Redis)               │            │
│        │  L3: Hive Mind (Qdrant + Mem0)          │            │
│        │  L4: Agent Codex (File System)          │            │
│        └─────────────────────────────────────────┘            │
└──────────────────────────────────────────────────────────────────┘
```

---

## Components and Interfaces

### 1. Deployment Mode Manager

Manages mode selection and component initialization.

```typescript
// src/core/DeploymentManager.ts

export type DeploymentMode = 'cli' | 'mcp-server' | 'standalone';

export interface DeploymentConfig {
  mode: DeploymentMode;
  dataDir: string;
  mcpPort?: number;
  mcpAuthEnabled?: boolean;
  gatewayEnabled: boolean;
}

export class DeploymentManager {
  private mode: DeploymentMode;
  private services: Map<string, Service> = new Map();

  async initialize(config: DeploymentConfig): Promise<void> {
    this.mode = config.mode;
    
    // Always initialize Memory System (all modes need it)
    await this.initializeMemorySystem(config);
    
    // Initialize mode-specific components
    switch (this.mode) {
      case 'cli':
        await this.initializeCLI(config);
        break;
      case 'mcp-server':
        await this.initializeMCPServer(config);
        break;
      case 'standalone':
        await this.initializeStandalone(config);
        break;
    }
  }

  private async initializeMemorySystem(config: DeploymentConfig): Promise<void> {
    // Initialize all 4 layers independently
    const chronicle = new ChronicleService(config.dataDir);
    const activeStream = new ActiveStreamService(); // Redis optional
    const hiveMind = new HiveMindService(); // Qdrant optional
    const codex = new CodexService(config.dataDir);
    
    this.services.set('chronicle', chronicle);
    this.services.set('activeStream', activeStream);
    this.services.set('hiveMind', hiveMind);
    this.services.set('codex', codex);
  }

  private async initializeCLI(config: DeploymentConfig): Promise<void> {
    const cli = new CLIInterface(this.services);
    this.services.set('cli', cli);
  }

  private async initializeMCPServer(config: DeploymentConfig): Promise<void> {
    if (config.gatewayEnabled) {
      const gateway = new Gateway();
      this.services.set('gateway', gateway);
    }
    
    const mcpServer = new MCPServer(this.services, config.mcpPort);
    await mcpServer.start();
    this.services.set('mcpServer', mcpServer);
  }

  private async initializeStandalone(config: DeploymentConfig): Promise<void> {
    const gateway = new Gateway();
    this.services.set('gateway', gateway);
    
    const agentSystem = new AgentSystem(this.services);
    await agentSystem.loadAgents(['ubik', 'axiom']);
    this.services.set('agentSystem', agentSystem);
  }
}
```

---

### 2. CLI Interface

Command-line interface for direct access to ANOTS capabilities.

```typescript
// src/cli/CLIInterface.ts

export class CLIInterface {
  private memoryService: MemoryService;
  private chronicleService: ChronicleService;
  private gateway?: Gateway;

  constructor(services: Map<string, Service>) {
    this.memoryService = new MemoryService(services);
    this.chronicleService = services.get('chronicle') as ChronicleService;
    this.gateway = services.get('gateway') as Gateway | undefined;
  }

  async executeCommand(command: string, args: string[]): Promise<void> {
    const [category, action, ...params] = [command, ...args];
    
    switch (category) {
      case 'memory':
        await this.handleMemoryCommand(action, params);
        break;
      case 'chronicle':
        await this.handleChronicleCommand(action, params);
        break;
      case 'chat':
        await this.handleChatCommand(action, params);
        break;
      default:
        throw new Error(`Unknown command category: ${category}`);
    }
  }

  private async handleMemoryCommand(action: string, params: string[]): Promise<void> {
    switch (action) {
      case 'search':
        const query = params[0];
        const results = await this.memoryService.search(query);
        console.table(results);
        break;
      case 'store':
        const content = params.join(' ');
        await this.memoryService.store(content);
        console.log('✓ Fact stored successfully');
        break;
      case 'context':
        const context = await this.memoryService.getContext();
        console.log(context);
        break;
      case 'clear':
        await this.memoryService.clearContext();
        console.log('✓ Context cleared');
        break;
      default:
        throw new Error(`Unknown memory action: ${action}`);
    }
  }

  private async handleChronicleCommand(action: string, params: string[]): Promise<void> {
    switch (action) {
      case 'write':
        const content = params.join(' ');
        const chapterId = await this.chronicleService.write(content);
        console.log(`✓ Chronicle entry written: ${chapterId}`);
        break;
      case 'read':
        const id = params[0];
        const entry = await this.chronicleService.read(id);
        console.log(entry);
        break;
      case 'list':
        const entries = await this.chronicleService.list();
        console.table(entries);
        break;
      case 'search':
        const searchQuery = params.join(' ');
        const searchResults = await this.chronicleService.search(searchQuery);
        console.table(searchResults);
        break;
      default:
        throw new Error(`Unknown chronicle action: ${action}`);
    }
  }

  private async handleChatCommand(action: string, params: string[]): Promise<void> {
    const message = params.join(' ');
    
    if (this.gateway) {
      // Use Gateway for intelligent routing
      const response = await this.gateway.chat([
        { role: 'user', content: message }
      ]);
      console.log(response.choices[0].message.content);
    } else {
      // Fallback to direct Ollama
      const ollama = new OllamaClient();
      const response = await ollama.invoke(message);
      console.log(response);
    }
  }
}
```

---

### 3. MCP Server

Exposes ANOTS capabilities as MCP tools for external agents.

```typescript
// src/mcp/MCPServer.ts

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

export class MCPServer {
  private server: Server;
  private services: Map<string, Service>;
  private tools: Map<string, MCPTool> = new Map();

  constructor(services: Map<string, Service>, port?: number) {
    this.services = services;
    this.server = new Server(
      {
        name: 'anots',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    this.registerTools();
  }

  private registerTools(): void {
    // Memory tools
    this.registerTool({
      name: 'anots/memory/search',
      description: 'ANOTS: Search semantic memory (Hive Mind)',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          limit: { type: 'number', description: 'Max results', default: 5 },
          filter: { type: 'object', description: 'Metadata filters' },
        },
        required: ['query'],
      },
      handler: async (args) => {
        const memoryService = new MemoryService(this.services);
        return await memoryService.search(args.query, args.limit, args.filter);
      },
    });

    this.registerTool({
      name: 'anots/memory/store',
      description: 'ANOTS: Store fact in semantic memory',
      inputSchema: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'Fact to store' },
          metadata: { type: 'object', description: 'Additional metadata' },
          source: { type: 'string', description: 'Source identifier' },
        },
        required: ['content'],
      },
      handler: async (args) => {
        const memoryService = new MemoryService(this.services);
        return await memoryService.store(args.content, args.metadata, args.source);
      },
    });

    // Chronicle tools
    this.registerTool({
      name: 'anots/chronicle/write',
      description: 'ANOTS: Write immutable Chronicle entry',
      inputSchema: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'Entry content (markdown)' },
          participants: { type: 'array', items: { type: 'string' } },
          sessionType: { type: 'string', description: 'Session type' },
          metadata: { type: 'object', description: 'Additional frontmatter' },
        },
        required: ['content', 'participants'],
      },
      handler: async (args) => {
        const chronicle = this.services.get('chronicle') as ChronicleService;
        return await chronicle.write(args.content, args.participants, args.sessionType, args.metadata);
      },
    });

    // Gateway tools (if available)
    if (this.services.has('gateway')) {
      this.registerTool({
        name: 'anots/gateway/chat',
        description: 'ANOTS: Route LLM request with intelligent routing',
        inputSchema: {
          type: 'object',
          properties: {
            messages: { type: 'array', items: { type: 'object' } },
            taskHint: { type: 'string', description: 'Task type hint' },
            temperature: { type: 'number', description: 'Temperature override' },
            maxTokens: { type: 'number', description: 'Max tokens override' },
          },
          required: ['messages'],
        },
        handler: async (args) => {
          const gateway = this.services.get('gateway') as Gateway;
          return await gateway.chat(args.messages, {
            taskHint: args.taskHint,
            temperature: args.temperature,
            maxTokens: args.maxTokens,
          });
        },
      });
    }

    // System tools
    this.registerTool({
      name: 'anots/system/list-tools',
      description: 'ANOTS: List all available MCP tools',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        return Array.from(this.tools.values()).map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        }));
      },
    });
  }

  private registerTool(tool: MCPTool): void {
    this.tools.set(tool.name, tool);
    
    this.server.setRequestHandler('tools/call', async (request) => {
      if (request.params.name === tool.name) {
        try {
          const result = await tool.handler(request.params.arguments);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: error.message,
                  tool: tool.name,
                }, null, 2),
              },
            ],
            isError: true,
          };
        }
      }
    });
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('MCP Server started on stdio');
  }

  async stop(): Promise<void> {
    await this.server.close();
  }
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: object;
  handler: (args: any) => Promise<any>;
}
```

---

### 4. Memory Service

Unified interface to all 4 memory layers with graceful degradation.

```typescript
// src/memory/MemoryService.ts

export class MemoryService {
  private chronicle: ChronicleService;
  private activeStream: ActiveStreamService;
  private hiveMind: HiveMindService;
  private codex: CodexService;

  constructor(services: Map<string, Service>) {
    this.chronicle = services.get('chronicle') as ChronicleService;
    this.activeStream = services.get('activeStream') as ActiveStreamService;
    this.hiveMind = services.get('hiveMind') as HiveMindService;
    this.codex = services.get('codex') as CodexService;
  }

  async search(query: string, limit: number = 5, filter?: object): Promise<SearchResult[]> {
    try {
      // Try Hive Mind (L3) first
      return await this.hiveMind.search(query, limit, filter);
    } catch (error) {
      console.warn('Hive Mind unavailable, falling back to Chronicle search');
      // Fallback to Chronicle (L1) text search
      return await this.chronicle.search(query, limit);
    }
  }

  async store(content: string, metadata?: object, source?: string): Promise<void> {
    try {
      // Store in Hive Mind (L3)
      await this.hiveMind.store(content, metadata, source);
    } catch (error) {
      console.warn('Hive Mind unavailable, storing in Chronicle only');
      // Fallback: write to Chronicle (L1)
      await this.chronicle.write(content, [source || 'system'], 'memory-store', metadata);
    }
  }

  async getContext(): Promise<string> {
    try {
      // Get from Active Stream (L2)
      return await this.activeStream.getContext();
    } catch (error) {
      console.warn('Active Stream unavailable, returning empty context');
      return '';
    }
  }

  async clearContext(): Promise<void> {
    try {
      await this.activeStream.clear();
    } catch (error) {
      console.warn('Active Stream unavailable, nothing to clear');
    }
  }

  async getHealth(): Promise<MemoryHealth> {
    return {
      chronicle: await this.chronicle.isHealthy(),
      activeStream: await this.activeStream.isHealthy(),
      hiveMind: await this.hiveMind.isHealthy(),
      codex: await this.codex.isHealthy(),
    };
  }
}

interface MemoryHealth {
  chronicle: boolean;
  activeStream: boolean;
  hiveMind: boolean;
  codex: boolean;
}
```

---

### 5. Agent System (Standalone Mode)

Manages Ubik and Axiom agents with LangGraph orchestration.

```typescript
// src/agents/AgentSystem.ts

import { StateGraph } from '@langchain/langgraph';

export class AgentSystem {
  private agents: Map<string, Agent> = new Map();
  private graph?: StateGraph;
  private services: Map<string, Service>;

  constructor(services: Map<string, Service>) {
    this.services = services;
  }

  async loadAgents(agentIds: string[]): Promise<void> {
    for (const id of agentIds) {
      const definition = await this.loadAgentDefinition(id);
      const agent = new Agent(definition, this.services);
      this.agents.set(id, agent);
    }
    
    await this.initializeOrchestration();
  }

  private async loadAgentDefinition(id: string): Promise<AgentDefinition> {
    const path = `src/agents/presets/${id}.yaml`;
    const content = await fs.readFile(path, 'utf-8');
    const raw = yaml.load(content);
    return AgentDefinitionSchema.parse(raw);
  }

  private async initializeOrchestration(): Promise<void> {
    this.graph = new StateGraph(ActiveStreamState);
    
    // Add node for each agent
    for (const [id, agent] of this.agents) {
      this.graph.addNode(id, async (state) => {
        return await agent.execute(state);
      });
    }
    
    // Simple round-robin edges
    const agentIds = Array.from(this.agents.keys());
    for (let i = 0; i < agentIds.length; i++) {
      const current = agentIds[i];
      const next = agentIds[(i + 1) % agentIds.length];
      this.graph.addEdge(current, next);
    }
    
    this.graph.setEntryPoint(agentIds[0]);
    
    console.log(`Agent orchestration initialized: ${agentIds.join(', ')}`);
  }

  async processMessage(message: string): Promise<string> {
    if (!this.graph) {
      throw new Error('Agent system not initialized');
    }
    
    const result = await this.graph.invoke({
      messages: [{ role: 'user', content: message }],
    });
    
    return result.messages[result.messages.length - 1].content;
  }
}
```

---

## Data Models

```typescript
// src/core/types.ts

export interface SearchResult {
  content: string;
  score: number;
  metadata?: Record<string, any>;
  source?: string;
}

export interface ChronicleEntry {
  chapterId: string;
  date: string;
  participants: string[];
  sessionType: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface AgentDefinition {
  id: string;
  name: string;
  role: string;
  personality?: string;
  modelPreference: {
    high_entropy: string;
    low_entropy: string;
  };
  memoryAccess: {
    chronicle: 'read' | 'write' | 'none';
    activeStream: 'read' | 'write';
    hiveMind: 'read' | 'write' | 'none';
    codex: 'read' | 'write' | 'none';
  };
  systemPrompt?: string;
}

export interface ActiveStreamState {
  messages: Array<{ role: string; content: string }>;
  currentAgent?: string;
  context: Record<string, any>;
}
```

---

## Testing Strategy

### Property-Based Tests

All 19 correctness properties from requirements.md will be tested using fast-check:

```typescript
// tests/properties/deployment.test.ts

import * as fc from 'fast-check';

// Feature: anots-unified, Property 1: Mode Validation
describe('Property 1: Mode Validation', () => {
  it('accepts valid modes or rejects with error', () => {
    fc.assert(
      fc.property(fc.string(), (mode) => {
        const validModes = ['cli', 'mcp-server', 'standalone'];
        
        if (validModes.includes(mode)) {
          // Should accept
          expect(() => validateMode(mode)).not.toThrow();
        } else {
          // Should reject with descriptive error
          expect(() => validateMode(mode)).toThrow(/Invalid deployment mode/);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: anots-unified, Property 3: Memory Search Idempotence
describe('Property 3: Memory Search Idempotence', () => {
  it('returns same results for same query', async () => {
    fc.assert(
      fc.asyncProperty(fc.string(), async (query) => {
        const memoryService = new MemoryService(services);
        
        const results1 = await memoryService.search(query);
        const results2 = await memoryService.search(query);
        
        expect(results1).toEqual(results2);
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: anots-unified, Property 17: Layer Failure Isolation
describe('Property 17: Layer Failure Isolation', () => {
  it('other layers continue when one fails', async () => {
    fc.assert(
      fc.asyncProperty(
        fc.constantFrom('chronicle', 'activeStream', 'hiveMind', 'codex'),
        async (failingLayer) => {
          // Simulate layer failure
          services.get(failingLayer).simulateFailure();
          
          // Other layers should still work
          const otherLayers = ['chronicle', 'activeStream', 'hiveMind', 'codex']
            .filter(l => l !== failingLayer);
          
          for (const layer of otherLayers) {
            const health = await services.get(layer).isHealthy();
            expect(health).toBe(true);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
```

### Integration Tests

```typescript
// tests/integration/cli-mode.test.ts

describe('CLI Mode Integration', () => {
  it('executes memory search command', async () => {
    const cli = new CLIInterface(services);
    await cli.executeCommand('memory', ['search', 'quantum computing']);
    // Verify output
  });

  it('executes chronicle write command', async () => {
    const cli = new CLIInterface(services);
    await cli.executeCommand('chronicle', ['write', 'Test entry']);
    // Verify file created
  });
});

// tests/integration/mcp-server.test.ts

describe('MCP Server Integration', () => {
  it('handles anots/memory/search tool call', async () => {
    const mcpServer = new MCPServer(services);
    await mcpServer.start();
    
    const result = await mcpClient.callTool('anots/memory/search', {
      query: 'test query',
      limit: 5,
    });
    
    expect(result).toHaveProperty('content');
  });
});
```

---

## Error Handling

### Graceful Degradation

Each component handles failures gracefully:

```typescript
// Example: Memory Service with fallbacks
async search(query: string): Promise<SearchResult[]> {
  try {
    return await this.hiveMind.search(query);
  } catch (error) {
    logger.warn('Hive Mind unavailable, falling back to Chronicle');
    try {
      return await this.chronicle.search(query);
    } catch (fallbackError) {
      logger.error('All memory layers unavailable');
      return [];
    }
  }
}
```

### Layer-Specific Errors

```typescript
class LayerUnavailableError extends Error {
  constructor(public layer: string, public reason: string) {
    super(`Memory layer ${layer} unavailable: ${reason}`);
    this.name = 'LayerUnavailableError';
  }
}
```

---

## Performance Considerations

### CLI Mode
- Commands execute synchronously
- File system operations are fast (< 10ms)
- No network overhead

### MCP Server Mode
- Async tool execution
- Connection pooling for Redis/Qdrant
- Response caching for repeated queries

### Standalone Mode
- LangGraph state checkpointing with Redis
- Parallel agent execution where possible
- Memory operations non-blocking

---

## Security

### MCP Server Authentication

```typescript
class MCPAuthMiddleware {
  private apiKeys: Set<string>;

  constructor(apiKeys: string[]) {
    this.apiKeys = new Set(apiKeys);
  }

  authenticate(request: MCPRequest): boolean {
    const authHeader = request.headers['authorization'];
    if (!authHeader) return false;
    
    const token = authHeader.replace('Bearer ', '');
    return this.apiKeys.has(token);
  }
}
```

### File System Security

```typescript
function validatePath(path: string, baseDir: string): void {
  const resolved = path.resolve(path);
  if (!resolved.startsWith(baseDir)) {
    throw new Error('Path traversal detected');
  }
}
```

---

## Deployment

### CLI Mode
```bash
npm install -g anots
anots memory search "quantum computing"
```

### MCP Server Mode
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

### Standalone Mode
```bash
export ANOTS_MODE=standalone
npm start
```

---

## Future Enhancements

### Phase 2
- Web UI for standalone mode
- OAuth2 authentication for MCP server
- Distributed memory (multi-node Chronicle)
- Agent marketplace (share custom agents)

### Phase 3
- Real-time collaboration (multiple users)
- Advanced orchestration patterns (hierarchical, supervisor)
- Performance analytics dashboard
- Cloud deployment templates (Docker, K8s)

