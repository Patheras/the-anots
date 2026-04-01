/**
 * MCP Server Tests
 * 
 * Tests for Model Context Protocol server
 */

import { MCPServer } from '../../src/mcp/MCPServer';
import { MCPTool } from '../../src/mcp/types';
import { z } from 'zod';

// Mock console methods
const originalLog = console.log;
const originalError = console.error;

describe('MCPServer', () => {
  let server: MCPServer;
  
  beforeEach(() => {
    server = new MCPServer({
      name: 'test-server',
      version: '1.0.0',
      transport: 'stdio',
      enableLogging: false, // Disable logging in tests
    });
    
    // Mock console
    console.log = jest.fn();
    console.error = jest.fn();
  });
  
  afterEach(async () => {
    if (await server.isHealthy()) {
      await server.shutdown();
    }
    console.log = originalLog;
    console.error = originalError;
  });
  
  describe('Server Lifecycle', () => {
    it('should initialize successfully', async () => {
      await server.initialize();
      
      const isHealthy = await server.isHealthy();
      expect(isHealthy).toBe(true);
    });
    
    it('should shutdown successfully', async () => {
      await server.initialize();
      await server.shutdown();
      
      const isHealthy = await server.isHealthy();
      expect(isHealthy).toBe(false);
    });
    
    it('should not initialize twice', async () => {
      await server.initialize();
      await server.initialize(); // Should be idempotent
      
      const isHealthy = await server.isHealthy();
      expect(isHealthy).toBe(true);
    });
    
    it('should handle shutdown when not initialized', async () => {
      await server.shutdown(); // Should not throw
      
      const isHealthy = await server.isHealthy();
      expect(isHealthy).toBe(false);
    });
  });
  
  describe('Tool Registration', () => {
    it('should register a tool', () => {
      const tool: MCPTool = {
        definition: {
          name: 'test-tool',
          description: 'A test tool',
          inputSchema: z.object({
            message: z.string(),
          }),
        },
        handler: async (args) => ({
          content: [{ type: 'text', text: `Echo: ${args.message}` }],
        }),
      };
      
      server.registerTool(tool);
      
      const tools = server.getTools();
      expect(tools).toContain('test-tool');
    });
    
    it('should register multiple tools', () => {
      const tools: MCPTool[] = [
        {
          definition: {
            name: 'tool-1',
            description: 'Tool 1',
            inputSchema: z.object({}),
          },
          handler: async () => ({ content: [] }),
        },
        {
          definition: {
            name: 'tool-2',
            description: 'Tool 2',
            inputSchema: z.object({}),
          },
          handler: async () => ({ content: [] }),
        },
      ];
      
      server.registerTools(tools);
      
      const registeredTools = server.getTools();
      expect(registeredTools).toContain('tool-1');
      expect(registeredTools).toContain('tool-2');
    });
  });
  
  describe('Server Status', () => {
    it('should return correct status when not running', () => {
      const status = server.getStatus();
      
      expect(status.running).toBe(false);
      expect(status.transport).toBe('stdio');
      expect(status.toolCount).toBe(0);
      expect(status.uptime).toBe(0);
      expect(status.requestCount).toBe(0);
    });
    
    it('should return correct status when running', async () => {
      await server.initialize();
      
      // Small delay to ensure uptime > 0
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const status = server.getStatus();
      
      expect(status.running).toBe(true);
      expect(status.transport).toBe('stdio');
      expect(status.uptime).toBeGreaterThan(0);
    });
    
    it('should track tool count', () => {
      const tool: MCPTool = {
        definition: {
          name: 'test-tool',
          description: 'Test',
          inputSchema: z.object({}),
        },
        handler: async () => ({ content: [] }),
      };
      
      server.registerTool(tool);
      
      const status = server.getStatus();
      expect(status.toolCount).toBe(1);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle invalid transport', async () => {
      const invalidServer = new MCPServer({
        name: 'test',
        version: '1.0.0',
        transport: 'http' as any,
      });
      
      await expect(invalidServer.initialize()).rejects.toThrow('HTTP transport not yet implemented');
    });
  });
  
  describe('Health Check', () => {
    it('should return false when not initialized', async () => {
      const isHealthy = await server.isHealthy();
      expect(isHealthy).toBe(false);
    });
    
    it('should return true when initialized', async () => {
      await server.initialize();
      const isHealthy = await server.isHealthy();
      expect(isHealthy).toBe(true);
    });
    
    it('should return false after shutdown', async () => {
      await server.initialize();
      await server.shutdown();
      const isHealthy = await server.isHealthy();
      expect(isHealthy).toBe(false);
    });
  });
});
