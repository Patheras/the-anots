# MCP Client Configuration Examples

This guide shows how to connect various MCP clients (Claude Desktop, Cline, Cursor) to the ANOTS MCP server.

## Prerequisites

1. ANOTS MCP server must be running:
   ```bash
   cd anots-v1
   npm run build
   node dist/cli/index.js mcp:start
   ```

2. For authentication (optional):
   ```bash
   # With auth enabled
   node dist/cli/index.js mcp:start --auth --keys your-secret-key
   
   # Or via environment
   export ANOTS_MCP_AUTH_ENABLED=true
   export ANOTS_MCP_API_KEYS=key1,key2,key3
   node dist/cli/index.js mcp:start
   ```

---

## Claude Desktop

Claude Desktop uses a JSON configuration file to connect to MCP servers.

### Configuration File Location

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

### Basic Configuration (No Auth)

```json
{
  "mcpServers": {
    "anots": {
      "command": "node",
      "args": [
        "D:/AIAIAIAI/ANOTS/anots-v1/dist/cli/index.js",
        "mcp:start"
      ],
      "env": {
        "ANOTS_DATA_DIR": "D:/AIAIAIAI/ANOTS/anots-v1/data"
      }
    }
  }
}
```

### With Authentication

```json
{
  "mcpServers": {
    "anots": {
      "command": "node",
      "args": [
        "D:/AIAIAIAI/ANOTS/anots-v1/dist/cli/index.js",
        "mcp:start",
        "--auth",
        "--keys",
        "your-secret-key-here"
      ],
      "env": {
        "ANOTS_DATA_DIR": "D:/AIAIAIAI/ANOTS/anots-v1/data"
      }
    }
  }
}
```

### Multiple Environments

```json
{
  "mcpServers": {
    "anots-dev": {
      "command": "node",
      "args": [
        "/path/to/anots-v1/dist/cli/index.js",
        "mcp:start"
      ],
      "env": {
        "ANOTS_DATA_DIR": "/path/to/anots-v1/data-dev"
      }
    },
    "anots-prod": {
      "command": "node",
      "args": [
        "/path/to/anots-v1/dist/cli/index.js",
        "mcp:start",
        "--auth",
        "--keys",
        "prod-secret-key"
      ],
      "env": {
        "ANOTS_DATA_DIR": "/path/to/anots-v1/data-prod"
      }
    }
  }
}
```

---

## Cline (VS Code Extension)

Cline is a VS Code extension that supports MCP servers.

### Configuration

1. Open VS Code Settings (Ctrl+, or Cmd+,)
2. Search for "Cline MCP"
3. Add server configuration:

```json
{
  "cline.mcpServers": {
    "anots": {
      "command": "node",
      "args": [
        "${workspaceFolder}/anots-v1/dist/cli/index.js",
        "mcp:start"
      ],
      "env": {
        "ANOTS_DATA_DIR": "${workspaceFolder}/anots-v1/data"
      }
    }
  }
}
```

### With Authentication

```json
{
  "cline.mcpServers": {
    "anots": {
      "command": "node",
      "args": [
        "${workspaceFolder}/anots-v1/dist/cli/index.js",
        "mcp:start",
        "--auth",
        "--keys",
        "your-secret-key"
      ],
      "env": {
        "ANOTS_DATA_DIR": "${workspaceFolder}/anots-v1/data"
      }
    }
  }
}
```

### Workspace-Specific Configuration

Create `.vscode/settings.json` in your workspace:

```json
{
  "cline.mcpServers": {
    "anots": {
      "command": "node",
      "args": [
        "${workspaceFolder}/anots-v1/dist/cli/index.js",
        "mcp:start"
      ],
      "env": {
        "ANOTS_DATA_DIR": "${workspaceFolder}/anots-v1/data",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

---

## Cursor

Cursor IDE has built-in MCP support.

### Configuration File Location

- **macOS**: `~/.cursor/mcp_config.json`
- **Windows**: `%USERPROFILE%\.cursor\mcp_config.json`
- **Linux**: `~/.cursor/mcp_config.json`

### Basic Configuration

```json
{
  "mcpServers": {
    "anots": {
      "command": "node",
      "args": [
        "D:/AIAIAIAI/ANOTS/anots-v1/dist/cli/index.js",
        "mcp:start"
      ],
      "cwd": "D:/AIAIAIAI/ANOTS/anots-v1",
      "env": {
        "ANOTS_DATA_DIR": "./data"
      }
    }
  }
}
```

### With Authentication

```json
{
  "mcpServers": {
    "anots": {
      "command": "node",
      "args": [
        "D:/AIAIAIAI/ANOTS/anots-v1/dist/cli/index.js",
        "mcp:start",
        "--auth",
        "--keys",
        "cursor-secret-key"
      ],
      "cwd": "D:/AIAIAIAI/ANOTS/anots-v1",
      "env": {
        "ANOTS_DATA_DIR": "./data"
      }
    }
  }
}
```

### Project-Specific Configuration

Create `.cursor/mcp_config.json` in your project root:

```json
{
  "mcpServers": {
    "anots-local": {
      "command": "node",
      "args": [
        "./anots-v1/dist/cli/index.js",
        "mcp:start"
      ],
      "cwd": "${workspaceFolder}",
      "env": {
        "ANOTS_DATA_DIR": "./anots-v1/data",
        "ANOTS_MODE": "mcp-server"
      }
    }
  }
}
```

---

## Available MCP Tools

Once connected, you'll have access to 19 MCP tools across 5 categories:

### Memory Tools (8 tools)
- `anots/memory/search` - Search across all memory layers
- `anots/memory/store` - Store content in memory
- `anots/memory/get-context` - Get active stream context
- `anots/memory/update-context` - Update active stream context
- `anots/memory/clear-context` - Clear active stream context
- `anots/memory/list-sessions` - List active stream sessions
- `anots/memory/stats` - Get memory statistics
- `anots/memory/health` - Check memory layer health

### Chronicle Tools (4 tools)
- `anots/chronicle/write` - Write to chronicle (immutable log)
- `anots/chronicle/read` - Read chronicle chapter
- `anots/chronicle/list` - List chronicle chapters
- `anots/chronicle/search` - Search chronicle

### Codex Tools (5 tools)
- `anots/codex/read` - Read agent codex file
- `anots/codex/write` - Update agent codex
- `anots/codex/list` - List codex files
- `anots/codex/init` - Initialize agent codex
- `anots/codex/read-full` - Read full codex structure

### System Tools (2 tools)
- `anots/system/health` - Check system health
- `anots/system/list-tools` - List available tools

---

## Testing Your Connection

### 1. List Available Tools

Ask your MCP client:
```
Can you list all available ANOTS tools?
```

Expected response should show 19 tools across 5 categories.

### 2. Check System Health

```
Use anots/system/health to check if all memory layers are operational
```

Expected response:
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

### 3. Store and Retrieve Memory

```
Use anots/memory/store to save: "Testing MCP connection from Claude Desktop"
```

Then:
```
Use anots/memory/search to find: "MCP connection"
```

---

## Troubleshooting

### Server Not Starting

1. Check if Node.js is installed:
   ```bash
   node --version  # Should be v18 or higher
   ```

2. Verify build is up to date:
   ```bash
   cd anots-v1
   npm run build
   ```

3. Test server manually:
   ```bash
   node dist/cli/index.js mcp:start
   ```

### Authentication Errors

If you see "Authentication required" errors:

1. Verify API key is correct
2. Check environment variables:
   ```bash
   echo $ANOTS_MCP_AUTH_ENABLED
   echo $ANOTS_MCP_API_KEYS
   ```

3. Try disabling auth for testing:
   ```bash
   node dist/cli/index.js mcp:start  # No --auth flag
   ```

### Path Issues

- Use absolute paths in production configs
- Use `${workspaceFolder}` for workspace-relative paths
- On Windows, use forward slashes or escaped backslashes

### Memory Layer Failures

If some memory layers show as unhealthy:

1. Check data directory exists:
   ```bash
   ls -la anots-v1/data
   ```

2. Verify permissions:
   ```bash
   # Should be readable/writable
   chmod -R 755 anots-v1/data
   ```

3. Check external services (optional):
   - Redis: `redis-cli ping`
   - Qdrant: `curl http://localhost:6333/health`

---

## Advanced Configuration

### Custom Data Directory

```json
{
  "mcpServers": {
    "anots": {
      "command": "node",
      "args": ["./dist/cli/index.js", "mcp:start"],
      "env": {
        "ANOTS_DATA_DIR": "/custom/path/to/data",
        "ANOTS_MODE": "mcp-server"
      }
    }
  }
}
```

### Debug Logging

```json
{
  "mcpServers": {
    "anots": {
      "command": "node",
      "args": ["./dist/cli/index.js", "mcp:start"],
      "env": {
        "LOG_LEVEL": "debug",
        "ANOTS_DATA_DIR": "./data"
      }
    }
  }
}
```

### Multiple API Keys

```bash
# Environment variable
export ANOTS_MCP_API_KEYS=key1,key2,key3

# Or in config
node dist/cli/index.js mcp:start --auth --keys key1,key2,key3
```

---

## Security Best Practices

1. **Use Authentication in Production**
   - Always enable auth for production deployments
   - Use strong, randomly generated API keys
   - Rotate keys regularly

2. **Protect API Keys**
   - Never commit API keys to version control
   - Use environment variables or secure vaults
   - Different keys for different environments

3. **Limit Access**
   - Use separate keys for different clients
   - Revoke compromised keys immediately
   - Monitor access logs

4. **Network Security**
   - MCP server uses stdio transport (local only)
   - No network exposure by default
   - For remote access, use SSH tunneling

---

## Next Steps

- Read [WHITEPAPER-TCAM-v1.4.md](./WHITEPAPER-TCAM-v1.4.md) for architecture details
- See [SETUP.md](../SETUP.md) for installation guide
- Check [README.md](../README.md) for project overview
- Explore [MCP Tools Documentation](./MCP-TOOLS.md) for detailed tool specs

---

**Document Status:** ✅ COMPLETE  
**Last Updated:** 2026-04-02  
**Version:** 1.0  
**Task:** 4.8 - MCP Client Examples
