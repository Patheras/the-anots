import { serializeChronicle, serializeChronicleWithOptions } from '../../src/chronicle/serializer';
import { ChronicleChapter } from '../../src/chronicle/types';

describe('Chronicle Serializer', () => {
  const sampleChapter: ChronicleChapter = {
    metadata: {
      date: '2026-03-22',
      chapterId: '2026-03-22-chapter-001',
      participants: ['Chip', 'Ubik'],
      sessionType: 'general',
      startTime: '2026-03-22T10:00:00.000Z',
      endTime: '2026-03-22T11:00:00.000Z',
      tags: ['memory-system', 'typescript'],
      summary: 'Discussion about Chronicle implementation',
      messageCount: 42,
    },
    content: {
      summary: 'This session focused on implementing the Chronicle layer.',
      dialogue: '**Chip:** Let\'s implement Chronicle\n**Ubik:** Great idea!',
      truths: ['Chronicle is L1', 'YAML frontmatter contains metadata'],
      insights: ['Memory system needs 4 layers'],
      toolsCreated: ['ChronicleParser'],
      decisions: ['Use js-yaml for parsing'],
    },
  };

  describe('serializeChronicle', () => {
    it('should serialize complete chapter to markdown', () => {
      const markdown = serializeChronicle(sampleChapter);
      
      // Check frontmatter
      expect(markdown).toContain('---');
      expect(markdown).toContain('date:');
      expect(markdown).toContain('2026-03-22');
      expect(markdown).toContain('chapterId: 2026-03-22-chapter-001');
      expect(markdown).toContain('participants:');
      expect(markdown).toContain('- Chip');
      expect(markdown).toContain('- Ubik');
      expect(markdown).toContain('sessionType: general');
      expect(markdown).toContain('startTime:');
      expect(markdown).toContain('2026-03-22T10:00:00.000Z');
      expect(markdown).toContain('endTime:');
      expect(markdown).toContain('tags:');
      expect(markdown).toContain('- memory-system');
      expect(markdown).toContain('messageCount: 42');
      
      // Check content sections
      expect(markdown).toContain('## Summary');
      expect(markdown).toContain('This session focused on implementing the Chronicle layer.');
      expect(markdown).toContain('## Dialogue');
      expect(markdown).toContain('**Chip:** Let\'s implement Chronicle');
      expect(markdown).toContain('## Truths');
      expect(markdown).toContain('- Chronicle is L1');
      expect(markdown).toContain('## Insights');
      expect(markdown).toContain('- Memory system needs 4 layers');
      expect(markdown).toContain('## Tools Created');
      expect(markdown).toContain('- ChronicleParser');
      expect(markdown).toContain('## Decisions');
      expect(markdown).toContain('- Use js-yaml for parsing');
    });

    it('should serialize minimal chapter without optional fields', () => {
      const minimalChapter: ChronicleChapter = {
        metadata: {
          date: '2026-03-22',
          chapterId: '2026-03-22-chapter-001',
          participants: ['Chip'],
          sessionType: 'general',
          startTime: '2026-03-22T10:00:00.000Z',
          endTime: '2026-03-22T11:00:00.000Z',
        },
        content: {
          summary: 'Brief summary',
          dialogue: '**Chip:** Hello',
          truths: [],
          insights: [],
          toolsCreated: [],
          decisions: [],
        },
      };

      const markdown = serializeChronicle(minimalChapter);
      
      expect(markdown).toContain('date:');
      expect(markdown).toContain('2026-03-22');
      expect(markdown).toContain('## Summary');
      expect(markdown).toContain('Brief summary');
      expect(markdown).toContain('## Dialogue');
      expect(markdown).toContain('**Chip:** Hello');
      
      // Optional sections should not be included when empty
      expect(markdown).not.toContain('## Truths');
      expect(markdown).not.toContain('## Insights');
      expect(markdown).not.toContain('## Tools Created');
      expect(markdown).not.toContain('## Decisions');
    });

    it('should handle multiline dialogue', () => {
      const chapter: ChronicleChapter = {
        metadata: {
          date: '2026-03-22',
          chapterId: '2026-03-22-chapter-001',
          participants: ['Chip', 'Ubik'],
          sessionType: 'general',
          startTime: '2026-03-22T10:00:00.000Z',
          endTime: '2026-03-22T11:00:00.000Z',
        },
        content: {
          summary: 'Test',
          dialogue: '**Chip:** Line 1\n**Ubik:** Line 2\n**Chip:** Line 3',
          truths: [],
          insights: [],
          toolsCreated: [],
          decisions: [],
        },
      };

      const markdown = serializeChronicle(chapter);
      
      expect(markdown).toContain('**Chip:** Line 1');
      expect(markdown).toContain('**Ubik:** Line 2');
      expect(markdown).toContain('**Chip:** Line 3');
    });

    it('should handle special characters in content', () => {
      const chapter: ChronicleChapter = {
        metadata: {
          date: '2026-03-22',
          chapterId: '2026-03-22-chapter-001',
          participants: ['Chip'],
          sessionType: 'general',
          startTime: '2026-03-22T10:00:00.000Z',
          endTime: '2026-03-22T11:00:00.000Z',
        },
        content: {
          summary: 'Test with "quotes" and \'apostrophes\'',
          dialogue: '**Chip:** Code: `const x = 1;`',
          truths: ['Truth with *asterisks* and _underscores_'],
          insights: [],
          toolsCreated: [],
          decisions: [],
        },
      };

      const markdown = serializeChronicle(chapter);
      
      expect(markdown).toContain('Test with "quotes" and \'apostrophes\'');
      expect(markdown).toContain('Code: `const x = 1;`');
      expect(markdown).toContain('Truth with *asterisks* and _underscores_');
    });
  });

  describe('serializeChronicleWithOptions', () => {
    it('should use custom list marker', () => {
      const markdown = serializeChronicleWithOptions(sampleChapter, {
        listMarker: '*',
      });
      
      expect(markdown).toContain('* Chronicle is L1');
      expect(markdown).toContain('* Memory system needs 4 layers');
      expect(markdown).not.toContain('- Chronicle is L1');
    });

    it('should include empty sections when requested', () => {
      const minimalChapter: ChronicleChapter = {
        metadata: {
          date: '2026-03-22',
          chapterId: '2026-03-22-chapter-001',
          participants: ['Chip'],
          sessionType: 'general',
          startTime: '2026-03-22T10:00:00.000Z',
          endTime: '2026-03-22T11:00:00.000Z',
        },
        content: {
          summary: 'Test',
          dialogue: 'Test',
          truths: [],
          insights: [],
          toolsCreated: [],
          decisions: [],
        },
      };

      const markdown = serializeChronicleWithOptions(minimalChapter, {
        includeEmptySections: true,
      });
      
      expect(markdown).toContain('## Truths');
      expect(markdown).toContain('## Insights');
      expect(markdown).toContain('## Tools Created');
      expect(markdown).toContain('## Decisions');
    });

    it('should use custom indent size', () => {
      const markdown = serializeChronicleWithOptions(sampleChapter, {
        indentSize: 4,
      });
      
      // YAML should have 4-space indentation
      expect(markdown).toContain('    - Chip');
      expect(markdown).toContain('    - Ubik');
    });
  });
});
