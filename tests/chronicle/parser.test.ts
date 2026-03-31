import { parseChronicle, validateChronicle, ChronicleParseError } from '../../src/chronicle/parser';

describe('Chronicle Parser', () => {
  const validChronicle = `---
date: 2026-03-22
chapterId: 2026-03-22-chapter-001
participants:
  - Chip
  - Ubik
sessionType: general
startTime: 2026-03-22T10:00:00.000Z
endTime: 2026-03-22T11:00:00.000Z
tags:
  - memory-system
  - typescript
summary: Discussion about Chronicle implementation
messageCount: 42
---

## Summary

This session focused on implementing the Chronicle layer (L1) of the TCAM memory system. We discussed data models, schemas, and the parser implementation.

## Dialogue

**Chip:** Let's implement the Chronicle parser today.

**Ubik:** Great idea! Chronicle is the foundation of our memory system.

**Chip:** We need to parse YAML frontmatter and markdown content.

**Ubik:** I'll help with the markdown parsing logic.

## Truths

- Chronicle is L1 (immutable historical record)
- YAML frontmatter contains metadata
- Markdown sections contain dialogue and insights
- Parser must validate all fields

## Insights

- Memory system needs 4 independent layers
- Chronicle survives all other system failures
- Human-readable format is crucial for debugging

## Tools Created

- ChronicleParser class
- YAML frontmatter extractor

## Decisions

- Use js-yaml for YAML parsing
- Use Zod for schema validation
- Return descriptive errors for invalid files
`;

  describe('parseChronicle', () => {
    it('should parse valid Chronicle markdown', () => {
      const result = parseChronicle(validChronicle);
      
      expect(result.metadata.date).toBe('2026-03-22');
      expect(result.metadata.chapterId).toBe('2026-03-22-chapter-001');
      expect(result.metadata.participants).toEqual(['Chip', 'Ubik']);
      expect(result.metadata.sessionType).toBe('general');
      expect(result.metadata.tags).toEqual(['memory-system', 'typescript']);
      expect(result.metadata.messageCount).toBe(42);
      
      expect(result.content.summary).toContain('Chronicle layer');
      expect(result.content.dialogue).toContain('Chip:');
      expect(result.content.dialogue).toContain('Ubik:');
      expect(result.content.truths).toHaveLength(4);
      expect(result.content.insights).toHaveLength(3);
      expect(result.content.toolsCreated).toHaveLength(2);
      expect(result.content.decisions).toHaveLength(3);
    });

    it('should parse Chronicle with minimal content', () => {
      const minimalChronicle = `---
date: 2026-03-22
chapterId: 2026-03-22-chapter-001
participants:
  - Chip
sessionType: general
startTime: 2026-03-22T10:00:00.000Z
endTime: 2026-03-22T11:00:00.000Z
---

## Summary

Brief summary

## Dialogue

**Chip:** Hello
`;

      const result = parseChronicle(minimalChronicle);
      
      expect(result.metadata.participants).toEqual(['Chip']);
      expect(result.content.summary).toBe('Brief summary');
      expect(result.content.dialogue).toBe('**Chip:** Hello');
      expect(result.content.truths).toEqual([]);
      expect(result.content.insights).toEqual([]);
    });

    it('should throw error for missing frontmatter', () => {
      const invalidChronicle = `## Summary
No frontmatter here`;

      expect(() => parseChronicle(invalidChronicle)).toThrow(ChronicleParseError);
      expect(() => parseChronicle(invalidChronicle)).toThrow(/Missing YAML frontmatter/);
    });

    it('should throw error for malformed YAML', () => {
      const invalidChronicle = `---
date: 2026-03-22
participants: [Chip, Ubik
---

## Summary
Test`;

      expect(() => parseChronicle(invalidChronicle)).toThrow(ChronicleParseError);
      expect(() => parseChronicle(invalidChronicle)).toThrow(/Malformed YAML/);
    });

    it('should throw error for invalid metadata', () => {
      const invalidChronicle = `---
date: 22-03-2026
chapterId: 2026-03-22-chapter-001
participants:
  - Chip
sessionType: general
startTime: 2026-03-22T10:00:00.000Z
endTime: 2026-03-22T11:00:00.000Z
---

## Summary
Test

## Dialogue
Test`;

      expect(() => parseChronicle(invalidChronicle)).toThrow(ChronicleParseError);
      expect(() => parseChronicle(invalidChronicle)).toThrow(/Invalid metadata/);
    });

    it('should throw error for missing required section (Summary)', () => {
      const invalidChronicle = `---
date: 2026-03-22
chapterId: 2026-03-22-chapter-001
participants:
  - Chip
sessionType: general
startTime: 2026-03-22T10:00:00.000Z
endTime: 2026-03-22T11:00:00.000Z
---

## Dialogue
Test dialogue`;

      expect(() => parseChronicle(invalidChronicle)).toThrow(ChronicleParseError);
      expect(() => parseChronicle(invalidChronicle)).toThrow(/Missing required section.*Summary/);
    });

    it('should throw error for missing required section (Dialogue)', () => {
      const invalidChronicle = `---
date: 2026-03-22
chapterId: 2026-03-22-chapter-001
participants:
  - Chip
sessionType: general
startTime: 2026-03-22T10:00:00.000Z
endTime: 2026-03-22T11:00:00.000Z
---

## Summary
Test summary`;

      expect(() => parseChronicle(invalidChronicle)).toThrow(ChronicleParseError);
      expect(() => parseChronicle(invalidChronicle)).toThrow(/Missing required section.*Dialogue/);
    });

    it('should throw error for empty summary content', () => {
      const invalidChronicle = `---
date: 2026-03-22
chapterId: 2026-03-22-chapter-001
participants:
  - Chip
sessionType: general
startTime: 2026-03-22T10:00:00.000Z
endTime: 2026-03-22T11:00:00.000Z
---

## Summary

## Dialogue
Test dialogue`;

      // Empty summary section is treated as missing section
      expect(() => parseChronicle(invalidChronicle)).toThrow(ChronicleParseError);
      expect(() => parseChronicle(invalidChronicle)).toThrow(/Missing required section.*Summary/);
    });

    it('should parse list items correctly', () => {
      const chronicleWithLists = `---
date: 2026-03-22
chapterId: 2026-03-22-chapter-001
participants:
  - Chip
sessionType: general
startTime: 2026-03-22T10:00:00.000Z
endTime: 2026-03-22T11:00:00.000Z
---

## Summary
Test

## Dialogue
Test

## Truths
- Truth 1
- Truth 2
* Truth 3

## Insights
* Insight 1
- Insight 2
`;

      const result = parseChronicle(chronicleWithLists);
      
      expect(result.content.truths).toEqual(['Truth 1', 'Truth 2', 'Truth 3']);
      expect(result.content.insights).toEqual(['Insight 1', 'Insight 2']);
    });
  });

  describe('validateChronicle', () => {
    it('should return valid for correct Chronicle', () => {
      const result = validateChronicle(validChronicle);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return errors for invalid Chronicle', () => {
      const invalidChronicle = `---
date: invalid-date
---

## Summary
Test`;

      const result = validateChronicle(invalidChronicle);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return descriptive error messages', () => {
      const invalidChronicle = `No frontmatter`;

      const result = validateChronicle(invalidChronicle);
      
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Missing YAML frontmatter');
    });
  });
});
