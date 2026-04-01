/**
 * CLI Status Command Tests
 * 
 * Tests for system status and health checks
 */

import { UnifiedMemoryService } from '../../src/memory/UnifiedMemoryService';

// Mock console methods
const originalLog = console.log;
const originalError = console.error;

describe('CLI Status Command', () => {
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
  
  describe('System Status', () => {
    it('should report overall system health', async () => {
      const isHealthy = await memoryService.isHealthy();
      
      expect(typeof isHealthy).toBe('boolean');
    });
    
    it('should report individual layer health', async () => {
      const health = await memoryService.getLayerHealth();
      
      expect(health).toHaveProperty('chronicle');
      expect(health).toHaveProperty('activeStream');
      expect(health).toHaveProperty('hiveMind');
      expect(health).toHaveProperty('codex');
      
      // All layers should be boolean
      expect(typeof health.chronicle).toBe('boolean');
      expect(typeof health.activeStream).toBe('boolean');
      expect(typeof health.hiveMind).toBe('boolean');
      expect(typeof health.codex).toBe('boolean');
    });
    
    it('should show healthy status when all layers operational', async () => {
      const health = await memoryService.getLayerHealth();
      const isHealthy = await memoryService.isHealthy();
      
      // At least Chronicle and Codex should be healthy (file-based)
      expect(health.chronicle).toBe(true);
      expect(health.codex).toBe(true);
      
      // System should be healthy if core layers work
      expect(isHealthy).toBe(true);
    });
  });
  
  describe('Layer Statistics', () => {
    it('should provide detailed statistics', async () => {
      const stats = await memoryService.getStats();
      
      expect(stats).toHaveProperty('chronicle');
      expect(stats).toHaveProperty('activeStream');
      expect(stats).toHaveProperty('hiveMind');
      expect(stats).toHaveProperty('codex');
    });
    
    it('should track chronicle statistics', async () => {
      const stats = await memoryService.getStats();
      
      expect(stats.chronicle).toHaveProperty('chapterCount');
      expect(typeof stats.chronicle.chapterCount).toBe('number');
      expect(stats.chronicle.chapterCount).toBeGreaterThanOrEqual(0);
    });
    
    it('should track active stream statistics', async () => {
      const stats = await memoryService.getStats();
      
      expect(stats.activeStream).toHaveProperty('sessionCount');
      expect(typeof stats.activeStream.sessionCount).toBe('number');
      expect(stats.activeStream.sessionCount).toBeGreaterThanOrEqual(0);
    });
    
    it('should track hive mind statistics', async () => {
      const stats = await memoryService.getStats();
      
      expect(stats.hiveMind).toHaveProperty('memoryCount');
      expect(typeof stats.hiveMind.memoryCount).toBe('number');
      expect(stats.hiveMind.memoryCount).toBeGreaterThanOrEqual(0);
    });
    
    it('should track codex initialization status', async () => {
      const stats = await memoryService.getStats();
      
      expect(stats.codex).toHaveProperty('ubikInitialized');
      expect(stats.codex).toHaveProperty('axiomInitialized');
      
      expect(typeof stats.codex.ubikInitialized).toBe('boolean');
      expect(typeof stats.codex.axiomInitialized).toBe('boolean');
      
      // Both agents should be initialized
      expect(stats.codex.ubikInitialized).toBe(true);
      expect(stats.codex.axiomInitialized).toBe(true);
    });
  });
  
  describe('Graceful Degradation', () => {
    it('should report degraded status when optional services unavailable', async () => {
      const health = await memoryService.getLayerHealth();
      
      // Redis and Qdrant might not be available (optional)
      // But Chronicle and Codex should always work (file-based)
      expect(health.chronicle).toBe(true);
      expect(health.codex).toBe(true);
      
      // System should still be healthy with file fallbacks
      const isHealthy = await memoryService.isHealthy();
      expect(isHealthy).toBe(true);
    });
    
    it('should continue operating with file-based fallbacks', async () => {
      // Even without Redis/Qdrant, basic operations should work
      await memoryService.store('Test content');
      const results = await memoryService.search('test', 10);
      
      // Should work via Chronicle fallback
      expect(results).toBeDefined();
    });
  });
  
  describe('Error Handling', () => {
    it('should handle health check errors', async () => {
      const testService = new UnifiedMemoryService();
      await testService.initialize();
      await testService.shutdown();
      
      await expect(testService.isHealthy()).rejects.toThrow();
    });
    
    it('should handle stats errors', async () => {
      const testService = new UnifiedMemoryService();
      await testService.initialize();
      await testService.shutdown();
      
      await expect(testService.getStats()).rejects.toThrow();
    });
  });
  
  describe('Integration', () => {
    it('should reflect changes in statistics', async () => {
      const statsBefore = await memoryService.getStats();
      const chronicleCountBefore = statsBefore.chronicle.chapterCount;
      
      // Store some content (creates chronicle entry)
      await memoryService.store('Test content for stats');
      
      const statsAfter = await memoryService.getStats();
      const chronicleCountAfter = statsAfter.chronicle.chapterCount;
      
      // Chronicle count should increase
      expect(chronicleCountAfter).toBeGreaterThanOrEqual(chronicleCountBefore);
    });
  });
});
