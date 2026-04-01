# ANOTS REST API Guide

Complete guide for using the ANOTS REST API to access memory layers and chat with Axiom.

## Quick Start

### Start API Server

```bash
cd anots-v1
npm run build

# Basic API (no Axiom)
node dist/cli/index.js api:start

# With Axiom chat endpoint
node dist/cli/index.js api:start --axiom

# Custom port
node dist/cli/index.js api:start --port 8080 --axiom
```

### Environment Configuration

```bash
# .env file
ANOTS_API_PORT=3001
ANOTS_API_HOST=0.0.0.0
ANOTS_API_ENABLE_AXIOM=true
CORS_ORIGINS=*

# For Axiom chat (requires Gateway)
ZAI_API_KEY=your-zai-api-key
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:9b-instruct-q4_K_M
```

---

## API Endpoints

### Health Check

**GET** `/api/health`

Check system health status.

**Response:**
```json
{
  "success": true,
  "data": {
    "overall": "healthy",
    "layers": {
      "chronicle": true,
      "activeStream": true,
      "hiveMind": true,
      "codex": true
    }
  }
}
```

**Example:**
```bash
curl http://localhost:3001/api/health
```

---

### Memory Search

**POST** `/api/memory/search`

Search across all 4 memory layers.

**Request Body:**
```json
{
  "query": "authentication implementation",
  "limit": 10
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "content": "Implemented MCP authentication...",
        "score": 0.95,
        "source": "chronicle",
        "metadata": {
          "date": "2026-04-02"
        }
      }
    ],
    "count": 10,
    "query": "authentication implementation"
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:3001/api/memory/search \
  -H "Content-Type: application/json" \
  -d '{"query": "MCP server", "limit": 5}'
```

---

### Memory Store

**POST** `/api/memory/store`

Store content in memory (Chronicle + Hive Mind).

**Request Body:**
```json
{
  "content": "Completed Phase 4 with 140 passing tests",
  "metadata": {
    "phase": "4",
    "status": "complete",
    "tests": 140
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Content stored successfully"
}
```

**Example:**
```bash
curl -X POST http://localhost:3001/api/memory/store \
  -H "Content-Type: application/json" \
  -d '{
    "content": "API server implementation complete",
    "metadata": {"type": "milestone"}
  }'
```

---

### Memory Statistics

**GET** `/api/memory/stats`

Get memory system statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "chronicle": {
      "chapterCount": 46,
      "totalEntries": 156
    },
    "activeStream": {
      "sessionCount": 3,
      "totalMessages": 87
    },
    "hiveMind": {
      "memoryCount": 128
    },
    "codex": {
      "ubikInitialized": true,
      "axiomInitialized": true
    }
  }
}
```

**Example:**
```bash
curl http://localhost:3001/api/memory/stats
```

---

### Chronicle Write

**POST** `/api/chronicle/write`

Write an immutable Chronicle entry.

**Request Body:**
```json
{
  "content": "Phase 4 complete. All MCP tools implemented and tested.",
  "participants": ["chip", "axiom"],
  "sessionType": "technical",
  "metadata": {
    "phase": "4",
    "tests": 140
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "chapterId": "2026-04-02-chip-axiom-technical",
    "date": "2026-04-02"
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:3001/api/chronicle/write \
  -H "Content-Type: application/json" \
  -d '{
    "content": "API implementation milestone",
    "participants": ["chip"],
    "sessionType": "general"
  }'
```

---

### Axiom Chat (Optional)

**POST** `/api/axiom/chat`

Chat with Axiom, the documentation-based assistant.

**Requirements:**
- API started with `--axiom` flag
- Gateway initialized (requires Z.ai or Ollama)

**Request Body:**
```json
{
  "message": "What is the MCP server?",
  "sessionId": "api-session-1"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "The MCP (Model Context Protocol) server is...",
    "agent": "axiom",
    "model": "glm-5-pro"
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:3001/api/axiom/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Explain the 4-layer memory system",
    "sessionId": "my-session"
  }'
```

**Axiom Behavior:**
- Only answers questions about ANOTS documentation
- Refuses questions outside documentation scope
- Analytical and precise responses
- Low temperature (0.3) for factual accuracy
- Stores all interactions in memory

---

## Error Handling

All endpoints return errors in consistent format:

```json
{
  "success": false,
  "error": "Error Type",
  "message": "Detailed error message",
  "details": {}
}
```

### HTTP Status Codes

- `200` - Success
- `400` - Validation Error (bad request)
- `500` - Internal Server Error
- `503` - Service Unavailable (degraded health)

### Example Error Response

```json
{
  "success": false,
  "error": "Validation Error",
  "details": [
    {
      "path": ["query"],
      "message": "Query cannot be empty"
    }
  ]
}
```

---

## Integration Examples

### JavaScript/TypeScript

```typescript
// Search memory
async function searchMemory(query: string) {
  const response = await fetch('http://localhost:3001/api/memory/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit: 10 }),
  });
  
  const data = await response.json();
  return data.data.results;
}

// Chat with Axiom
async function askAxiom(message: string) {
  const response = await fetch('http://localhost:3001/api/axiom/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  
  const data = await response.json();
  return data.data.message;
}

// Store content
async function storeMemory(content: string, metadata?: any) {
  const response = await fetch('http://localhost:3001/api/memory/store', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, metadata }),
  });
  
  return response.json();
}
```

### Python

```python
import requests

BASE_URL = "http://localhost:3001"

# Search memory
def search_memory(query: str, limit: int = 10):
    response = requests.post(
        f"{BASE_URL}/api/memory/search",
        json={"query": query, "limit": limit}
    )
    return response.json()["data"]["results"]

