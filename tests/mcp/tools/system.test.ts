/**
 * MCP System Tools Tests
 * Feature: anots-unified-platform
 */

import { createSystemTools } from '../../../src/mcp/tools/system';
import { UnifiedMemoryService } from '../../../src/memory/UnifiedMemoryService';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('MCP System Tools', () => {
  let memoryService: UnifiedMemoryService;
  let tools: ReturnType<typeof createSystemTools>;
  let testDir: string;

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'system-mcp-test-'));
    process.env.CHRONICLE_ROOT = path.join(testDir, 'chronicle');
    process.env.ACTIVE_STREAM_ROOT = path.join(testDir, 'active-stream');
    process.env.HIVE_MIND_ROOT = path.join(testDir, 'hive-mind');
    process.env.CODEX_ROOT = path.join(testDir, 'codex');

    memoryService = new UnifiedMemoryService();
    await memoryService.initialize();
    tools = createSystemTools(memoryService);
  });

  afterEach(async () => {
    await memoryService.shutdown();
    delete process.env.CHRONICLE_ROOT;
    delete process.env.ACTIVE_STREAM_ROOT;
    delete process.env.HIVE_MIND_ROOT;
    delete process.env.CODEX_ROOT;
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  const getTextContent = (result: any): string => {
    if (Array.isArray(result.content)) {
      const textContent = result.content.find((c: any) => c.type === 'text');
      return textContent?.text || '';
    }
    return '';
  };

  describe('anots/system/health', () => {
    it('should return health status for all layers', async () => {
      const healthTool = tools.find(t => t.definition.name === 'anots/system/health')!;
      const result = await healthTool.handler({});
      const response = JSON.parse(getTextContent(result));

      expect(response.overall).toBeDefined();
      expect(['healthy', 'degraded']).toContain(response.overall);
      expect(response.layers).toBeDefined();
      expect(Array.isArray(response.layers)).toBe(true);
      expect(response.timestamp).toBeDefined();
    });

    it('should include all 4 memory layers', async () => {
      const healthTool = tools.find(t => t.definition.name === 'anots/system/health')!;
      const result = await healthTool.handler({});
      const response = JSON.parse(getTextContent(result));

      const layerNames = response.layers.map((l: any) => l.layer);
      expect(layerNames).toContain('Chronicle');
      expect(layerNames).toContain('ActiveStream');
      expect(layerNames).toContain('HiveMind');
      expect(layerNames).toContain('Codex');
    });

    it('should show healthy status for each layer', async () => {
      const healthTool = tools.find(t => t.definition.name === 'anots/system/health')!;
      const result = await healthTool.handler({});
      const response = JSON.parse(getTextContent(result));

      response.layers.forEach((layer: any) => {
        expect(layer.layer).toBeDefined();
        expect(layer.status).toBeDefined();
        expect(['healthy', 'unhealthy']).toContain(layer.status);
        expect(layer.message).toBeDefined();
      });
    });

    it('should return overall healthy when all layers are healthy', async () => {
      const healthTool = tools.find(t => t.definition.name === 'anots/system/health')!;
      const result = await healthTool.handler({});
      const response = JSON.parse(getTextContent(result));

      const allHealthy = response.layers.every((l: any) => l.status === 'healthy');
      if (allHealthy) {
        expect(response.overall).toBe('healthy');
      }
    });
  });

  describe('anots/system/list-tools', () => {
    it('should list all tools when category is "all"', async () => {
      const listTool = tools.find(t => t.definition.name === 'anots/system/list-tools')!;
      const result = await listTool.handler({ category: 'all' });
      const response = JSON.parse(getTextContent(result));

      expect(response.category).toBe('all');
      expect(response.count).toBeGreaterThan(0);
      expect(response.tools).toBeDefined();
      expect(Array.isArray(response.tools)).toBe(true);
      expect(response.total).toBe(response.count);
    });

    it('should list memory tools when category is "memory"', async () => {
      const listTool = tools.find(t => t.definition.name === 'anots/system/list-tools')!;
      const result = await listTool.handler({ category: 'memory' });
      const response = JSON.parse(getTextContent(result));

      expect(response.category).toBe('memory');
      expect(response.tools.every((t: string) => t.startsWith('anots/memory/'))).toBe(true);
      expect(response.tools).toContain('anots/memory/search');
      expect(response.tools).toContain('anots/memory/store');
    });

    it('should list chronicle tools when category is "chronicle"', async () => {
      const listTool = tools.find(t => t.definition.name === 'anots/system/list-tools')!;
      const result = await listTool.handler({ category: 'chronicle' });
      const response = JSON.parse(getTextContent(result));

      expect(response.category).toBe('chronicle');
      expect(response.tools.every((t: string) => t.startsWith('anots/chronicle/'))).toBe(true);
      expect(response.tools).toContain('anots/chronicle/write');
      expect(response.tools).toContain('anots/chronicle/read');
    });

    it('should list gateway tools when category is "gateway"', async () => {
      const listTool = tools.find(t => t.definition.name === 'anots/system/list-tools')!;
      const result = await listTool.handler({ category: 'gateway' });
      const response = JSON.parse(getTextContent(result));

      expect(response.category).toBe('gateway');
      expect(response.tools.every((t: string) => t.startsWith('anots/gateway/'))).toBe(true);
      expect(response.tools).toContain('anots/gateway/chat');
      expect(response.tools).toContain('anots/gateway/classify');
    });

    it('should list codex tools when category is "codex"', async () => {
      const listTool = tools.find(t => t.definition.name === 'anots/system/list-tools')!;
      const result = await listTool.handler({ category: 'codex' });
      const response = JSON.parse(getTextContent(result));

      expect(response.category).toBe('codex');
      expect(response.tools.every((t: string) => t.startsWith('anots/codex/'))).toBe(true);
      expect(response.tools).toContain('anots/codex/read');
      expect(response.tools).toContain('anots/codex/write');
    });

    it('should list system tools when category is "system"', async () => {
      const listTool = tools.find(t => t.definition.name === 'anots/system/list-tools')!;
      const result = await listTool.handler({ category: 'system' });
      const response = JSON.parse(getTextContent(result));

      expect(response.category).toBe('system');
      expect(response.tools.every((t: string) => t.startsWith('anots/system/'))).toBe(true);
      expect(response.tools).toContain('anots/system/health');
      expect(response.tools).toContain('anots/system/list-tools');
    });

    it('should include category counts', async () => {
      const listTool = tools.find(t => t.definition.name === 'anots/system/list-tools')!;
      const result = await listTool.handler({ category: 'all' });
      const response = JSON.parse(getTextContent(result));

      expect(response.categories).toBeDefined();
      expect(response.categories.memory).toBeGreaterThan(0);
      expect(response.categories.chronicle).toBeGreaterThan(0);
      expect(response.categories.gateway).toBeGreaterThan(0);
      expect(response.categories.codex).toBeGreaterThan(0);
      expect(response.categories.system).toBeGreaterThan(0);
    });

    it('should return sorted tool list', async () => {
      const listTool = tools.find(t => t.definition.name === 'anots/system/list-tools')!;
      const result = await listTool.handler({ category: 'all' });
      const response = JSON.parse(getTextContent(result));

      const toolList = response.tools;
      const sortedTools = [...toolList].sort();
      expect(toolList).toEqual(sortedTools);
    });

    it('should default to "all" category when not specified', async () => {
      const listTool = tools.find(t => t.definition.name === 'anots/system/list-tools')!;
      // Don't pass category at all - let Zod apply default
      const result = await listTool.handler({ category: undefined });
      const response = JSON.parse(getTextContent(result));

      expect(response.category).toBe('all');
    });
  });

  describe('Tool Registration', () => {
    it('should register 2 system tools', () => {
      expect(tools).toHaveLength(2);
      expect(tools.map(t => t.definition.name)).toEqual([
        'anots/system/health',
        'anots/system/list-tools',
      ]);
    });

    it('should have valid input schemas', () => {
      tools.forEach(tool => {
        expect(tool.definition.inputSchema).toBeDefined();
      });
    });

    it('should have handlers', () => {
      tools.forEach(tool => {
        expect(tool.handler).toBeDefined();
        expect(typeof tool.handler).toBe('function');
      });
    });
  });
});
