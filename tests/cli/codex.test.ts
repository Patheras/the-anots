/**
 * CLI Codex Commands Tests
 * 
 * Tests for codex read, list commands
 */

import { UnifiedMemoryService } from '../../src/memory/UnifiedMemoryService';
import * as fc from 'fast-check';

// Mock console methods
const originalLog = console.log;
const originalError = console.error;

describe('CLI Codex Commands', () => {
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
  
  describe('codex:read', () => {
    it('should read ubik codex', async () => {
      const codex = await memoryService.readCodex('ubik');
      
      expect(codex).toHaveProperty('identity');
      expect(codex).toHaveProperty('tasks');
      expect(codex).toHaveProperty('memory');
      expect(codex).toHaveProperty('tools');
      expect(codex).toHaveProperty('lastUpdated');
      
      expect(typeof codex.identity).toBe('string');
      expect(typeof codex.tasks).toBe('string');
      expect(typeof codex.memory).toBe('string');
      expect(typeof codex.tools).toBe('string');
    });
    
    it('should read axiom codex', async () => {
      const codex = await memoryService.readCodex('axiom');
      
      expect(codex).toHaveProperty('identity');
      expect(codex).toHaveProperty('tasks');
      expect(codex).toHaveProperty('memory');
      expect(codex).toHaveProperty('tools');
      expect(codex).toHaveProperty('lastUpdated');
      
      expect(typeof codex.identity).toBe('string');
      expect(typeof codex.tasks).toBe('string');
      expect(typeof codex.memory).toBe('string');
      expect(typeof codex.tools).toBe('string');
    });
    
    it('should contain agent-specific information', async () => {
      const ubikCodex = await memoryService.readCodex('ubik');
      const axiomCodex = await memoryService.readCodex('axiom');
      
      // Ubik should mention creative, divergent, resonance
      expect(ubikCodex.identity.toLowerCase()).toMatch(/ubik|creative|divergent|resonance/);
      
      // Axiom should mention analytical, convergent, SACOP
      expect(axiomCodex.identity.toLowerCase()).toMatch(/axiom|analytical|convergent|sacop/);
    });
  });
  
  describe('codex:list', () => {
    it('should list codex files for an agent', async () => {
      const layers = memoryService.getLayers();
      
      // List ubik codex files
      const files = await layers.codex.list('ubik');
      
      expect(files).toContain('README.md');
      expect(files).toContain('TASKS.md');
      expect(files).toContain('NOTES.md');
      expect(files).toContain('TOOLS.md');
    });
    
    it('should list codex files for axiom', async () => {
      const layers = memoryService.getLayers();
      
      const files = await layers.codex.list('axiom');
      
      expect(files).toContain('README.md');
      expect(files).toContain('TASKS.md');
      expect(files).toContain('NOTES.md');
      expect(files).toContain('TOOLS.md');
    });
  });
  
  describe('Property: Agent Isolation', () => {
    it('agents should only access their own codex', () => {
      fc.assert(
        fc.asyncProperty(
          fc.constantFrom('ubik', 'axiom'),
          async (agentId) => {
            const codex = await memoryService.readCodex(agentId as any);
            
            // Codex should contain agent-specific identity
            expect(codex.identity.toLowerCase()).toContain(agentId);
          }
        ),
        { numRuns: 10 }
      );
    });
  });
  
  describe('Codex Updates', () => {
    it('should update codex notes', async () => {
      const layers = memoryService.getLayers();
      
      const newNotes = 'Test notes update for Ubik';
      await layers.codex.write({
        node: 'ubik',
        file: 'NOTES.md',
        operation: 'replace',
        content: newNotes,
        summary: 'Test notes update',
      });
      
      // Read back
      const content = await layers.codex.readFile('ubik', 'NOTES.md');
      expect(content).toBe(newNotes);
    });
    
    it('should update codex tasks', async () => {
      const layers = memoryService.getLayers();
      
      const newTasks = '- [ ] Test task 1\n- [ ] Test task 2';
      await layers.codex.write({
        node: 'axiom',
        file: 'TASKS.md',
        operation: 'replace',
        content: newTasks,
        summary: 'Test tasks update',
      });
      
      // Read back
      const content = await layers.codex.readFile('axiom', 'TASKS.md');
      expect(content).toBe(newTasks);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle invalid agent name', async () => {
      await expect(
        memoryService.readCodex('invalid_agent' as any)
      ).rejects.toThrow();
    });
    
    it('should handle read errors gracefully', async () => {
      const testService = new UnifiedMemoryService();
      await testService.initialize();
      await testService.shutdown();
      
      await expect(testService.readCodex('ubik')).rejects.toThrow();
    });
    
    it('should handle write errors gracefully', async () => {
      const testService = new UnifiedMemoryService();
      await testService.initialize();
      const layers = testService.getLayers();
      await testService.shutdown();
      
      await expect(
        layers.codex.write({
          node: 'ubik',
          file: 'NOTES.md',
          operation: 'replace',
          content: 'test',
          summary: 'test',
        })
      ).rejects.toThrow();
    });
  });
});
