/**
 * Performance Monitor
 *
 * Tracks operation latencies and calculates percentiles (p50, p95, p99).
 * Used for health monitoring and performance validation.
 *
 * Requirements: 13.7
 */

export interface LatencyRecord {
  operation: string;
  component: string;
  durationMs: number;
  timestamp: Date;
  success: boolean;
}

export interface PercentileStats {
  operation: string;
  component: string;
  count: number;
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  avg: number;
}

export interface PerformanceMonitorConfig {
  maxRecords: number;       // max records per operation (default: 1000)
  windowMs: number;         // time window for stats (default: 1 hour)
}

const DEFAULT_CONFIG: PerformanceMonitorConfig = {
  maxRecords: 1000,
  windowMs: 60 * 60 * 1000, // 1 hour
};

export class PerformanceMonitor {
  private records: LatencyRecord[] = [];
  private config: PerformanceMonitorConfig;

  constructor(config: Partial<PerformanceMonitorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Record a latency measurement
   */
  record(component: string, operation: string, durationMs: number, success = true): void {
    this.records.push({
      operation,
      component,
      durationMs,
      timestamp: new Date(),
      success,
    });

    // Trim old records
    if (this.records.length > this.config.maxRecords) {
      this.records = this.records.slice(-this.config.maxRecords);
    }
  }

  /**
   * Measure and record an async operation's latency
   */
  async measure<T>(
    component: string,
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const start = Date.now();
    let success = true;
    try {
      const result = await fn();
      return result;
    } catch (error) {
      success = false;
      throw error;
    } finally {
      this.record(component, operation, Date.now() - start, success);
    }
  }

  /**
   * Get percentile stats for a specific component/operation
   */
  getStats(component: string, operation: string): PercentileStats | null {
    const windowStart = new Date(Date.now() - this.config.windowMs);
    const relevant = this.records.filter(
      r => r.component === component &&
           r.operation === operation &&
           r.timestamp >= windowStart
    );

    if (relevant.length === 0) return null;

    const durations = relevant.map(r => r.durationMs).sort((a, b) => a - b);
    return {
      operation,
      component,
      count: durations.length,
      p50: this.percentile(durations, 50),
      p95: this.percentile(durations, 95),
      p99: this.percentile(durations, 99),
      min: durations[0],
      max: durations[durations.length - 1],
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
    };
  }

  /**
   * Get all stats grouped by component/operation
   */
  getAllStats(): PercentileStats[] {
    const keys = new Set(
      this.records.map(r => `${r.component}::${r.operation}`)
    );
    const result: PercentileStats[] = [];
    for (const key of keys) {
      const [component, operation] = key.split('::');
      const stats = this.getStats(component, operation);
      if (stats) result.push(stats);
    }
    return result;
  }

  /**
   * Get throughput (operations per minute) for a component/operation
   */
  getThroughput(component: string, operation: string): number {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    return this.records.filter(
      r => r.component === component &&
           r.operation === operation &&
           r.timestamp >= oneMinuteAgo
    ).length;
  }

  /**
   * Get success rate (0-1) for a component/operation
   */
  getSuccessRate(component: string, operation: string): number {
    const windowStart = new Date(Date.now() - this.config.windowMs);
    const relevant = this.records.filter(
      r => r.component === component &&
           r.operation === operation &&
           r.timestamp >= windowStart
    );
    if (relevant.length === 0) return 1;
    return relevant.filter(r => r.success).length / relevant.length;
  }

  /**
   * Clear all records
   */
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

/**
 * Global singleton performance monitor
 */
export const globalPerformanceMonitor = new PerformanceMonitor();
