/**
 * Tests for Capacity Monitor
 * 
 * Requirements: 7.1, 7.4, 4.4
 */

import {
  CapacityMonitor,
  createCapacityMonitor,
} from '../../src/state/CapacityMonitor';
import {
  createEmptyActiveStreamState,
  DialogueMessage,
} from '../../src/state/types';

describe('CapacityMonitor', () => {
  let monitor: CapacityMonitor;

  beforeEach(() => {
    monitor = createCapacityMonitor();
  });

  describe('Initialization', () => {
    it('should create monitor with default thresholds', () => {
      expect(monitor).toBeDefined();
      
      const thresholds = monitor.getThresholds();
      expect(thresholds.preSleep).toBe(70);
      expect(thresholds.sleep).toBe(80);
      expect(thresholds.maximum).toBe(100);
    });

    it('should create monitor with custom thresholds', () => {
      const customMonitor = createCapacityMonitor({
        preSleep: 60,
        sleep: 75,
      });
      
      const thresholds = customMonitor.getThresholds();
      expect(thresholds.preSleep).toBe(60);
      expect(thresholds.sleep).toBe(75);
    });

    it('should create monitor with custom max tokens', () => {
      const customMonitor = createCapacityMonitor(undefined, 100000);
      
      expect(customMonitor.getMaxTokens()).toBe(100000);
    });
  });

  describe('Capacity Checking', () => {
    it('should check capacity for empty state', () => {
      const state = createEmptyActiveStreamState('session-1', 'chip', 'user-1');
      
      const status = monitor.checkCapacity(state);
      
      expect(status.estimatedTokens).toBe(0);
      expect(status.capacityPercentage).toBe(0);
      expect(status.shouldWarn).toBe(false);
      expect(status.shouldSleep).toBe(false);
      expect(status.phase).toBe('awakening');
    });

    it('should calculate capacity for active phase (20-70%)', () => {
      const state = createEmptyActiveStreamState('session-1', 'chip', 'user-1');
      
      // Add messages to reach ~30% capacity
      // 128000 tokens * 0.3 = 38400 tokens = ~153600 characters
      const messageCount = 300;
      const messageLength = 512; // 512 chars per message
      
      state.messages = Array.from({ length: messageCount }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: 'x'.repeat(messageLength),
        timestamp: new Date().toISOString(),
      }));
      
      const status = monitor.checkCapacity(state);
      
      expect(status.capacityPercentage).toBeGreaterThan(20);
      expect(status.capacityPercentage).toBeLessThan(70);
      expect(status.shouldWarn).toBe(false);
      expect(status.shouldSleep).toBe(false);
      expect(status.phase).toBe('active');
    });

    it('should detect pre-sleep phase (70-80%)', () => {
      const state = createEmptyActiveStreamState('session-1', 'chip', 'user-1');
      
      // Add messages to reach ~75% capacity
      // 128000 tokens * 0.75 = 96000 tokens = ~384000 characters
      const messageCount = 750;
      const messageLength = 512;
      
      state.messages = Array.from({ length: messageCount }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: 'x'.repeat(messageLength),
        timestamp: new Date().toISOString(),
      }));
      
      const status = monitor.checkCapacity(state);
      
      expect(status.capacityPercentage).toBeGreaterThanOrEqual(70);
      expect(status.capacityPercentage).toBeLessThan(80);
      expect(status.shouldWarn).toBe(true);
      expect(status.shouldSleep).toBe(false);
      expect(status.phase).toBe('pre_sleep');
    });

    it('should detect sleeping phase (80%+)', () => {
      const state = createEmptyActiveStreamState('session-1', 'chip', 'user-1');
      
      // Add messages to reach ~85% capacity
      // 128000 tokens * 0.85 = 108800 tokens = ~435200 characters
      const messageCount = 850;
      const messageLength = 512;
      
      state.messages = Array.from({ length: messageCount }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: 'x'.repeat(messageLength),
        timestamp: new Date().toISOString(),
      }));
      
      const status = monitor.checkCapacity(state);
      
      expect(status.capacityPercentage).toBeGreaterThanOrEqual(80);
      expect(status.shouldWarn).toBe(false); // No warning, direct sleep
      expect(status.shouldSleep).toBe(true);
      expect(status.phase).toBe('sleeping');
    });
  });

  describe('State Updates', () => {
    it('should update state with capacity info', () => {
      const state = createEmptyActiveStreamState('session-1', 'chip', 'user-1');
      
      state.messages = Array.from({ length: 100 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: 'This is a test message with enough content to register capacity',
        timestamp: new Date().toISOString(),
      }));
      
      const updatedState = monitor.updateStateCapacity(state);
      
      expect(updatedState.estimatedTokens).toBeGreaterThan(0);
      expect(updatedState.capacityPercentage).toBeGreaterThan(0);
      expect(updatedState.lastUpdatedAt).toBeDefined();
    });
  });

  describe('Warning Messages', () => {
    it('should return null for active phase', () => {
      const state = createEmptyActiveStreamState('session-1', 'chip', 'user-1');
      
      state.messages = Array.from({ length: 100 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: 'Test message',
        timestamp: new Date().toISOString(),
      }));
      
      const message = monitor.getWarningMessage(state);
      
      expect(message).toBeNull();
    });

    it('should return warning for pre-sleep phase', () => {
      const state = createEmptyActiveStreamState('session-1', 'chip', 'user-1');
      
      // Reach 75% capacity
      state.messages = Array.from({ length: 750 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: 'x'.repeat(512),
        timestamp: new Date().toISOString(),
      }));
      
      const message = monitor.getWarningMessage(state);
      
      expect(message).toBeDefined();
      expect(message).toContain('Approaching memory consolidation');
    });

    it('should return sleep message for sleeping phase', () => {
      const state = createEmptyActiveStreamState('session-1', 'chip', 'user-1');
      
      // Reach 85% capacity
      state.messages = Array.from({ length: 850 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: 'x'.repeat(512),
        timestamp: new Date().toISOString(),
      }));
      
      const message = monitor.getWarningMessage(state);
      
      expect(message).toBeDefined();
      expect(message).toContain('Memory capacity');
      expect(message).toContain('Consolidation required');
    });
  });

  describe('Capacity Calculations', () => {
    it('should calculate remaining capacity', () => {
      const state = createEmptyActiveStreamState('session-1', 'chip', 'user-1');
      
      state.messages = [
        { role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
      ];
      
      const remaining = monitor.getRemainingCapacity(state);
      
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThan(monitor.getMaxTokens());
    });

    it('should estimate messages until sleep', () => {
      const state = createEmptyActiveStreamState('session-1', 'chip', 'user-1');
      
      // Add some messages
      state.messages = Array.from({ length: 100 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: 'Test message',
        timestamp: new Date().toISOString(),
      }));
      
      const messagesUntilSleep = monitor.estimateMessagesUntilSleep(state);
      
      expect(messagesUntilSleep).toBeGreaterThan(0);
    });

    it('should return 0 messages until sleep when at capacity', () => {
      const state = createEmptyActiveStreamState('session-1', 'chip', 'user-1');
      
      // Fill to 85% capacity
      state.messages = Array.from({ length: 850 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: 'x'.repeat(512),
        timestamp: new Date().toISOString(),
      }));
      
      const messagesUntilSleep = monitor.estimateMessagesUntilSleep(state);
      
      expect(messagesUntilSleep).toBe(0);
    });
  });

  describe('Phase Detection', () => {
    it('should detect awakening phase (0-20%)', () => {
      const state = createEmptyActiveStreamState('session-1', 'chip', 'user-1');
      
      state.messages = Array.from({ length: 50 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: 'Test',
        timestamp: new Date().toISOString(),
      }));
      
      const phase = monitor.getCurrentPhase(state);
      
      expect(phase).toBe('awakening');
    });

    it('should detect active phase (20-70%)', () => {
      const state = createEmptyActiveStreamState('session-1', 'chip', 'user-1');
      
      state.messages = Array.from({ length: 300 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: 'x'.repeat(512),
        timestamp: new Date().toISOString(),
      }));
      
      const phase = monitor.getCurrentPhase(state);
      
      expect(phase).toBe('active');
    });

    it('should detect pre_sleep phase (70-80%)', () => {
      const state = createEmptyActiveStreamState('session-1', 'chip', 'user-1');
      
      state.messages = Array.from({ length: 750 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: 'x'.repeat(512),
        timestamp: new Date().toISOString(),
      }));
      
      const phase = monitor.getCurrentPhase(state);
      
      expect(phase).toBe('pre_sleep');
    });

    it('should detect sleeping phase (80%+)', () => {
      const state = createEmptyActiveStreamState('session-1', 'chip', 'user-1');
      
      state.messages = Array.from({ length: 850 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: 'x'.repeat(512),
        timestamp: new Date().toISOString(),
      }));
      
      const phase = monitor.getCurrentPhase(state);
      
      expect(phase).toBe('sleeping');
    });
  });

  describe('Helper Methods', () => {
    it('should check shouldWarn correctly', () => {
      const state = createEmptyActiveStreamState('session-1', 'chip', 'user-1');
      
      // Active phase - no warning
      state.messages = Array.from({ length: 300 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: 'x'.repeat(512),
        timestamp: new Date().toISOString(),
      }));
      
      expect(monitor.shouldWarn(state)).toBe(false);
      
      // Pre-sleep phase - warning
      state.messages = Array.from({ length: 750 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: 'x'.repeat(512),
        timestamp: new Date().toISOString(),
      }));
      
      expect(monitor.shouldWarn(state)).toBe(true);
    });

    it('should check shouldSleep correctly', () => {
      const state = createEmptyActiveStreamState('session-1', 'chip', 'user-1');
      
      // Active phase - no sleep
      state.messages = Array.from({ length: 300 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: 'x'.repeat(512),
        timestamp: new Date().toISOString(),
      }));
      
      expect(monitor.shouldSleep(state)).toBe(false);
      
      // Sleeping phase - sleep
      state.messages = Array.from({ length: 850 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: 'x'.repeat(512),
        timestamp: new Date().toISOString(),
      }));
      
      expect(monitor.shouldSleep(state)).toBe(true);
    });
  });
});
