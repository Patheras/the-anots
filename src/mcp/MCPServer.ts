/**
 * MCP Server
 * 
 * Model Context Protocol server implementation
 * Provides tools for memory, chronicle, and gateway operations
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import { Service } from '../core/types';
import {
  MCPServerConfig,
  MCPTool,
  MCPServerStatus,
} from './types';

export class MCPServer implements Service {
  name = 'MCPServer';
  private server: Server;
  private transport: StdioServerTransport | null = null;
  private tools: Map<string, MCPTool> = new Map();
  private initialized = false;
  private startTime: number = 0;
  private requestCount: number = 0;
  private config: MCPServerConfig;

  constructor(config: MCPServerConfig) {
    this.config = {
      enableLogging: true,
      ...config,
    };

    // Create MCP server instance
    this.server = new Server(
      {
        name: config.name,
        version: config.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  /**
   * Setup MCP protocol handlers
   */
  private setupHandlers(): void {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: Tool[] = Array.from(this.tools.values()).map(tool => ({
        name: tool.definition.name,
        description: tool.definition.description,
        inputSchema: this.zodToJsonSchema(tool.definition.inputSchema),
      }));

      return { tools };
    });

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
      this.requestCount++;

      const toolName = request.params.name;
      const tool = this.tools.get(toolName);

      if (!tool) {
        return {
          content: [
            {
              type: 'text',
              text: `Tool not found: ${toolName}`,
            },
          ],
          isError: true,
        };
      }

      try {
        // Validate input with Zod schema
        const validatedArgs = tool.definition.inputSchema.parse(request.params.arguments);

        // Execute tool handler
        const response = await tool.handler(validatedArgs);

        if (this.config.enableLogging) {
          console.log(`✓ Tool executed: ${toolName}`);
        }

        return response;
      } catch (error) {
        if (this.config.enableLogging) {
          console.error(`✗ Tool error: ${toolName}`, error);
        }

        return {
          content: [
            {
              type: 'text',
              text: `Tool execution failed: ${(error as Error).message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * Register a tool
   */
  registerTool(tool: MCPTool): void {
    this.tools.set(tool.definition.name, tool);

    if (this.config.enableLogging) {
      console.log(`Registered tool: ${tool.definition.name}`);
    }
  }

  /**
   * Register multiple tools
   */
  registerTools(tools: MCPTool[]): void {
    tools.forEach(tool => this.registerTool(tool));
  }

  /**
   * Initialize and start the server
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.config.transport === 'stdio') {
      // Use stdio transport for local connections
      this.transport = new StdioServerTransport();
      await this.server.connect(this.transport);

      if (this.config.enableLogging) {
        console.log('✓ MCP Server started (stdio transport)');
      }
    } else {
      throw new Error('HTTP transport not yet implemented');
    }

    this.startTime = Date.now();
    this.initialized = true;
  }

  /**
   * Shutdown the server
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    await this.server.close();
    this.initialized = false;

    if (this.config.enableLogging) {
      console.log('✓ MCP Server stopped');
    }
  }

  /**
   * Check if server is healthy
   */
  async isHealthy(): Promise<boolean> {
    return this.initialized;
  }

  /**
   * Get server status
   */
  getStatus(): MCPServerStatus {
    return {
      running: this.initialized,
      transport: this.config.transport,
      toolCount: this.tools.size,
      uptime: this.initialized ? Date.now() - this.startTime : 0,
      requestCount: this.requestCount,
    };
  }

  /**
   * Get registered tools
   */
  getTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Convert Zod schema to JSON Schema
   * Simplified version - MCP SDK expects JSON Schema format
   */
  private zodToJsonSchema(_schema: any): any {
    // This is a simplified conversion
    // In production, use a library like zod-to-json-schema
    return {
      type: 'object',
      properties: {},
      required: [],
    };
  }
}
