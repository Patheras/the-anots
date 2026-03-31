import * as fs from 'fs/promises';
import * as path from 'path';
import { simpleGit } from 'simple-git';
import {
  initializeNodeCodex,
  initializeAllCodex,
  isCodexInitialized,
} from '../../src/codex/initializer';
import { AgentNode, CodexFile, getCodexDirectory, getCodexFilePath } from '../../src/codex/types';

describe('Agent Codex Initializer', () => {
  // Use unique test directory to avoid Git lock conflicts with other test suites
  const testRoot = path.join(__dirname, '../../codex-initializer-test');

  beforeEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testRoot, { recursive: true, force: true });
      // Wait a bit to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch {
      // Ignore if doesn't exist
    }
    
    // Override codex root for this test suite
    process.env.CODEX_ROOT = testRoot;
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testRoot, { recursive: true, force: true });
      // Wait a bit to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch {
      // Ignore if doesn't exist
    }
    
    // Reset environment
    delete process.env.CODEX_ROOT;
  });

  describe('initializeNodeCodex', () => {
    it('should create Ubik Codex directory structure', async () => {
      await initializeNodeCodex('ubik');

      const directory = getCodexDirectory('ubik');
      const stats = await fs.stat(directory);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should create all required Codex files for Ubik', async () => {
      await initializeNodeCodex('ubik');

      const files: CodexFile[] = [
        'README.md',
        'TASKS.md',
        'SYNTHETIC-DIARY.md',
        'NOTES.md',
        'CONTEXT.md',
        'TOOLS.md',
      ];

      for (const file of files) {
        const filePath = getCodexFilePath('ubik', file);
        const stats = await fs.stat(filePath);
        expect(stats.isFile()).toBe(true);
      }
    });

    it('should create Axiom Codex directory structure', async () => {
      await initializeNodeCodex('axiom');

      const directory = getCodexDirectory('axiom');
      const stats = await fs.stat(directory);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should create all required Codex files for Axiom', async () => {
      await initializeNodeCodex('axiom');

      const files: CodexFile[] = [
        'README.md',
        'TASKS.md',
        'SYNTHETIC-DIARY.md',
        'NOTES.md',
        'CONTEXT.md',
        'TOOLS.md',
      ];

      for (const file of files) {
        const filePath = getCodexFilePath('axiom', file);
        const stats = await fs.stat(filePath);
        expect(stats.isFile()).toBe(true);
      }
    });

    it('should initialize Git repository', async () => {
      await initializeNodeCodex('ubik');

      const directory = getCodexDirectory('ubik');
      const git = simpleGit(directory);
      const log = await git.log();

      expect(log.total).toBeGreaterThan(0);
      expect(log.latest?.message).toBe('Initialize ubik Codex');
    });

    it('should not overwrite existing files', async () => {
      await initializeNodeCodex('ubik');

      // Modify a file
      const filePath = getCodexFilePath('ubik', 'README.md');
      const originalContent = await fs.readFile(filePath, 'utf-8');
      const modifiedContent = originalContent + '\n\n## Custom Section\n\nCustom content';
      await fs.writeFile(filePath, modifiedContent, 'utf-8');

      // Initialize again
      await initializeNodeCodex('ubik');

      // File should not be overwritten
      const currentContent = await fs.readFile(filePath, 'utf-8');
      expect(currentContent).toBe(modifiedContent);
    });

    it('should create files with default content', async () => {
      await initializeNodeCodex('ubik');

      const readmePath = getCodexFilePath('ubik', 'README.md');
      const content = await fs.readFile(readmePath, 'utf-8');

      expect(content).toContain('# Ubik - The Creative Engine');
      expect(content).toContain('**Identity:** The Divergent Mind');
      expect(content).toContain('**Protocol:** Resonance Protocols');
    });
  });

  describe('initializeAllCodex', () => {
    it('should create both Ubik and Axiom Codex', async () => {
      await initializeAllCodex();

      const ubikDir = getCodexDirectory('ubik');
      const axiomDir = getCodexDirectory('axiom');

      const ubikStats = await fs.stat(ubikDir);
      const axiomStats = await fs.stat(axiomDir);

      expect(ubikStats.isDirectory()).toBe(true);
      expect(axiomStats.isDirectory()).toBe(true);
    });

    it('should create all files for both nodes', async () => {
      await initializeAllCodex();

      const files: CodexFile[] = [
        'README.md',
        'TASKS.md',
        'SYNTHETIC-DIARY.md',
        'NOTES.md',
        'CONTEXT.md',
        'TOOLS.md',
      ];

      const nodes: AgentNode[] = ['ubik', 'axiom'];

      for (const node of nodes) {
        for (const file of files) {
          const filePath = getCodexFilePath(node, file);
          const stats = await fs.stat(filePath);
          expect(stats.isFile()).toBe(true);
        }
      }
    });
  });

  describe('isCodexInitialized', () => {
    it('should return false for uninitialized Codex', async () => {
      const initialized = await isCodexInitialized('ubik');
      expect(initialized).toBe(false);
    });

    it('should return true for initialized Codex', async () => {
      await initializeNodeCodex('ubik');
      const initialized = await isCodexInitialized('ubik');
      expect(initialized).toBe(true);
    });

    it('should return false if some files are missing', async () => {
      await initializeNodeCodex('ubik');

      // Delete one file
      const filePath = getCodexFilePath('ubik', 'TOOLS.md');
      await fs.unlink(filePath);

      const initialized = await isCodexInitialized('ubik');
      expect(initialized).toBe(false);
    });
  });

  describe('Codex content validation', () => {
    it('should create Ubik-specific content', async () => {
      await initializeNodeCodex('ubik');

      const readmePath = getCodexFilePath('ubik', 'README.md');
      const notesPath = getCodexFilePath('ubik', 'NOTES.md');

      const readmeContent = await fs.readFile(readmePath, 'utf-8');
      const notesContent = await fs.readFile(notesPath, 'utf-8');

      expect(readmeContent).toContain('Ubik');
      expect(readmeContent).toContain('Creative Engine');
      expect(notesContent).toContain('Creative Learnings');
    });

    it('should create Axiom-specific content', async () => {
      await initializeNodeCodex('axiom');

      const readmePath = getCodexFilePath('axiom', 'README.md');
      const notesPath = getCodexFilePath('axiom', 'NOTES.md');

      const readmeContent = await fs.readFile(readmePath, 'utf-8');
      const notesContent = await fs.readFile(notesPath, 'utf-8');

      expect(readmeContent).toContain('Axiom');
      expect(readmeContent).toContain('Analytical Engine');
      expect(notesContent).toContain('Technical Learnings');
    });
  });
});