# Chat with Axiom
def ask_axiom(message: str, session_id: str = "python-client"):
    response = requests.post(
        f"{BASE_URL}/api/axiom/chat",
        json={"message": message, "sessionId": session_id}
    )
    return response.json()["data"]["message"]

# Store content
def store_memory(content: str, metadata: dict = None):
    response = requests.post(
        f"{BASE_URL}/api/memory/store",
        json={"content": content, "metadata": metadata}
    )
    return response.json()

# Example usage
if __name__ == "__main__":
    # Ask Axiom
    answer = ask_axiom("What is the Chronicle layer?")
    print(f"Axiom: {answer}")
    
    # Store the interaction
    store_memory(
        f"Asked Axiom about Chronicle. Answer: {answer}",
        {"type": "axiom-interaction"}
    )
    
    # Search for it
    results = search_memory("Chronicle layer", limit=5)
    print(f"Found {len(results)} results")
```

### cURL Examples

```bash
# Health check
curl http://localhost:3001/api/health

# Search
curl -X POST http://localhost:3001/api/memory/search \
  -H "Content-Type: application/json" \
  -d '{"query": "Phase 4", "limit": 5}'

# Store
curl -X POST http://localhost:3001/api/memory/store \
  -H "Content-Type: application/json" \
  -d '{"content": "Test entry", "metadata": {"test": true}}'

# Stats
curl http://localhost:3001/api/memory/stats

# Chronicle
curl -X POST http://localhost:3001/api/chronicle/write \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Milestone reached",
    "participants": ["chip"],
    "sessionType": "general"
  }'

# Axiom chat
curl -X POST http://localhost:3001/api/axiom/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is ANOTS?"}'
```

---

## Use Cases

### 1. Documentation Assistant

Use Axiom as a documentation chatbot:

```typescript
// Web app integration
async function documentationChat(userQuestion: string) {
  const response = await fetch('http://localhost:3001/api/axiom/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      message: userQuestion,
      sessionId: 'web-app-user-123'
    }),
  });
  
  const data = await response.json();
  return data.data.message;
}
```

### 2. Memory-Augmented Application

Build apps with persistent memory:

```typescript
// Store user interactions
async function logUserAction(action: string, details: any) {
  await fetch('http://localhost:3001/api/memory/store', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: `User action: ${action}`,
      metadata: { ...details, timestamp: new Date().toISOString() }
    }),
  });
}

// Search past interactions
async function findSimilarActions(query: string) {
  const response = await fetch('http://localhost:3001/api/memory/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit: 10 }),
  });
  
  return response.json();
}
```

### 3. Chronicle-Based Logging

Use Chronicle for immutable audit logs:

```typescript
async function logSystemEvent(event: string, participants: string[]) {
  await fetch('http://localhost:3001/api/chronicle/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: event,
      participants,
      sessionType: 'system',
      metadata: {
        timestamp: new Date().toISOString(),
        source: 'api-client'
      }
    }),
  });
}
```

---

## Security Considerations

### CORS Configuration

By default, API accepts requests from any origin (`*`). For production:

```bash
# .env
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

### Network Security

- API binds to `0.0.0.0` by default (all interfaces)
- For local-only access, use `127.0.0.1`:

```bash
ANOTS_API_HOST=127.0.0.1
```

### Rate Limiting

Currently no rate limiting. For production, add middleware:

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

### Authentication

Currently no authentication. For production, add API key middleware:

```typescript
app.use('/api/', (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

---

## Troubleshooting

### API Won't Start

1. Check port availability:
   ```bash
   # Windows
   netstat -ano | findstr :3001
   
   # Linux/Mac
   lsof -i :3001
   ```

2. Try different port:
   ```bash
   node dist/cli/index.js api:start --port 8080
   ```

### Axiom Chat Not Available

1. Verify `--axiom` flag:
   ```bash
   node dist/cli/index.js api:start --axiom
   ```

2. Check Gateway configuration:
   ```bash
   # Need either Z.ai or Ollama
   echo $ZAI_API_KEY
   echo $OLLAMA_BASE_URL
   ```

3. Test Gateway separately:
   ```bash
   node dist/cli/index.js status
   ```

### Memory Layers Unhealthy

1. Check health endpoint:
   ```bash
   curl http://localhost:3001/api/health
   ```

2. Verify data directory:
   ```bash
   ls -la data/
   ```

3. Check logs for errors

---

## Performance

### Benchmarks

- Health check: ~10ms
- Memory search: ~100-200ms
- Memory store: ~50-100ms
- Chronicle write: ~100-200ms
- Axiom chat: ~2-5 seconds (depends on LLM)

### Optimization Tips

1. **Use appropriate limits:**
   ```json
   {"query": "...", "limit": 10}  // Don't request 1000 results
   ```

2. **Batch operations:**
   ```typescript
   // Instead of multiple stores
   await Promise.all([
     store(content1),
     store(content2),
     store(content3)
   ]);
   ```

3. **Cache responses:**
   ```typescript
   const cache = new Map();
   
   async function cachedSearch(query: string) {
     if (cache.has(query)) return cache.get(query);
     const results = await search(query);
     cache.set(query, results);
     return results;
   }
   ```

---

## Next Steps

- See [MCP-CLIENT-EXAMPLES.md](./MCP-CLIENT-EXAMPLES.md) for MCP integration
- Read [WHITEPAPER-TCAM-v1.4.md](./WHITEPAPER-TCAM-v1.4.md) for architecture
- Check [README.md](../README.md) for project overview

---

**Document Status:** ✅ COMPLETE  
**Last Updated:** 2026-04-02  
**Version:** 1.0  
**Feature:** REST API with Axiom Chat
