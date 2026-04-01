/**
 * CLI Memory Commands Tests
 * 
 * Tests for memory search, store, stats commands
 */

import { UnifiedMemoryService } from '../../src/memory/UnifiedMemoryService';
import * as fc from 'fast-check';

// Mock console methods
const originalLog = console.log;
const originalError = console.error;

describe('CLI Memory Commands', () => {
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
  
  describe('memory:search', () => {
    it('should search memory and display results', async () => {
      // Store some test data
      await memoryService.store('Test content about AI agents', { type: 'test' });
      await memoryService.store('Another test about memory systems', { type: 'test' });
      
      // Search
      const results = await memoryService.search('test', 10);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('content');
      expect(results[0]).toHaveProperty('source');
      expect(results[0]).toHaveProperty('score');
    });
    
    it('should handle empty search results', async () => {
      const results = await memoryService.search('nonexistent_query_xyz', 10);
      
      expect(results).toEqual([]);
    });
    
    it('should respect limit parameter', async () => {
      // Store multiple items
      for (let i = 0; i < 5; i++) {
        await memoryService.store(`Test content ${i}`, { index: i });
      }
      
      const results = await memoryService.search('test', 3);
      
      expect(results.length).toBeLessThanOrEqual(3);
    });
  });
  
  describe('memory:store', () => {
    it('should store content successfully', async () => {
      const content = 'Test content for storage';
      
      await memoryService.store(content);
      
      // Verify by searching
      const results = await memoryService.search('storage', 10);
      expect(results.length).toBeGreaterThan(0);
    });
    
    it('should store content with metadata', async () => {
      const content = 'Test content with metadata';
      const metadata = { author: 'test', type: 'example' };
      
      await memoryService.store(content, metadata);
      
      // Verify storage
      const results = await memoryService.search('metadata', 10);
      expect(results.length).toBeGreaterThan(0);
    });
  });
  
  describe('memory:stats', () => {
    it('should return memory statistics', async () => {
      const stats = await memoryService.getStats();
      
      expect(stats).toHaveProperty('chronicle');
      expect(stats).toHaveProperty('activeStream');
      expect(stats).toHaveProperty('hiveMind');
      expect(stats).toHaveProperty('codex');
      
      expect(stats.chronicle).toHaveProperty('chapterCount');
      expect(stats.activeStream).toHaveProperty('sessionCount');
      expect(stats.hiveMind).toHaveProperty('memoryCount');
      expect(stats.codex).toHaveProperty('ubikInitialized');
      expect(stats.codex).toHaveProperty('axiomInitialized');
    });
    
    it('should return layer health status', async () => {
      const health = await memoryService.getLayerHealth();
      
      expect(health).toHaveProperty('chronicle');
      expect(health).toHaveProperty('activeStream');
      expect(health).toHaveProperty('hiveMind');
      expect(health).toHaveProperty('codex');
      
      expect(typeof health.chronicle).toBe('boolean');
      expect(typeof health.activeStream).toBe('boolean');
      expect(typeof health.hiveMind).toBe('boolean');
      expect(typeof health.codex).toBe('boolean');
    });
  });
  
  describe('Error Handling', () => {
    it('should handle search errors gracefully', async () => {
      // Create a new service instance for this test
      const testService = new UnifiedMemoryService();
      await testService.initialize();
      
      // Force an error by shutting down service
      await testService.shutdown();
      
      await expect(testService.search('test', 10)).rejects.toThrow();
    });
    
    it('should handle store errors gracefully', async () => {
      // Create a new service instance for this test
      const testService = new UnifiedMemoryService();
      await testService.initialize();
      
      // Force an error by shutting down service
      await testService.shutdown();
      
      await expect(testService.store('test')).rejects.toThrow();
    });
  });
});
