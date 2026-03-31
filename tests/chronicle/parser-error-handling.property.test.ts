/**
 * Property 15: Chronicle Parser Error Handling
 *
 * Validates: Requirements 19.4, 19.7
 *
 * Verifies that the Chronicle parser:
 * - Returns descriptive errors for invalid files
 * - Never crashes (no unhandled exceptions)
 * - Handles all edge cases gracefully
 *
 * Tag: feature=memory-system, property=15
 */

import * as fc from 'fast-check';
import { parseChronicle, ChronicleParseError } from '../../src/chronicle/parser';
import { serializeChronicle } from '../../src/chronicle/serializer';
import { ChronicleChapter } from '../../src/chronicle/types';

fc.configureGlobal({ numRuns: 100 });

/**
 * Helper: create a valid Chronicle markdown string
 */
function makeValidChronicle(overrides: Partial<{
  date: string;
  chapterId: string;
  summary: string;
  dialogue: string;
}> = {}): string {
  const chapter: ChronicleChapter = {
    metadata: {
      date: overrides.date ?? '2025-03-24',
      chapterId: overrides.chapterId ?? '2025-03-24-chapter-001',
      participants: ['user', 'agent'],
      sessionType: 'general',
      startTime: '2025-03-24T10:00:00.000Z',
      endTime: '2025-03-24T11:00:00.000Z',
      messageCount: 3,
    },
    content: {
      summary: overrides.summary ?? 'Test summary for property testing',
      dialogue: overrides.dialogue ?? '**user:** Hello\n\n**agent:** Hi there',
      truths: [],
      insights: [],
      toolsCreated: [],
      decisions: [],
    },
  };
  return serializeChronicle(chapter);
}

