/**
 * Tests for CodexService
 */

import { CodexService } from '../../src/memory/CodexService';
import { AgentNode, CodexFile, CodexUpdate } from '../../src/codex/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as fc from 'fast-check';

// Test data directory
const TEST_DATA_DIR = path.join(__dirname, '../../test-data/codex');

describe('CodexService', () => {
  let service: CodexService;
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeAll(() => {
    // Mock console methods to avoid test pollution
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    // Set test Codex root
    process.env.CODEX_ROOT = TEST_DATA_DIR;
  });

  afterAll(() => {
    // Restore console methods
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();

    delete process.env.CODEX_ROOT;
  });

  beforeEach(async () => {
    // Clean test directory
    await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_DATA_DIR, { recursive: true });

    // Create service
    service = new CodexService({ autoInitialize: true });
    await service.initialize();
  });

  afterEach(async () => {
    await service.shutdown();
    
    // Wait for Git locks to release on Windows
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    // Clean up test directory
    await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      expect(service.name).toBe('CodexService');
      expect(await service.isHealthy()).toBe(true);
    });

    it('should auto-initialize codex directories', async () => {
      const ubikInitialized = await service.isInitialized('ubik');
      const axiomInitialized = await service.isInitialized('axiom');

      expect(ubikInitialized).toBe(true);
      expect(axiomInitialized).toBe(true);
    });

    it('should create all standard files', async () => {
      const files = await service.list('ubik');

      expect(files).toContain('README.md');
      expect(files).toContain('TASKS.md');
      expect(files).toContain('SYNTHETIC-DIARY.md');
      expect(files).toContain('NOTES.md');
      expect(files).toContain('CONTEXT.md');
      expect(files).toContain('TOOLS.md');
    });

    it('should handle multiple initializations gracefully', async () => {
      await service.initialize();
      await service.initialize();

      expect(await service.isHealthy()).toBe(true);
    });

    it('should not reinitialize existing codex', async () => {
      await service.init('ubik');
      await service.init('ubik'); // Should not throw

      expect(await service.isInitialized('ubik')).toBe(true);
    });
  });

  describe('Read Operations', () => {
    it('should read entire codex for an agent', async () => {
      const codex = await service.read('ubik');

      expect(codex.node).toBe('ubik');
      expect(codex.identity).toContain('Ubik');
      expect(codex.identity).toContain('Creative Engine');
      expect(codex.tasks).toBeTruthy();
      expect(codex.diary).toBeTruthy();
      expect(codex.notes).toBeTruthy();
      expect(codex.context).toBeTruthy();
      expect(codex.tools).toBeTruthy();
      expect(codex.lastUpdated).toBeTruthy();
      // lastUpdated can be Date or string (from JSON serialization)
      const isValidDate = codex.lastUpdated instanceof Date || 
                          (typeof codex.lastUpdated === 'string' && !isNaN(Date.parse(codex.lastUpdated))) ||
                          (typeof codex.lastUpdated === 'object' && codex.lastUpdated !== null);
      expect(isValidDate).toBe(true);
    });

    it('should read specific codex file', async () => {
      const readme = await service.readFile('ubik', 'README.md');

      expect(readme).toContain('Ubik');
      expect(readme).toContain('Creative Engine');
    });

    it('should read different content for different agents', async () => {
      const ubikReadme = await service.readFile('ubik', 'README.md');
      const axiomReadme = await service.readFile('axiom', 'README.md');

      expect(ubikReadme).toContain('Ubik');
      expect(ubikReadme).toContain('Creative');
      expect(axiomReadme).toContain('Axiom');
      expect(axiomReadme).toContain('Analytical');
    });

    it('should list all codex files', async () => {
      const files = await service.list('ubik');

      expect(files).toHaveLength(6);
      expect(files).toContain('README.md');
      expect(files).toContain('TASKS.md');
    });
  });

  describe('Write Operations', () => {
    it('should append content to file', async () => {
      const update: CodexUpdate = {
        node: 'ubik',
        file: 'TASKS.md',
        operation: 'append',
        content: '\n## New Task\n\nTest task content',
        summary: 'Add new task',
      };

      await service.write(update);

      const content = await service.readFile('ubik', 'TASKS.md');
      expect(content).toContain('New Task');
      expect(content).toContain('Test task content');
    });

    it('should replace file content', async () => {
      const update: CodexUpdate = {
        node: 'ubik',
        file: 'CONTEXT.md',
        operation: 'replace',
        content: '# New Context\n\nCompletely new content',
        summary: 'Replace context',
      };

      await service.write(update);

      const content = await service.readFile('ubik', 'CONTEXT.md');
      expect(content).toBe('# New Context\n\nCompletely new content');
    });

    it('should update specific section', async () => {
      // First, create a file with sections
      const initialUpdate: CodexUpdate = {
        node: 'ubik',
        file: 'NOTES.md',
        operation: 'replace',
        content: '# Notes\n\n## Section 1\n\nOriginal content\n\n## Section 2\n\nOther content',
        summary: 'Initialize notes',
      };

      await service.write(initialUpdate);

      // Update Section 1
      const sectionUpdate: CodexUpdate = {
        node: 'ubik',
        file: 'NOTES.md',
        operation: 'update',
        section: 'Section 1',
        content: 'Updated content',
        summary: 'Update section 1',
      };

      await service.write(sectionUpdate);

      const content = await service.readFile('ubik', 'NOTES.md');
      expect(content).toContain('Updated content');
      expect(content).toContain('Section 2');
      expect(content).toContain('Other content');
      expect(content).not.toContain('Original content');
    });

    it('should batch update multiple files', async () => {
      const updates = [
        {
          file: 'TASKS.md' as CodexFile,
          operation: 'append' as const,
          content: '\n## Task 1\n\nFirst task',
          summary: 'Add task 1',
        },
        {
          file: 'NOTES.md' as CodexFile,
          operation: 'append' as const,
          content: '\n## Note 1\n\nFirst note',
          summary: 'Add note 1',
        },
      ];

      await service.batchWrite('ubik', updates, 'Batch update: tasks and notes');

      const tasks = await service.readFile('ubik', 'TASKS.md');
      const notes = await service.readFile('ubik', 'NOTES.md');

      expect(tasks).toContain('Task 1');
      expect(notes).toContain('Note 1');
    });
  });

  describe('Agent Isolation', () => {
    it('should maintain separate codex for each agent', async () => {
      // Update Ubik's tasks
      const ubikUpdate: CodexUpdate = {
        node: 'ubik',
        file: 'TASKS.md',
        operation: 'append',
        content: '\n## Ubik Task\n\nUbik-specific task',
        summary: 'Add Ubik task',
      };

      await service.write(ubikUpdate);

      // Update Axiom's tasks
      const axiomUpdate: CodexUpdate = {
        node: 'axiom',
        file: 'TASKS.md',
        operation: 'append',
        content: '\n## Axiom Task\n\nAxiom-specific task',
        summary: 'Add Axiom task',
      };

      await service.write(axiomUpdate);

      // Verify isolation
      const ubikTasks = await service.readFile('ubik', 'TASKS.md');
      const axiomTasks = await service.readFile('axiom', 'TASKS.md');

      expect(ubikTasks).toContain('Ubik Task');
      expect(ubikTasks).not.toContain('Axiom Task');

      expect(axiomTasks).toContain('Axiom Task');
      expect(axiomTasks).not.toContain('Ubik Task');
    });

    it('should read correct codex for each agent', async () => {
      const ubikCodex = await service.read('ubik');
      const axiomCodex = await service.read('axiom');

      expect(ubikCodex.node).toBe('ubik');
      expect(ubikCodex.identity).toContain('Ubik');

      expect(axiomCodex.node).toBe('axiom');
      expect(axiomCodex.identity).toContain('Axiom');
    });
  });

  describe('Property Tests', () => {
    describe('Property: Agent Isolation', () => {
      it('should never leak data between agents', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              ubikContent: fc.string({ minLength: 10, maxLength: 100 }),
              axiomContent: fc.string({ minLength: 10, maxLength: 100 }),
              file: fc.constantFrom<CodexFile>(
                'TASKS.md',
                'NOTES.md',
                'CONTEXT.md',
                'TOOLS.md'
              ),
            }),
            async (data) => {
              // Write to Ubik
              const ubikUpdate: CodexUpdate = {
                node: 'ubik',
                file: data.file,
                operation: 'append',
                content: `\n${data.ubikContent}`,
                summary: 'Test update',
              };
              await service.write(ubikUpdate);

              // Write to Axiom
              const axiomUpdate: CodexUpdate = {
                node: 'axiom',
                file: data.file,
                operation: 'append',
                content: `\n${data.axiomContent}`,
                summary: 'Test update',
              };
              await service.write(axiomUpdate);

              // Verify isolation
              const ubikFile = await service.readFile('ubik', data.file);
              const axiomFile = await service.readFile('axiom', data.file);

              expect(ubikFile).toContain(data.ubikContent);
              expect(ubikFile).not.toContain(data.axiomContent);

              expect(axiomFile).toContain(data.axiomContent);
              expect(axiomFile).not.toContain(data.ubikContent);
            }
          ),
          { numRuns: 10 } // Reduced due to Git commit overhead
        );
      }, 30000); // 30 second timeout for Git operations
    });

    describe('Property: Write-Read Round-Trip', () => {
      it('should preserve content through write-read cycle', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              node: fc.constantFrom<AgentNode>('ubik', 'axiom'),
              file: fc.constantFrom<CodexFile>(
                'TASKS.md',
                'NOTES.md',
                'CONTEXT.md',
                'TOOLS.md'
              ),
              content: fc.string({ minLength: 10, maxLength: 200 }).filter(s => s.trim().length > 0),
            }),
            async (data) => {
              // Write
              const update: CodexUpdate = {
                node: data.node,
                file: data.file,
                operation: 'append',
                content: `\n## Test Section\n\n${data.content}`,
                summary: 'Test update',
              };
              await service.write(update);

              // Read
              const readContent = await service.readFile(data.node, data.file);

              // Verify
              expect(readContent).toContain(data.content);
            }
          ),
          { numRuns: 15 } // Reduced due to Git commit overhead
        );
      }, 30000); // 30 second timeout for Git operations
    });
  });

  describe('Error Handling', () => {
    it('should throw error when not initialized', async () => {
      const uninitializedService = new CodexService({ autoInitialize: false });

      await expect(uninitializedService.read('ubik')).rejects.toThrow('not initialized');
    });

    it('should throw error when reading before initialization', async () => {
      const uninitializedService = new CodexService({ autoInitialize: false });

      await expect(uninitializedService.readFile('ubik', 'README.md')).rejects.toThrow('not initialized');
    });

    it('should report unhealthy when not initialized', async () => {
      const uninitializedService = new CodexService({ autoInitialize: false });

      expect(await uninitializedService.isHealthy()).toBe(false);
    });
  });

  describe('Cached Updates', () => {
    it('should track cached updates', () => {
      const cached = service.getCachedUpdates();
      expect(cached).toBeInstanceOf(Map);
    });

    it('should clear cached updates', () => {
      service.clearCachedUpdates();
      const cached = service.getCachedUpdates();
      expect(cached.size).toBe(0);
    });
  });

  describe('Health Check', () => {
    it('should report healthy when initialized', async () => {
      expect(await service.isHealthy()).toBe(true);
    });

    it('should check both agent codex directories', async () => {
      const ubikInitialized = await service.isInitialized('ubik');
      const axiomInitialized = await service.isInitialized('axiom');

      expect(ubikInitialized).toBe(true);
      expect(axiomInitialized).toBe(true);
    });
  });
});
