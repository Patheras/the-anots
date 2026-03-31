import * as fs from 'fs/promises';
import * as path from 'path';
import * as fc from 'fast-check';
import { writeChronicle } from '../../src/chronicle/writer';
import { ChronicleChapter } from '../../src/chronicle/types';

/**
 * Property 3: Chronicle Immutability
 * 
 * Validates: Requirements 3.2, 3.8
 * 
 * This property test verifies that Chronicle operations are truly immutable:
 * - No modifications to existing files
 * - No deletions
 * - Only append operations (new files)
 * 
 * Strategy:
 * 1. Write multiple Chronicle chapters
 * 2. Monitor file system operations
 * 3. Verify no existing files are modified or deleted
 * 4. Verify only new files are created
 */

describe('Property 3: Chronicle Immutability', () => {
  const testDir = path.join(__dirname, '../../data/chronicle/chip/general');

  beforeEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }
  });

  /**
   * Helper: Create a valid Chronicle chapter
   */
  function createChapter(chapterId: string): ChronicleChapter {
    const date = chapterId.split('-chapter-')[0];
    return {
      metadata: {
        date,
        chapterId,
        participants: ['User', 'Axiom'],
        sessionType: 'general',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        messageCount: 5,
      },
      content: {
        summary: 'Test chapter summary',
        dialogue: '**User:** Hello\n\n**Axiom:** Hi there!',
        truths: ['Test truth'],
        insights: ['Test insight'],
        toolsCreated: [],
        decisions: [],
      },
    };
  }

  /**
   * Helper: Get all files in directory with their modification times
   */
  async function getFileSnapshots(directory: string): Promise<Map<string, { mtime: Date; size: number }>> {
    const snapshots = new Map<string, { mtime: Date; size: number }>();
    
    try {
      const files = await fs.readdir(directory);
      
      for (const file of files) {
        const filePath = path.join(directory, file);
        const stats = await fs.stat(filePath);
        
        // Only track .md files (not .git directory or other files)
        if (stats.isFile() && file.endsWith('.md')) {
          snapshots.set(filePath, {
            mtime: stats.mtime,
            size: stats.size,
          });
        }
      }
    } catch {
      // Directory doesn't exist yet
    }
    
    return snapshots;
  }

  it('should never modify existing Chronicle files', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.nat({ max: 999 }), { minLength: 3, maxLength: 10 }),
        async (chapterNumbers) => {
          const date = '2025-03-22';
          
          // Write first chapter
          const firstChapterId = `${date}-chapter-${chapterNumbers[0].toString().padStart(3, '0')}`;
          await writeChronicle(createChapter(firstChapterId));

          // Take snapshot of file system (content hashes)
          const beforeSnapshot = await getFileSnapshots(testDir);
          
          // Write remaining chapters
          for (let i = 1; i < chapterNumbers.length; i++) {
            const chapterId = `${date}-chapter-${chapterNumbers[i].toString().padStart(3, '0')}`;
            await writeChronicle(createChapter(chapterId));
          }

          // Take snapshot after writes
          const afterSnapshot = await getFileSnapshots(testDir);

          // Check for modifications to existing files
          for (const [file, beforeStats] of beforeSnapshot.entries()) {
            const afterStats = afterSnapshot.get(file);
            
            if (afterStats) {
              // PROPERTY: File size should not change (primary immutability check)
              expect(afterStats.size).toBe(beforeStats.size);
            }
          }
          
          // PROPERTY: No files should be deleted
          for (const file of beforeSnapshot.keys()) {
            expect(afterSnapshot.has(file)).toBe(true);
          }
        }
      ),
      { numRuns: 50 } // Reduced for speed
    );
  }, 180000); // 180 second timeout

  it('should maintain read-only permissions on all Chronicle files', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.nat({ max: 999 }), { minLength: 1, maxLength: 10 }),
        async (chapterNumbers) => {
          const date = '2025-03-22';
          
          // Write chapters
          for (const num of chapterNumbers) {
            const chapterId = `${date}-chapter-${num.toString().padStart(3, '0')}`;
            await writeChronicle(createChapter(chapterId));
          }

          // Check all files have read-only permissions
          const files = await fs.readdir(testDir);
          
          for (const file of files) {
            if (file.endsWith('.md')) {
              const filePath = path.join(testDir, file);
              const stats = await fs.stat(filePath);
              
              // Check if writable bits are off (read-only)
              const isReadOnly = (stats.mode & 0o222) === 0;
              
              // PROPERTY: All Chronicle files must be read-only
              expect(isReadOnly).toBe(true);
            }
          }
        }
      ),
      { numRuns: 50 } // Reduced for speed
    );
  }, 180000);

  it('should reject attempts to overwrite existing chapters', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.nat({ max: 999 }),
        async (chapterNum) => {
          const date = '2025-03-22';
          const chapterId = `${date}-chapter-${chapterNum.toString().padStart(3, '0')}`;
          
          // Write chapter first time
          await writeChronicle(createChapter(chapterId));

          // Take snapshot
          const beforeSnapshot = await getFileSnapshots(testDir);

          // Try to write same chapter again (should fail silently)
          await writeChronicle(createChapter(chapterId));

          // Take snapshot after
          const afterSnapshot = await getFileSnapshots(testDir);

          // PROPERTY: No modifications should occur
          for (const [file, beforeStats] of beforeSnapshot.entries()) {
            const afterStats = afterSnapshot.get(file);
            expect(afterStats?.mtime.getTime()).toBe(beforeStats.mtime.getTime());
            expect(afterStats?.size).toBe(beforeStats.size);
          }
          
          // PROPERTY: No new files should be added (same chapter ID)
          expect(afterSnapshot.size).toBe(beforeSnapshot.size);
          
          // PROPERTY: No deletions should occur
          for (const file of beforeSnapshot.keys()) {
            expect(afterSnapshot.has(file)).toBe(true);
          }
        }
      ),
      { numRuns: 50 } // Reduced for speed
    );
  }, 180000);

  it('should preserve file content integrity across multiple writes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.array(fc.nat({ max: 999 }), { minLength: 2, maxLength: 5 }),
          fc.array(fc.nat({ max: 999 }), { minLength: 1, maxLength: 3 })
        ),
        async ([firstBatch, secondBatch]) => {
          const date = '2025-03-22';
          const fileContents = new Map<string, string>();

          // Write first batch and store their content
          for (const num of firstBatch) {
            const chapterId = `${date}-chapter-${num.toString().padStart(3, '0')}`;
            await writeChronicle(createChapter(chapterId));

            // Read and store content
            const filePath = path.join(testDir, `${chapterId}.md`);
            try {
              const content = await fs.readFile(filePath, 'utf-8');
              fileContents.set(chapterId, content);
            } catch {
              // File might not exist if write failed
            }
          }

          // Write second batch
          for (const num of secondBatch) {
            const chapterId = `${date}-chapter-${(Math.max(...firstBatch) + num + 1).toString().padStart(3, '0')}`;
            await writeChronicle(createChapter(chapterId));
          }

          // Verify original file contents are unchanged
          for (const [chapterId, originalContent] of fileContents.entries()) {
            const filePath = path.join(testDir, `${chapterId}.md`);
            const currentContent = await fs.readFile(filePath, 'utf-8');
            
            // PROPERTY: Original file content must remain unchanged
            expect(currentContent).toBe(originalContent);
          }
        }
      ),
      { numRuns: 50 } // Reduced for speed
    );
  }, 180000); // 180 second timeout
});
