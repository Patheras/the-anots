# ANOTS MCP Tools Documentation

Complete reference for all 19 MCP tools provided by the ANOTS server.

## Table of Contents

- [Memory Tools](#memory-tools) (8 tools)
- [Chronicle Tools](#chronicle-tools) (4 tools)
- [Codex Tools](#codex-tools) (5 tools)
- [System Tools](#system-tools) (2 tools)

---

## Memory Tools

### anots/memory/search

Search across all 4 memory layers (Chronicle, Active Stream, Hive Mind, Codex).

**Input Schema:**
```typescript
{
  query: string;      // Search query
  limit?: number;     // Max results (default: 20)
}
```

**Example:**
```json
{
  "query": "authentication implementation",
  "limit": 10
}
```

**Response:**
```json
{
  "results": [
    {
      "content": "Added optional API key authentication...",
      "score": 0.95,
      "source": "chronicle",
      "metadata": {
        "chapterId": "2026-04-02-chip-axiom-general",
        "date": "2026-04-02"
      }
    }
  ],
  "totalResults": 10
}
```

---

### anots/memory/store

Store content in memory (writes to Chronicle L1 and Hive Mind L3).

**Input Schema:**
```typescript
{
  content: string;                    // Content to store
  metadata?: Record<string, any>;     // Optional metadata
}
```

**Example:**
```json
{
  "content": "Implemented MCP authentication with API keys",
  "metadata": {
    "task": "4.7",
    "category": "security",
    "author": "chip"
  }
}
```

**Response:**
```json
{
  "success": true,
  "chronicleId": "2026-04-02-chip-general",
  "hiveMindId": "mem_abc123"
}
```

---

### anots/memory/get-context

Get active stream context for a session (L2 working memory).

**Input Schema:**
```typescript
{
  sessionId?: string;  // Session ID (default: "default")
}
```

**Example:**
```json
{
  "sessionId": "session-a"
}
```

**Response:**
```json
{
  "sessionId": "session-a",
  "messages": [
    {
      "role": "user",
      "content": "Implement authentication"
    },
    {
      "role": "assistant",
      "content": "I'll add API key auth..."
    }
  ],
  "context": {
    "currentTask": "4.7",
    "lastUpdate": "2026-04-02T10:30:00Z"
  }
}
```

---

### anots/memory/update-context

Update active stream context (append messages or update context).

**Input Schema:**
```typescript
{
  sessionId?: string;                 // Session ID (default: "default")
  messages?: Array<{                  // Messages to append
    role: string;
    content: string;
  }>;
  context?: Record<string, any>;      // Context to merge
}
```

**Example:**
```json
{
  "sessionId": "session-a",
  "messages": [
    {
      "role": "user",
      "content": "Add tests for auth"
    }
  ],
  "context": {
    "currentTask": "4.7",
    "testsAdded": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "session-a",
  "messageCount": 5,
  "contextKeys": ["currentTask", "testsAdded", "lastUpdate"]
}
```

---

### anots/memory/clear-context

Clear active stream context for a session.

**Input Schema:**
```typescript
{
  sessionId?: string;  // Session ID (default: "default")
}
```

**Example:**
```json
{
  "sessionId": "session-a"
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "session-a",
  "cleared": true
}
```

---

### anots/memory/list-sessions

List all active stream sessions.

**Input Schema:**
```typescript
{}  // No parameters
```

**Response:**
```json
{
  "sessions": [
    {
      "sessionId": "default",
      "messageCount": 10,
      "lastUpdate": "2026-04-02T10:30:00Z"
    },
    {
      "sessionId": "session-a",
      "messageCount": 5,
      "lastUpdate": "2026-04-02T09:15:00Z"
    }
  ],
  "totalSessions": 2
}
```

---

### anots/memory/stats

Get memory system statistics.

**Input Schema:**
```typescript
{}  // No parameters
```

**Response:**
```json
{
  "chronicle": {
    "chapterCount": 42,
    "totalEntries": 156,
    "oldestEntry": "2026-03-01",
    "newestEntry": "2026-04-02"
  },
  "activeStream": {
    "sessionCount": 3,
    "totalMessages": 87
  },
  "hiveMind": {
    "memoryCount": 128,
    "vectorCount": 128
  },
  "codex": {
    "ubikInitialized": true,
    "axiomInitialized": true,
    "totalFiles": 12
  }
}
```

---

### anots/memory/health

Check health status of all memory layers.

**Input Schema:**
```typescript
{}  // No parameters
```

**Response:**
```json
{
  "overall": "healthy",
  "layers": {
    "chronicle": true,
    "activeStream": true,
    "hiveMind": true,
    "codex": true
  }
}
```

---

## Chronicle Tools

### anots/chronicle/write

Write an entry to the Chronicle (immutable historical record).

**Input Schema:**
```typescript
{
  content: string;                    // Entry content
  participants: string[];             // Participants (e.g., ["chip", "axiom"])
  sessionType: string;                // Type: general, ubik, axiom, collaboration, etc.
  metadata?: {
    truthsCount?: number;
    durationMinutes?: number;
    [key: string]: any;
  };
}
```

**Example:**
```json
{
  "content": "Implemented MCP authentication with 13 passing tests...",
  "participants": ["chip", "axiom"],
  "sessionType": "technical",
  "metadata": {
    "task": "4.7",
    "testsAdded": 13,
    "durationMinutes": 45
  }
}
```

**Response:**
```json
{
  "success": true,
  "chapterId": "2026-04-02-chip-axiom-technical",
  "filePath": "data/chronicle/chip/technical/2026-04-02-chip-axiom-technical.md"
}
```

---

### anots/chronicle/read

Read a specific Chronicle chapter.

**Input Schema:**
```typescript
{
  chapterId: string;  // Chapter ID (e.g., "2026-04-02-chip-axiom-technical")
}
```

**Example:**
```json
{
  "chapterId": "2026-04-02-chip-axiom-technical"
}
```

**Response:**
```json
{
  "chapterId": "2026-04-02-chip-axiom-technical",
  "date": "2026-04-02",
  "participants": ["chip", "axiom"],
  "sessionType": "technical",
  "content": "# Chronicle Entry\n\n## Session Details\n...",
  "metadata": {
    "task": "4.7",
    "testsAdded": 13
  }
}
```

---

### anots/chronicle/list

List Chronicle chapters (optionally filtered by type).

**Input Schema:**
```typescript
{
  sessionType?: string;  // Filter by type (general, ubik, axiom, etc.)
  limit?: number;        // Max results (default: 50)
}
```

**Example:**
```json
{
  "sessionType": "technical",
  "limit": 10
}
```

**Response:**
```json
{
  "chapters": [
    {
      "chapterId": "2026-04-02-chip-axiom-technical",
      "date": "2026-04-02",
      "participants": ["chip", "axiom"],
      "sessionType": "technical",
      "preview": "Implemented MCP authentication..."
    }
  ],
  "totalChapters": 10
}
```

---

### anots/chronicle/search

Search Chronicle entries.

**Input Schema:**
```typescript
{
  query: string;      // Search query
  limit?: number;     // Max results (default: 20)
}
```

**Example:**
```json
{
  "query": "authentication",
  "limit": 5
}
```

**Response:**
```json
{
  "results": [
    {
      "chapterId": "2026-04-02-chip-axiom-technical",
      "date": "2026-04-02",
      "participants": ["chip", "axiom"],
      "content": "Implemented MCP authentication...",
      "score": 0.95
    }
  ],
  "totalResults": 5
}
```

---

## Codex Tools

### anots/codex/read

Read a specific codex file for an agent.

**Input Schema:**
```typescript
{
  agent: "ubik" | "axiom";  // Agent name
  file: string;             // File name (README, TASKS, NOTES, etc.)
}
```

**Example:**
```json
{
  "agent": "axiom",
  "file": "TASKS"
}
```

**Response:**
```json
{
  "agent": "axiom",
  "file": "TASKS",
  "content": "# Axiom Tasks\n\n## Current Tasks\n...",
  "lastUpdated": "2026-04-02T10:30:00Z"
}
```

---

### anots/codex/write

Update a codex file (with Git versioning).

**Input Schema:**
```typescript
{
  agent: "ubik" | "axiom";  // Agent name
  file: string;             // File name
  content: string;          // New content
  operation: "append" | "replace" | "update";  // Operation type
  commitMessage?: string;   // Git commit message
}
```

**Example:**
```json
{
  "agent": "axiom",
  "file": "TASKS",
  "content": "\n## Task 4.7\n- [x] Implement MCP authentication",
  "operation": "append",
  "commitMessage": "Add Task 4.7 completion"
}
```

**Response:**
```json
{
  "success": true,
  "agent": "axiom",
  "file": "TASKS",
  "operation": "append",
  "gitCommit": "abc123def",
  "filePath": "data/codex/axiom/TASKS.md"
}
```

---

### anots/codex/list

List all codex files for an agent.

**Input Schema:**
```typescript
{
  agent: "ubik" | "axiom";  // Agent name
}
```

**Example:**
```json
{
  "agent": "ubik"
}
```

**Response:**
```json
{
  "agent": "ubik",
  "files": [
    {
      "name": "README.md",
      "size": 2048,
      "lastModified": "2026-04-02T10:30:00Z"
    },
    {
      "name": "TASKS.md",
      "size": 1024,
      "lastModified": "2026-04-01T15:20:00Z"
    }
  ],
  "totalFiles": 6
}
```

---

### anots/codex/init

Initialize codex for an agent (creates directory structure and Git repo).

**Input Schema:**
```typescript
{
  agent: "ubik" | "axiom";  // Agent name
}
```

**Example:**
```json
{
  "agent": "ubik"
}
```

**Response:**
```json
{
  "success": true,
  "agent": "ubik",
  "filesCreated": [
    "README.md",
    "TASKS.md",
    "NOTES.md",
    "CONTEXT.md",
    "SYNTHETIC-DIARY.md",
    "TOOLS.md"
  ],
  "gitInitialized": true,
  "path": "data/codex/ubik"
}
```

---

### anots/codex/read-full

Read entire codex structure for an agent.

**Input Schema:**
```typescript
{
  agent: "ubik" | "axiom";  // Agent name
}
```

**Example:**
```json
{
  "agent": "axiom"
}
```

**Response:**
```json
{
  "agent": "axiom",
  "identity": "# Axiom Identity\n\nAnalytical Engine...",
  "tasks": "# Axiom Tasks\n\n## Current Tasks\n...",
  "notes": "# Axiom Notes\n\n...",
  "context": "# Axiom Context\n\n...",
  "diary": "# Axiom Synthetic Diary\n\n...",
  "tools": "# Axiom Tools\n\n...",
  "lastUpdated": "2026-04-02T10:30:00Z"
}
```

---

## System Tools

### anots/system/health

Check health status of all system components.

**Input Schema:**
```typescript
{}  // No parameters
```

**Response:**
```json
{
  "overall": "healthy",
  "layers": {
    "chronicle": {
      "status": "healthy",
      "details": "46 chapters available"
    },
    "activeStream": {
      "status": "healthy",
      "details": "3 active sessions"
    },
    "hiveMind": {
      "status": "healthy",
      "details": "128 memories (file fallback)"
    },
    "codex": {
      "status": "healthy",
      "details": "ubik and axiom initialized"
    }
  },
  "timestamp": "2026-04-02T10:30:00Z"
}
```

---

### anots/system/list-tools

List all available MCP tools (with optional category filter).

**Input Schema:**
```typescript
{
  category?: "memory" | "chronicle" | "gateway" | "codex" | "system" | "all";
}
```

**Example:**
```json
{
  "category": "memory"
}
```

**Response:**
```json
{
  "category": "memory",
  "tools": [
    {
      "name": "anots/memory/search",
      "description": "Search across all memory layers",
      "category": "memory"
    },
    {
      "name": "anots/memory/store",
      "description": "Store content in memory",
      "category": "memory"
    }
  ],
  "totalTools": 8,
  "categories": {
    "memory": 8,
    "chronicle": 4,
    "codex": 5,
    "system": 2
  }
}
```

---

## Error Handling

All tools return errors in a consistent format:

```json
{
  "error": true,
  "message": "Detailed error message",
  "code": "ERROR_CODE",
  "details": {
    "additionalInfo": "..."
  }
}
```

### Common Error Codes

- `INVALID_INPUT` - Input validation failed
- `NOT_FOUND` - Resource not found
- `PERMISSION_DENIED` - Authentication failed
- `LAYER_UNAVAILABLE` - Memory layer not available
- `OPERATION_FAILED` - Operation failed

---

## Best Practices

### 1. Memory Operations

- Use `anots/memory/search` for cross-layer queries
- Use `anots/chronicle/write` for important events
- Use `anots/memory/store` for general content
- Clear active stream context when starting new tasks

### 2. Chronicle Usage

- Write to Chronicle for significant milestones
- Include meaningful metadata (task IDs, durations, etc.)
- Use appropriate session types (technical, collaboration, etc.)
- Search Chronicle for historical context

### 3. Codex Management

- Update codex regularly with agent learnings
- Use Git commit messages for traceability
- Read full codex before major decisions
- Keep TASKS.md synchronized with actual work

### 4. System Monitoring

- Check health before critical operations
- Monitor memory stats for capacity planning
- List tools to discover new capabilities
- Use debug logging for troubleshooting

---

## Integration Examples

### Example 1: Task Completion Workflow

```typescript
// 1. Store task completion
await mcpClient.callTool("anots/memory/store", {
  content: "Completed Task 4.7: MCP Authentication",
  metadata: {
    task: "4.7",
    status: "complete",
    tests: 13
  }
});

// 2. Write to Chronicle
await mcpClient.callTool("anots/chronicle/write", {
  content: "Task 4.7 complete. Added API key auth with 13 tests.",
  participants: ["chip", "axiom"],
  sessionType: "technical",
  metadata: { task: "4.7" }
});

// 3. Update Codex
await mcpClient.callTool("anots/codex/write", {
  agent: "axiom",
  file: "TASKS",
  content: "\n- [x] Task 4.7: MCP Authentication",
  operation: "append",
  commitMessage: "Mark Task 4.7 complete"
});
```

### Example 2: Context-Aware Search

```typescript
// 1. Get current context
const context = await mcpClient.callTool("anots/memory/get-context", {
  sessionId: "current-task"
});

// 2. Search with context
const results = await mcpClient.callTool("anots/memory/search", {
  query: `${context.context.currentTask} implementation details`,
  limit: 10
});

// 3. Update context with findings
await mcpClient.callTool("anots/memory/update-context", {
  sessionId: "current-task",
  context: {
    searchResults: results.totalResults,
    lastSearch: new Date().toISOString()
  }
});
```

---

## Next Steps

- See [MCP-CLIENT-EXAMPLES.md](./MCP-CLIENT-EXAMPLES.md) for client setup
- Read [WHITEPAPER-TCAM-v1.4.md](./WHITEPAPER-TCAM-v1.4.md) for architecture
- Check [SETUP.md](../SETUP.md) for installation
- Explore [README.md](../README.md) for project overview

---

**Document Status:** ✅ COMPLETE  
**Last Updated:** 2026-04-02  
**Version:** 1.0  
**Task:** 4.8 - MCP Tools Documentation
