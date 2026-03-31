import * as fc from 'fast-check';
import { parseChronicle } from '../../src/chronicle/parser';
import { serializeChronicle } from '../../src/chronicle/serializer';
import { ChronicleChapter, ChronicleMetadata, ChronicleContent } from '../../src/chronicle/types';

/**
 * Property 4: Chronicle Round-Trip Serialization
 * 
 * For any valid Chronicle object, parsing then serializing then parsing
 * should produce an equivalent object.
 * 
 * Property: parse(serialize(obj)) ≈ obj
 * 
 * Validates: Requirements 19.6
 * Tags: feature=memory-system, property=4
 */

describe('Property 4: Chronicle Round-Trip Serialization', () => {
  // Configure fast-check to run 100 iterations
  const testConfig = { numRuns: 100 };

  // Arbitrary for valid date strings (YYYY-MM-DD)
  const dateArbitrary = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
    .map(date => date.toISOString().split('T')[0]);

  // Arbitrary for valid ISO 8601 timestamps
  const timestampArbitrary = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
    .map(date => date.toISOString());

  // Arbitrary for chapter ID (YYYY-MM-DD-chapter-NNN)
  const chapterIdArbitrary = fc.tuple(dateArbitrary, fc.integer({ min: 1, max: 999 }))
    .map(([date, num]) => `${date}-chapter-${num.toString().padStart(3, '0')}`);

  // Arbitrary for session type
  const sessionTypeArbitrary = fc.constantFrom('general', 'ubik', 'axiom');

  // Arbitrary for non-empty string (for content) - excludes whitespace-only strings
  const nonEmptyStringArbitrary = fc.string({ minLength: 1, maxLength: 500 })
    .filter(s => s.trim().length > 0);

  // Arbitrary for array of strings - excludes whitespace-only strings
  const stringArrayArbitrary = fc.array(
    fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
    { maxLength: 10 }
  );

  // Arbitrary for Chronicle metadata
  const metadataArbitrary: fc.Arbitrary<ChronicleMetadata> = fc.record({
    date: dateArbitrary,
    chapterId: chapterIdArbitrary,
    participants: fc.array(
      fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
      { minLength: 1, maxLength: 5 }
    ),
    sessionType: sessionTypeArbitrary as fc.Arbitrary<'general' | 'ubik' | 'axiom'>,
    startTime: timestampArbitrary,
    endTime: timestampArbitrary,
    tags: fc.option(stringArrayArbitrary, { nil: undefined }),
    summary: fc.option(fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0), { nil: undefined }),
    messageCount: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
  });

  // Arbitrary for Chronicle content
  const contentArbitrary: fc.Arbitrary<ChronicleContent> = fc.record({
    summary: nonEmptyStringArbitrary,
    dialogue: nonEmptyStringArbitrary,
    truths: stringArrayArbitrary,
    insights: stringArrayArbitrary,
    toolsCreated: stringArrayArbitrary,
    decisions: stringArrayArbitrary,
  });

  // Arbitrary for complete Chronicle chapter
  const chapterArbitrary: fc.Arbitrary<ChronicleChapter> = fc.record({
    metadata: metadataArbitrary,
    content: contentArbitrary,
  });

  it('should maintain equivalence through round-trip serialization', () => {
    fc.assert(
      fc.property(chapterArbitrary, (originalChapter) => {
        // Serialize the chapter to markdown
        const markdown = serializeChronicle(originalChapter);
        
        // Parse the markdown back to an object
        const parsedChapter = parseChronicle(markdown);
        
        // Compare metadata (field by field for better error messages)
        expect(parsedChapter.metadata.date).toBe(originalChapter.metadata.date);
        expect(parsedChapter.metadata.chapterId).toBe(originalChapter.metadata.chapterId);
        expect(parsedChapter.metadata.participants).toEqual(originalChapter.metadata.participants);
        expect(parsedChapter.metadata.sessionType).toBe(originalChapter.metadata.sessionType);
        expect(parsedChapter.metadata.startTime).toBe(originalChapter.metadata.startTime);
        expect(parsedChapter.metadata.endTime).toBe(originalChapter.metadata.endTime);
        
        // Optional metadata fields
        if (originalChapter.metadata.tags && originalChapter.metadata.tags.length > 0) {
          expect(parsedChapter.metadata.tags).toEqual(originalChapter.metadata.tags);
        }
        if (originalChapter.metadata.summary) {
          expect(parsedChapter.metadata.summary).toBe(originalChapter.metadata.summary);
        }
        if (originalChapter.metadata.messageCount !== undefined) {
          expect(parsedChapter.metadata.messageCount).toBe(originalChapter.metadata.messageCount);
        }
        
        // Compare content (parser trims whitespace, so we compare trimmed versions)
        expect(parsedChapter.content.summary).toBe(originalChapter.content.summary.trim());
        expect(parsedChapter.content.dialogue).toBe(originalChapter.content.dialogue.trim());
        expect(parsedChapter.content.truths).toEqual(originalChapter.content.truths.map(t => t.trim()));
        expect(parsedChapter.content.insights).toEqual(originalChapter.content.insights.map(i => i.trim()));
        expect(parsedChapter.content.toolsCreated).toEqual(originalChapter.content.toolsCreated.map(t => t.trim()));
        expect(parsedChapter.content.decisions).toEqual(originalChapter.content.decisions.map(d => d.trim()));
      }),
      testConfig
    );
  });

  it('should handle edge cases in round-trip', () => {
    fc.assert(
      fc.property(chapterArbitrary, (originalChapter) => {
        // First round-trip
        const markdown1 = serializeChronicle(originalChapter);
        const parsed1 = parseChronicle(markdown1);
        
        // Second round-trip (should be idempotent)
        const markdown2 = serializeChronicle(parsed1);
        const parsed2 = parseChronicle(markdown2);
        
        // Both parsed results should be equivalent
        expect(parsed2).toEqual(parsed1);
      }),
      testConfig
    );
  });

  it('should preserve special characters through round-trip', () => {
    const specialCharsArbitrary = fc.record({
      metadata: metadataArbitrary,
      content: fc.record({
        summary: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        dialogue: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
        truths: fc.array(fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), { maxLength: 5 }),
        insights: fc.array(fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), { maxLength: 5 }),
        toolsCreated: fc.array(fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), { maxLength: 5 }),
        decisions: fc.array(fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0), { maxLength: 5 }),
      }),
    });

    fc.assert(
      fc.property(specialCharsArbitrary, (chapter) => {
        const markdown = serializeChronicle(chapter);
        const parsed = parseChronicle(markdown);
        
        // Content should be preserved (trimmed)
        expect(parsed.content.summary).toBe(chapter.content.summary.trim());
        expect(parsed.content.dialogue).toBe(chapter.content.dialogue.trim());
      }),
      { numRuns: 50 } // Fewer runs for this test
    );
  });

  it('should handle empty optional arrays through round-trip', () => {
    const minimalChapterArbitrary = fc.record({
      metadata: metadataArbitrary,
      content: fc.record({
        summary: nonEmptyStringArbitrary,
        dialogue: nonEmptyStringArbitrary,
        truths: fc.constant([]),
        insights: fc.constant([]),
        toolsCreated: fc.constant([]),
        decisions: fc.constant([]),
      }),
    });

    fc.assert(
      fc.property(minimalChapterArbitrary, (chapter) => {
        const markdown = serializeChronicle(chapter);
        const parsed = parseChronicle(markdown);
        
        // Empty arrays should remain empty
        expect(parsed.content.truths).toEqual([]);
        expect(parsed.content.insights).toEqual([]);
        expect(parsed.content.toolsCreated).toEqual([]);
        expect(parsed.content.decisions).toEqual([]);
      }),
      { numRuns: 50 }
    );
  });
});
