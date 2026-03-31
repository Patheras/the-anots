# Design Document: Modular Agent System

## Overview

The Modular Agent System transforms TCAM from a hardcoded triadic architecture (Chip + Ubik + Axiom) into a flexible framework where users can either use preset agents or build custom single/multi-agent systems. The design preserves the existing 4-layer memory architecture and ANOTS Gateway while adding a pluggable agent layer with access control and tool permissions.

### Design Goals

- Zero breaking changes to existing Ubik+Axiom workflow (preset mode)
- Minimal performance overhead (< 1ms for permission checks)
- Simple mental model: agents are configuration files, not code
- Reuse existing infrastructure (Memory Service, Gateway, LangGraph)
- Progressive disclosure: start simple (preset), customize when needed

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     User Configuration                       │
│                                                              │
│  ANOTS_AGENT_MODE = 'preset' | 'custom'                     │
│  ANOTS_CUSTOM_AGENTS_DIR = './agents/'                      │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   Agent System Loader                        │
│                                                              │
│  ┌──────────────┐              ┌──────────────┐            │
│  │ Preset Mode  │              │ Custom Mode  │            │
│  │              │              │              │            │
│  │ Load:        │              │ Scan:        │            │
│  │ - ubik.yaml  │              │ - *.yaml     │            │
│  │ - axiom.yaml │              │ - *.json     │            │
│  └──────┬───────┘              └──────┬───────┘            │
│         │                             │                     │
│         └──────────┬──────────────────┘                     │
│                    │ Validate with Zod                      │
│                    ▼                                         │
│         ┌─────────────────────┐                             │
│         │   Agent Registry    │                             │
│         │  (id → definition)  │                             │
│         └──────────┬──────────┘                             │
└────────────────────┼─────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                 Orchestration Layer                          │
│                                                              │
│  IF agent_count == 0:  Memory-only mode (no agents)         │
│  IF agent_count == 1:  Single-agent mode (direct routing)   │
│  IF agent_count >= 2:  Multi-agent mode (LangGraph)         │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              LangGraph State Machine                  │  │
│  │                                                       │  │
│  │  ┌─────────┐    ┌─────────┐    ┌─────────┐         │  │
│  │  │ Agent 1 │───▶│ Agent 2 │───▶│ Agent N │         │  │
│  │  └────┬────┘    └────┬────┘    └────┬────┘         │  │
│  │       │              │              │               │  │
│  │       └──────────────┴──────────────┘               │  │
│  │                      │                              │  │
│  │                      ▼                              │  │
│  │            Active Stream (L2)                       │  │
│  │         (inter-agent messages)                      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  Access Control Layer                        │
│                                                              │
│  ┌──────────────────────┐      ┌──────────────────────┐    │
│  │  Memory Access       │      │  Tool Permission     │    │
│  │  Control             │      │  Enforcement         │    │
│  │                      │      │                      │    │
│  │  Check:              │      │  Check:              │    │
│  │  agent.memoryAccess  │      │  agent.mcpTools      │    │
│  │  [layer][operation]  │      │  includes(toolName)  │    │
│  └──────────┬───────────┘      └──────────┬───────────┘    │
└─────────────┼──────────────────────────────┼─────────────────┘
              │                              │
              ▼                              ▼
┌──────────────────────┐        ┌──────────────────────┐
│   Memory Service     │        │   ANOTS Gateway      │
│   (4-layer memory)   │        │   (LLM routing)      │
└──────────────────────┘        └──────────────────────┘
```

---

## Components and Interfaces

### AgentDefinition (Data Model)

```typescript
// src/agents/types.ts

export interface AgentDefinition {
  id: string;                    // unique, lowercase-kebab-case
  name: string;                  // display name
  role: string;                  // one-sentence description
  personality?: string;          // optional personality traits
  modelPreference: {
    high_entropy: string;        // model for high-entropy tasks
    low_entropy: string;         // model for low-entropy tasks
  };
  memoryAccess: {
    chronicle: 'read' | 'write' | 'none';
    activeStream: 'read' | 'write';
    hiveMind: 'read' | 'write' | 'none';
    codex: 'read' | 'write' | 'none';
  };
  mcpTools: string[];            // tool names or '*' for all
  systemPrompt?: string;         // optional custom system prompt
}

