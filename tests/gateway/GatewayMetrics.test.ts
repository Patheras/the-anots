/**
 * GatewayMetrics + GatewayAuditLog Tests
 * Unit tests + Property-based tests (Properties 14, 15, 19)
 * Feature: anots-gateway
 */

import * as fc from 'fast-check';
import { GatewayMetrics } from '../../src/gateway/GatewayMetrics';
import { GatewayAuditLog } from '../../src/gateway/GatewayAuditLog';
import { PerformanceRecord, RoutingDecision, TaskType, ProviderId } from '../../src/gateway/types';

fc.configureGlobal({ numRuns: 100 });

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeRecord = (overrides: Partial<PerformanceRecord> = {}): PerformanceRecord => ({
  requestId: 'test-id',
  totalLatencyMs: 200,
  providerLatencyMs: 180,
  gatewayOverheadMs: 20,
  provider: 'local',
  model: 'qwen3.5:latest',
  taskType: 'code-generation',
  entropy: 'low',
  success: true,
  timestamp: new Date(),
  ...overrides,
});

const makeDecision = (requestId = 'test-id'): RoutingDecision => ({
  requestId,
  taskType: 'code-generation',
  entropy: 'low',
  selectedProvider: 'local',
  model: 'qwen3.5:latest',
  fallbackChain: [],
  quotaStatus: { consumed: 0, limit: 1_000_000, exhausted: false, resetAt: new Date() },
  cloudHealthStatus: 'healthy',
  localHealthStatus: 'healthy',
  timestamp: new Date(),
});

// ─── GatewayMetrics ───────────────────────────────────────────────────────────

describe('GatewayMetrics', () => {
  let metrics: GatewayMetrics;

  beforeEach(() => {
    metrics = new GatewayMetrics();
  });

  // ─── Property 14: Metrics Accumulation ──────────────────────────────────

  describe('Property 14: Metrics Accumulation', () => {
    it('N records → requestCount = N (for N ≤ 1000)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          (n) => {
            const m = new GatewayMetrics();
            for (let i = 0; i < n; i++) {
              m.record(makeRecord({ requestId: `req-${i}` }));
            }
            expect(m.getSnapshot().requestCount).toBe(n);
          }
        )
      );
    });
  });

  // ─── Property 15: Metrics Bounded Buffer ────────────────────────────────

  describe('Property 15: Metrics Bounded Buffer', () => {
    it('more than 1000 records → only last 1000 retained', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1001, max: 1500 }),
          (n) => {
            const m = new GatewayMetrics();
            for (let i = 0; i < n; i++) {
              m.record(makeRecord({ requestId: `req-${i}` }));
            }
            expect(m.size).toBe(1000);
            expect(m.getSnapshot().requestCount).toBe(1000);
          }
        )
      );
    });
  });

  // ─── Unit Tests ──────────────────────────────────────────────────────────

  describe('getSnapshot', () => {
    it('returns zero stats for empty metrics', () => {
      const snap = metrics.getSnapshot();
      expect(snap.requestCount).toBe(0);
      expect(snap.successRate).toBe(1);
      expect(snap.avgGatewayOverheadMs).toBe(0);
    });

    it('calculates success rate correctly', () => {
      metrics.record(makeRecord({ success: true }));
      metrics.record(makeRecord({ success: true }));
      metrics.record(makeRecord({ success: false }));
      expect(metrics.getSnapshot().successRate).toBeCloseTo(2 / 3, 2);
    });

    it('calculates average overhead correctly', () => {
      metrics.record(makeRecord({ gatewayOverheadMs: 10 }));
      metrics.record(makeRecord({ gatewayOverheadMs: 30 }));
      expect(metrics.getSnapshot().avgGatewayOverheadMs).toBe(20);
    });

    it('groups stats per provider', () => {
      metrics.record(makeRecord({ provider: 'cloud', providerLatencyMs: 500 }));
      metrics.record(makeRecord({ provider: 'local', providerLatencyMs: 50 }));
      const snap = metrics.getSnapshot();
      expect(snap.perProvider.cloud?.requestCount).toBe(1);
      expect(snap.perProvider.local?.requestCount).toBe(1);
    });
  });

  describe('clear', () => {
    it('resets all records', () => {
      metrics.record(makeRecord());
      metrics.clear();
      expect(metrics.size).toBe(0);
      expect(metrics.getSnapshot().requestCount).toBe(0);
    });
  });
});

// ─── GatewayAuditLog ──────────────────────────────────────────────────────────

describe('GatewayAuditLog', () => {
  let log: GatewayAuditLog;

  beforeEach(() => {
    log = new GatewayAuditLog();
  });

  // ─── Property 19: Bounded Audit Log Retrieval ────────────────────────────

  describe('Property 19: Bounded Audit Log Retrieval', () => {
    it('getRecent(limit) returns at most limit entries', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 2000 }), // entries to add
          fc.integer({ min: 0, max: 500 }),   // limit to request
          (entryCount, limit) => {
            const l = new GatewayAuditLog();
            for (let i = 0; i < entryCount; i++) {
              l.append(makeDecision(`req-${i}`));
            }
            const result = l.getRecent(limit);
            expect(result.length).toBeLessThanOrEqual(limit);
          }
        )
      );
    });
  });

  // ─── Unit Tests ──────────────────────────────────────────────────────────

  describe('append', () => {
    it('stores decisions', () => {
      log.append(makeDecision('req-1'));
      expect(log.size).toBe(1);
    });

    it('caps at 1000 entries', () => {
      for (let i = 0; i < 1200; i++) {
        log.append(makeDecision(`req-${i}`));
      }
      expect(log.size).toBe(1000);
    });
  });

  describe('getRecent', () => {
    it('returns most recent entries', () => {
      log.append(makeDecision('first'));
      log.append(makeDecision('second'));
      log.append(makeDecision('third'));
      const recent = log.getRecent(2);
      expect(recent.length).toBe(2);
      expect(recent[1].requestId).toBe('third');
    });

    it('returns empty array when log is empty', () => {
      expect(log.getRecent(10)).toEqual([]);
    });

    it('returns all entries when limit > size', () => {
      log.append(makeDecision('a'));
      log.append(makeDecision('b'));
      expect(log.getRecent(100).length).toBe(2);
    });
  });

  describe('clear', () => {
    it('removes all entries', () => {
      log.append(makeDecision('x'));
      log.clear();
      expect(log.size).toBe(0);
    });
  });
});
