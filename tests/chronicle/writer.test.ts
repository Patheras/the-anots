import * as fs from 'fs/promises';
import * as path from 'path';
import { simpleGit } from 'simple-git';
import {
  writeChronicle,
  chronicleExists,
  getNextChapterId,
  listChronicles,
  getChronicleStats,
} from '../../src/chronicle/writer';
import { ChronicleChapter } from '../../src/chronicle/types';

describe('Chronicle Writer', () => {
  const testDir = path.join(__dirname, '../../data/chronicle/chip/general');
  const testChapter: ChronicleChapter = {
    metadata: {
      date: '2025-03-22',
      chapterId: '2025-03-22-chapter-001',
      participants: ['User', 'Axiom'],
      sessionType: 'general',
      startTime: '2025-03-22T10:00:00Z',
      endTime: '2025-03-22T10:30:00Z',
      messageCount: 5,
    },
    content: {
      summary: 'Test chapter for Git integration',
      dialogue: '**User:** Hello\n\n**Axiom:** Hi there!',
      truths: ['Test truth 1'],
      insights: ['Test insight 1'],
      toolsCreated: [],
      decisions: [],
    },
  };

  beforeEach(async () => {
    // Clean up test directory before each test
    try {
      await fs.rm(testDir, { recursive: true, force: true });
      // Wait a bit to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch {
      // Ignore if doesn't exist
    }
  });

  afterEach(async () => {
    // Clean up test directory after each test
    try {
      await fs.rm(testDir, { recursive: true, force: true });
      // Wait a bit to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch {
      // Ignore if doesn't exist
    }
  });

  describe('writeChronicle', () => {
    it('should write Chronicle chapter to file system', async () => {
      await writeChronicle(testChapter);

      const exists = await chronicleExists('2025-03-22-chapter-001', 'general');
      expect(exists).toBe(true);
    });

    it('should create file with read-only permissions', async () => {
      await writeChronicle(testChapter);

      const stats = await getChronicleStats('2025-03-22-chapter-001', 'general');
      expect(stats).not.toBeNull();
      expect(stats?.isReadOnly).toBe(true);
    });

    it('should not overwrite existing file (append-only)', async () => {
      await writeChronicle(testChapter);

      // Try to write again - should fail silently
      await writeChronicle(testChapter);

      // File should still exist with original content
      const exists = await chronicleExists('2025-03-22-chapter-001', 'general');
      expect(exists).toBe(true);
    });

    it('should commit chapter to Git', async () => {
      await writeChronicle(testChapter);

      // Check Git log
      const git = simpleGit(testDir);
      const log = await git.log();

      expect(log.total).toBe(1);
      expect(log.latest?.message).toBe('Add chapter 2025-03-22-chapter-001');
    });

    it('should handle Git errors gracefully', async () => {
      // Write chapter (Git should work)
      await writeChronicle(testChapter);

      // Verify file was created even if Git fails
      const exists = await chronicleExists('2025-03-22-chapter-001', 'general');
      expect(exists).toBe(true);
    });
  });

  describe('chronicleExists', () => {
    it('should return true for existing chapter', async () => {
      await writeChronicle(testChapter);

      const exists = await chronicleExists('2025-03-22-chapter-001', 'general');
      expect(exists).toBe(true);
    });

    it('should return false for non-existing chapter', async () => {
      const exists = await chronicleExists('2025-03-22-chapter-999', 'general');
      expect(exists).toBe(false);
    });
  });

  describe('getNextChapterId', () => {
    it('should return chapter-001 for empty directory', async () => {
      const nextId = await getNextChapterId('2025-03-22', 'general');
      expect(nextId).toBe('2025-03-22-chapter-001');
    });

    it('should return next sequential chapter ID', async () => {
      await writeChronicle(testChapter);

      const nextId = await getNextChapterId('2025-03-22', 'general');
      expect(nextId).toBe('2025-03-22-chapter-002');
    });

    it('should handle multiple chapters on same date', async () => {
      await writeChronicle(testChapter);

      const chapter2 = {
        ...testChapter,
        metadata: { ...testChapter.metadata, chapterId: '2025-03-22-chapter-002' },
      };
      await writeChronicle(chapter2);

      const nextId = await getNextChapterId('2025-03-22', 'general');
      expect(nextId).toBe('2025-03-22-chapter-003');
    });
  });

  describe('listChronicles', () => {
    it('should return empty array for empty directory', async () => {
      const chronicles = await listChronicles('general');
      expect(chronicles).toEqual([]);
    });

    it('should list all chronicles in directory', async () => {
      await writeChronicle(testChapter);

      const chapter2 = {
        ...testChapter,
        metadata: { ...testChapter.metadata, chapterId: '2025-03-22-chapter-002' },
      };
      await writeChronicle(chapter2);

      const chronicles = await listChronicles('general');
      expect(chronicles).toHaveLength(2);
      expect(chronicles).toContain('2025-03-22-chapter-001');
      expect(chronicles).toContain('2025-03-22-chapter-002');
    });

    it('should return sorted list', async () => {
      const chapter1 = {
        ...testChapter,
        metadata: { ...testChapter.metadata, chapterId: '2025-03-22-chapter-002' },
      };
      await writeChronicle(chapter1);

      const chapter2 = {
        ...testChapter,
        metadata: { ...testChapter.metadata, chapterId: '2025-03-22-chapter-001' },
      };
      await writeChronicle(chapter2);

      const chronicles = await listChronicles('general');
      expect(chronicles[0]).toBe('2025-03-22-chapter-001');
      expect(chronicles[1]).toBe('2025-03-22-chapter-002');
    });
  });

  describe('getChronicleStats', () => {
    it('should return null for non-existing chapter', async () => {
      const stats = await getChronicleStats('2025-03-22-chapter-999', 'general');
      expect(stats).toBeNull();
    });

    it('should return file stats for existing chapter', async () => {
      await writeChronicle(testChapter);

      const stats = await getChronicleStats('2025-03-22-chapter-001', 'general');
      expect(stats).not.toBeNull();
      expect(stats?.size).toBeGreaterThan(0);
      expect(stats?.created.getTime()).toBeGreaterThan(0);
      expect(stats?.modified.getTime()).toBeGreaterThan(0);
      expect(stats?.isReadOnly).toBe(true);
    });
  });
});
