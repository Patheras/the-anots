/**
 * GatewayHealthMonitor Tests
 * Unit tests + Property-based tests (Properties 10, 11)
 * Feature: anots-gateway
 */

import * as fc from 'fast-check';
import { GatewayHealthMonitor } from '../../src/gateway/GatewayHealthMonitor';

fc.configureGlobal({ numRuns: 100 });

describe('GatewayHealthMonitor', () => {
  let monitor: GatewayHealthMonitor;

  beforeEach(() => {
    monitor = new GatewayHealthMonitor();
  });

  afterEach(() => {
    monitor.stopPeriodicProbes();
  });

  // ─── Property 10: Health Degradation Threshold ────────────────────────────

  describe('Property 10: Health Degradation Threshold', () => {
    it('error rate > 10% → status=degraded', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 11, max: 50 }), // failures out of 100
          (failureCount) => {
            const m = new GatewayHealthMonitor();
            // Record 100 requests with failureCount failures
            for (let i = 0; i < 100; i++) {
              m.recordRequest('cloud', 100, i >= failureCount);
            }
            const health = m.getProviderHealth('cloud');
            expect(health.status).toBe('degraded');
            m.stopPeriodicProbes();
          }
        )
      );
    });

    it('p95 latency > 10,000ms → status=degraded', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10001, max: 20000 }),
          (highLatency) => {
            const m = new GatewayHealthMonitor();
            // Record 20 requests with high latency (drives p95 up)
            for (let i = 0; i < 20; i++) {
              m.recordRequest('local', highLatency, true);
            }
            const health = m.getProviderHealth('local');
            expect(health.status).toBe('degraded');
            m.stopPeriodicProbes();
          }
        )
      );
    });
  });

  // ─── Unit Tests ────────────────────────────────────────────────────────────

  describe('recordRequest', () => {
    it('starts healthy with no records', () => {
      const health = monitor.getProviderHealth('cloud');
      expect(health.status).toBe('healthy');
      expect(health.errorRate).toBe(0);
    });

    it('tracks error rate correctly', () => {
      for (let i = 0; i < 10; i++) {
        monitor.recordRequest('cloud', 100, i < 8); // 2 failures = 20%
      }
      const health = monitor.getProviderHealth('cloud');
      expect(health.errorRate).toBeCloseTo(0.2, 1);
    });

    it('tracks latency percentiles', () => {
      for (let i = 1; i <= 100; i++) {
        monitor.recordRequest('local', i * 10, true); // 10ms to 1000ms
      }
      const health = monitor.getProviderHealth('local');
      expect(health.latencyP50).toBeGreaterThan(0);
      expect(health.latencyP95).toBeGreaterThan(health.latencyP50);
      expect(health.latencyP99).toBeGreaterThanOrEqual(health.latencyP95);
    });
  });

  describe('degradation and recovery', () => {
    it('marks degraded when error rate exceeds 10%', () => {
      for (let i = 0; i < 10; i++) {
        monitor.recordRequest('cloud', 100, i < 8); // 20% error rate
      }
      expect(monitor.getProviderHealth('cloud').status).toBe('degraded');
    });

    it('recovers after two consecutive healthy checks', () => {
      // First degrade it
      for (let i = 0; i < 10; i++) {
        monitor.recordRequest('cloud', 100, false); // 100% error rate
      }
      expect(monitor.getProviderHealth('cloud').status).toBe('degraded');

      // Now simulate recovery: clear old records by recording many healthy ones
      // (in real usage, old records expire after 60s; here we flood with healthy)
      for (let i = 0; i < 200; i++) {
        monitor.recordRequest('cloud', 100, true); // 0% error rate
      }
      // After enough healthy records, two consecutive checks should flip to healthy
      monitor.recordRequest('cloud', 100, true);
      monitor.recordRequest('cloud', 100, true);
      expect(monitor.getProviderHealth('cloud').status).toBe('healthy');
    });

    it('cloud and local are tracked independently', () => {
      // Degrade cloud
      for (let i = 0; i < 10; i++) {
        monitor.recordRequest('cloud', 100, false);
      }
      // Local stays healthy
      monitor.recordRequest('local', 50, true);

      expect(monitor.getProviderHealth('cloud').status).toBe('degraded');
      expect(monitor.getProviderHealth('local').status).toBe('healthy');
    });
  });

  describe('startPeriodicProbes / stopPeriodicProbes', () => {
    it('starts and stops without error', () => {
      const m = new GatewayHealthMonitor();
      m.startPeriodicProbes();
      m.stopPeriodicProbes();
    });

    it('does not start twice', () => {
      const m = new GatewayHealthMonitor();
      m.startPeriodicProbes();
      m.startPeriodicProbes(); // no-op
      m.stopPeriodicProbes();
    });
  });
});
