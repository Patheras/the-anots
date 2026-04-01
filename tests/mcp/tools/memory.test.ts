/**
 * MCP Memory Tools Tests
 */

import { createMemoryTools } from '../../../src/mcp/tools/memory';
import { UnifiedMemoryService } from '../../../src/memory/UnifiedMemoryService';
import * as fs from 'fs';
import * as path from 'path';

// Mock console methods
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

// Helper to extract text from CallToolResult
function getTextContent(result: any): string {
  if (result.content[0].type === 'text') {
    return result.content[0].text;
  }
  throw new Error('Expected text content');
}

describe('MCP Memory Tools', () => {
  let memoryService: UnifiedMemoryService;
  let tools: ReturnType<typeof createMemoryTools>;
  const testDataDir = path.join(__dirname, '../../test-data-mcp-memory');

  beforeAll(async () => {
    // Mock console
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();

    // Create test data directory
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }

    // Initialize memory service
    memoryService = new UnifiedMemoryService({
      chronicleConfig: { dataDir: path.join(testDataDir, 'chronicle') },
      activeStreamConfig: { dataDir: path.join(testDataDir, 'active-stream') },
      hiveMindConfig: { dataDir: path.join(testDataDir, 'hive-mind') },
      codexConfig: { dataDir: path.join(testDataDir, 'codex') },
    });

    await memoryService.initialize();

    // Create tools
    tools = createMemoryTools(memoryService);
  });

  afterAll(async () => {
    await memoryService.shutdown();

    // Cleanup test data
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }

    // Restore console
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  });

  describe('Tool Registration', () => {
    it('should create 8 memory tools', () => {
      expect(tools).toHaveLength(8);
    });

    it('should have correct tool names', () => {
      const toolNames = tools.map(t => t.definition.name);
      expect(toolNames).toEqual([
        'anots/memory/search',
        'anots/memory/store',
        'anots/memory/get-context',
        'anots/memory/update-context',
        'anots/memory/clear-context',
        'anots/memory/list-sessions',
        'anots/memory/stats',
        'anots/memory/health',
      ]);
    });

    it('should have descriptions for all tools', () => {
      tools.forEach(tool => {
        expect(tool.definition.description).toBeTruthy();
        expect(tool.definition.description.length).toBeGreaterThan(10);
      });
    });

    it('should have input schemas for all tools', () => {
      tools.forEach(tool => {
        expect(tool.definition.inputSchema).toBeTruthy();
      });
    });
  });

  describe('anots/memory/store', () => {
    it('should store content successfully', async () => {
      const storeTool = tools.find(t => t.definition.name === 'anots/memory/store')!;
      const result = await storeTool.handler({
        content: 'Test memory content',
        metadata: { source: 'test' },
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(getTextContent(result)).toContain('stored successfully');
    });

    it('should store content without metadata', async () => {
      const storeTool = tools.find(t => t.definition.name === 'anots/memory/store')!;
      const result = await storeTool.handler({
        content: 'Another test memory',
      });

      expect(getTextContent(result)).toContain('stored successfully');
    });
  });

  describe('anots/memory/search', () => {
    beforeAll(async () => {
      // Store some test data
      const storeTool = tools.find(t => t.definition.name === 'anots/memory/store')!;
      await storeTool.handler({ content: 'The quick brown fox jumps over the lazy dog' });
      await storeTool.handler({ content: 'Machine learning is a subset of artificial intelligence' });
    });

    it('should search and return results', async () => {
      const searchTool = tools.find(t => t.definition.name === 'anots/memory/search')!;
      const result = await searchTool.handler({
        query: 'fox',
        limit: 10,
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(getTextContent(result)).toContain('Found');
    });

    it('should use default limit', async () => {
      const searchTool = tools.find(t => t.definition.name === 'anots/memory/search')!;
      const result = await searchTool.handler({
        query: 'test',
      });

      expect(result.content).toHaveLength(1);
    });

    it('should return no results message for non-existent query', async () => {
      const searchTool = tools.find(t => t.definition.name === 'anots/memory/search')!;
      const result = await searchTool.handler({
        query: 'xyznonexistent123',
        limit: 10,
      });

      expect(getTextContent(result)).toContain('No results found');
    });
  });

  describe('anots/memory/get-context', () => {
    it('should return no context for non-existent session', async () => {
      const getContextTool = tools.find(t => t.definition.name === 'anots/memory/get-context')!;
      const result = await getContextTool.handler({
        sessionId: 'non-existent-session',
      });

      expect(getTextContent(result)).toContain('No context found');
    });
  });

  describe('anots/memory/update-context', () => {
    it('should update context successfully', async () => {
      const updateContextTool = tools.find(t => t.definition.name === 'anots/memory/update-context')!;
      const result = await updateContextTool.handler({
        sessionId: 'test-session-1',
        state: {
          messages: [{ role: 'user', content: 'Hello' }],
          metadata: { timestamp: Date.now() },
        },
      });

      expect(getTextContent(result)).toContain('Context updated');
    });

    it('should retrieve updated context', async () => {
      const updateContextTool = tools.find(t => t.definition.name === 'anots/memory/update-context')!;
      const getContextTool = tools.find(t => t.definition.name === 'anots/memory/get-context')!;
      
      await updateContextTool.handler({
        sessionId: 'test-session-2',
        state: {
          messages: [{ role: 'user', content: 'Test message' }],
        },
      });

      const result = await getContextTool.handler({
        sessionId: 'test-session-2',
      });

      expect(getTextContent(result)).toContain('Test message');
    });
  });

  describe('anots/memory/clear-context', () => {
    it('should clear context successfully', async () => {
      const clearContextTool = tools.find(t => t.definition.name === 'anots/memory/clear-context')!;
      const updateContextTool = tools.find(t => t.definition.name === 'anots/memory/update-context')!;
      const getContextTool = tools.find(t => t.definition.name === 'anots/memory/get-context')!;
      
      // First create a context
      await updateContextTool.handler({
        sessionId: 'test-session-clear',
        state: {
          messages: [{ role: 'user', content: 'To be cleared' }],
        },
      });

      // Clear it
      const result = await clearContextTool.handler({
        sessionId: 'test-session-clear',
      });

      expect(getTextContent(result)).toContain('Context cleared');

      // Verify it's cleared
      const getResult = await getContextTool.handler({
        sessionId: 'test-session-clear',
      });

      expect(getTextContent(getResult)).toContain('No context found');
    });
  });

  describe('anots/memory/list-sessions', () => {
    it('should list active sessions', async () => {
      const listSessionsTool = tools.find(t => t.definition.name === 'anots/memory/list-sessions')!;
      const updateContextTool = tools.find(t => t.definition.name === 'anots/memory/update-context')!;
      
      // Create some sessions
      await updateContextTool.handler({
        sessionId: 'session-a',
        state: { messages: [] },
      });
      await updateContextTool.handler({
        sessionId: 'session-b',
        state: { messages: [] },
      });

      const result = await listSessionsTool.handler({});
      const text = getTextContent(result);

      expect(text).toContain('Active sessions');
      expect(text).toContain('session-a');
      expect(text).toContain('session-b');
    });
  });

  describe('anots/memory/stats', () => {
    it('should return memory statistics', async () => {
      const statsTool = tools.find(t => t.definition.name === 'anots/memory/stats')!;
      const result = await statsTool.handler({});
      const text = getTextContent(result);

      expect(text).toContain('Memory Statistics');
      expect(text).toContain('Chronicle');
      expect(text).toContain('Active Stream');
      expect(text).toContain('Hive Mind');
      expect(text).toContain('Codex');
    });

    it('should show chapter count', async () => {
      const statsTool = tools.find(t => t.definition.name === 'anots/memory/stats')!;
      const result = await statsTool.handler({});

      expect(getTextContent(result)).toMatch(/Chapters: \d+/);
    });

    it('should show session count', async () => {
      const statsTool = tools.find(t => t.definition.name === 'anots/memory/stats')!;
      const result = await statsTool.handler({});

      expect(getTextContent(result)).toMatch(/Sessions: \d+/);
    });
  });

  describe('anots/memory/health', () => {
    it('should return health status', async () => {
      const healthTool = tools.find(t => t.definition.name === 'anots/memory/health')!;
      const result = await healthTool.handler({});
      const text = getTextContent(result);

      expect(text).toContain('Memory System Health');
      expect(text).toContain('Layer Status');
    });

    it('should show all layer statuses', async () => {
      const healthTool = tools.find(t => t.definition.name === 'anots/memory/health')!;
      const result = await healthTool.handler({});
      const text = getTextContent(result);

      expect(text).toContain('Chronicle (L1)');
      expect(text).toContain('Active Stream (L2)');
      expect(text).toContain('Hive Mind (L3)');
      expect(text).toContain('Codex (L4)');
    });

    it('should indicate healthy or degraded status', async () => {
      const healthTool = tools.find(t => t.definition.name === 'anots/memory/health')!;
      const result = await healthTool.handler({});

      expect(getTextContent(result)).toMatch(/Memory System Health: (✓ Healthy|✗ Degraded)/);
    });
  });

  describe('Error Handling', () => {
    it('should handle store errors gracefully', async () => {
      const storeTool = tools.find(t => t.definition.name === 'anots/memory/store')!;
      
      // Shutdown service to cause error
      await memoryService.shutdown();

      await expect(storeTool.handler({
        content: 'This should fail',
      })).rejects.toThrow();

      // Reinitialize for other tests
      await memoryService.initialize();
    });
  });
});
