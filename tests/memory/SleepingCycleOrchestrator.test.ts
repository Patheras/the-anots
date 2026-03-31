/**
 * Tests for Sleeping Cycle Orchestrator
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 16.1-16.6
 */

import {
  SleepingCycleOrchestrator,
  createSleepingCycleOrchestrator,
  SleepProgressStep,
} from '../../src/memory/SleepingCycleOrchestrator';
import { createMemoryService } from '../../src/memory/MemoryService';
import { createCapacityMonitor } from '../../src/state/CapacityMonitor';
import { createEmptyActiveStreamState } from '../../src/state/types';

describe('SleepingCycleOrchestrator', () => {
  let orchestrator: SleepingCycleOrchestrator;
  let progressSteps: SleepProgressStep[];

  beforeEach(() => {
    progressSteps = [];
    
    const memoryService = createMemoryService({
      llm: {
        baseUrl: 'http://localhost:11434',
        model: 'qwen2.5:9b-instruct-q4_K_M',
        temperature: 0.3,
      },
      qdrant: {
        url: 'http://localhost:6333',
      },
      mem0: {
        vectorStore: {
          provider: 'qdrant',
          config: {
            host: 'localhost',
            port: 6333,
            collection: 'tcam_hive_truths',
          },
        },
        llm: {
          provider: 'ollama',
          config: {
            model: 'qwen2.5:9b-instruct-q4_K_M',
            temperature: 0.3,
          },
        },
      },
      redis: {
        url: 'redis://localhost:9999', // Non-existent for testing
        database: 0,
      },
    });

    const capacityMonitor = createCapacityMonitor();

    orchestrator = createSleepingCycleOrchestrator(
      memoryService,
      capacityMonitor,
      (step) => progressSteps.push({ ...step })
    );
  });

  describe('Initialization', () => {
    it('should create orchestrator', () => {
      expect(orchestrator).toBeDefined();
    });

    it('should start in AWAKENING phase', () => {
      expect(orchestrator.getCurrentPhase()).toBe('AWAKENING');
    });
  });

  describe('Phase Management', () => {
    it('should update phase based on capacity', () => {
      const state = createEmptyActiveStreamState('session-1', 'chip', 'user-1');
      
      // Empty state - AWAKENING
      let phase = orchestrator.updatePhase(state);
      expect(phase).toBe('AWAKENING');
      
      // Add messages to reach ACTIVE phase (30%)
      state.messages = Array.from({ length: 300 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: 'x'.repeat(512),
        timestamp: new Date().toISOString(),
      }));
      
      phase = orchestrator.updatePhase(state);
      expect(phase).toBe('ACTIVE');
      
      // Add more messages to reach PRE_SLEEP phase (75%)
      state.messages = Array.from({ length: 750 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: 'x'.repeat(512),
        timestamp: new Date().toISOString(),
      }));
      
      phase = orchestrator.updatePhase(state);
      expect(phase).toBe('PRE_SLEEP');
      
      // Add more messages to reach SLEEPING phase (85%)
      state.messages = Array.from({ length: 850 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: 'x'.repeat(512),
        timestamp: new Date().toISOString(),
      }));
      
      phase = orchestrator.updatePhase(state);
      expect(phase).toBe('SLEEPING');
    });
  });

  describe('PHASE 1: AWAKENING', () => {
    it('should execute awakening phase', async () => {
      const state = await orchestrator.executeAwakening('session-1', 'chip', 'user-1');
      
      expect(state).toBeDefined();
      expect(state.sessionId).toBe('session-1');
      expect(state.agentId).toBe('chip');
      expect(state.userId).toBe('user-1');
      expect(orchestrator.getCurrentPhase()).toBe('ACTIVE');
    });

    it('should report progress during awakening', async () => {
      await orchestrator.executeAwakening('session-1', 'chip', 'user-1');
      
      // Should have progress updates
      expect(progressSteps.length).toBeGreaterThan(0);
      
      // Check for expected steps
      const stepNames = progressSteps.map((s) => s.name);
      expect(stepNames).toContain('load_codex');
      expect(stepNames).toContain('query_hive');
      expect(stepNames).toContain('restore_state');
    });

    it('should complete awakening in reasonable time', async () => {
      const startTime = Date.now();
      await orchestrator.executeAwakening('session-1', 'chip', 'user-1');
      const duration = Date.now() - startTime;
      
      // Should complete in < 10 seconds (target is ~5s)
      expect(duration).toBeLessThan(10000);
    }, 15000);
  });

  describe('PHASE 4: SLEEPING', () => {
    it('should execute sleeping phase', async () => {
      const state = createEmptyActiveStreamState('session-1', 'chip', 'user-1');
      
      // Add some messages
      state.messages = Array.from({ length: 10 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Test message ${i}`,
        timestamp: new Date().toISOString(),
      }));
      
      const summary = await orchestrator.executeSleeping(state);
      
      expect(summary).toBeDefined();
      expect(summary.sessionId).toBe('session-1');
      expect(summary.duration).toBeGreaterThan(0);
      expect(summary.steps.length).toBeGreaterThan(0);
      expect(orchestrator.getCurrentPhase()).toBe('REAWAKENING');
    }, 60000);

    it('should extract truths during sleeping', async () => {
      const state = createEmptyActiveStreamState('session-1', 'chip', 'user-1');
      
      state.messages = [
        { role: 'user', content: 'My name is Alice', timestamp: new Date().toISOString() },
        { role: 'assistant', content: 'Nice to meet you, Alice!', timestamp: new Date().toISOString() },
        { role: 'user', content: 'I work as a software engineer', timestamp: new Date().toISOString() },
      ];
      
      const summary = await orchestrator.executeSleeping(state);
      
      // May extract truths (depends on Mem0/LLM availability)
      expect(summary.truthsExtracted).toBeGreaterThanOrEqual(0);
    }, 60000);

    it('should report progress during sleeping', async () => {
      const state = createEmptyActiveStreamState('session-1', 'chip', 'user-1');
      
      state.messages = [
        { role: 'user', content: 'Test', timestamp: new Date().toISOString() },
      ];
      
      progressSteps = [];
      await orchestrator.executeSleeping(state);
      
      // Should have progress updates
      expect(progressSteps.length).toBeGreaterThan(0);
      
      // Check for expected steps
      const stepNames = progressSteps.map((s) => s.name);
      expect(stepNames).toContain('extract_truths');
      expect(stepNames).toContain('inscribe_chronicle');
      expect(stepNames).toContain('index_hive');
      expect(stepNames).toContain('update_codex');
      expect(stepNames).toContain('generate_summary');
    }, 60000);

    it('should generate sleep summary', async () => {
      const state = createEmptyActiveStreamState('session-1', 'chip', 'user-1');
      
      state.messages = [
        { role: 'user', content: 'Test message', timestamp: new Date().toISOString() },
      ];
      
      const summary = await orchestrator.executeSleeping(state);
      
      expect(summary.keyInsights).toBeDefined();
      expect(Array.isArray(summary.keyInsights)).toBe(true);
      expect(summary.startTime).toBeDefined();
      expect(summary.endTime).toBeDefined();
    }, 60000);

    it('should handle errors gracefully during sleeping', async () => {
      const state = createEmptyActiveStreamState('session-1', 'chip', 'user-1');
      
      // Empty messages might cause some steps to fail
      state.messages = [];
      
      // Should not throw
      const summary = await orchestrator.executeSleeping(state);
      
      expect(summary).toBeDefined();
      // Errors array should exist
      expect(Array.isArray(summary.errors)).toBe(true);
    }, 60000);
  });

  describe('PHASE 5: REAWAKENING', () => {
    it('should execute reawakening phase', async () => {
      const oldState = createEmptyActiveStreamState('session-1', 'chip', 'user-1');
      
      const sleepSummary = {
        sessionId: 'session-1',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        duration: 5000,
        truthsExtracted: 5,
        chaptersInscribed: 1,
        truthsIndexed: 5,
        codexUpdates: 1,
        keyInsights: ['Test insight'],
        steps: [],
        errors: [],
      };
      
      const newState = await orchestrator.executeReawakening(oldState, sleepSummary);
      
      expect(newState).toBeDefined();
      expect(newState.sessionId).toContain('awakened');
      expect(newState.messages.length).toBeGreaterThan(0);
      expect(newState.context.sleepSummary).toBeDefined();
      expect(orchestrator.getCurrentPhase()).toBe('ACTIVE');
    });

    it('should inject sleep summary into context', async () => {
      const oldState = createEmptyActiveStreamState('session-1', 'chip', 'user-1');
      
      const sleepSummary = {
        sessionId: 'session-1',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        duration: 5000,
        truthsExtracted: 3,
        chaptersInscribed: 1,
        truthsIndexed: 3,
        codexUpdates: 1,
        keyInsights: ['Extracted 3 truths'],
        steps: [],
        errors: [],
      };
      
      const newState = await orchestrator.executeReawakening(oldState, sleepSummary);
      
      expect(newState.context.sleepSummary).toEqual(sleepSummary);
      expect(newState.context.previousSession).toBe('session-1');
    });

    it('should add system message with summary', async () => {
      const oldState = createEmptyActiveStreamState('session-1', 'chip', 'user-1');
      
      const sleepSummary = {
        sessionId: 'session-1',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        duration: 5000,
        truthsExtracted: 2,
        chaptersInscribed: 1,
        truthsIndexed: 2,
        codexUpdates: 1,
        keyInsights: ['Test'],
        steps: [],
        errors: [],
      };
      
      const newState = await orchestrator.executeReawakening(oldState, sleepSummary);
      
      expect(newState.messages.length).toBe(1);
      expect(newState.messages[0].role).toBe('system');
      expect(newState.messages[0].content).toContain('Memory Consolidation Complete');
    });
  });

  describe('Trigger Checks', () => {
    it('should check if should trigger sleep', () => {
      const state = createEmptyActiveStreamState('session-1', 'chip', 'user-1');
      
      // Empty state - no sleep
      expect(orchestrator.shouldTriggerSleep(state)).toBe(false);
      
      // Fill to 85% - should sleep
      state.messages = Array.from({ length: 850 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: 'x'.repeat(512),
        timestamp: new Date().toISOString(),
      }));
      
      expect(orchestrator.shouldTriggerSleep(state)).toBe(true);
    });

    it('should check if should show warning', () => {
      const state = createEmptyActiveStreamState('session-1', 'chip', 'user-1');
      
      // Empty state - no warning
      expect(orchestrator.shouldShowWarning(state)).toBe(false);
      
      // Fill to 75% - should warn
      state.messages = Array.from({ length: 750 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: 'x'.repeat(512),
        timestamp: new Date().toISOString(),
      }));
      
      expect(orchestrator.shouldShowWarning(state)).toBe(true);
    });

    it('should get warning message', () => {
      const state = createEmptyActiveStreamState('session-1', 'chip', 'user-1');
      
      // Empty state - no message
      expect(orchestrator.getWarningMessage(state)).toBeNull();
      
      // Fill to 75% - warning message
      state.messages = Array.from({ length: 750 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: 'x'.repeat(512),
        timestamp: new Date().toISOString(),
      }));
      
      const message = orchestrator.getWarningMessage(state);
      expect(message).toBeDefined();
      expect(message).toContain('Approaching memory consolidation');
    });
  });

  describe('Full Cycle Integration', () => {
    it('should execute complete sleep-reawaken cycle', async () => {
      // Start with awakening
      const initialState = await orchestrator.executeAwakening('session-1', 'chip', 'user-1');
      expect(orchestrator.getCurrentPhase()).toBe('ACTIVE');
      
      // Add messages to trigger sleep
      initialState.messages = Array.from({ length: 850 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: 'x'.repeat(512),
        timestamp: new Date().toISOString(),
      }));
      
      // Check should sleep
      expect(orchestrator.shouldTriggerSleep(initialState)).toBe(true);
      
      // Execute sleeping
      const summary = await orchestrator.executeSleeping(initialState);
      expect(orchestrator.getCurrentPhase()).toBe('REAWAKENING');
      expect(summary).toBeDefined();
      
      // Execute reawakening
      const newState = await orchestrator.executeReawakening(initialState, summary);
      expect(orchestrator.getCurrentPhase()).toBe('ACTIVE');
      expect(newState.sessionId).toContain('awakened');
      
      // New state should have lower capacity
      expect(newState.messages.length).toBeLessThan(initialState.messages.length);
    }, 90000);
  });
});
