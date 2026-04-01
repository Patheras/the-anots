/**
 * MCP Codex Tools Tests
 * Feature: anots-unified-platform
 */

import { registerCodexTools } from '../../../src/mcp/tools/codex';
import { CodexService } from '../../../src/memory/CodexService';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('MCP Codex Tools', () => {
  let codex: CodexService;
  let tools: ReturnType<typeof registerCodexTools>;
  let testDir: string;

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-mcp-test-'));
    process.env.CODEX_ROOT = testDir;
    codex = new CodexService({ autoInitialize: false });
    await codex.initialize();
    tools = registerCodexTools(codex);
  });

  afterEach(async () => {
    await codex.shutdown();
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

  describe('anots/codex/init', () => {
    it('should initialize codex for ubik', async () => {
      const initTool = tools.find(t => t.definition.name === 'anots/codex/init')!;
      const result = await initTool.handler({ node: 'ubik' });
      const response = JSON.parse(getTextContent(result));

      expect(response.success).toBe(true);
      expect(response.node).toBe('ubik');
      expect(fs.existsSync(path.join(testDir, 'ubik'))).toBe(true);
    });

    it('should initialize codex for axiom', async () => {
      const initTool = tools.find(t => t.definition.name === 'anots/codex/init')!;
      const result = await initTool.handler({ node: 'axiom' });
      const response = JSON.parse(getTextContent(result));

      expect(response.success).toBe(true);
      expect(response.node).toBe('axiom');
      expect(fs.existsSync(path.join(testDir, 'axiom'))).toBe(true);
    });
  });

  describe('anots/codex/read', () => {
    beforeEach(async () => {
      await codex.init('ubik');
    });

    it('should read README.md', async () => {
      const readTool = tools.find(t => t.definition.name === 'anots/codex/read')!;
      const result = await readTool.handler({ node: 'ubik', file: 'README.md' });
      const response = JSON.parse(getTextContent(result));

      expect(response.success).toBe(true);
      expect(response.node).toBe('ubik');
      expect(response.file).toBe('README.md');
      expect(response.content).toContain('Ubik');
    });

    it('should read TASKS.md', async () => {
      const readTool = tools.find(t => t.definition.name === 'anots/codex/read')!;
      const result = await readTool.handler({ node: 'ubik', file: 'TASKS.md' });
      const response = JSON.parse(getTextContent(result));

      expect(response.success).toBe(true);
      expect(response.file).toBe('TASKS.md');
    });

    it('should read from axiom after auto-initialization', async () => {
      // First initialize axiom
      await codex.init('axiom');
      
      const readTool = tools.find(t => t.definition.name === 'anots/codex/read')!;
      const result = await readTool.handler({ node: 'axiom', file: 'README.md' });
      const response = JSON.parse(getTextContent(result));

      expect(response.success).toBe(true);
      expect(response.node).toBe('axiom');
      expect(response.content).toContain('Axiom');
    });
  });

  describe('anots/codex/write', () => {
    beforeEach(async () => {
      await codex.init('ubik');
    });

    it('should append to NOTES.md', async () => {
      const writeTool = tools.find(t => t.definition.name === 'anots/codex/write')!;
      const result = await writeTool.handler({
        node: 'ubik',
        file: 'NOTES.md',
        operation: 'append',
        content: '\n## New Note\nTest content',
        summary: 'Add test note',
      });
      const response = JSON.parse(getTextContent(result));

      expect(response.success).toBe(true);
      expect(response.operation).toBe('append');

      // Verify content was written
      const content = await codex.readFile('ubik', 'NOTES.md');
      expect(content).toContain('New Note');
    });

    it('should replace TASKS.md', async () => {
      const writeTool = tools.find(t => t.definition.name === 'anots/codex/write')!;
      const result = await writeTool.handler({
        node: 'ubik',
        file: 'TASKS.md',
        operation: 'replace',
        content: '# New Tasks\n- Task 1\n- Task 2',
        summary: 'Replace tasks',
      });
      const response = JSON.parse(getTextContent(result));

      expect(response.success).toBe(true);
      expect(response.operation).toBe('replace');

      // Verify content was replaced
      const content = await codex.readFile('ubik', 'TASKS.md');
      expect(content).toContain('New Tasks');
      expect(content).not.toContain('No active tasks yet');
    });

    it('should write to axiom after initialization', async () => {
      // First initialize axiom
      await codex.init('axiom');
      
      const writeTool = tools.find(t => t.definition.name === 'anots/codex/write')!;
      const result = await writeTool.handler({
        node: 'axiom',
        file: 'NOTES.md',
        operation: 'append',
        content: '\n## Test Note',
        summary: 'test',
      });
      const response = JSON.parse(getTextContent(result));

      expect(response.success).toBe(true);
      expect(response.node).toBe('axiom');
    });
  });

  describe('anots/codex/list', () => {
    beforeEach(async () => {
      await codex.init('ubik');
    });

    it('should list all codex files for ubik', async () => {
      const listTool = tools.find(t => t.definition.name === 'anots/codex/list')!;
      const result = await listTool.handler({ node: 'ubik' });
      const response = JSON.parse(getTextContent(result));

      expect(response.success).toBe(true);
      expect(response.node).toBe('ubik');
      expect(response.files).toContain('README.md');
      expect(response.files).toContain('TASKS.md');
      expect(response.count).toBeGreaterThan(0);
    });

    it('should list files for axiom after auto-initialization', async () => {
      // First initialize axiom
      await codex.init('axiom');
      
      const listTool = tools.find(t => t.definition.name === 'anots/codex/list')!;
      const result = await listTool.handler({ node: 'axiom' });
      const response = JSON.parse(getTextContent(result));

      expect(response.success).toBe(true);
      expect(response.node).toBe('axiom');
      expect(response.files.length).toBeGreaterThan(0);
    });
  });

  describe('anots/codex/read-full', () => {
    beforeEach(async () => {
      await codex.init('ubik');
    });

    it('should read entire codex for ubik', async () => {
      const readFullTool = tools.find(t => t.definition.name === 'anots/codex/read-full')!;
      const result = await readFullTool.handler({ node: 'ubik' });
      const response = JSON.parse(getTextContent(result));

      expect(response.success).toBe(true);
      expect(response.node).toBe('ubik');
      expect(response.identity).toBeDefined();
      expect(response.tasks).toBeDefined();
      expect(response.diary).toBeDefined();
      expect(response.notes).toBeDefined();
      expect(response.context).toBeDefined();
      expect(response.tools).toBeDefined();
    });
  });

  describe('Tool Registration', () => {
    it('should register all 5 Codex tools', () => {
      expect(tools).toHaveLength(5);
      expect(tools.map(t => t.definition.name)).toEqual([
        'anots/codex/read',
        'anots/codex/write',
        'anots/codex/list',
        'anots/codex/init',
        'anots/codex/read-full',
      ]);
    });

    it('should have valid input schemas', () => {
      tools.forEach(tool => {
        expect(tool.definition.inputSchema).toBeDefined();
      });
    });
  });
});
