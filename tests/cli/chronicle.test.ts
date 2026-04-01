/**
 * CLI Chronicle Commands Tests
 * 
 * Tests for chronicle list, read, search commands
 */

import { UnifiedMemoryService } from '../../src/memory/UnifiedMemoryService';
import * as fc from 'fast-check';

// Mock console methods
const originalLog = console.log;
const originalError = console.error;

describe('CLI Chronicle Commands', () => {
  let memoryService: UnifiedMemoryService;
  let consoleOutput: string[];
  let consoleErrors: string[];
  
  beforeEach(async () => {
    memoryService = new UnifiedMemoryService();
    await memoryService.initialize();
    
    // Capture console output
    consoleOutput = [];
    consoleErrors = [];
    console.log = jest.fn((...args) => {
      consoleOutput.push(args.map(a => String(a)).join(' '));
    });
    console.error = jest.fn((...args) => {
      consoleErrors.push(args.map(a => String(a)).join(' '));
    });
  });
  
  afterEach(async () => {
    await memoryService.shutdown();
    console.log = originalLog;
    console.error = originalError;
  });
  
  describe('chronicle:list', () => {
    it('should list chronicle chapters', async () => {
      const layers = memoryService.getLayers();
      
      // Write some test chapters
      await layers.chronicle.write({
        date: new Date().toISOString().split('T')[0],
        participants: ['user', 'axiom'],
        sessionType: 'general',
        content: 'Test chapter 1',
      });
      await layers.chronicle.write({
        date: new Date().toISOString().split('T')[0],
        participants: ['user', 'ubik'],
        sessionType: 'general',
        content: 'Test chapter 2',
      });
      
      // List chapters
      const chapters = await layers.chronicle.list('general');
      
      expect(chapters.length).toBeGreaterThanOrEqual(2);
      expect(chapters[0]).toHaveProperty('chapterId');
      expect(chapters[0]).toHaveProperty('date');
      expect(chapters[0]).toHaveProperty('participants');
      expect(chapters[0]).toHaveProperty('content');
    });
    
    it('should filter by session type', async () => {
      const layers = memoryService.getLayers();
      
      // Write chapters of different types
      await layers.chronicle.write({
        date: new Date().toISOString().split('T')[0],
        participants: ['user'],
        sessionType: 'general',
        content: 'General chapter',
      });
      await layers.chronicle.write({
        date: new Date().toISOString().split('T')[0],
        participants: ['user', 'ubik'],
        sessionType: 'ubik',
        content: 'Ubik chapter',
      });
      
      // List only ubik chapters
      const ubikChapters = await layers.chronicle.list('ubik');
      
      expect(ubikChapters.length).toBeGreaterThanOrEqual(1);
      // All should be ubik type
      ubikChapters.forEach(chapter => {
        expect(chapter.sessionType).toBe('ubik');
      });
    });
    
    it('should handle empty chronicle', async () => {
      const layers = memoryService.getLayers();
      
      // List non-existent type
      const chapters = await layers.chronicle.list('nonexistent' as any);
      
      expect(chapters).toEqual([]);
    });
  });
  
  describe('chronicle:read', () => {
    it('should read a specific chapter', async () => {
      const layers = memoryService.getLayers();
      
      // Write a test chapter
      await layers.chronicle.write({
        date: new Date().toISOString().split('T')[0],
        participants: ['user', 'axiom'],
        sessionType: 'general',
        content: 'Test chapter content',
      });
      
      // Read it back
      const chapters = await layers.chronicle.list('general');
      const chapter = chapters.find(c => c.content.includes('Test chapter content'));
      
      expect(chapter).toBeDefined();
      expect(chapter?.content).toContain('Test chapter content');
    });
  });
  
  describe('chronicle:search', () => {
    it('should search chronicle content', async () => {
      const layers = memoryService.getLayers();
      
      // Write searchable content
      await layers.chronicle.write({
        date: new Date().toISOString().split('T')[0],
        participants: ['user'],
        sessionType: 'general',
        content: 'This is a unique searchable phrase',
      });
      
      // Search
      const results = await layers.chronicle.search({ content: 'unique searchable' });
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain('unique searchable');
    });
    
    it('should return empty results for non-matching query', async () => {
      const layers = memoryService.getLayers();
      
      const results = await layers.chronicle.search({ content: 'nonexistent_xyz_query' });
      
      expect(results).toEqual([]);
    });
  });
  
  describe('Property: Chronicle Immutability', () => {
    it('chronicle entries should never be modified after write', () => {
      fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 200 }),
          fc.constantFrom('general', 'ubik', 'axiom'),
          fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 1, maxLength: 3 }),
          async (content, type, participants) => {
            const layers = memoryService.getLayers();
            
            // Write chapter
            await layers.chronicle.write({
              date: new Date().toISOString().split('T')[0],
              participants,
              sessionType: type as any,
              content,
            });
            
            // Read it back
            const chapters = await layers.chronicle.list(type as any);
            const chapter = chapters.find(c => c.content === content);
            
            // Content should match exactly
            expect(chapter?.content).toBe(content);
            expect(chapter?.participants).toEqual(participants);
          }
        ),
        { numRuns: 10 }
      );
    });
  });
  
  describe('Error Handling', () => {
    it('should handle list errors gracefully', async () => {
      const testService = new UnifiedMemoryService();
      await testService.initialize();
      await testService.shutdown();
      
      const layers = testService.getLayers();
      await expect(layers.chronicle.list('general')).rejects.toThrow();
    });
    
    it('should handle write errors gracefully', async () => {
      const testService = new UnifiedMemoryService();
      await testService.initialize();
      await testService.shutdown();
      
      const layers = testService.getLayers();
      await expect(
        layers.chronicle.write({
          date: new Date().toISOString().split('T')[0],
          participants: ['user'],
          sessionType: 'general',
          content: 'test',
        })
      ).rejects.toThrow();
    });
  });
});
