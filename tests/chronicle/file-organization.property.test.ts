/**
 * Property 11: Chronicle File Organization
 *
 * Validates: Requirements 3.3
 *
 * Verifies that Chronicle files are created in the correct directories
 * and follow the naming pattern: YYYY-MM-DD-chapter-NNN.md
 *
 * Tag: feature=memory-system, property=11
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { writeChronicle } from '../../src/chronicle/writer';
import { ChronicleChapter } from '../../src/chronicle/types';

fc.configureGlobal({ numRuns: 20 });

describe('Property 11: Chronicle File Organization', () => {
  let testRoot: string;

  beforeEach(async () => {
    testRoot = path.join(
      os.tmpdir(),
      `tcam-file-org-${Date.now()}-${Math.random().toString(36).substring(7)}`
    );
    await fsp.mkdir(testRoot, { recursive: true });
    process.env.CHRONICLE_ROOT = path.join(testRoot, 'chronicle');
  });

  afterEach(async () => {
    delete process.env.CHRONICLE_ROOT;
    try {
      await fsp.rm(testRoot, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  it('files are created in correct directory based on sessionType', async () => {
    let counter = 0;
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          sessionType: fc.constantFrom('general' as const, 'ubik' as const, 'axiom' as const),
          date: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
          summary: fc.string({ minLength: 10, maxLength: 80 })
            .filter(s => s.trim() === s && s.trim().length > 0),
        }),
        async (input) => {
          counter++;
          const dateStr = input.date.toISOString().split('T')[0];
          const chapterId = `${dateStr}-chapter-${String(counter).padStart(3, '0')}`;

          const chapter: ChronicleChapter = {
            metadata: {
              date: dateStr,
              chapterId,
              participants: ['user', 'agent'],
              sessionType: input.sessionType,
              startTime: new Date().toISOString(),
              endTime: new Date().toISOString(),
              messageCount: 1,
              summary: input.summary,
            },
            content: {
              summary: input.summary,
              dialogue: '**user:** Hello\n\n**agent:** Hi',
              truths: [],
              insights: [],
              toolsCreated: [],
              decisions: [],
            },
          };

          await writeChronicle(chapter);

          const chronicleRoot = process.env.CHRONICLE_ROOT!;
          const expectedDir = path.join(chronicleRoot, 'chip', input.sessionType);
          const expectedFile = path.join(expectedDir, `${chapterId}.md`);

          // File must be in the correct directory
          expect(fs.existsSync(expectedFile)).toBe(true);

          // File must NOT be in wrong directories
          const wrongTypes = (['general', 'ubik', 'axiom'] as const)
            .filter(t => t !== input.sessionType);
          for (const wrongType of wrongTypes) {
            const wrongFile = path.join(chronicleRoot, 'chip', wrongType, `${chapterId}.md`);
            expect(fs.existsSync(wrongFile)).toBe(false);
          }
        }
      )
    );
  }, 120000);

  it('file names follow YYYY-MM-DD-chapter-NNN.md pattern', async () => {
    let counter = 0;
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          date: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
          seq: fc.integer({ min: 1, max: 999 }),
          summary: fc.string({ minLength: 10, maxLength: 80 })
            .filter(s => s.trim() === s && s.trim().length > 0),
        }),
        async (input) => {
          counter++;
          const dateStr = input.date.toISOString().split('T')[0];
          const paddedSeq = String(counter).padStart(3, '0');
          const chapterId = `${dateStr}-chapter-${paddedSeq}`;

          const chapter: ChronicleChapter = {
            metadata: {
              date: dateStr,
              chapterId,
              participants: ['user', 'agent'],
              sessionType: 'general',
              startTime: new Date().toISOString(),
              endTime: new Date().toISOString(),
              messageCount: 1,
            },
            content: {
              summary: input.summary,
              dialogue: '**user:** Hello\n\n**agent:** Hi',
              truths: [],
              insights: [],
              toolsCreated: [],
              decisions: [],
            },
          };

          await writeChronicle(chapter);

          const chronicleRoot = process.env.CHRONICLE_ROOT!;
          const dir = path.join(chronicleRoot, 'chip', 'general');
          const files = fs.readdirSync(dir);

          // All .md files must match the naming pattern
          const chapterFilePattern = /^\d{4}-\d{2}-\d{2}-chapter-\d{3}\.md$/;
          for (const file of files.filter(f => f.endsWith('.md'))) {
            expect(chapterFilePattern.test(file)).toBe(true);
          }

          // Our specific file must exist
          expect(files).toContain(`${chapterId}.md`);
        }
      )
    );
  }, 120000);

  it('different session types create separate directory trees', async () => {
    let counter = 0;
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          summary: fc.string({ minLength: 10, maxLength: 80 })
            .filter(s => s.trim() === s && s.trim().length > 0),
        }),
        async (input) => {
          counter++;
          const dateStr = new Date().toISOString().split('T')[0];
          const seq = String(counter).padStart(3, '0');

          // Write one chapter per session type
          for (const sessionType of ['general', 'ubik', 'axiom'] as const) {
            const chapterId = `${dateStr}-chapter-${seq}`;
            await writeChronicle({
              metadata: {
                date: dateStr,
                chapterId,
                participants: ['user', 'agent'],
                sessionType,
                startTime: new Date().toISOString(),
                endTime: new Date().toISOString(),
                messageCount: 1,
              },
              content: {
                summary: input.summary,
                dialogue: '**user:** Hello\n\n**agent:** Hi',
                truths: [],
                insights: [],
                toolsCreated: [],
                decisions: [],
              },
            });
          }

          const chronicleRoot = process.env.CHRONICLE_ROOT!;

          // Each session type has its own directory
          for (const sessionType of ['general', 'ubik', 'axiom']) {
            const dir = path.join(chronicleRoot, 'chip', sessionType);
            expect(fs.existsSync(dir)).toBe(true);
            const files = fs.readdirSync(dir);
            expect(files.length).toBeGreaterThan(0);
          }
        }
      )
    );
  }, 120000);

  it('chapter IDs are unique within a session type', async () => {
    let counter = 0;
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.string({ minLength: 10, maxLength: 50 })
            .filter(s => s.trim() === s && s.trim().length > 0),
          { minLength: 2, maxLength: 5 }
        ),
        async (summaries) => {
          const dateStr = new Date().toISOString().split('T')[0];
          const writtenIds: string[] = [];

          for (const summary of summaries) {
            counter++;
            const chapterId = `${dateStr}-chapter-${String(counter).padStart(3, '0')}`;
            writtenIds.push(chapterId);

            await writeChronicle({
              metadata: {
                date: dateStr,
                chapterId,
                participants: ['user', 'agent'],
                sessionType: 'general',
                startTime: new Date().toISOString(),
                endTime: new Date().toISOString(),
                messageCount: 1,
              },
              content: {
                summary,
                dialogue: '**user:** Hello\n\n**agent:** Hi',
                truths: [],
                insights: [],
                toolsCreated: [],
                decisions: [],
              },
            });
          }

          // All IDs must be unique
          const uniqueIds = new Set(writtenIds);
          expect(uniqueIds.size).toBe(writtenIds.length);

          // All files must exist
          const chronicleRoot = process.env.CHRONICLE_ROOT!;
          for (const id of writtenIds) {
            const filePath = path.join(chronicleRoot, 'chip', 'general', `${id}.md`);
            expect(fs.existsSync(filePath)).toBe(true);
          }
        }
      )
    );
  }, 120000);
});
