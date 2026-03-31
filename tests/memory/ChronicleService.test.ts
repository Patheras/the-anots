/**
 * Tests for ChronicleService
 */

import { ChronicleService } from '../../src/memory/ChronicleService';
import { ChronicleEntry } from '../../src/core/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as fc from 'fast-check';

// Test data directory
const TEST_DATA_DIR = path.join(__dirname, '../../test-data/chronicle');

describe('ChronicleService', () => {
  let service: ChronicleService;

  beforeAll(async () => {
    // Set test Chronicle root
    process.env.CHRONICLE_ROOT = TEST_DATA_DIR;
  });

  beforeEach(async () => {
    // Clean test directory
    await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_DATA_DIR, { recursive: true });

    // Create service
    service = new ChronicleService();
    await service.initialize();
  });

  afterEach(async () => {
    await service.shutdown();
  });

  afterAll(async () => {
    // Clean up test directory
    await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
    delete process.env.CHRONICLE_ROOT;
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      expect(service.name).toBe('ChronicleService');
      expect(await service.isHealthy()).toBe(true);
    });

    it('should create Chronicle directories on init', async () => {
      const generalDir = path.join(TEST_DATA_DIR, 'chip/general');
      const ubikDir = path.join(TEST_DATA_DIR, 'chip/ubik');
      const axiomDir = path.join(TEST_DATA_DIR, 'chip/axiom');

      await expect(fs.access(generalDir)).resolves.not.toThrow();
      await expect(fs.access(ubikDir)).resolves.not.toThrow();
      await expect(fs.access(axiomDir)).resolves.not.toThrow();
    });

    it('should handle multiple initializations gracefully', async () => {
      await service.initialize();
      await service.initialize();
      
      expect(await service.isHealthy()).toBe(true);
    });
  });

  describe('Write Operations', () => {
    it('should write a Chronicle entry', async () => {
      const entry: ChronicleEntry = {
        chapterId: '2026-03-31-chapter-001',
        date: '2026-03-31',
        participants: ['Chip', 'User'],
        sessionType: 'general',
        content: '**Chip:** Hello!\n**User:** Hi there!',
        metadata: {
          summary: 'Test conversation',
          messageCount: 2,
        },
      };

      await expect(service.write(entry)).resolves.not.toThrow();

      // Verify file exists
      const exists = await service.exists('2026-03-31-chapter-001', 'general');
      expect(exists).toBe(true);
    });

    it('should auto-generate chapter ID if not provided', async () => {
      const entry: ChronicleEntry = {
        chapterId: '',
        date: '2026-03-31',
        participants: ['Chip'],
        sessionType: 'general',
        content: 'Test content',
      };

      await service.write(entry);

      // List chapters to find the auto-generated ID
      const chapters = await service.list('general');
      expect(chapters.length).toBe(1);
      expect(chapters[0].chapterId).toMatch(/^2026-03-31-chapter-\d{3}$/);
    });

    it('should write multiple chapters with sequential IDs', async () => {
      const date = '2026-03-31';
      
      for (let i = 0; i < 3; i++) {
        const entry: ChronicleEntry = {
          chapterId: '',
          date,
          participants: ['Chip'],
          sessionType: 'general',
          content: `Content ${i}`,
        };
        
        await service.write(entry);
      }

      const chapters = await service.list('general');
      expect(chapters.length).toBe(3);
      
      // Verify sequential IDs
      const ids = chapters.map(c => c.chapterId).sort();
      expect(ids[0]).toBe('2026-03-31-chapter-001');
      expect(ids[1]).toBe('2026-03-31-chapter-002');
      expect(ids[2]).toBe('2026-03-31-chapter-003');
    });

    it('should write to different session types', async () => {
      const sessionTypes: Array<'general' | 'ubik' | 'axiom'> = ['general', 'ubik', 'axiom'];
      
      for (const sessionType of sessionTypes) {
        const entry: ChronicleEntry = {
          chapterId: `2026-03-31-chapter-001`,
          date: '2026-03-31',
          participants: ['Chip'],
          sessionType,
          content: `Content for ${sessionType}`,
        };
        
        await service.write(entry);
      }

      // Verify each session type has one chapter
      for (const sessionType of sessionTypes) {
        const chapters = await service.list(sessionType);
        expect(chapters.length).toBe(1);
        expect(chapters[0].sessionType).toBe(sessionType);
      }
    });
  });

  describe('Read Operations', () => {
    it('should read a Chronicle entry', async () => {
      const entry: ChronicleEntry = {
        chapterId: '2026-03-31-chapter-001',
        date: '2026-03-31',
        participants: ['Chip', 'User'],
        sessionType: 'general',
        content: '**Chip:** Hello!\n**User:** Hi there!',
        metadata: {
          summary: 'Test conversation',
          messageCount: 2,
        },
      };

      await service.write(entry);

      const readEntry = await service.read('2026-03-31-chapter-001', 'general');
      
      expect(readEntry).not.toBeNull();
      expect(readEntry?.chapterId).toBe('2026-03-31-chapter-001');
      expect(readEntry?.date).toBe('2026-03-31');
      expect(readEntry?.participants).toEqual(['Chip', 'User']);
      expect(readEntry?.sessionType).toBe('general');
      expect(readEntry?.content).toContain('Hello!');
    });

    it('should return null for non-existent chapter', async () => {
      const entry = await service.read('2026-03-31-chapter-999', 'general');
      expect(entry).toBeNull();
    });

    it('should preserve metadata on read', async () => {
      const entry: ChronicleEntry = {
        chapterId: '2026-03-31-chapter-001',
        date: '2026-03-31',
        participants: ['Chip'],
        sessionType: 'general',
        content: 'Test content',
        metadata: {
          summary: 'Test summary',
          messageCount: 5,
          tags: ['test', 'chronicle'],
          truths: ['Truth 1', 'Truth 2'],
          insights: ['Insight 1'],
          decisions: ['Decision 1'],
        },
      };

      await service.write(entry);
      const readEntry = await service.read('2026-03-31-chapter-001', 'general');

      expect(readEntry?.metadata?.summary).toBe('Test summary');
      expect(readEntry?.metadata?.messageCount).toBe(5);
      expect(readEntry?.metadata?.tags).toEqual(['test', 'chronicle']);
      expect(readEntry?.metadata?.truths).toEqual(['Truth 1', 'Truth 2']);
      expect(readEntry?.metadata?.insights).toEqual(['Insight 1']);
      expect(readEntry?.metadata?.decisions).toEqual(['Decision 1']);
    });
  });

  describe('List Operations', () => {
    it('should list all chapters', async () => {
      // Write multiple chapters
      for (let i = 1; i <= 3; i++) {
        const entry: ChronicleEntry = {
          chapterId: `2026-03-31-chapter-00${i}`,
          date: '2026-03-31',
          participants: ['Chip'],
          sessionType: 'general',
          content: `Content ${i}`,
        };
        
        await service.write(entry);
      }

      const chapters = await service.list('general');
      expect(chapters.length).toBe(3);
    });

    it('should list chapters from all session types', async () => {
      const sessionTypes: Array<'general' | 'ubik' | 'axiom'> = ['general', 'ubik', 'axiom'];
      
      for (const sessionType of sessionTypes) {
        const entry: ChronicleEntry = {
          chapterId: '2026-03-31-chapter-001',
          date: '2026-03-31',
          participants: ['Chip'],
          sessionType,
          content: `Content for ${sessionType}`,
        };
        
        await service.write(entry);
      }

      const allChapters = await service.list();
      expect(allChapters.length).toBe(3);
    });

    it('should return empty array when no chapters exist', async () => {
      const chapters = await service.list('general');
      expect(chapters).toEqual([]);
    });

    it('should sort chapters by date (newest first)', async () => {
      const dates = ['2026-03-29', '2026-03-31', '2026-03-30'];
      
      for (const date of dates) {
        const entry: ChronicleEntry = {
          chapterId: `${date}-chapter-001`,
          date,
          participants: ['Chip'],
          sessionType: 'general',
          content: `Content for ${date}`,
        };
        
        await service.write(entry);
      }

      const chapters = await service.list('general');
      expect(chapters[0].date).toBe('2026-03-31');
      expect(chapters[1].date).toBe('2026-03-30');
      expect(chapters[2].date).toBe('2026-03-29');
    });
  });

  describe('Search Operations', () => {
    beforeEach(async () => {
      // Create test data
      const entries: ChronicleEntry[] = [
        {
          chapterId: '2026-03-31-chapter-001',
          date: '2026-03-31',
          participants: ['Chip', 'User'],
          sessionType: 'general',
          content: 'Discussion about memory systems',
          metadata: { summary: 'Memory system design' },
        },
        {
          chapterId: '2026-03-30-chapter-001',
          date: '2026-03-30',
          participants: ['Chip', 'Ubik'],
          sessionType: 'ubik',
          content: 'Philosophical dialogue about consciousness',
          metadata: { summary: 'Consciousness exploration' },
        },
        {
          chapterId: '2026-03-29-chapter-001',
          date: '2026-03-29',
          participants: ['Chip', 'Axiom'],
          sessionType: 'axiom',
          content: 'Code generation and testing',
          metadata: { summary: 'Testing strategies' },
        },
      ];

      for (const entry of entries) {
        await service.write(entry);
      }
    });

    it('should search by date', async () => {
      const results = await service.search({ date: '2026-03-31' });
      
      expect(results.length).toBe(1);
      expect(results[0].date).toBe('2026-03-31');
    });

    it('should search by participants', async () => {
      const results = await service.search({ participants: ['Ubik'] });
      
      expect(results.length).toBe(1);
      expect(results[0].participants).toContain('Ubik');
    });

    it('should search by session type', async () => {
      const results = await service.search({ sessionType: 'axiom' });
      
      expect(results.length).toBe(1);
      expect(results[0].sessionType).toBe('axiom');
    });

    it('should search by content', async () => {
      const results = await service.search({ content: 'memory' });
      
      expect(results.length).toBe(1);
      expect(results[0].content).toContain('memory');
    });

    it('should search by summary', async () => {
      const results = await service.search({ content: 'consciousness' });
      
      expect(results.length).toBe(1);
      expect(results[0].metadata?.summary).toContain('Consciousness');
    });

    it('should combine multiple search criteria', async () => {
      const results = await service.search({
        participants: ['Chip'],
        sessionType: 'general',
      });
      
      expect(results.length).toBe(1);
      expect(results[0].sessionType).toBe('general');
      expect(results[0].participants).toContain('Chip');
    });

    it('should return empty array when no matches', async () => {
      const results = await service.search({ content: 'nonexistent' });
      expect(results).toEqual([]);
    });

    it('should be case-insensitive for content search', async () => {
      const results = await service.search({ content: 'MEMORY' });
      expect(results.length).toBe(1);
    });
  });

  describe('Stats Operations', () => {
    it('should get chapter statistics', async () => {
      const entry: ChronicleEntry = {
        chapterId: '2026-03-31-chapter-001',
        date: '2026-03-31',
        participants: ['Chip'],
        sessionType: 'general',
        content: 'Test content',
      };

      await service.write(entry);

      const stats = await service.getStats('2026-03-31-chapter-001', 'general');
      
      expect(stats).not.toBeNull();
      expect(stats?.size).toBeGreaterThan(0);
      expect(stats?.created).toBeTruthy();
      expect(stats?.modified).toBeTruthy();
      expect(stats?.isReadOnly).toBe(true);
    });

    it('should return null for non-existent chapter', async () => {
      const stats = await service.getStats('2026-03-31-chapter-999', 'general');
      expect(stats).toBeNull();
    });
  });

  describe('Property Tests', () => {
    describe('Property 5: Chronicle Immutability', () => {
      it('should never overwrite existing chapters', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.string({ minLength: 10, maxLength: 100 }),
            async (content) => {
              const chapterId = '2026-03-31-chapter-001';
              
              const entry1: ChronicleEntry = {
                chapterId,
                date: '2026-03-31',
                participants: ['Chip'],
                sessionType: 'general',
                content: 'Original content',
              };

              const entry2: ChronicleEntry = {
                chapterId,
                date: '2026-03-31',
                participants: ['Chip'],
                sessionType: 'general',
                content,
              };

              // Write first entry
              await service.write(entry1);

              // Try to write second entry with same ID (should not overwrite)
              await service.write(entry2);

              // Read and verify original content is preserved
              const readEntry = await service.read(chapterId, 'general');
              expect(readEntry?.content).toBe('Original content');
            }
          ),
          { numRuns: 20 } // Reduced from 50 due to Git commit overhead
        );
      }, 30000); // 30 second timeout
    });

    describe('Property 6: Chronicle Write-Read Round-Trip', () => {
      it('should preserve data through write-read cycle', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              date: fc.constant('2026-03-31'),
              participants: fc.array(
                fc.string({ minLength: 2, maxLength: 20 }).filter(s => s.trim().length > 0),
                { minLength: 1, maxLength: 3 }
              ),
              content: fc.string({ minLength: 10, maxLength: 200 }).filter(s => s.trim().length > 0),
              summary: fc.string({ minLength: 10, maxLength: 50 }).filter(s => s.trim().length > 0),
            }),
            async (data) => {
              const chapterId = `2026-03-31-chapter-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
              
              const entry: ChronicleEntry = {
                chapterId,
                date: data.date,
                participants: data.participants,
                sessionType: 'general',
                content: data.content,
                metadata: {
                  summary: data.summary,
                },
              };

              // Write
              await service.write(entry);

              // Read
              const readEntry = await service.read(chapterId, 'general');

              // Verify
              expect(readEntry).not.toBeNull();
              expect(readEntry?.chapterId).toBe(chapterId);
              expect(readEntry?.date).toBe(data.date);
              expect(readEntry?.participants).toEqual(data.participants);
              expect(readEntry?.content).toBe(data.content);
              expect(readEntry?.metadata?.summary).toBe(data.summary);
            }
          ),
          { numRuns: 20 } // Reduced from 50 due to Git commit overhead
        );
      }, 30000); // 30 second timeout for property test with Git commits
    });
  });

  describe('Error Handling', () => {
    it('should throw error when not initialized', async () => {
      const uninitializedService = new ChronicleService();
      
      const entry: ChronicleEntry = {
        chapterId: '2026-03-31-chapter-001',
        date: '2026-03-31',
        participants: ['Chip'],
        sessionType: 'general',
        content: 'Test',
      };

      await expect(uninitializedService.write(entry)).rejects.toThrow('not initialized');
    });

    it('should report unhealthy when not initialized', async () => {
      const uninitializedService = new ChronicleService();
      expect(await uninitializedService.isHealthy()).toBe(false);
    });
  });
});
