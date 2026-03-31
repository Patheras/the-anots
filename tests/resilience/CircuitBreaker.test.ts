/**
 * Tests for CircuitBreaker
 * Requirements: 12.1, 12.2
 */

import { CircuitBreaker, CircuitOpenError } from '../../src/resilience/CircuitBreaker';

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker({
      name: 'test',
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 100, // 100ms for fast tests
    });
  });

  describe('CLOSED state (normal operation)', () => {
    it('starts in CLOSED state', () => {
      expect(cb.getState()).toBe('CLOSED');
    });

    it('passes through successful calls', async () => {
      const result = await cb.execute(async () => 'ok');
      expect(result).toBe('ok');
    });

    it('passes through failed calls and counts failures', async () => {
      await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow('fail');
      expect(cb.getStats().failureCount).toBe(1);
      expect(cb.getState()).toBe('CLOSED');
    });

    it('resets failure count on success', async () => {
      await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
      await cb.execute(async () => 'ok');
      expect(cb.getStats().failureCount).toBe(0);
    });
  });

  describe('CLOSED → OPEN transition', () => {
    it('opens after reaching failure threshold', async () => {
      for (let i = 0; i < 3; i++) {
        await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
      }
      expect(cb.getState()).toBe('OPEN');
    });

    it('throws CircuitOpenError when OPEN', async () => {
      for (let i = 0; i < 3; i++) {
        await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
      }
      await expect(cb.execute(async () => 'ok')).rejects.toThrow(CircuitOpenError);
    });

    it('isOpen() returns true when OPEN', async () => {
      for (let i = 0; i < 3; i++) {
        await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
      }
      expect(cb.isOpen()).toBe(true);
    });
  });

  describe('OPEN → HALF_OPEN transition', () => {
    it('transitions to HALF_OPEN after timeout', async () => {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
      }
      expect(cb.getState()).toBe('OPEN');

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // isOpen() should trigger HALF_OPEN transition
      expect(cb.isOpen()).toBe(false);
      expect(cb.getState()).toBe('HALF_OPEN');
    });

    it('allows one call through in HALF_OPEN', async () => {
      for (let i = 0; i < 3; i++) {
        await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
      }
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should allow call through (not throw CircuitOpenError)
      const result = await cb.execute(async () => 'recovery');
      expect(result).toBe('recovery');
    });
  });

  describe('HALF_OPEN → CLOSED transition', () => {
    it('closes after successThreshold successes in HALF_OPEN', async () => {
      // Open circuit
      for (let i = 0; i < 3; i++) {
        await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
      }
      await new Promise(resolve => setTimeout(resolve, 150));

      // Two successes should close it (successThreshold = 2)
      await cb.execute(async () => 'ok1');
      await cb.execute(async () => 'ok2');

      expect(cb.getState()).toBe('CLOSED');
    });
  });

  describe('HALF_OPEN → OPEN transition', () => {
    it('reopens if call fails in HALF_OPEN', async () => {
      for (let i = 0; i < 3; i++) {
        await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
      }
      await new Promise(resolve => setTimeout(resolve, 150));

      // Fail during recovery
      await expect(cb.execute(async () => { throw new Error('still failing'); })).rejects.toThrow();
      expect(cb.getState()).toBe('OPEN');
    });
  });

  describe('manual reset', () => {
    it('resets to CLOSED state', async () => {
      for (let i = 0; i < 3; i++) {
        await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
      }
      expect(cb.getState()).toBe('OPEN');

      cb.reset();
      expect(cb.getState()).toBe('CLOSED');
      expect(cb.getStats().failureCount).toBe(0);
    });
  });

  describe('getStats', () => {
    it('tracks total calls, failures, successes', async () => {
      await cb.execute(async () => 'ok');
      await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();

      const stats = cb.getStats();
      expect(stats.totalCalls).toBe(2);
      expect(stats.totalSuccesses).toBe(1);
      expect(stats.totalFailures).toBe(1);
    });

    it('records lastFailureTime', async () => {
      const before = new Date();
      await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
      const after = new Date();

      const stats = cb.getStats();
      expect(stats.lastFailureTime).not.toBeNull();
      expect(stats.lastFailureTime!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(stats.lastFailureTime!.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('getRetryAfterMs', () => {
    it('returns 0 when not OPEN', () => {
      expect(cb.getRetryAfterMs()).toBe(0);
    });

    it('returns remaining timeout when OPEN', async () => {
      for (let i = 0; i < 3; i++) {
        await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
      }
      const retryAfter = cb.getRetryAfterMs();
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(100);
    });
  });
});
