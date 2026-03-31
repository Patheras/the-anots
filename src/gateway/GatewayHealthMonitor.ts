/**
 * Gateway Health Monitor
 *
 * Tracks per-provider health using a 60-second rolling window.
 * Marks providers as degraded when error rate > 10% OR p95 > 10,000ms.
 * Recovers when error rate < 5% AND p95 < 8,000ms for two consecutive checks.
 *
 * Requirements: 5.1–5.7
 */

import { ProviderHealth, ProviderId, ProviderStatus } from './types';
import { PerformanceMonitor } from '../resilience/PerformanceMonitor';

interface HealthRecord {
  latencyMs: number;
  success: boolean;
  timestamp: Date;
}

interface ConsecutiveHealthyCount {
  cloud: number;
  local: number;
}

export class GatewayHealthMonitor {
  private readonly records: Map<ProviderId, HealthRecord[]> = new Map([
    ['cloud', []],
    ['local', []],
  ]);

  private readonly status: Map<ProviderId, ProviderStatus> = new Map([
    ['cloud', 'healthy'],
    ['local', 'healthy'],
  ]);

  private readonly consecutiveHealthy: ConsecutiveHealthyCount = { cloud: 0, local: 0 };
  private readonly windowMs = 60_000; // 60-second rolling window
  private probeTimer: NodeJS.Timeout | null = null;

  // Injected probe function (for testing / real use)
  private probeProvider?: (provider: ProviderId) => Promise<{ latencyMs: number; success: boolean }>;

  constructor(probeProvider?: (provider: ProviderId) => Promise<{ latencyMs: number; success: boolean }>) {
    this.probeProvider = probeProvider;
  }

  /** Record a completed request for a provider */
  recordRequest(provider: ProviderId, latencyMs: number, success: boolean): void {
    const records = this.records.get(provider)!;
    records.push({ latencyMs, success, timestamp: new Date() });
    this.evictOldRecords(provider);
    this.updateStatus(provider);
  }

  /** Get current health for a provider */
  getProviderHealth(provider: ProviderId): ProviderHealth {
    this.evictOldRecords(provider);
    const records = this.records.get(provider)!;

    if (records.length === 0) {
      return {
        provider,
        latencyP50: 0,
        latencyP95: 0,
        latencyP99: 0,
        errorRate: 0,
        status: this.status.get(provider)!,
        lastChecked: new Date(),
      };
    }

    const latencies = records.map(r => r.latencyMs).sort((a, b) => a - b);
    const failures = records.filter(r => !r.success).length;

    return {
      provider,
      latencyP50: this.percentile(latencies, 50),
      latencyP95: this.percentile(latencies, 95),
      latencyP99: this.percentile(latencies, 99),
      errorRate: failures / records.length,
      status: this.status.get(provider)!,
      lastChecked: new Date(),
    };
  }

  /** Start 30-second periodic health probes */
  startPeriodicProbes(): void {
    if (this.probeTimer) return;
    this.probeTimer = setInterval(() => {
      this.runProbes();
    }, 30_000);
    if (this.probeTimer.unref) this.probeTimer.unref();
  }

  /** Stop periodic probes */
  stopPeriodicProbes(): void {
    if (this.probeTimer) {
      clearInterval(this.probeTimer);
      this.probeTimer = null;
    }
  }

  private async runProbes(): Promise<void> {
    if (!this.probeProvider) return;
    for (const provider of ['cloud', 'local'] as ProviderId[]) {
      try {
        const result = await this.probeProvider(provider);
        this.recordRequest(provider, result.latencyMs, result.success);
      } catch {
        this.recordRequest(provider, 10_001, false);
      }
    }
  }

  private evictOldRecords(provider: ProviderId): void {
    const cutoff = Date.now() - this.windowMs;
    const records = this.records.get(provider)!;
    const fresh = records.filter(r => r.timestamp.getTime() >= cutoff);
    this.records.set(provider, fresh);
  }

  private updateStatus(provider: ProviderId): void {
    const health = this.getProviderHealthRaw(provider);
    const current = this.status.get(provider)!;

    const isDegraded =
      health.errorRate > 0.10 ||
      health.latencyP95 > 10_000;

    const isRecovering =
      health.errorRate < 0.05 &&
      health.latencyP95 < 8_000;

    if (isDegraded) {
      this.status.set(provider, 'degraded');
      this.consecutiveHealthy[provider] = 0;
    } else if (isRecovering && current === 'degraded') {
      this.consecutiveHealthy[provider]++;
      if (this.consecutiveHealthy[provider] >= 2) {
        this.status.set(provider, 'healthy');
        this.consecutiveHealthy[provider] = 0;
      }
    } else if (current !== 'degraded') {
      this.status.set(provider, 'healthy');
    }
  }

  /** Raw health calculation without status override (used internally) */
  private getProviderHealthRaw(provider: ProviderId): { errorRate: number; latencyP95: number } {
    const records = this.records.get(provider)!;
    if (records.length === 0) return { errorRate: 0, latencyP95: 0 };

    const latencies = records.map(r => r.latencyMs).sort((a, b) => a - b);
    const failures = records.filter(r => !r.success).length;

    return {
      errorRate: failures / records.length,
      latencyP95: this.percentile(latencies, 95),
    };
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0];
    const idx = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
  }
}
