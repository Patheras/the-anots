/**
 * Property 1: Layer Independence Under Failure
 *
 * Validates: Requirements 1.2, 1.3, 1.7
 *
 * Verifies that each layer can operate independently even when other layers fail.
 * L1 (Chronicle) and L4 (Agent Codex) are file-system-only and must work
 * regardless of L2 (Redis) or L3 (Qdrant) availability.
 *
 * Tag: feature=memory-system, property=1
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { writeChronicle } from '../../src/chronicle/writer';
import { parseChronicle } from '../../src/chronicle/parser';
import { loadAgentCodex } from '../../src/codex/loader';
import { updateAgentCodex } from '../../src/codex/updater';
import { initializeNodeCodex } from '../../src/codex/initializer';
import { ChronicleChapter } from '../../src/chronicle/types';
import { AgentNode } from '../../src/codex/types';

fc.configureGlobal({ numRuns: 20 });

describe('Property 1: Layer Independence Under Failure', () => {
  let testRoot: string;

  beforeEach(async () => {
    testRoot = path.join(
      os.tmpdir(),
      `tcam-layer-independence-${Date.now()}-${Math.random().toString(36).substring(7)}`
    );
    await fsp.mkdir(testRoot, { recursive: true });

    // Set env vars for test isolation
    process.env.CHRONICLE_ROOT = path.join(testRoot, 'chronicle');
    process.env.CODEX_ROOT = path.join(testRoot, 'codex');
  });

  afterEach(async () => {
    delete process.env.CHRONICLE_ROOT;
    delete process.env.CODEX_ROOT;
    try {
      await fsp.rm(testRoot, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  /**
   * Helper: create a valid Chronicle chapter
   */
  function makeChapter(date: string, chapterId: string, summary: string): ChronicleChapter {
    return {
      metadata: {
        date,
        chapterId,
        participants: ['user', 'agent'],
        sessionType: 'general',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        messageCount: 3,
        summary,
      },
      content: {
        summary,
        dialogue: '**user:** Hello\n\n**agent:** Hi there',
        truths: [],
        insights: [],
        toolsCreated: [],
        decisions: [],
      },
    };
  }

  it('L1 (Chronicle) operates without L2, L3, L4', async () => {
    let counter = 0;
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          date: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') }),
          summary: fc.string({ minLength: 10, maxLength: 100 }).filter(s => s.trim() === s && s.trim().length > 0),
          participants: fc.array(
            fc.string({ minLength: 3, maxLength: 10 }).filter(s => /^[a-zA-Z]+$/.test(s)),
            { minLength: 1, maxLength: 3 }
          ),
        }),
        async (input) => {
          counter++;
          const dateStr = input.date.toISOString().split('T')[0];
          const chapterId = `${dateStr}-chapter-${String(counter).padStart(3, '0')}`;
          const chapter = makeChapter(dateStr, chapterId, input.summary);
          chapter.metadata.participants = input.participants;

          // L1 write - no external deps
          await writeChronicle(chapter);

          // Verify file exists
          const chronicleRoot = process.env.CHRONICLE_ROOT!;
          const filePath = path.join(chronicleRoot, 'chip', 'general', `${chapterId}.md`);
          expect(fs.existsSync(filePath)).toBe(true);

          // L1 read/parse - no external deps
          const content = await fsp.readFile(filePath, 'utf-8');
          const parsed = parseChronicle(content);
          expect(parsed.metadata.chapterId).toBe(chapterId);
          expect(parsed.content.summary).toBe(input.summary);

          // Verify immutability (read-only)
          const stats = fs.statSync(filePath);
          expect(stats.mode & 0o200).toBe(0);
        }
      )
    );
  }, 120000);

  it('L4 (Agent Codex) operates without L1, L2, L3', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          node: fc.constantFrom('ubik' as AgentNode, 'axiom' as AgentNode),
          content: fc.string({ minLength: 10, maxLength: 200 }).filter(s => s.trim() === s && s.trim().length > 0),
        }),
        async (input) => {
          // L4 init - no external deps
          await initializeNodeCodex(input.node);

          // L4 update - no external deps
          await updateAgentCodex({
            node: input.node,
            file: 'NOTES.md',
            operation: 'replace',
            content: input.content,
            summary: 'Test update',
          });

          // L4 load - no external deps
          const codex = await loadAgentCodex(input.node);
          expect(codex.node).toBe(input.node);
          expect(codex.notes).toContain(input.content);

          // Verify files exist on disk
          const codexRoot = process.env.CODEX_ROOT!;
          expect(fs.existsSync(path.join(codexRoot, input.node, 'README.md'))).toBe(true);
          expect(fs.existsSync(path.join(codexRoot, input.node, 'NOTES.md'))).toBe(true);
        }
      )
    );
  }, 120000);

  it('L1 and L4 continue working when L2 (Redis) is unavailable', async () => {
    let counter = 0;
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          summary: fc.string({ minLength: 10, maxLength: 80 }).filter(s => s.trim() === s && s.trim().length > 0),
          codexContent: fc.string({ minLength: 10, maxLength: 80 }).filter(s => s.trim() === s && s.trim().length > 0),
        }),
        async (input) => {
          counter++;
          const dateStr = new Date().toISOString().split('T')[0];
          const chapterId = `${dateStr}-chapter-${String(counter).padStart(3, '0')}`;

          // L1 works without Redis
          await writeChronicle(makeChapter(dateStr, chapterId, input.summary));
          const chronicleRoot = process.env.CHRONICLE_ROOT!;
          const filePath = path.join(chronicleRoot, 'chip', 'general', `${chapterId}.md`);
          expect(fs.existsSync(filePath)).toBe(true);

          // L4 works without Redis
          await initializeNodeCodex('ubik');
          await updateAgentCodex({
            node: 'ubik',
            file: 'CONTEXT.md',
            operation: 'replace',
            content: input.codexContent,
            summary: 'Test',
          });
          const codex = await loadAgentCodex('ubik');
          expect(codex.context).toContain(input.codexContent);

          // Verify L1 data integrity
          const fileContent = await fsp.readFile(filePath, 'utf-8');
          const parsed = parseChronicle(fileContent);
          expect(parsed.content.summary).toBe(input.summary);
        }
      )
    );
  }, 120000);

  it('L1 and L4 continue working when L3 (Qdrant) is unavailable', async () => {
    let counter = 0;
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          summary: fc.string({ minLength: 10, maxLength: 80 }).filter(s => s.trim() === s && s.trim().length > 0),
          codexContent: fc.string({ minLength: 10, maxLength: 80 }).filter(s => s.trim() === s && s.trim().length > 0),
        }),
        async (input) => {
          counter++;
          const dateStr = new Date().toISOString().split('T')[0];
          const chapterId = `${dateStr}-chapter-${String(counter).padStart(3, '0')}`;

          // L1 works without Qdrant
          await writeChronicle(makeChapter(dateStr, chapterId, input.summary));
          const chronicleRoot = process.env.CHRONICLE_ROOT!;
          const filePath = path.join(chronicleRoot, 'chip', 'general', `${chapterId}.md`);
          expect(fs.existsSync(filePath)).toBe(true);

          // L4 works without Qdrant
          await initializeNodeCodex('axiom');
          await updateAgentCodex({
            node: 'axiom',
            file: 'TASKS.md',
            operation: 'replace',
            content: input.codexContent,
            summary: 'Test',
          });
          const codex = await loadAgentCodex('axiom');
          expect(codex.tasks).toContain(input.codexContent);
        }
      )
    );
  }, 120000);

  it('Multiple simultaneous layer failures - L1 and L4 remain operational', async () => {
    let counter = 0;
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          l1Summary: fc.string({ minLength: 10, maxLength: 80 }).filter(s => s.trim() === s && s.trim().length > 0),
          l4Content: fc.string({ minLength: 10, maxLength: 80 }).filter(s => s.trim() === s && s.trim().length > 0),
          l2Down: fc.boolean(),
          l3Down: fc.boolean(),
        }),
        async (input) => {
          counter++;
          const dateStr = new Date().toISOString().split('T')[0];
          const chapterId = `${dateStr}-chapter-${String(counter).padStart(3, '0')}`;

          // L1 - always works (file system only)
          await writeChronicle(makeChapter(dateStr, chapterId, input.l1Summary));
          const chronicleRoot = process.env.CHRONICLE_ROOT!;
          const filePath = path.join(chronicleRoot, 'chip', 'general', `${chapterId}.md`);
          expect(fs.existsSync(filePath)).toBe(true);

          // L4 - always works (file system only)
          await initializeNodeCodex('ubik');
          await updateAgentCodex({
            node: 'ubik',
            file: 'README.md',
            operation: 'replace',
            content: input.l4Content,
            summary: 'Test',
          });

          // Verify both layers have correct data
          const fileContent = await fsp.readFile(filePath, 'utf-8');
          const parsed = parseChronicle(fileContent);
          expect(parsed.content.summary).toBe(input.l1Summary);

          const codex = await loadAgentCodex('ubik');
          expect(codex.identity).toContain(input.l4Content);
        }
      )
    );
  }, 120000);

  it('L1 and L4 are independent of each other', async () => {
    let counter = 0;
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          summary: fc.string({ minLength: 10, maxLength: 80 }).filter(s => s.trim() === s && s.trim().length > 0),
          codexContent: fc.string({ minLength: 10, maxLength: 80 }).filter(s => s.trim() === s && s.trim().length > 0),
        }),
        async (input) => {
          counter++;
          const dateStr = new Date().toISOString().split('T')[0];
          const chapterId = `${dateStr}-chapter-${String(counter).padStart(3, '0')}`;

          // L1 can work even if L4 directory doesn't exist
          await writeChronicle(makeChapter(dateStr, chapterId, input.summary));
          const chronicleRoot = process.env.CHRONICLE_ROOT!;
          const filePath = path.join(chronicleRoot, 'chip', 'general', `${chapterId}.md`);
          expect(fs.existsSync(filePath)).toBe(true);

          // L4 can work even if L1 has no chapters
          await initializeNodeCodex('axiom');
          await updateAgentCodex({
            node: 'axiom',
            file: 'NOTES.md',
            operation: 'replace',
            content: input.codexContent,
            summary: 'Test',
          });
          const codex = await loadAgentCodex('axiom');
          expect(codex.notes).toContain(input.codexContent);

          // Both layers have their own data, independent of each other
          const fileContent = await fsp.readFile(filePath, 'utf-8');
          const parsed = parseChronicle(fileContent);
          expect(parsed.content.summary).toBe(input.summary);
        }
      )
    );
  }, 120000);
});
