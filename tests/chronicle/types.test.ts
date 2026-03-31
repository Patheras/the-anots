import {
  ChronicleMetadataSchema,
  ChronicleContentSchema,
  ChronicleChapterSchema,
  generateChapterId,
  parseChapterId,
  getChronicleDirectory,
  getChronicleFilePath,
  isValidDate,
  isValidISO8601,
} from '../../src/chronicle/types';

describe('Chronicle Types and Schemas', () => {
  describe('ChronicleMetadataSchema', () => {
    it('should validate correct metadata', () => {
      const validMetadata = {
        date: '2026-03-22',
        chapterId: '2026-03-22-chapter-001',
        participants: ['Chip', 'Ubik'],
        sessionType: 'general' as const,
        startTime: '2026-03-22T10:00:00.000Z',
        endTime: '2026-03-22T11:00:00.000Z',
      };

      const result = ChronicleMetadataSchema.safeParse(validMetadata);
      expect(result.success).toBe(true);
    });

    it('should reject invalid date format', () => {
      const invalidMetadata = {
        date: '22-03-2026', // Wrong format
        chapterId: '2026-03-22-chapter-001',
        participants: ['Chip'],
        sessionType: 'general' as const,
        startTime: '2026-03-22T10:00:00.000Z',
        endTime: '2026-03-22T11:00:00.000Z',
      };

      const result = ChronicleMetadataSchema.safeParse(invalidMetadata);
      expect(result.success).toBe(false);
    });

    it('should reject invalid chapter ID format', () => {
      const invalidMetadata = {
        date: '2026-03-22',
        chapterId: '2026-03-22-001', // Missing "chapter-"
        participants: ['Chip'],
        sessionType: 'general' as const,
        startTime: '2026-03-22T10:00:00.000Z',
        endTime: '2026-03-22T11:00:00.000Z',
      };

      const result = ChronicleMetadataSchema.safeParse(invalidMetadata);
      expect(result.success).toBe(false);
    });

    it('should reject invalid session type', () => {
      const invalidMetadata = {
        date: '2026-03-22',
        chapterId: '2026-03-22-chapter-001',
        participants: ['Chip'],
        sessionType: 'invalid' as any,
        startTime: '2026-03-22T10:00:00.000Z',
        endTime: '2026-03-22T11:00:00.000Z',
      };

      const result = ChronicleMetadataSchema.safeParse(invalidMetadata);
      expect(result.success).toBe(false);
    });

    it('should reject empty participants array', () => {
      const invalidMetadata = {
        date: '2026-03-22',
        chapterId: '2026-03-22-chapter-001',
        participants: [],
        sessionType: 'general' as const,
        startTime: '2026-03-22T10:00:00.000Z',
        endTime: '2026-03-22T11:00:00.000Z',
      };

      const result = ChronicleMetadataSchema.safeParse(invalidMetadata);
      expect(result.success).toBe(false);
    });

    it('should reject invalid ISO 8601 timestamp', () => {
      const invalidMetadata = {
        date: '2026-03-22',
        chapterId: '2026-03-22-chapter-001',
        participants: ['Chip'],
        sessionType: 'general' as const,
        startTime: '2026-03-22 10:00:00', // Not ISO 8601
        endTime: '2026-03-22T11:00:00.000Z',
      };

      const result = ChronicleMetadataSchema.safeParse(invalidMetadata);
      expect(result.success).toBe(false);
    });
  });

  describe('ChronicleContentSchema', () => {
    it('should validate correct content', () => {
      const validContent = {
        summary: 'Discussion about TypeScript memory system',
        dialogue: '**Chip:** Let\'s implement Chronicle\n**Ubik:** Great idea!',
        truths: ['TypeScript is type-safe', 'Chronicle is immutable'],
        insights: ['Memory system needs 4 layers'],
        toolsCreated: [],
        decisions: ['Use Zod for validation'],
      };

      const result = ChronicleContentSchema.safeParse(validContent);
      expect(result.success).toBe(true);
    });

    it('should reject empty summary', () => {
      const invalidContent = {
        summary: '',
        dialogue: 'Some dialogue',
      };

      const result = ChronicleContentSchema.safeParse(invalidContent);
      expect(result.success).toBe(false);
    });

    it('should reject empty dialogue', () => {
      const invalidContent = {
        summary: 'Some summary',
        dialogue: '',
      };

      const result = ChronicleContentSchema.safeParse(invalidContent);
      expect(result.success).toBe(false);
    });

    it('should provide default empty arrays for optional fields', () => {
      const minimalContent = {
        summary: 'Test summary',
        dialogue: 'Test dialogue',
      };

      const result = ChronicleContentSchema.parse(minimalContent);
      expect(result.truths).toEqual([]);
      expect(result.insights).toEqual([]);
      expect(result.toolsCreated).toEqual([]);
      expect(result.decisions).toEqual([]);
    });
  });

  describe('ChronicleChapterSchema', () => {
    it('should validate complete chapter', () => {
      const validChapter = {
        metadata: {
          date: '2026-03-22',
          chapterId: '2026-03-22-chapter-001',
          participants: ['Chip', 'Axiom'],
          sessionType: 'axiom' as const,
          startTime: '2026-03-22T10:00:00.000Z',
          endTime: '2026-03-22T11:00:00.000Z',
        },
        content: {
          summary: 'Technical audit session',
          dialogue: '**Chip:** Review the code\n**Axiom:** Analyzing...',
          truths: ['Code is well-structured'],
          insights: ['Need more tests'],
        },
      };

      const result = ChronicleChapterSchema.safeParse(validChapter);
      expect(result.success).toBe(true);
    });
  });

  describe('Helper Functions', () => {
    describe('generateChapterId', () => {
      it('should generate correct chapter ID', () => {
        expect(generateChapterId('2026-03-22', 1)).toBe('2026-03-22-chapter-001');
        expect(generateChapterId('2026-03-22', 42)).toBe('2026-03-22-chapter-042');
        expect(generateChapterId('2026-03-22', 999)).toBe('2026-03-22-chapter-999');
      });
    });

    describe('parseChapterId', () => {
      it('should parse valid chapter ID', () => {
        const result = parseChapterId('2026-03-22-chapter-001');
        expect(result).toEqual({
          date: '2026-03-22',
          sequenceNumber: 1,
        });
      });

      it('should return null for invalid chapter ID', () => {
        expect(parseChapterId('invalid-id')).toBeNull();
        expect(parseChapterId('2026-03-22-001')).toBeNull();
      });
    });

    describe('getChronicleDirectory', () => {
      it('should return correct directory for session type', () => {
        expect(getChronicleDirectory('general')).toBe('data/chronicle/chip/general');
        expect(getChronicleDirectory('ubik')).toBe('data/chronicle/chip/ubik');
        expect(getChronicleDirectory('axiom')).toBe('data/chronicle/chip/axiom');
      });
    });

    describe('getChronicleFilePath', () => {
      it('should return correct file path', () => {
        expect(getChronicleFilePath('2026-03-22-chapter-001', 'general'))
          .toBe('data/chronicle/chip/general/2026-03-22-chapter-001.md');
      });
    });

    describe('isValidDate', () => {
      it('should validate correct dates', () => {
        expect(isValidDate('2026-03-22')).toBe(true);
        expect(isValidDate('2026-01-01')).toBe(true);
        expect(isValidDate('2026-12-31')).toBe(true);
      });

      it('should reject invalid dates', () => {
        expect(isValidDate('2026-13-01')).toBe(false); // Invalid month
        expect(isValidDate('2026-02-30')).toBe(false); // Invalid day
        expect(isValidDate('22-03-2026')).toBe(false); // Wrong format
        expect(isValidDate('2026/03/22')).toBe(false); // Wrong separator
      });
    });

    describe('isValidISO8601', () => {
      it('should validate correct ISO 8601 timestamps', () => {
        expect(isValidISO8601('2026-03-22T10:00:00.000Z')).toBe(true);
        expect(isValidISO8601('2026-03-22T10:00:00.123Z')).toBe(true);
      });

      it('should reject invalid timestamps', () => {
        expect(isValidISO8601('2026-03-22 10:00:00')).toBe(false);
        expect(isValidISO8601('2026-03-22T10:00:00')).toBe(false); // Missing Z
        expect(isValidISO8601('invalid')).toBe(false);
      });
    });
  });
});