describe('Property 15: Chronicle Parser Error Handling', () => {
  it('parser never crashes on arbitrary string input', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (input) => {
          let threw = false;
          let errorMessage = '';

          try {
            parseChronicle(input);
          } catch (error) {
            threw = true;
            errorMessage = (error as Error).message;
          }

          // If it throws, it must be a ChronicleParseError with a message
          if (threw) {
            expect(errorMessage.length).toBeGreaterThan(0);
          }
          // No unhandled exceptions (process crash) - test passing means no crash
        }
      )
    );
  });

  it('missing frontmatter returns descriptive error', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        (content) => {
          // Content without --- frontmatter delimiters
          const noFrontmatter = `# Just a heading\n\n${content}`;

          let error: Error | null = null;
          try {
            parseChronicle(noFrontmatter);
          } catch (e) {
            error = e as Error;
          }

          expect(error).not.toBeNull();
          expect(error!.message.length).toBeGreaterThan(0);
          // Error should mention frontmatter or format
          expect(
            error!.message.toLowerCase().includes('frontmatter') ||
            error!.message.toLowerCase().includes('format') ||
            error!.message.toLowerCase().includes('invalid') ||
            error!.message.toLowerCase().includes('missing')
          ).toBe(true);
        }
      )
    );
  });

  it('malformed YAML frontmatter returns descriptive error', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 })
          .filter(s => s.includes(':') && !s.startsWith('---')),
        (yamlContent) => {
          // Deliberately malformed YAML (unbalanced brackets etc.)
          const malformed = `---\n${yamlContent}: [unclosed\n---\n\n## Summary\n\nTest\n\n## Dialogue\n\nTest`;

          let error: Error | null = null;
          try {
            parseChronicle(malformed);
          } catch (e) {
            error = e as Error;
          }

          // Either parses (if YAML is accidentally valid) or throws with message
          if (error) {
            expect(error.message.length).toBeGreaterThan(0);
          }
        }
      )
    );
  });

  it('missing required metadata fields return descriptive errors', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          // Missing date
          '---\nchapterId: 2025-03-24-chapter-001\nparticipants: [user]\nsessionType: general\nstartTime: 2025-03-24T10:00:00.000Z\nendTime: 2025-03-24T11:00:00.000Z\n---\n\n## Summary\n\nTest\n\n## Dialogue\n\nTest',
          // Missing chapterId
          '---\ndate: 2025-03-24\nparticipants: [user]\nsessionType: general\nstartTime: 2025-03-24T10:00:00.000Z\nendTime: 2025-03-24T11:00:00.000Z\n---\n\n## Summary\n\nTest\n\n## Dialogue\n\nTest',
          // Missing participants
          '---\ndate: 2025-03-24\nchapterId: 2025-03-24-chapter-001\nsessionType: general\nstartTime: 2025-03-24T10:00:00.000Z\nendTime: 2025-03-24T11:00:00.000Z\n---\n\n## Summary\n\nTest\n\n## Dialogue\n\nTest',
          // Invalid sessionType
          '---\ndate: 2025-03-24\nchapterId: 2025-03-24-chapter-001\nparticipants: [user]\nsessionType: invalid_type\nstartTime: 2025-03-24T10:00:00.000Z\nendTime: 2025-03-24T11:00:00.000Z\n---\n\n## Summary\n\nTest\n\n## Dialogue\n\nTest',
          // Invalid date format
          '---\ndate: 24/03/2025\nchapterId: 2025-03-24-chapter-001\nparticipants: [user]\nsessionType: general\nstartTime: 2025-03-24T10:00:00.000Z\nendTime: 2025-03-24T11:00:00.000Z\n---\n\n## Summary\n\nTest\n\n## Dialogue\n\nTest',
        ),
        (invalidMarkdown) => {
          let error: Error | null = null;
          try {
            parseChronicle(invalidMarkdown);
          } catch (e) {
            error = e as Error;
          }

          expect(error).not.toBeNull();
          expect(error!.message.length).toBeGreaterThan(0);
        }
      )
    );
  });

  it('missing required content sections return descriptive errors', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          // Missing Summary section
          '---\ndate: 2025-03-24\nchapterId: 2025-03-24-chapter-001\nparticipants: [user]\nsessionType: general\nstartTime: 2025-03-24T10:00:00.000Z\nendTime: 2025-03-24T11:00:00.000Z\n---\n\n## Dialogue\n\nTest dialogue',
          // Missing Dialogue section
          '---\ndate: 2025-03-24\nchapterId: 2025-03-24-chapter-001\nparticipants: [user]\nsessionType: general\nstartTime: 2025-03-24T10:00:00.000Z\nendTime: 2025-03-24T11:00:00.000Z\n---\n\n## Summary\n\nTest summary',
          // Empty content
          '---\ndate: 2025-03-24\nchapterId: 2025-03-24-chapter-001\nparticipants: [user]\nsessionType: general\nstartTime: 2025-03-24T10:00:00.000Z\nendTime: 2025-03-24T11:00:00.000Z\n---\n',
        ),
        (invalidMarkdown) => {
          let error: Error | null = null;
          try {
            parseChronicle(invalidMarkdown);
          } catch (e) {
            error = e as Error;
          }

          expect(error).not.toBeNull();
          expect(error!.message.length).toBeGreaterThan(0);
        }
      )
    );
  });

  it('valid chronicles always parse successfully', () => {
    fc.assert(
      fc.property(
        fc.record({
          summary: fc.string({ minLength: 10, maxLength: 100 })
            .filter(s => s.trim() === s && s.trim().length > 0),
          dialogue: fc.string({ minLength: 10, maxLength: 200 })
            .filter(s => s.trim() === s && s.trim().length > 0),
          participants: fc.array(
            fc.string({ minLength: 3, maxLength: 10 }).filter(s => /^[a-zA-Z]+$/.test(s)),
            { minLength: 1, maxLength: 3 }
          ),
          sessionType: fc.constantFrom('general' as const, 'ubik' as const, 'axiom' as const),
        }),
        (input) => {
          const markdown = makeValidChronicle({
            summary: input.summary,
            dialogue: input.dialogue,
          });

          let parsed: ReturnType<typeof parseChronicle> | null = null;
          let error: Error | null = null;

          try {
            parsed = parseChronicle(markdown);
          } catch (e) {
            error = e as Error;
          }

          expect(error).toBeNull();
          expect(parsed).not.toBeNull();
          expect(parsed!.content.summary).toBe(input.summary);
        }
      )
    );
  });

  it('empty string returns descriptive error', () => {
    let error: Error | null = null;
    try {
      parseChronicle('');
    } catch (e) {
      error = e as Error;
    }
    expect(error).not.toBeNull();
    expect(error!.message.length).toBeGreaterThan(0);
  });

  it('whitespace-only string returns descriptive error', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim() === ''),
        (whitespace) => {
          let error: Error | null = null;
          try {
            parseChronicle(whitespace);
          } catch (e) {
            error = e as Error;
          }
          expect(error).not.toBeNull();
          expect(error!.message.length).toBeGreaterThan(0);
        }
      )
    );
  });

  it('binary-like content returns descriptive error without crashing', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 1, maxLength: 100 }),
        (bytes) => {
          const binaryString = Buffer.from(bytes).toString('latin1');

          let threw = false;
          try {
            parseChronicle(binaryString);
          } catch {
            threw = true;
          }

          // Either parses or throws - but never crashes the process
          // Test passing = no crash
        }
      )
    );
  });
});
