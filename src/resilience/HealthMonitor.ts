/**
 * Health Monitor
 *
 * Tracks component health status and provides a unified health endpoint.
 * Checks connectivity to Mem0, Qdrant, Redis, file system, and LLM.
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.6, 13.7
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export type ComponentStatus = 'healthy' | 'degraded' | 'down';
export type OverallStatus = 'healthy' | 'degraded' | 'down';

export interface ComponentHealth {
  name: string;
  status: ComponentStatus;
  latencyMs?: number;
  lastChecked: Date;
  error?: string;
}

export interface HealthReport {
  status: OverallStatus;
  uptime: number;           // seconds since start
  components: ComponentHealth[];
  errorCount: number;
  lastOperationAt: Date | null;
  checkedAt: Date;
}

export interface HealthMonitorConfig {
  checkIntervalMs: number;  // how often to check (default: 30s)
  checkTimeoutMs: number;   // timeout per check (default: 5s)
  dataDir: string;          // directory to check writability
}

const DEFAULT_CONFIG: HealthMonitorConfig = {
  checkIntervalMs: 30000,
  checkTimeoutMs: 5000,
  dataDir: 'data',
};

export class HealthMonitor {
  private startTime = new Date();
  private components = new Map<string, ComponentHealth>();
  private errorCount = 0;
  private lastOperationAt: Date | null = null;
  private checkInterval: NodeJS.Timeout | null = null;
  private config: HealthMonitorConfig;

  // Optional service clients (injected)
  private qdrantCheck?: () => Promise<boolean>;
  private redisCheck?: () => Promise<boolean>;
  private mem0Check?: () => Promise<boolean>;
  private llmCheck?: () => Promise<boolean>;

  constructor(config: Partial<HealthMonitorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initComponents();
  }

  /**
   * Register health check functions for external services
   */
  registerCheck(name: string, checkFn: () => Promise<boolean>): void {
    switch (name) {
      case 'qdrant': this.qdrantCheck = checkFn; break;
      case 'redis': this.redisCheck = checkFn; break;
      case 'mem0': this.mem0Check = checkFn; break;
      case 'llm': this.llmCheck = checkFn; break;
    }
  }

  /**
   * Run all health checks and return report
   */
  async check(): Promise<HealthReport> {
    await Promise.all([
      this.checkFileSystem(),
      this.checkQdrant(),
      this.checkRedis(),
      this.checkMem0(),
      this.checkLLM(),
    ]);

    return this.getReport();
  }

  /**
   * Get current health report (without re-checking)
   */
  getReport(): HealthReport {
    const components = Array.from(this.components.values());
    const status = this.calculateOverallStatus(components);

    return {
      status,
      uptime: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
      components,
      errorCount: this.errorCount,
      lastOperationAt: this.lastOperationAt,
      checkedAt: new Date(),
    };
  }

  /**
   * Record an operation (updates lastOperationAt)
   */
  recordOperation(success: boolean): void {
    this.lastOperationAt = new Date();
    if (!success) this.errorCount++;
  }

  /**
   * Start periodic health checks
   */
  startPeriodicChecks(): void {
    if (this.checkInterval) return;
    this.checkInterval = setInterval(() => {
      this.check().catch(err => {
        console.warn('Health check failed:', err.message);
      });
    }, this.config.checkIntervalMs);
    // Allow process to exit even if interval is running
    this.checkInterval.unref();
  }

  /**
   * Stop periodic health checks
   */
  stopPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Get status of a specific component
   */
  getComponentStatus(name: string): ComponentHealth | undefined {
    return this.components.get(name);
  }

  private initComponents(): void {
    const names = ['filesystem', 'qdrant', 'redis', 'mem0', 'llm'];
    for (const name of names) {
      this.components.set(name, {
        name,
        status: 'healthy',
        lastChecked: new Date(),
      });
    }
  }

  private async checkFileSystem(): Promise<void> {
    const start = Date.now();
    try {
      const testFile = path.join(this.config.dataDir, '.health-check');
      await fs.mkdir(this.config.dataDir, { recursive: true });
      await fs.writeFile(testFile, 'ok');
      await fs.unlink(testFile);

      this.setComponent('filesystem', 'healthy', Date.now() - start);
    } catch (error) {
      this.setComponent('filesystem', 'down', Date.now() - start, (error as Error).message);
    }
  }

  private async checkQdrant(): Promise<void> {
    if (!this.qdrantCheck) {
      // No check registered - mark as unknown/degraded
      this.setComponent('qdrant', 'degraded', undefined, 'No health check registered');
      return;
    }
    const start = Date.now();
    try {
      const ok = await Promise.race([
        this.qdrantCheck(),
        this.timeout(this.config.checkTimeoutMs),
      ]);
      this.setComponent('qdrant', ok ? 'healthy' : 'down', Date.now() - start);
    } catch (error) {
      this.setComponent('qdrant', 'down', Date.now() - start, (error as Error).message);
    }
  }

  private async checkRedis(): Promise<void> {
    if (!this.redisCheck) {
      this.setComponent('redis', 'degraded', undefined, 'No health check registered');
      return;
    }
    const start = Date.now();
    try {
      const ok = await Promise.race([
        this.redisCheck(),
        this.timeout(this.config.checkTimeoutMs),
      ]);
      this.setComponent('redis', ok ? 'healthy' : 'down', Date.now() - start);
    } catch (error) {
      this.setComponent('redis', 'down', Date.now() - start, (error as Error).message);
    }
  }

  private async checkMem0(): Promise<void> {
    if (!this.mem0Check) {
      this.setComponent('mem0', 'degraded', undefined, 'No health check registered');
      return;
    }
    const start = Date.now();
    try {
      const ok = await Promise.race([
        this.mem0Check(),
        this.timeout(this.config.checkTimeoutMs),
      ]);
      this.setComponent('mem0', ok ? 'healthy' : 'down', Date.now() - start);
    } catch (error) {
      this.setComponent('mem0', 'down', Date.now() - start, (error as Error).message);
    }
  }

  private async checkLLM(): Promise<void> {
    if (!this.llmCheck) {
      this.setComponent('llm', 'degraded', undefined, 'No health check registered');
      return;
    }
    const start = Date.now();
    try {
      const ok = await Promise.race([
        this.llmCheck(),
        this.timeout(this.config.checkTimeoutMs),
      ]);
      this.setComponent('llm', ok ? 'healthy' : 'down', Date.now() - start);
    } catch (error) {
      this.setComponent('llm', 'down', Date.now() - start, (error as Error).message);
    }
  }

  private setComponent(
    name: string,
    status: ComponentStatus,
    latencyMs?: number,
    error?: string
  ): void {
    this.components.set(name, {
      name,
      status,
      latencyMs,
      lastChecked: new Date(),
      error,
    });
  }

  private calculateOverallStatus(components: ComponentHealth[]): OverallStatus {
    const fsStatus = components.find(c => c.name === 'filesystem')?.status;
    if (fsStatus === 'down') return 'down';
    const statuses = components.map(c => c.status);
    if (statuses.some(s => s === 'down')) return 'degraded';
    if (statuses.some(s => s === 'degraded')) return 'degraded';
    return 'healthy';
  }

  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Health check timed out after ${ms}ms`)), ms)
    );
  }
}

/**
 * Global singleton health monitor
 */
export const globalHealthMonitor = new HealthMonitor();
