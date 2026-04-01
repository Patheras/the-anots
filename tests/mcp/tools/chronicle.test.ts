/**
 * MCP Chronicle Tools Tests
 */

import { createChronicleTools } from '../../../src/mcp/tools/chronicle';
import { ChronicleService } from '../../../src/memory/ChronicleService';
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

describe('MCP Chronicle Tools', () => {
  let chronicleService: ChronicleService;
  let tools: ReturnType<typeof createChronicleTools>;
  const testDataDir = path.join(__dirname, '../../test-data-mcp-chronicle');

  beforeAll(async () => {
    // Mock console
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();

    // Create test data directory
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }

    // Initialize chronicle service
    chronicleService = new ChronicleService();
    await chronicleService.initialize();

    // Create tools
    tools = createChronicleTools(chronicleService);
  });

  afterAll(async () => {
    await chronicleService.shutdown();

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
    it('should create 4 chronicle tools', () => {
      expect(tools).toHaveLength(4);
    });

    it('should have correct tool names', () => {
      const toolNames = tools.map(t => t.definition.name);
      expect(toolNames).toEqual([
        'anots/chronicle/write',
        'anots/chronicle/read',
        'anots/chronicle/list',
        'anots/chronicle/search',
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

  describe('anots/chronicle/write', () => {
    it('should write a chapter with all fields', async () => {
      const writeTool = tools.find(t => t.definition.name === 'anots/chronicle/write')!;
      const result = await writeTool.handler({
        content: 'This is a test chapter with full metadata',
        participants: ['Alice', 'Bob'],
        sessionType: 'collaboration',
        metadata: { project: 'test-project' },
      });

      const text = getTextContent(result);
      expect(text).toContain('Chapter written');
      expect(text).toContain('Alice, Bob');
      expect(text).toContain('collaboration');
    });

    it('should write a chapter with minimal fields', async () => {
      const writeTool = tools.find(t => t.definition.name === 'anots/chronicle/write')!;
      const result = await writeTool.handler({
        content: 'Minimal chapter content',
      });

      const text = getTextContent(result);
      expect(text).toContain('Chapter written');
      expect(text).toContain('System');
      expect(text).toContain('general');
    });

    it('should auto-generate chapter ID', async () => {
      const writeTool = tools.find(t => t.definition.name === 'anots/chronicle/write')!;
      const result = await writeTool.handler({
        content: 'Chapter with auto-generated ID',
      });

      const text = getTextContent(result);
      expect(text).toContain('Chapter written successfully');
    });

    it('should include current date', async () => {
      const writeTool = tools.find(t => t.definition.name === 'anots/chronicle/write')!;
      const result = await writeTool.handler({
        content: 'Chapter with date',
      });

      const text = getTextContent(result);
      const today = new Date().toISOString().split('T')[0];
      expect(text).toContain(`Date: ${today}`);
    });
  });

  describe('anots/chronicle/read', () => {
    let testChapterId: string;

    beforeAll(async () => {
      // Write a test chapter
      const writeTool = tools.find(t => t.definition.name === 'anots/chronicle/write')!;
      await writeTool.handler({
        content: 'Chapter for reading test with unique marker xyz123',
        participants: ['TestUser'],
        sessionType: 'general',
      });

      // List chapters to find the one we just wrote
      const chapters = await chronicleService.list('general');
      const testChapter = chapters.find(c => c.content.includes('unique marker xyz123'));
      if (!testChapter) {
        throw new Error('Test chapter not found');
      }
      testChapterId = testChapter.chapterId!;
    });

    it('should read an existing chapter', async () => {
      const readTool = tools.find(t => t.definition.name === 'anots/chronicle/read')!;
      const result = await readTool.handler({
        chapterId: testChapterId,
        sessionType: 'general',
      });

      const text = getTextContent(result);
      expect(text).toContain(testChapterId);
      expect(text).toContain('unique marker xyz123');
      expect(text).toContain('TestUser');
    });

    it('should return error for non-existent chapter', async () => {
      const readTool = tools.find(t => t.definition.name === 'anots/chronicle/read')!;
      const result = await readTool.handler({
        chapterId: 'non-existent-chapter',
        sessionType: 'general',
      });

      expect(result.isError).toBe(true);
      const text = getTextContent(result);
      expect(text).toContain('Chapter not found');
    });
  });

  describe('anots/chronicle/list', () => {
    beforeAll(async () => {
      // Write some test chapters
      const writeTool = tools.find(t => t.definition.name === 'anots/chronicle/write')!;
      await writeTool.handler({ content: 'List test chapter 1' });
      await writeTool.handler({ content: 'List test chapter 2' });
      await writeTool.handler({ content: 'List test chapter 3' });
    });

    it('should list all chapters', async () => {
      const listTool = tools.find(t => t.definition.name === 'anots/chronicle/list')!;
      const result = await listTool.handler({});

      const text = getTextContent(result);
      expect(text).toContain('Chronicle Chapters');
      expect(text).toMatch(/\(\d+\)/); // Should show count
    });

    it('should respect limit parameter', async () => {
      const listTool = tools.find(t => t.definition.name === 'anots/chronicle/list')!;
      const result = await listTool.handler({
        limit: 2,
      });

      const text = getTextContent(result);
      const lines = text.split('\n').filter(l => l.startsWith('-'));
      expect(lines.length).toBeLessThanOrEqual(2);
    });

    it('should show chapter metadata', async () => {
      const listTool = tools.find(t => t.definition.name === 'anots/chronicle/list')!;
      const result = await listTool.handler({});

      const text = getTextContent(result);
      expect(text).toMatch(/chapter-\d+/);
      expect(text).toMatch(/\d{4}-\d{2}-\d{2}/); // Date format
    });
  });

  describe('anots/chronicle/search', () => {
    beforeAll(async () => {
      // Write chapters with different content
      const writeTool = tools.find(t => t.definition.name === 'anots/chronicle/write')!;
      await writeTool.handler({
        content: 'The quick brown fox jumps over the lazy dog',
        participants: ['Alice'],
        sessionType: 'general',
      });
      await writeTool.handler({
        content: 'Machine learning algorithms are fascinating',
        participants: ['Bob'],
        sessionType: 'general',
      });
      await writeTool.handler({
        content: 'Collaboration between Alice and Bob on the project',
        participants: ['Alice', 'Bob'],
        sessionType: 'general',
      });
    });

    it('should search by content', async () => {
      const searchTool = tools.find(t => t.definition.name === 'anots/chronicle/search')!;
      const result = await searchTool.handler({
        content: 'fox',
      });

      const text = getTextContent(result);
      expect(text).toContain('Found');
      expect(text).toContain('fox');
    });

    it('should search by participants', async () => {
      const searchTool = tools.find(t => t.definition.name === 'anots/chronicle/search')!;
      const result = await searchTool.handler({
        participants: ['Alice'],
      });

      const text = getTextContent(result);
      expect(text).toContain('Found');
      expect(text).toContain('Alice');
    });

    it('should search by session type', async () => {
      const searchTool = tools.find(t => t.definition.name === 'anots/chronicle/search')!;
      const result = await searchTool.handler({
        sessionType: 'general',
      });

      const text = getTextContent(result);
      expect(text).toContain('Found');
      expect(text).toContain('general');
    });

    it('should combine multiple search criteria', async () => {
      const searchTool = tools.find(t => t.definition.name === 'anots/chronicle/search')!;
      const result = await searchTool.handler({
        content: 'Alice',
        sessionType: 'general',
      });

      const text = getTextContent(result);
      expect(text).toContain('Found');
    });

    it('should respect limit parameter', async () => {
      const searchTool = tools.find(t => t.definition.name === 'anots/chronicle/search')!;
      const result = await searchTool.handler({
        content: 'Alice',
        limit: 1,
      });

      const text = getTextContent(result);
      if (text.includes('Found')) {
        const matches = text.match(/\d+\./g); // Count numbered results
        expect(matches?.length || 0).toBeLessThanOrEqual(1);
      }
    });

    it('should return no results message when nothing matches', async () => {
      const searchTool = tools.find(t => t.definition.name === 'anots/chronicle/search')!;
      const result = await searchTool.handler({
        content: 'xyznonexistent123',
      });

      const text = getTextContent(result);
      expect(text).toContain('No matching chapters found');
    });

    it('should show content preview in results', async () => {
      const searchTool = tools.find(t => t.definition.name === 'anots/chronicle/search')!;
      const result = await searchTool.handler({
        content: 'Machine',
      });

      const text = getTextContent(result);
      expect(text).toContain('Machine learning');
    });
  });

  describe('Error Handling', () => {
    it('should handle write errors gracefully', async () => {
      const writeTool = tools.find(t => t.definition.name === 'anots/chronicle/write')!;
      
      // Shutdown service to cause error
      await chronicleService.shutdown();

      await expect(writeTool.handler({
        content: 'This should fail',
      })).rejects.toThrow();

      // Reinitialize for other tests
      await chronicleService.initialize();
    });
  });
});
