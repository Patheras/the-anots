/**
 * Tests for PerformanceMonitor
 * Requirements: 13.7
 */

import { PerformanceMonitor, globalPerformanceMonitor } from '../../src/resilience/PerformanceMonitor';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor({ maxRecords: 100, windowMs: 60000 });
  });

  describe('record', () => {
    it('records latency entries', () => {
      monitor.record('Qdrant', 'search', 50);
      expect(monitor.size).toBe(1);
    });

    it('trims records when over maxRecords', () => {
      const small = new PerformanceMonitor({ maxRecords: 5 });
      for (let i = 0; i < 10; i++) small.record('test', 'op', i);
      expect(small.size).toBe(5);
    });
  });

  describe('measure', () => {
    it('measures async operation latency', async () => {
      await monitor.measure('Qdrant', 'search', async () => {
        await new Promise(r => setTimeout(r, 10));
        return 'result';
      });
      const stats = monitor.getStats('Qdrant', 'search');
      expect(stats).not.toBeNull();
      expect(stats!.count).toBe(1);
      expect(stats!.p50).toBeGreaterThanOrEqual(5);
    });

    it('records failed operations', async () => {
      await expect(
        monitor.measure('Qdrant', 'search', async () => { throw new Error('fail'); })
      ).rejects.toThrow('fail');
      expect(monitor.getSuccessRate('Qdrant', 'search')).toBe(0);
    });

    it('returns the operation result', async () => {
      const result = await monitor.measure('test', 'op', async () => 42);
      expect(result).toBe(42);
    });
  });

  describe('getStats', () => {
    it('returns null for unknown component/operation', () => {
      expect(monitor.getStats('Unknown', 'op')).toBeNull();
    });

    it('calculates correct percentiles', () => {
      // Record 100 values: 1ms to 100ms
      for (let i = 1; i <= 100; i++) {
        monitor.record('test', 'op', i);
      }
      const stats = monitor.getStats('test', 'op')!;
      expect(stats.count).toBe(100);
      expect(stats.min).toBe(1);
      expect(stats.max).toBe(100);
      expect(stats.p50).toBeGreaterThanOrEqual(49);
      expect(stats.p50).toBeLessThanOrEqual(51);
      expect(stats.p95).toBeGreaterThanOrEqual(94);
      expect(stats.p95).toBeLessThanOrEqual(96);
      expect(stats.p99).toBeGreaterThanOrEqual(98);
      expect(stats.p99).toBeLessThanOrEqual(100);
    });

    it('calculates avg correctly', () => {
      monitor.record('test', 'op', 10);
      monitor.record('test', 'op', 20);
      monitor.record('test', 'op', 30);
      const stats = monitor.getStats('test', 'op')!;
      expect(stats.avg).toBe(20);
    });

    it('handles single record', () => {
      monitor.record('test', 'op', 42);
      const stats = monitor.getStats('test', 'op')!;
      expect(stats.p50).toBe(42);
      expect(stats.p95).toBe(42);
      expect(stats.p99).toBe(42);
    });
  });

  describe('getAllStats', () => {
    it('returns stats for all component/operation pairs', () => {
      monitor.record('Qdrant', 'search', 50);
      monitor.record('Mem0', 'extract', 100);
      monitor.record('Qdrant', 'index', 30);

      const all = monitor.getAllStats();
      expect(all.length).toBe(3);
      const components = all.map(s => s.component);
      expect(components).toContain('Qdrant');
      expect(components).toContain('Mem0');
    });
  });

  describe('getThroughput', () => {
    it('returns operations per minute', () => {
      monitor.record('Qdrant', 'search', 10);
      monitor.record('Qdrant', 'search', 20);
      expect(monitor.getThroughput('Qdrant', 'search')).toBe(2);
    });

    it('returns 0 for unknown operation', () => {
      expect(monitor.getThroughput('Unknown', 'op')).toBe(0);
    });
  });

  describe('getSuccessRate', () => {
    it('returns 1.0 when all succeed', () => {
      monitor.record('test', 'op', 10, true);
      monitor.record('test', 'op', 20, true);
      expect(monitor.getSuccessRate('test', 'op')).toBe(1);
    });

    it('returns 0.5 when half fail', () => {
      monitor.record('test', 'op', 10, true);
      monitor.record('test', 'op', 20, false);
      expect(monitor.getSuccessRate('test', 'op')).toBe(0.5);
    });

    it('returns 1.0 for unknown operation', () => {
      expect(monitor.getSuccessRate('Unknown', 'op')).toBe(1);
    });
  });

  describe('clear', () => {
    it('clears all records', () => {
      monitor.record('test', 'op', 10);
      monitor.clear();
      expect(monitor.size).toBe(0);
    });
  });

  describe('globalPerformanceMonitor', () => {
    it('is a singleton instance', () => {
      expect(globalPerformanceMonitor).toBeInstanceOf(PerformanceMonitor);
    });
  });
});
