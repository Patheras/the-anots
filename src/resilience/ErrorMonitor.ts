/**
 * Error Monitor
 *
 * Tracks all errors with timestamps, counts by component/operation,
 * and alerts on high error rates.
 *
 * Requirements: 12.6, 1.7
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface ErrorEntry {
  timestamp: Date;
  component: string;
  operation: string;
  error: string;
  fallbackUsed?: string;
  level: LogLevel;
}

export interface ErrorStats {
  component: string;
  operation: string;
  count: number;
  lastError: Date;
  errorRate: number; // errors per hour
}

export interface ErrorMonitorConfig {
  alertThreshold: number;   // errors per hour before alerting (default: 10)
  maxEntries: number;       // max log entries to keep in memory (default: 1000)
  logToConsole: boolean;    // whether to log to console (default: true)
}

const DEFAULT_CONFIG: ErrorMonitorConfig = {
  alertThreshold: 10,
  maxEntries: 1000,
  logToConsole: true,
};

export class ErrorMonitor {
  private entries: ErrorEntry[] = [];
  private config: ErrorMonitorConfig;

  constructor(config: Partial<ErrorMonitorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Log an error entry
   */
  log(
    level: LogLevel,
    component: string,
    operation: string,
    error: string | Error,
    fallbackUsed?: string
  ): void {
    const entry: ErrorEntry = {
      timestamp: new Date(),
      component,
      operation,
      error: error instanceof Error ? error.message : error,
      fallbackUsed,
      level,
    };

    this.entries.push(entry);

    // Trim old entries if over limit
    if (this.entries.length > this.config.maxEntries) {
      this.entries = this.entries.slice(-this.config.maxEntries);
    }

    // Log to console
    if (this.config.logToConsole) {
      this.writeToConsole(entry);
    }

    // Check alert threshold for ERROR level
    if (level === 'ERROR') {
      this.checkAlertThreshold(component, operation);
    }
  }

  debug(component: string, operation: string, message: string): void {
    this.log('DEBUG', component, operation, message);
  }

  info(component: string, operation: string, message: string): void {
    this.log('INFO', component, operation, message);
  }

  warn(component: string, operation: string, message: string, fallbackUsed?: string): void {
    this.log('WARN', component, operation, message, fallbackUsed);
  }

  error(component: string, operation: string, error: string | Error, fallbackUsed?: string): void {
    this.log('ERROR', component, operation, error, fallbackUsed);
  }

  /**
   * Get error statistics by component/operation
   */
  getStats(): ErrorStats[] {
    const statsMap = new Map<string, ErrorStats>();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    for (const entry of this.entries) {
      if (entry.level !== 'ERROR' && entry.level !== 'WARN') continue;

      const key = `${entry.component}::${entry.operation}`;
      const existing = statsMap.get(key);

      if (!existing) {
        statsMap.set(key, {
          component: entry.component,
          operation: entry.operation,
          count: 1,
          lastError: entry.timestamp,
          errorRate: entry.timestamp >= oneHourAgo ? 1 : 0,
        });
      } else {
        existing.count++;
        if (entry.timestamp > existing.lastError) {
          existing.lastError = entry.timestamp;
        }
        if (entry.timestamp >= oneHourAgo) {
          existing.errorRate++;
        }
      }
    }

    return Array.from(statsMap.values());
  }

  /**
   * Get error rate for a specific component (errors per hour)
   */
  getErrorRate(component: string): number {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return this.entries.filter(
      e => e.component === component &&
           e.level === 'ERROR' &&
           e.timestamp >= oneHourAgo
    ).length;
  }

  /**
   * Get recent entries (last N)
   */
  getRecentEntries(count: number = 50): ErrorEntry[] {
    return this.entries.slice(-count);
  }

  /**
   * Get entries filtered by level
   */
  getEntriesByLevel(level: LogLevel): ErrorEntry[] {
    return this.entries.filter(e => e.level === level);
  }

  /**
   * Get entries filtered by component
   */
  getEntriesByComponent(component: string): ErrorEntry[] {
    return this.entries.filter(e => e.component === component);
  }

  /**
   * Check if error rate exceeds alert threshold
   */
  isAlertThresholdExceeded(component?: string): boolean {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentErrors = this.entries.filter(
      e => e.level === 'ERROR' &&
           e.timestamp >= oneHourAgo &&
           (!component || e.component === component)
    );
    return recentErrors.length > this.config.alertThreshold;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Get total entry count
   */
  get size(): number {
    return this.entries.length;
  }

  private writeToConsole(entry: ErrorEntry): void {
    const ts = entry.timestamp.toISOString();
    const fallback = entry.fallbackUsed ? ` [fallback: ${entry.fallbackUsed}]` : '';
    const msg = `[${ts}] [${entry.level}] [${entry.component}::${entry.operation}] ${entry.error}${fallback}`;

    switch (entry.level) {
      case 'ERROR':
        console.error(msg);
        break;
      case 'WARN':
        console.warn(msg);
        break;
      case 'DEBUG':
        console.debug(msg);
        break;
      default:
        console.log(msg);
    }
  }

  private checkAlertThreshold(component: string, operation: string): void {
    if (this.isAlertThresholdExceeded()) {
      console.error(
        `[ALERT] High error rate detected: >${this.config.alertThreshold} errors/hour` +
        ` (latest: ${component}::${operation})`
      );
    }
  }
}

/**
 * Global singleton error monitor instance
 */
export const globalErrorMonitor = new ErrorMonitor();
