import * as fs from 'fs/promises';
import * as path from 'path';
import {
  loadAgentCodex,
  loadCodexFile,
  codexFileExists,
} from '../../src/codex/loader';
import { initializeNodeCodex } from '../../src/codex/initializer';
import { updateAgentCodex } from '../../src/codex/updater';
import { CodexFile } from '../../src/codex/types';

describe('Codex Loader', () => {
  // Use unique test directory to avoid Git lock conflicts
  const testRoot = path.join(__dirname, '../../codex-loader-test');

  beforeEach(async () => {
    // Clean up and initialize
    try {
      await fs.rm(testRoot, { recursive: true, force: true });
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch {
      // Ignore
    }
    
    // Override codex root for this test suite
    process.env.CODEX_ROOT = testRoot;
    
    // Initialize Ubik Codex for testing
    await initializeNodeCodex('ubik');
  });

  afterEach(async () => {
    // Clean up
    try {
      await fs.rm(testRoot, { recursive: true, force: true });
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch {
      // Ignore
    }
    
    // Reset environment
    delete process.env.CODEX_ROOT;
  });

  describe('loadAgentCodex', () => {
    it('should load complete Codex for Ubik', async () => {
      const codex = await loadAgentCodex('ubik');

      expect(codex.node).toBe('ubik');
      expect(codex.identity).toContain('Ubik - The Creative Engine');
      expect(codex.tasks).toContain('Active Missions');
      expect(codex.diary).toContain('Synthetic Diary - Ubik');
      expect(codex.notes).toContain('Creative Learnings');
      expect(codex.context).toContain('Current State');
      expect(codex.tools).toContain('Autopoietic Tool Registry');
      expect(typeof codex.lastUpdated.getTime()).toBe('number');
      expect(codex.lastUpdated.getTime()).toBeGreaterThan(0);
    });

    it('should load complete Codex for Axiom', async () => {
      await initializeNodeCodex('axiom');
      
      const codex = await loadAgentCodex('axiom');

      expect(codex.node).toBe('axiom');
      expect(codex.identity).toContain('Axiom - The Analytical Engine');
      expect(codex.tasks).toContain('Active Missions');
      expect(codex.diary).toContain('Synthetic Diary - Axiom');
      expect(codex.notes).toContain('Technical Learnings');
      expect(codex.context).toContain('Current State');
      expect(codex.tools).toContain('Crafted Tool Catalog');
      expect(typeof codex.lastUpdated.getTime()).toBe('number');
      expect(codex.lastUpdated.getTime()).toBeGreaterThan(0);
    });

    it('should load updated content', async () => {
      // Update a file
      await updateAgentCodex({
        node: 'ubik',
        file: 'TASKS.md',
        operation: 'append',
        content: '\n## New Task\n\n- Task 1\n- Task 2',
        summary: 'Add new tasks',
      });

      // Load Codex
      const codex = await loadAgentCodex('ubik');

      expect(codex.tasks).toContain('## New Task');
      expect(codex.tasks).toContain('- Task 1');
      expect(codex.tasks).toContain('- Task 2');
    });

    it('should handle missing files gracefully', async () => {
      // Delete a file
      const filePath = path.join(testRoot, 'ubik', 'TOOLS.md');
      await fs.unlink(filePath);

      // Load Codex - should not throw
      const codex = await loadAgentCodex('ubik');

      expect(codex.node).toBe('ubik');
      expect(codex.tools).toBe(''); // Missing file returns empty string
      expect(codex.identity).toContain('Ubik'); // Other files still loaded
    });

    it('should throw error if Codex directory does not exist', async () => {
      // Remove entire directory
      await fs.rm(testRoot, { recursive: true, force: true });

      await expect(loadAgentCodex('ubik')).rejects.toThrow();
    });
  });

  describe('loadCodexFile', () => {
    it('should load specific Codex file', async () => {
      const content = await loadCodexFile('ubik', 'README.md');

      expect(content).toContain('Ubik - The Creative Engine');
      expect(content).toContain('Identity:');
    });

    it('should return empty string for missing file', async () => {
      // Delete file
      const filePath = path.join(testRoot, 'ubik', 'NOTES.md');
      await fs.unlink(filePath);

      const content = await loadCodexFile('ubik', 'NOTES.md');

      expect(content).toBe('');
    });

    it('should load all Codex files individually', async () => {
      const files: CodexFile[] = [
        'README.md',
        'TASKS.md',
        'SYNTHETIC-DIARY.md',
        'NOTES.md',
        'CONTEXT.md',
        'TOOLS.md',
      ];

      for (const file of files) {
        const content = await loadCodexFile('ubik', file);
        expect(content.length).toBeGreaterThan(0);
      }
    });
  });

  describe('codexFileExists', () => {
    it('should return true for existing file', async () => {
      const exists = await codexFileExists('ubik', 'README.md');
      expect(exists).toBe(true);
    });

    it('should return false for missing file', async () => {
      // Delete file
      const filePath = path.join(testRoot, 'ubik', 'CONTEXT.md');
      await fs.unlink(filePath);

      const exists = await codexFileExists('ubik', 'CONTEXT.md');
      expect(exists).toBe(false);
    });

    it('should return false for non-existent Codex', async () => {
      // Remove entire directory
      await fs.rm(testRoot, { recursive: true, force: true });

      const exists = await codexFileExists('ubik', 'README.md');
      expect(exists).toBe(false);
    });

    it('should check all Codex files', async () => {
      const files: CodexFile[] = [
        'README.md',
        'TASKS.md',
        'SYNTHETIC-DIARY.md',
        'NOTES.md',
        'CONTEXT.md',
        'TOOLS.md',
      ];

      for (const file of files) {
        const exists = await codexFileExists('ubik', file);
        expect(exists).toBe(true);
      }
    });
  });

  describe('integration', () => {
    it('should load Codex after multiple updates', async () => {
      // Perform multiple updates
      await updateAgentCodex({
        node: 'ubik',
        file: 'TASKS.md',
        operation: 'append',
        content: '\n## Task 1',
        summary: 'Add task 1',
      });

      await updateAgentCodex({
        node: 'ubik',
        file: 'NOTES.md',
        operation: 'append',
        content: '\n## Note 1',
        summary: 'Add note 1',
      });

      await updateAgentCodex({
        node: 'ubik',
        file: 'CONTEXT.md',
        operation: 'replace',
        content: '# Updated Context\n\nNew context content',
        summary: 'Update context',
      });

      // Load Codex
      const codex = await loadAgentCodex('ubik');

      expect(codex.tasks).toContain('## Task 1');
      expect(codex.notes).toContain('## Note 1');
      expect(codex.context).toContain('Updated Context');
    });

    it('should reflect latest state after updates', async () => {
      // Initial load
      const before = await loadAgentCodex('ubik');
      const beforeTasksLength = before.tasks.length;

      // Update
      await updateAgentCodex({
        node: 'ubik',
        file: 'TASKS.md',
        operation: 'append',
        content: '\n## New Task\n\nTask description',
        summary: 'Add new task',
      });

      // Load again
      const after = await loadAgentCodex('ubik');

      expect(after.tasks.length).toBeGreaterThan(beforeTasksLength);
      expect(after.tasks).toContain('## New Task');
      expect(after.lastUpdated.getTime()).toBeGreaterThanOrEqual(before.lastUpdated.getTime());
    });
  });
});
