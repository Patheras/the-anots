/**
 * Tests for ErrorMonitor
 * Requirements: 12.6, 1.7
 */

import { ErrorMonitor, globalErrorMonitor } from '../../src/resilience/ErrorMonitor';

describe('ErrorMonitor', () => {
  let monitor: ErrorMonitor;

  beforeEach(() => {
    monitor = new ErrorMonitor({ logToConsole: false });
  });

  describe('logging', () => {
    it('logs error entries', () => {
      monitor.error('Qdrant', 'search', 'Connection refused');
      expect(monitor.size).toBe(1);
      const entries = monitor.getEntriesByLevel('ERROR');
      expect(entries[0].component).toBe('Qdrant');
      expect(entries[0].operation).toBe('search');
      expect(entries[0].error).toBe('Connection refused');
      expect(entries[0].level).toBe('ERROR');
    });

    it('logs warn entries with fallback info', () => {
      monitor.warn('Mem0', 'extract', 'Timeout', 'llm_extraction');
      const entries = monitor.getEntriesByLevel('WARN');
      expect(entries[0].fallbackUsed).toBe('llm_extraction');
    });

    it('logs info and debug entries', () => {
      monitor.info('MemoryService', 'init', 'Service started');
      monitor.debug('Chronicle', 'write', 'Writing chapter');
      expect(monitor.size).toBe(2);
    });

    it('accepts Error objects', () => {
      const err = new Error('ENOSPC: disk full');
      monitor.error('Chronicle', 'write', err);
      const entries = monitor.getEntriesByLevel('ERROR');
      expect(entries[0].error).toBe('ENOSPC: disk full');
    });

    it('trims entries when over maxEntries', () => {
      const smallMonitor = new ErrorMonitor({ maxEntries: 5, logToConsole: false });
      for (let i = 0; i < 10; i++) {
        smallMonitor.error('test', 'op', `error ${i}`);
      }
      expect(smallMonitor.size).toBe(5);
    });
  });

  describe('getStats', () => {
    it('returns stats grouped by component/operation', () => {
      monitor.error('Qdrant', 'search', 'err1');
      monitor.error('Qdrant', 'search', 'err2');
      monitor.error('Mem0', 'extract', 'err3');

      const stats = monitor.getStats();
      const qdrantStats = stats.find(s => s.component === 'Qdrant');
      expect(qdrantStats?.count).toBe(2);
      expect(stats.length).toBe(2);
    });

    it('calculates error rate for recent errors', () => {
      monitor.error('Qdrant', 'search', 'err');
      const stats = monitor.getStats();
      expect(stats[0].errorRate).toBe(1);
    });
  });

  describe('getErrorRate', () => {
    it('returns count of errors in last hour', () => {
      monitor.error('Qdrant', 'search', 'err1');
      monitor.error('Qdrant', 'search', 'err2');
      monitor.warn('Qdrant', 'index', 'warn'); // warns don't count
      expect(monitor.getErrorRate('Qdrant')).toBe(2);
    });

    it('returns 0 for unknown component', () => {
      expect(monitor.getErrorRate('Unknown')).toBe(0);
    });
  });

  describe('getEntriesByComponent', () => {
    it('filters entries by component', () => {
      monitor.error('Qdrant', 'search', 'err');
      monitor.error('Mem0', 'extract', 'err');
      monitor.warn('Qdrant', 'index', 'warn');

      const qdrantEntries = monitor.getEntriesByComponent('Qdrant');
      expect(qdrantEntries.length).toBe(2);
      expect(qdrantEntries.every(e => e.component === 'Qdrant')).toBe(true);
    });
  });

  describe('getRecentEntries', () => {
    it('returns last N entries', () => {
      for (let i = 0; i < 10; i++) {
        monitor.info('test', 'op', `msg ${i}`);
      }
      const recent = monitor.getRecentEntries(3);
      expect(recent.length).toBe(3);
      expect(recent[2].error).toBe('msg 9');
    });
  });

  describe('isAlertThresholdExceeded', () => {
    it('returns false when below threshold', () => {
      const m = new ErrorMonitor({ alertThreshold: 5, logToConsole: false });
      m.error('test', 'op', 'err');
      expect(m.isAlertThresholdExceeded()).toBe(false);
    });

    it('returns true when above threshold', () => {
      const m = new ErrorMonitor({ alertThreshold: 2, logToConsole: false });
      m.error('test', 'op', 'err1');
      m.error('test', 'op', 'err2');
      m.error('test', 'op', 'err3');
      expect(m.isAlertThresholdExceeded()).toBe(true);
    });

    it('filters by component when specified', () => {
      const m = new ErrorMonitor({ alertThreshold: 2, logToConsole: false });
      m.error('Qdrant', 'op', 'err1');
      m.error('Qdrant', 'op', 'err2');
      m.error('Qdrant', 'op', 'err3');
      expect(m.isAlertThresholdExceeded('Qdrant')).toBe(true);
      expect(m.isAlertThresholdExceeded('Mem0')).toBe(false);
    });
  });

  describe('clear', () => {
    it('clears all entries', () => {
      monitor.error('test', 'op', 'err');
      monitor.clear();
      expect(monitor.size).toBe(0);
    });
  });

  describe('globalErrorMonitor', () => {
    it('is a singleton instance', () => {
      expect(globalErrorMonitor).toBeInstanceOf(ErrorMonitor);
    });
  });
});
