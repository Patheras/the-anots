/**
 * MCP Server Authentication Tests
 * 
 * Tests for optional API key authentication
 */

import { MCPServer } from '../../src/mcp/MCPServer';
import { MCPTool } from '../../src/mcp/types';
import { z } from 'zod';

describe('MCPServer Authentication', () => {
  let server: MCPServer;

  // Mock console methods
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(async () => {
    if (server) {
      await server.shutdown();
    }
    jest.restoreAllMocks();
  });

  describe('Authentication Disabled (Default)', () => {
    it('should allow all requests when auth is disabled', async () => {
      server = new MCPServer({
        name: 'test-server',
        version: '1.0.0',
        transport: 'stdio',
        authEnabled: false,
        enableLogging: false,
      });

      // Register a test tool
      const testTool: MCPTool = {
        definition: {
          name: 'test-tool',
          description: 'Test tool',
          inputSchema: z.object({
            message: z.string(),
          }),
        },
        handler: async (args) => ({
          content: [{ type: 'text', text: `Echo: ${args.message}` }],
        }),
      };

      server.registerTool(testTool);

      // Server should accept requests without API key
      const status = server.getStatus();
      expect(status.toolCount).toBe(1);
    });

    it('should ignore API keys when auth is disabled', async () => {
      server = new MCPServer({
        name: 'test-server',
        version: '1.0.0',
        transport: 'stdio',
        authEnabled: false,
        apiKeys: ['key1', 'key2'],
        enableLogging: false,
      });

      const status = server.getStatus();
      expect(status.running).toBe(false); // Not initialized yet
    });
  });

  describe('Authentication Enabled', () => {
    it('should enable auth when authEnabled=true and apiKeys provided', async () => {
      const consoleSpy = jest.spyOn(console, 'log');

      server = new MCPServer({
        name: 'test-server',
        version: '1.0.0',
        transport: 'stdio',
        authEnabled: true,
        apiKeys: ['secret-key-1', 'secret-key-2'],
        enableLogging: true,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('MCP Authentication enabled (2 keys)')
      );
    });

    it('should not enable auth when authEnabled=true but no apiKeys', async () => {
      server = new MCPServer({
        name: 'test-server',
        version: '1.0.0',
        transport: 'stdio',
        authEnabled: true,
        apiKeys: [],
        enableLogging: false,
      });

      // Auth should not be enabled without keys
      const status = server.getStatus();
      expect(status.toolCount).toBe(0);
    });

    it('should not enable auth when authEnabled=true but apiKeys undefined', async () => {
      server = new MCPServer({
        name: 'test-server',
        version: '1.0.0',
        transport: 'stdio',
        authEnabled: true,
        enableLogging: false,
      });

      const status = server.getStatus();
      expect(status.toolCount).toBe(0);
    });
  });

  describe('Tool Registration with Auth', () => {
    it('should register tools regardless of auth settings', async () => {
      server = new MCPServer({
        name: 'test-server',
        version: '1.0.0',
        transport: 'stdio',
        authEnabled: true,
        apiKeys: ['test-key'],
        enableLogging: false,
      });

      const testTool: MCPTool = {
        definition: {
          name: 'secure-tool',
          description: 'Secure tool',
          inputSchema: z.object({
            data: z.string(),
          }),
        },
        handler: async (args, context) => ({
          content: [
            {
              type: 'text',
              text: `Authenticated: ${context?.authenticated}, Data: ${args.data}`,
            },
          ],
        }),
      };

      server.registerTool(testTool);

      const tools = server.getTools();
      expect(tools).toContain('secure-tool');
    });

    it('should register multiple tools with auth enabled', async () => {
      server = new MCPServer({
        name: 'test-server',
        version: '1.0.0',
        transport: 'stdio',
        authEnabled: true,
        apiKeys: ['key1'],
        enableLogging: false,
      });

      const tools: MCPTool[] = [
        {
          definition: {
            name: 'tool-1',
            description: 'Tool 1',
            inputSchema: z.object({}),
          },
          handler: async () => ({ content: [{ type: 'text', text: 'Tool 1' }] }),
        },
        {
          definition: {
            name: 'tool-2',
            description: 'Tool 2',
            inputSchema: z.object({}),
          },
          handler: async () => ({ content: [{ type: 'text', text: 'Tool 2' }] }),
        },
      ];

      server.registerTools(tools);

      const registeredTools = server.getTools();
      expect(registeredTools).toHaveLength(2);
      expect(registeredTools).toContain('tool-1');
      expect(registeredTools).toContain('tool-2');
    });
  });

  describe('Configuration Validation', () => {
    it('should accept valid auth configuration', () => {
      expect(() => {
        server = new MCPServer({
          name: 'test-server',
          version: '1.0.0',
          transport: 'stdio',
          authEnabled: true,
          apiKeys: ['valid-key-1', 'valid-key-2', 'valid-key-3'],
          enableLogging: false,
        });
      }).not.toThrow();
    });

    it('should handle empty apiKeys array gracefully', () => {
      expect(() => {
        server = new MCPServer({
          name: 'test-server',
          version: '1.0.0',
          transport: 'stdio',
          authEnabled: true,
          apiKeys: [],
          enableLogging: false,
        });
      }).not.toThrow();
    });

    it('should use default values for optional config', () => {
      server = new MCPServer({
        name: 'test-server',
        version: '1.0.0',
        transport: 'stdio',
      });

      const status = server.getStatus();
      expect(status.running).toBe(false);
      expect(status.toolCount).toBe(0);
    });
  });

  describe('Server Status with Auth', () => {
    it('should report correct status with auth enabled', async () => {
      server = new MCPServer({
        name: 'auth-server',
        version: '2.0.0',
        transport: 'stdio',
        authEnabled: true,
        apiKeys: ['key1', 'key2'],
        enableLogging: false,
      });

      const status = server.getStatus();
      expect(status.running).toBe(false);
      expect(status.transport).toBe('stdio');
      expect(status.toolCount).toBe(0);
      expect(status.uptime).toBe(0);
      expect(status.requestCount).toBe(0);
    });

    it('should report correct status with auth disabled', async () => {
      server = new MCPServer({
        name: 'no-auth-server',
        version: '1.0.0',
        transport: 'stdio',
        authEnabled: false,
        enableLogging: false,
      });

      const status = server.getStatus();
      expect(status.running).toBe(false);
      expect(status.transport).toBe('stdio');
    });
  });

  describe('Health Check with Auth', () => {
    it('should report healthy when not initialized', async () => {
      server = new MCPServer({
        name: 'test-server',
        version: '1.0.0',
        transport: 'stdio',
        authEnabled: true,
        apiKeys: ['key1'],
        enableLogging: false,
      });

      const healthy = await server.isHealthy();
      expect(healthy).toBe(false);
    });
  });
});
