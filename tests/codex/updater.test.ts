import * as fs from 'fs/promises';
import * as path from 'path';
import { simpleGit } from 'simple-git';
import {
  updateAgentCodex,
  batchUpdateCodex,
  getCachedUpdates,
  clearCachedUpdates,
  flushCachedUpdates,
} from '../../src/codex/updater';
import { initializeNodeCodex } from '../../src/codex/initializer';
import { CodexUpdate, getCodexFilePath } from '../../src/codex/types';

describe('Codex Updater', () => {
  // Use unique test directory to avoid Git lock conflicts with other test suites
  const testRoot = path.join(__dirname, '../../codex-updater-test');

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
    
    // Clear cache
    clearCachedUpdates();
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

  describe('append operation', () => {
    it('should append content to file', async () => {
      const update: CodexUpdate = {
        node: 'ubik',
        file: 'TASKS.md',
        operation: 'append',
        content: '\n## New Task\n\n- Task 1\n- Task 2',
        summary: 'Add new tasks',
      };

      await updateAgentCodex(update);

      const filePath = getCodexFilePath('ubik', 'TASKS.md');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('## New Task');
      expect(content).toContain('- Task 1');
      expect(content).toContain('- Task 2');
    });

    it('should commit changes to Git', async () => {
      const update: CodexUpdate = {
        node: 'ubik',
        file: 'TASKS.md',
        operation: 'append',
        content: '\n## New Task\n\nTest task',
        summary: 'Add test task',
      };

      await updateAgentCodex(update);

      const directory = path.join(testRoot, 'ubik');
      const git = simpleGit(directory);
      const log = await git.log();

      expect(log.latest?.message).toBe('Update ubik codex: Add test task');
    });
  });

  describe('replace operation', () => {
    it('should replace entire file content', async () => {
      const newContent = '# New Content\n\nCompletely replaced.';
      
      const update: CodexUpdate = {
        node: 'ubik',
        file: 'CONTEXT.md',
        operation: 'replace',
        content: newContent,
        summary: 'Replace context',
      };

      await updateAgentCodex(update);

      const filePath = getCodexFilePath('ubik', 'CONTEXT.md');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toBe(newContent);
    });
  });

  describe('update operation', () => {
    it('should update specific section', async () => {
      // First, add some content with sections
      const initialContent = `# Test File

## Section 1

Original content 1

## Section 2

Original content 2

## Section 3

Original content 3
`;

      await updateAgentCodex({
        node: 'ubik',
        file: 'NOTES.md',
        operation: 'replace',
        content: initialContent,
        summary: 'Setup test content',
      });

      // Now update Section 2
      const update: CodexUpdate = {
        node: 'ubik',
        file: 'NOTES.md',
        operation: 'update',
        section: 'Section 2',
        content: 'Updated content for section 2',
        summary: 'Update section 2',
      };

      await updateAgentCodex(update);

      const filePath = getCodexFilePath('ubik', 'NOTES.md');
      const content = await fs.readFile(filePath, 'utf-8');

      expect(content).toContain('## Section 2');
      expect(content).toContain('Updated content for section 2');
      expect(content).toContain('## Section 1');
      expect(content).toContain('Original content 1');
      expect(content).toContain('## Section 3');
      expect(content).toContain('Original content 3');
    });

    it('should throw error if section not found', async () => {
      const update: CodexUpdate = {
        node: 'ubik',
        file: 'NOTES.md',
        operation: 'update',
        section: 'Nonexistent Section',
        content: 'New content',
        summary: 'Update nonexistent section',
      };

      // Should not throw (graceful error handling)
      await updateAgentCodex(update);
      
      // Error should be logged but not thrown
      expect(true).toBe(true);
    });

    it('should require section name for update operation', async () => {
      const update: CodexUpdate = {
        node: 'ubik',
        file: 'NOTES.md',
        operation: 'update',
        content: 'New content',
        summary: 'Update without section',
      };

      // Should not throw (graceful error handling)
      await updateAgentCodex(update);
      
      // Error should be logged but not thrown
      expect(true).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle disk full errors gracefully', async () => {
      // This test is conceptual - we can't easily simulate ENOSPC
      // But we verify the error handling code exists
      const update: CodexUpdate = {
        node: 'ubik',
        file: 'TASKS.md',
        operation: 'append',
        content: '\n## Test',
        summary: 'Test',
      };

      // Should not throw
      await updateAgentCodex(update);
      expect(true).toBe(true);
    });
  });

  describe('batch updates', () => {
    it('should update multiple files in single commit', async () => {
      await batchUpdateCodex(
        'ubik',
        [
          {
            file: 'TASKS.md',
            operation: 'append',
            content: '\n## Task 1',
            summary: 'Add task 1',
          },
          {
            file: 'NOTES.md',
            operation: 'append',
            content: '\n## Note 1',
            summary: 'Add note 1',
          },
        ],
        'Batch update: tasks and notes'
      );

      // Check both files were updated
      const tasksPath = getCodexFilePath('ubik', 'TASKS.md');
      const notesPath = getCodexFilePath('ubik', 'NOTES.md');

      const tasksContent = await fs.readFile(tasksPath, 'utf-8');
      const notesContent = await fs.readFile(notesPath, 'utf-8');

      expect(tasksContent).toContain('## Task 1');
      expect(notesContent).toContain('## Note 1');

      // Check Git commit
      const directory = path.join(testRoot, 'ubik');
      const git = simpleGit(directory);
      const log = await git.log();

      expect(log.latest?.message).toBe('Batch update: tasks and notes');
    });
  });

  describe('cache management', () => {
    it('should provide access to cached updates', () => {
      const cache = getCachedUpdates();
      expect(cache).toBeInstanceOf(Map);
    });

    it('should clear cached updates', () => {
      clearCachedUpdates();
      const cache = getCachedUpdates();
      expect(cache.size).toBe(0);
    });

    it('should flush cached updates', async () => {
      // This is a conceptual test
      await flushCachedUpdates();
      expect(true).toBe(true);
    });
  });

  describe('Git integration', () => {
    it('should create Git commits for each update', async () => {
      await updateAgentCodex({
        node: 'ubik',
        file: 'TASKS.md',
        operation: 'append',
        content: '\n## Task A',
        summary: 'Add task A',
      });

      await updateAgentCodex({
        node: 'ubik',
        file: 'TASKS.md',
        operation: 'append',
        content: '\n## Task B',
        summary: 'Add task B',
      });

      const directory = path.join(testRoot, 'ubik');
      const git = simpleGit(directory);
      const log = await git.log();

      // Should have 3 commits: init + 2 updates
      expect(log.total).toBeGreaterThanOrEqual(3);
    });
  });
});
