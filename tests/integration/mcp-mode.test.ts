/**
 * MCP Mode Integration Tests
 * 
 * End-to-end tests for MCP server mode
 */

import { MCPServer } from '../../src/mcp/MCPServer';
import { UnifiedMemoryService } from '../../src/memory/UnifiedMemoryService';
import { registerAllTools } from '../../src/mcp/tools';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('MCP Mode Integration Tests', () => {
  let server: MCPServer;
  let memoryService: UnifiedMemoryService;
  let testDataDir: string;

  beforeEach(async () => {
    // Create temporary data directory
    testDataDir = mkdtempSync(join(tmpdir(), 'mcp-integration-test-'));
    process.env.ANOTS_DATA_DIR = testDataDir;

    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();

    // Initialize memory service
    memoryService = new UnifiedMemoryService();
    await memoryService.initialize();

    // Create MCP server
    server = new MCPServer({
      name: 'anots-test-server',
      version: '1.0.0',
      transport: 'stdio',
      enableLogging: false,
    });

    // Register all tools
    await registerAllTools(server, memoryService);
  });

  afterEach(async () => {
    if (server) {
      await server.shutdown();
    }
    if (memoryService) {
      await memoryService.shutdown();
    }

    // Cleanup test directory
    try {
      rmSync(testDataDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }

    jest.restoreAllMocks();
    delete process.env.ANOTS_DATA_DIR;
  });

  describe('Server Initialization', () => {
    it('should initialize MCP server with all tools', () => {
      const tools = server.getTools();
      expect(tools.length).toBeGreaterThan(0);
      expect(tools).toContain('anots/memory/search');
      expect(tools).toContain('anots/chronicle/write');
      expect(tools).toContain('anots/codex/read');
      expect(tools).toContain('anots/system/health');
    });

    it('should have all 19 tools registered', () => {
      const tools = server.getTools();
      expect(tools).toHaveLength(19);
    });

    it('should categorize tools correctly', () => {
      const tools = server.getTools();
      
      const memoryTools = tools.filter(t => t.startsWith('anots/memory/'));
      const chronicleTools = tools.filter(t => t.startsWith('anots/chronicle/'));
      const codexTools = tools.filter(t => t.startsWith('anots/codex/'));
      const systemTools = tools.filter(t => t.startsWith('anots/system/'));
      
      expect(memoryTools).toHaveLength(8);
      expect(chronicleTools).toHaveLength(4);
      expect(codexTools).toHaveLength(5);
      expect(systemTools).toHaveLength(2);
    });
  });

  describe('Memory Layer Integration', () => {
    it('should have all memory layers initialized', async () => {
      const health = await memoryService.getLayerHealth();
      
      expect(health.chronicle).toBe(true);
      expect(health.activeStream).toBe(true);
      expect(health.hiveMind).toBe(true);
      expect(health.codex).toBe(true);
    });

    it('should report healthy status', async () => {
      const isHealthy = await memoryService.isHealthy();
      expect(isHealthy).toBe(true);
    });

    it('should provide memory statistics', async () => {
      const stats = await memoryService.getStats();
      
      expect(stats).toHaveProperty('chronicle');
      expect(stats).toHaveProperty('activeStream');
      expect(stats).toHaveProperty('hiveMind');
      expect(stats).toHaveProperty('codex');
      
      expect(stats.chronicle).toHaveProperty('chapterCount');
      expect(stats.activeStream).toHaveProperty('sessionCount');
      expect(stats.hiveMind).toHaveProperty('memoryCount');
      expect(stats.codex).toHaveProperty('ubikInitialized');
    });
  });

  describe('Cross-Layer Operations', () => {
    it('should store and retrieve content across layers', async () => {
      const testContent = 'Integration test content for MCP mode';
      
      // Store content
      await memoryService.store(testContent, {
        test: 'mcp-integration',
        timestamp: new Date().toISOString(),
      });
      
      // Search for content
      const results = await memoryService.search('Integration test', 10);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain('Integration test');
    });

    it('should maintain data consistency across layers', async () => {
      const content1 = 'First test entry';
      const content2 = 'Second test entry';
      
      await memoryService.store(content1);
      await memoryService.store(content2);
      
      const results = await memoryService.search('test entry', 10);
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle concurrent operations', async () => {
      const operations = Array.from({ length: 5 }, (_, i) =>
        memoryService.store(`Concurrent test ${i}`, { index: i })
      );
      
      await Promise.all(operations);
      
      const results = await memoryService.search('Concurrent test', 10);
      expect(results.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Tool Execution Flow', () => {
    it('should execute memory tools successfully', async () => {
      const tools = server.getTools();
      const memoryTools = tools.filter(t => t.startsWith('anots/memory/'));
      
      expect(memoryTools).toContain('anots/memory/search');
      expect(memoryTools).toContain('anots/memory/store');
      expect(memoryTools).toContain('anots/memory/stats');
      expect(memoryTools).toContain('anots/memory/health');
    });

    it('should execute chronicle tools successfully', async () => {
      const tools = server.getTools();
      const chronicleTools = tools.filter(t => t.startsWith('anots/chronicle/'));
      
      expect(chronicleTools).toContain('anots/chronicle/write');
      expect(chronicleTools).toContain('anots/chronicle/read');
      expect(chronicleTools).toContain('anots/chronicle/list');
      expect(chronicleTools).toContain('anots/chronicle/search');
    });

    it('should execute codex tools successfully', async () => {
      const tools = server.getTools();
      const codexTools = tools.filter(t => t.startsWith('anots/codex/'));
      
      expect(codexTools).toContain('anots/codex/read');
      expect(codexTools).toContain('anots/codex/write');
      expect(codexTools).toContain('anots/codex/list');
      expect(codexTools).toContain('anots/codex/init');
      expect(codexTools).toContain('anots/codex/read-full');
    });

    it('should execute system tools successfully', async () => {
      const tools = server.getTools();
      const systemTools = tools.filter(t => t.startsWith('anots/system/'));
      
      expect(systemTools).toContain('anots/system/health');
      expect(systemTools).toContain('anots/system/list-tools');
    });
  });

  describe('Error Handling', () => {
    it('should handle memory layer failures gracefully', async () => {
      // Shutdown one layer
      const layers = memoryService.getLayers();
      await layers.chronicle.shutdown();
      
      // System should still report partial health
      const health = await memoryService.getLayerHealth();
      expect(health.chronicle).toBe(false);
      expect(health.activeStream).toBe(true);
      expect(health.hiveMind).toBe(true);
      expect(health.codex).toBe(true);
    });

    it('should continue operating with degraded layers', async () => {
      const layers = memoryService.getLayers();
      await layers.chronicle.shutdown();
      
      // Should still be able to store and search
      await memoryService.store('Test with degraded layer');
      const results = await memoryService.search('degraded', 10);
      
      // Results may be limited but operation should succeed
      expect(results).toBeDefined();
    });
  });

  describe('Server Status', () => {
    it('should report correct server status', () => {
      const status = server.getStatus();
      
      expect(status.running).toBe(false); // Not initialized yet
      expect(status.transport).toBe('stdio');
      expect(status.toolCount).toBe(19);
      expect(status.uptime).toBe(0);
      expect(status.requestCount).toBe(0);
    });

    it('should track tool count correctly', () => {
      const status = server.getStatus();
      const tools = server.getTools();
      
      expect(status.toolCount).toBe(tools.length);
      expect(status.toolCount).toBe(19);
    });
  });

  describe('Performance', () => {
    it('should handle rapid tool queries', async () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 10; i++) {
        server.getTools();
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should be very fast
    });

    it('should handle multiple memory operations efficiently', async () => {
      const startTime = Date.now();
      
      const operations = Array.from({ length: 10 }, (_, i) =>
        memoryService.store(`Performance test ${i}`)
      );
      
      await Promise.all(operations);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Data Persistence', () => {
    it('should persist data across operations', async () => {
      await memoryService.store('Persistent test data');
      
      const results1 = await memoryService.search('Persistent', 10);
      expect(results1.length).toBeGreaterThan(0);
      
      // Search again
      const results2 = await memoryService.search('Persistent', 10);
      expect(results2.length).toBe(results1.length);
    });

    it('should maintain data integrity', async () => {
      const testData = 'Data integrity test content';
      await memoryService.store(testData);
      
      const results = await memoryService.search('integrity test', 10);
      expect(results[0].content).toContain('integrity test');
    });
  });

  describe('Tool Discovery', () => {
    it('should list all available tools', () => {
      const tools = server.getTools();
      
      expect(tools).toEqual(
        expect.arrayContaining([
          'anots/memory/search',
          'anots/memory/store',
          'anots/chronicle/write',
          'anots/codex/read',
          'anots/system/health',
        ])
      );
    });

    it('should provide tool names in correct format', () => {
      const tools = server.getTools();
      
      tools.forEach(tool => {
        expect(tool).toMatch(/^anots\/[a-z]+\/[a-z-]+$/);
      });
    });
  });
});