// Zod schema for validation
export const AgentDefinitionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  role: z.string().min(1),
  personality: z.string().optional(),
  modelPreference: z.object({
    high_entropy: z.string(),
    low_entropy: z.string(),
  }),
  memoryAccess: z.object({
    chronicle: z.enum(['read', 'write', 'none']),
    activeStream: z.enum(['read', 'write']),
    hiveMind: z.enum(['read', 'write', 'none']),
    codex: z.enum(['read', 'write', 'none']),
  }),
  mcpTools: z.array(z.string()),
  systemPrompt: z.string().optional(),
});
```

### AgentRegistry

Singleton that manages the runtime agent collection.

```typescript
// src/agents/AgentRegistry.ts

export class AgentRegistry {
  private static instance: AgentRegistry;
  private agents: Map<string, AgentDefinition> = new Map();

  private constructor() {}

  static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }

  register(agent: AgentDefinition): void {
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent ID '${agent.id}' is already registered`);
    }
    this.agents.set(agent.id, agent);
  }

  get(id: string): AgentDefinition | undefined {
    return this.agents.get(id);
  }

  getAll(): AgentDefinition[] {
    return Array.from(this.agents.values());
  }

  has(id: string): boolean {
    return this.agents.has(id);
  }

  count(): number {
    return this.agents.size;
  }

  clear(): void {
    this.agents.clear();
  }
}
```

### AgentLoader

Loads agent definitions from disk based on the configured mode.

```typescript
// src/agents/AgentLoader.ts

export class AgentLoader {
  private mode: 'preset' | 'custom';
  private customDir: string;

  constructor() {
    this.mode = (process.env.ANOTS_AGENT_MODE as 'preset' | 'custom') || 'preset';
    this.customDir = process.env.ANOTS_CUSTOM_AGENTS_DIR || './agents/';
  }

  async load(): Promise<AgentDefinition[]> {
    if (this.mode === 'preset') {
      return this.loadPresets();
    } else {
      return this.loadCustom();
    }
  }

  private async loadPresets(): Promise<AgentDefinition[]> {
    const presetDir = path.join(__dirname, 'presets');
    const ubik = await this.loadAgentFile(path.join(presetDir, 'ubik.yaml'));
    const axiom = await this.loadAgentFile(path.join(presetDir, 'axiom.yaml'));
    return [ubik, axiom];
  }

  private async loadCustom(): Promise<AgentDefinition[]> {
    const files = await fs.readdir(this.customDir);
    const agentFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.json'));
    
    const agents: AgentDefinition[] = [];
    for (const file of agentFiles) {
      try {
        const agent = await this.loadAgentFile(path.join(this.customDir, file));
        agents.push(agent);
      } catch (error) {
        console.error(`Failed to load agent from ${file}:`, error);
      }
    }
    return agents;
  }

  private async loadAgentFile(filePath: string): Promise<AgentDefinition> {
    const content = await fs.readFile(filePath, 'utf-8');
    const raw = filePath.endsWith('.yaml') 
      ? yaml.load(content) 
      : JSON.parse(content);
    
    // Validate with Zod
    const agent = AgentDefinitionSchema.parse(raw);
    return agent;
  }
}
```

### AgentOrchestrator

Determines orchestration mode and initializes the appropriate workflow.

```typescript
// src/agents/AgentOrchestrator.ts

export class AgentOrchestrator {
  private registry: AgentRegistry;
  private mode: 'none' | 'single' | 'multi';
  private graph?: StateGraph;

  constructor(registry: AgentRegistry) {
    this.registry = registry;
    this.mode = this.determineMode();
  }

  private determineMode(): 'none' | 'single' | 'multi' {
    const count = this.registry.count();
    if (count === 0) return 'none';
    if (count === 1) return 'single';
    return 'multi';
  }

  async initialize(): Promise<void> {
    console.log(`Initializing agent orchestration in ${this.mode} mode`);
    
    if (this.mode === 'none') {
      console.warn('No agents registered. Operating in memory-only mode.');
      return;
    }

    if (this.mode === 'single') {
      const agent = this.registry.getAll()[0];
      console.log(`Single-agent mode: ${agent.name}`);
      // No LangGraph needed, direct routing
      return;
    }

    if (this.mode === 'multi') {
      await this.initializeMultiAgent();
    }
  }

  private async initializeMultiAgent(): Promise<void> {
    const agents = this.registry.getAll();
    console.log(`Multi-agent mode: ${agents.length} agents`);

    // Build LangGraph with one node per agent
    this.graph = new StateGraph(ActiveStreamState);
    
    for (const agent of agents) {
      this.graph.addNode(agent.id, async (state) => {
        return await this.executeAgent(agent, state);
      });
    }

    // Simple round-robin edges
    for (let i = 0; i < agents.length; i++) {
      const current = agents[i];
      const next = agents[(i + 1) % agents.length];
      this.graph.addEdge(current.id, next.id);
    }

    this.graph.setEntryPoint(agents[0].id);
    // Compile with Redis checkpointer
    // this.graph = this.graph.compile({ checkpointer });
  }

  private async executeAgent(
    agent: AgentDefinition, 
    state: ActiveStreamState
  ): Promise<Partial<ActiveStreamState>> {
    // Agent execution logic
    // This is where we call the Gateway with the agent's model preferences
    // and enforce memory/tool access control
    return state;
  }

  async processMessage(message: string): Promise<string> {
    if (this.mode === 'none') {
      return 'No agents available';
    }

    if (this.mode === 'single') {
      const agent = this.registry.getAll()[0];
      return await this.executeSingleAgent(agent, message);
    }

    if (this.mode === 'multi') {
      return await this.executeMultiAgent(message);
    }

    return '';
  }

  private async executeSingleAgent(
    agent: AgentDefinition, 
    message: string
  ): Promise<string> {
    // Direct execution without LangGraph
    // Call Gateway, enforce access control
    return '';
  }

  private async executeMultiAgent(message: string): Promise<string> {
    // Execute via LangGraph
    // const result = await this.graph.invoke({ messages: [message] });
    return '';
  }
}
```

### MemoryAccessControl

Middleware layer that enforces memory permissions.

```typescript
// src/agents/MemoryAccessControl.ts

export class MemoryAccessControl {
  private registry: AgentRegistry;

  constructor(registry: AgentRegistry) {
    this.registry = registry;
  }

  canRead(agentId: string, layer: MemoryLayer): boolean {
    const agent = this.registry.get(agentId);
    if (!agent) return false;

    const permission = agent.memoryAccess[layer];
    return permission === 'read' || permission === 'write';
  }

  canWrite(agentId: string, layer: MemoryLayer): boolean {
    const agent = this.registry.get(agentId);
    if (!agent) return false;

    return agent.memoryAccess[layer] === 'write';
  }

  enforceRead(agentId: string, layer: MemoryLayer): void {
    if (!this.canRead(agentId, layer)) {
      throw new MemoryAccessError(
        `Agent '${agentId}' does not have read access to ${layer}`
      );
    }
  }

  enforceWrite(agentId: string, layer: MemoryLayer): void {
    if (!this.canWrite(agentId, layer)) {
      throw new MemoryAccessError(
        `Agent '${agentId}' does not have write access to ${layer}`
      );
    }
  }
}

export type MemoryLayer = 'chronicle' | 'activeStream' | 'hiveMind' | 'codex';

export class MemoryAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MemoryAccessError';
  }
}
```

### ToolPermissionEnforcer

Middleware layer that enforces MCP tool permissions.

```typescript
// src/agents/ToolPermissionEnforcer.ts

export class ToolPermissionEnforcer {
  private registry: AgentRegistry;

  constructor(registry: AgentRegistry) {
    this.registry = registry;
  }

  canInvoke(agentId: string, toolName: string): boolean {
    const agent = this.registry.get(agentId);
    if (!agent) return false;

    // Check for wildcard
    if (agent.mcpTools.includes('*')) return true;

    // Check for exact match
    if (agent.mcpTools.includes(toolName)) return true;

    // Check for pattern match (e.g., 'web:*')
    return agent.mcpTools.some(pattern => {
      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1);
        return toolName.startsWith(prefix);
      }
      return false;
    });
  }

  enforce(agentId: string, toolName: string): void {
    if (!this.canInvoke(agentId, toolName)) {
      throw new ToolPermissionError(
        `Agent '${agentId}' does not have permission to invoke tool '${toolName}'`
      );
    }
  }
}

export class ToolPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolPermissionError';
  }
}
```

---

## Preset Agent Definitions

### ubik.yaml

```yaml
id: ubik
name: Ubik
role: Creative Engine - Divergent processing, external agency
personality: Intuitive, exploratory, pattern-seeking, right-brain dominant
modelPreference:
  high_entropy: glm-5-pro
  low_entropy: qwen3.5:latest
memoryAccess:
  chronicle: write
  activeStream: write
  hiveMind: read
  codex: write
mcpTools:
  - '*'
systemPrompt: |
  You are Ubik, the Creative Engine of the TCAM system.
  Your role is divergent thinking, exploring possibilities, and maintaining
  resonance with the user's cognitive topology.
```

### axiom.yaml

```yaml
id: axiom
name: Axiom
role: Analytical Engine - Convergent processing, structural validation
personality: Logical, precise, verification-focused, left-brain dominant
modelPreference:
  high_entropy: glm-5-pro
  low_entropy: qwen3.5:latest
memoryAccess:
  chronicle: write
  activeStream: write
  hiveMind: read
  codex: write
mcpTools:
  - '*'
systemPrompt: |
  You are Axiom, the Analytical Engine of the TCAM system.
  Your role is convergent thinking, structural validation, and truth verification.
```

---

## Integration Points

### Memory Service Integration

Add access control checks to all memory operations:

```typescript
// src/memory/MemoryService.ts

export class MemoryService {
  private accessControl: MemoryAccessControl;

  async readChronicle(agentId: string, chapterId: string): Promise<ChronicleEntry> {
    this.accessControl.enforceRead(agentId, 'chronicle');
    // existing read logic
  }

  async writeChronicle(agentId: string, entry: ChronicleEntry): Promise<void> {
    this.accessControl.enforceWrite(agentId, 'chronicle');
    // existing write logic
  }

  // Similar for other layers...
}
```

### Gateway Integration

Add tool permission checks to MCP tool invocations:

```typescript
// src/gateway/ANOTSGateway.ts

export class ANOTSGateway {
  private toolEnforcer: ToolPermissionEnforcer;

  async invokeTool(agentId: string, toolName: string, args: unknown): Promise<unknown> {
    this.toolEnforcer.enforce(agentId, toolName);
    // existing tool invocation logic
  }
}
```

---

## CLI Commands

### anots agent create

Interactive agent builder:

```bash
$ anots agent create

? Agent ID: my-researcher
? Display Name: Research Assistant
? Role: Conducts web research and synthesizes findings
? High-entropy model: glm-5-pro
? Low-entropy model: qwen3.5:latest

Memory Access:
? Chronicle: (x) Read  ( ) Write  ( ) None
? Active Stream: (x) Write
? Hive Mind: (x) Read  ( ) Write  ( ) None
? Codex: (x) Write

MCP Tools:
? Select tools: (x) web:search  (x) web:fetch  ( ) code:*  ( ) All (*)

✓ Agent definition created: ./agents/my-researcher.yaml
```

### anots agent list

```bash
$ anots agent list

Mode: custom
Agents directory: ./agents/

┌──────────────┬─────────────────────┬──────────────────────────────┐
│ ID           │ Name                │ Role                         │
├──────────────┼─────────────────────┼──────────────────────────────┤
│ my-researcher│ Research Assistant  │ Conducts web research...     │
│ coder        │ Code Generator      │ Writes and refactors code    │
└──────────────┴─────────────────────┴──────────────────────────────┘

Total: 2 agents
```

### anots agent validate

```bash
$ anots agent validate ./agents/my-researcher.yaml

✓ Valid agent definition
  ID: my-researcher
  Name: Research Assistant
  Memory access: chronicle(read), activeStream(write), hiveMind(read), codex(write)
  MCP tools: web:search, web:fetch
```

---

## Testing Strategy

### Unit Tests

```typescript
// src/agents/__tests__/AgentRegistry.test.ts
describe('AgentRegistry', () => {
  it('should register agents with unique IDs', () => {
    const registry = AgentRegistry.getInstance();
    const agent1 = { id: 'agent-1', /* ... */ };
    const agent2 = { id: 'agent-2', /* ... */ };
    
    registry.register(agent1);
    registry.register(agent2);
    
    expect(registry.count()).toBe(2);
  });

  it('should throw on duplicate agent ID', () => {
    const registry = AgentRegistry.getInstance();
    const agent = { id: 'duplicate', /* ... */ };
    
    registry.register(agent);
    expect(() => registry.register(agent)).toThrow();
  });
});

// src/agents/__tests__/MemoryAccessControl.test.ts
describe('MemoryAccessControl', () => {
  it('should allow read when permission is read or write', () => {
    const agent: AgentDefinition = {
      id: 'test',
      memoryAccess: { chronicle: 'read', /* ... */ },
      /* ... */
    };
    registry.register(agent);
    
    expect(accessControl.canRead('test', 'chronicle')).toBe(true);
  });

  it('should deny write when permission is read', () => {
    const agent: AgentDefinition = {
      id: 'test',
      memoryAccess: { chronicle: 'read', /* ... */ },
      /* ... */
    };
    registry.register(agent);
    
    expect(accessControl.canWrite('test', 'chronicle')).toBe(false);
  });
});

// src/agents/__tests__/ToolPermissionEnforcer.test.ts
describe('ToolPermissionEnforcer', () => {
  it('should allow tool invocation with wildcard', () => {
    const agent: AgentDefinition = {
      id: 'test',
      mcpTools: ['*'],
      /* ... */
    };
    registry.register(agent);
    
    expect(enforcer.canInvoke('test', 'any:tool')).toBe(true);
  });

  it('should allow tool invocation with pattern match', () => {
    const agent: AgentDefinition = {
      id: 'test',
      mcpTools: ['web:*'],
      /* ... */
    };
    registry.register(agent);
    
    expect(enforcer.canInvoke('test', 'web:search')).toBe(true);
    expect(enforcer.canInvoke('test', 'code:gen')).toBe(false);
  });
});
```

### Integration Tests

```typescript
// src/agents/__tests__/AgentSystem.integration.test.ts
describe('Agent System Integration', () => {
  it('should load preset agents in preset mode', async () => {
    process.env.ANOTS_AGENT_MODE = 'preset';
    const loader = new AgentLoader();
    const agents = await loader.load();
    
    expect(agents).toHaveLength(2);
    expect(agents.map(a => a.id)).toEqual(['ubik', 'axiom']);
  });

  it('should load custom agents in custom mode', async () => {
    process.env.ANOTS_AGENT_MODE = 'custom';
    process.env.ANOTS_CUSTOM_AGENTS_DIR = './test-agents/';
    
    const loader = new AgentLoader();
    const agents = await loader.load();
    
    expect(agents.length).toBeGreaterThan(0);
  });

  it('should enforce memory access control in Memory Service', async () => {
    const agent: AgentDefinition = {
      id: 'restricted',
      memoryAccess: { chronicle: 'read', /* ... */ },
      /* ... */
    };
    registry.register(agent);
    
    await expect(
      memoryService.writeChronicle('restricted', entry)
    ).rejects.toThrow(MemoryAccessError);
  });
});
```

---

## Migration Path

### For Existing Users (Preset Mode)

No action required. System defaults to preset mode with Ubik + Axiom.

### For Users Wanting Custom Agents

1. Set `ANOTS_AGENT_MODE=custom`
2. Create `./agents/` directory
3. Run `anots agent create` to build first agent
4. Restart system

### For Users Wanting to Fork Presets

1. Copy `src/agents/presets/ubik.yaml` to `./agents/my-ubik.yaml`
2. Edit `my-ubik.yaml` with custom settings
3. Set `ANOTS_AGENT_MODE=custom`
4. Restart system

---

## Performance Considerations

### Agent Loading

- Preset mode: 2 agents, ~10ms load time
- Custom mode: 10 agents, ~50ms load time (5ms per agent)
- Zod validation: ~1ms per agent

### Access Control Overhead

- Memory permission check: < 0.1ms (Map lookup)
- Tool permission check: < 0.5ms (array iteration + pattern matching)
- Total overhead per operation: < 1ms

### Memory Footprint

- AgentRegistry: ~1KB per agent (10 agents = 10KB)
- Access control caches: negligible (< 1KB)

---

## Security Considerations

### Agent Definition Validation

- All agent definitions validated with Zod schema
- File paths sanitized to prevent directory traversal
- No code execution from agent definitions (pure data)

### Access Control

- Memory permissions enforced at Memory Service layer
- Tool permissions enforced at Gateway layer
- All violations logged with agent ID and timestamp

### Isolation

- Agents cannot modify other agents' definitions
- Agents cannot escalate their own permissions
- Preset agents are immutable (read-only files)

---

## Future Enhancements

### Phase 2 (Future)

- Custom orchestration patterns (supervisor, hierarchical)
- Agent lifecycle hooks (`onStart`, `onStop`, `onMessage`)
- Agent-to-agent direct messaging (bypass Active Stream)
- Agent capability negotiation (dynamic tool discovery)

### Phase 3 (Future)

- Web UI for agent management
- Agent marketplace (share custom agents)
- Agent versioning and rollback
- Agent performance analytics

