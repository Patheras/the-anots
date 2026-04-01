/**
 * MCP Server Types
 * 
 * Type definitions for Model Context Protocol server
 */

import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * MCP Transport types
 */
export type MCPTransport = 'stdio' | 'http';

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
  name: string;
  version: string;
  transport: MCPTransport;
  port?: number; // For HTTP transport
  enableLogging?: boolean;
}

/**
 * MCP Tool definition
 */
export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<any>;
}

/**
 * MCP Tool handler - uses CallToolResult from SDK
 */
export type MCPToolHandler = (args: any, clientId?: string) => Promise<CallToolResult>;

/**
 * MCP Tool registration
 */
export interface MCPTool {
  definition: MCPToolDefinition;
  handler: MCPToolHandler;
}

/**
 * MCP Server status
 */
export interface MCPServerStatus {
  running: boolean;
  transport: MCPTransport;
  toolCount: number;
  uptime: number;
  requestCount: number;
}
