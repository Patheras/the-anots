/**
 * Gateway Metrics
 *
 * Circular buffer of the last 1,000 PerformanceRecord entries.
 * Computes aggregate stats on demand.
 *
 * Requirements: 7.1–7.4
 */

import { PerformanceRecord, GatewayMetricsSnapshot, ProviderId } from './types';

const MAX_RECORDS = 1_000;
const OVERHEAD_WARN_MS = 100;

export class GatewayMetrics {
  private records: PerformanceRecord[] = [];

  /** Append a performance record, evicting oldest if over limit */
  record(entry: PerformanceRecord): void {
    if (entry.gatewayOverheadMs > OVERHEAD_WARN_MS) {
      console.warn(
        `[GatewayMetrics] High overhead: ${entry.gatewayOverheadMs}ms for request ${entry.requestId}`
      );
    }

    this.records.push(entry);
    if (this.records.length > MAX_RECORDS) {
      this.records = this.records.slice(-MAX_RECORDS);
    }
  }

  /** Compute aggregate statistics from buffered records */
  getSnapshot(): GatewayMetricsSnapshot {
    const total = this.records.length;
    if (total === 0) {
      return {
        requestCount: 0,
        successRate: 1,
        avgGatewayOverheadMs: 0,
        perProvider: {},
      };
    }

    const successes = this.records.filter(r => r.success).length;
    const avgOverhead =
      this.records.reduce((sum, r) => sum + r.gatewayOverheadMs, 0) / total;

    const perProvider: GatewayMetricsSnapshot['perProvider'] = {};

    for (const provider of ['cloud', 'cloud-alt', 'local'] as ProviderId[]) {
      const providerRecords = this.records.filter(r => r.provider === provider);
      if (providerRecords.length === 0) continue;

      const latencies = providerRecords
        .map(r => r.providerLatencyMs)
        .sort((a, b) => a - b);

      const providerSuccesses = providerRecords.filter(r => r.success).length;

      perProvider[provider] = {
        p50: this.percentile(latencies, 50),
        p95: this.percentile(latencies, 95),
        p99: this.percentile(latencies, 99),
        successRate: providerSuccesses / providerRecords.length,
        requestCount: providerRecords.length,
      };
    }

    return {
      requestCount: total,
      successRate: successes / total,
      avgGatewayOverheadMs: avgOverhead,
      perProvider,
    };
  }

  clear(): void {
    this.records = [];
  }

  get size(): number {
    return this.records.length;
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
