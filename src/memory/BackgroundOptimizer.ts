/**
 * Background Optimizer
 *
 * Performs non-critical optimization tasks during idle periods.
 * Pauses immediately when user activity resumes.
 * Never blocks main dialogue.
 *
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.6, 17.7
 * Whitepaper: Section 7.2 (Background Optimization)
 */

export interface TruthEntry {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  timestamp: Date;
  usageCount?: number;
}

export interface OptimizationResult {
  task: string;
  duration: number;
  itemsProcessed: number;
  success: boolean;
  error?: string;
}

export interface BackgroundOptimizerConfig {
  enabled: boolean;
  idleThresholdMs: number;    // ms of inactivity before starting (default: 10 min)
  maxTaskDurationMs: number;  // max time per task before yielding (default: 5s)
  deduplicationEnabled: boolean;
  scoringEnabled: boolean;
  clusteringEnabled: boolean;
}

const DEFAULT_CONFIG: BackgroundOptimizerConfig = {
  enabled: true,
  idleThresholdMs: 10 * 60 * 1000, // 10 minutes
  maxTaskDurationMs: 5000,
  deduplicationEnabled: true,
  scoringEnabled: true,
  clusteringEnabled: false, // expensive, disabled by default
};

export class BackgroundOptimizer {
  private config: BackgroundOptimizerConfig;
  private lastActivityAt: Date = new Date();
  private isRunning = false;
  private isPaused = false;
  private idleTimer: NodeJS.Timeout | null = null;
  private results: OptimizationResult[] = [];

  // Injected operations (optional - graceful if not provided)
  private getTruths?: () => Promise<TruthEntry[]>;
  private updateTruths?: (truths: TruthEntry[]) => Promise<void>;

  constructor(config: Partial<BackgroundOptimizerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register data access functions
   */
  registerDataAccess(
    getTruths: () => Promise<TruthEntry[]>,
    updateTruths: (truths: TruthEntry[]) => Promise<void>
  ): void {
    this.getTruths = getTruths;
    this.updateTruths = updateTruths;
  }

  /**
   * Record user activity - pauses optimization immediately
   */
  recordActivity(): void {
    this.lastActivityAt = new Date();
    if (this.isRunning) {
      this.isPaused = true;
    }
    this.resetIdleTimer();
  }

  /**
   * Start idle detection and background optimization
   */
  start(): void {
    if (!this.config.enabled) return;
    this.resetIdleTimer();
  }

  /**
   * Stop background optimization
   */
  stop(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    this.isPaused = true;
  }

  /**
   * Check if system is currently idle
   */
  isIdle(): boolean {
    const idleMs = Date.now() - this.lastActivityAt.getTime();
    return idleMs >= this.config.idleThresholdMs;
  }

  /**
   * Get milliseconds since last activity
   */
  getIdleMs(): number {
    return Date.now() - this.lastActivityAt.getTime();
  }

  /**
   * Run optimization tasks manually (for testing)
   */
  async runOptimization(): Promise<OptimizationResult[]> {
    if (!this.config.enabled) return [];

    this.isRunning = true;
    this.isPaused = false;
    const results: OptimizationResult[] = [];

    try {
      if (this.config.deduplicationEnabled && !this.isPaused) {
        const result = await this.runDeduplication();
        results.push(result);
        this.results.push(result);
      }

      if (this.config.scoringEnabled && !this.isPaused) {
        const result = await this.runScoring();
        results.push(result);
        this.results.push(result);
      }

      if (this.config.clusteringEnabled && !this.isPaused) {
        const result = await this.runClustering();
        results.push(result);
        this.results.push(result);
      }
    } finally {
      this.isRunning = false;
    }

    return results;
  }

  /**
   * Deduplication: find and merge duplicate truths
   * Requirements: 17.2
   */
  async runDeduplication(): Promise<OptimizationResult> {
    const start = Date.now();
    try {
      if (!this.getTruths || !this.updateTruths) {
        return { task: 'deduplication', duration: 0, itemsProcessed: 0, success: true };
      }

      const truths = await this.getTruths();
      const seen = new Map<string, TruthEntry>();
      let duplicatesRemoved = 0;

      for (const truth of truths) {
        if (this.isPaused) break;

        const key = `${truth.subject}|${truth.predicate}|${truth.object}`.toLowerCase();
        const existing = seen.get(key);

        if (!existing) {
          seen.set(key, truth);
        } else {
          // Keep highest confidence
          if (truth.confidence > existing.confidence) {
            seen.set(key, truth);
          }
          duplicatesRemoved++;
        }
      }

      if (!this.isPaused && duplicatesRemoved > 0) {
        await this.updateTruths(Array.from(seen.values()));
      }

      return {
        task: 'deduplication',
        duration: Date.now() - start,
        itemsProcessed: duplicatesRemoved,
        success: true,
      };
    } catch (error) {
      return {
        task: 'deduplication',
        duration: Date.now() - start,
        itemsProcessed: 0,
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Memory scoring: score truths by recency, confidence, usage
   * Requirements: 17.2
   */
  async runScoring(): Promise<OptimizationResult> {
    const start = Date.now();
    try {
      if (!this.getTruths || !this.updateTruths) {
        return { task: 'scoring', duration: 0, itemsProcessed: 0, success: true };
      }

      const truths = await this.getTruths();
      const now = Date.now();
      let scored = 0;

      const scoredTruths = truths.map(truth => {
        if (this.isPaused) return truth;

        // Score = confidence * recency_factor * usage_factor
        const ageMs = now - truth.timestamp.getTime();
        const ageDays = ageMs / (1000 * 60 * 60 * 24);
        const recencyFactor = Math.exp(-ageDays / 30); // decay over 30 days
        const usageFactor = 1 + Math.log1p(truth.usageCount || 0) * 0.1;

        scored++;
        return {
          ...truth,
          confidence: Math.min(1, truth.confidence * recencyFactor * usageFactor),
        };
      });

      if (!this.isPaused) {
        await this.updateTruths(scoredTruths);
      }

      return {
        task: 'scoring',
        duration: Date.now() - start,
        itemsProcessed: scored,
        success: true,
      };
    } catch (error) {
      return {
        task: 'scoring',
        duration: Date.now() - start,
        itemsProcessed: 0,
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Semantic clustering: group related truths
   * Requirements: 17.2
   */
  async runClustering(): Promise<OptimizationResult> {
    const start = Date.now();
    try {
      if (!this.getTruths) {
        return { task: 'clustering', duration: 0, itemsProcessed: 0, success: true };
      }

      const truths = await this.getTruths();

      // Simple subject-based clustering
      const clusters = new Map<string, TruthEntry[]>();
      for (const truth of truths) {
        if (this.isPaused) break;
        const key = truth.subject.toLowerCase();
        if (!clusters.has(key)) clusters.set(key, []);
        clusters.get(key)!.push(truth);
      }

      return {
        task: 'clustering',
        duration: Date.now() - start,
        itemsProcessed: clusters.size,
        success: true,
      };
    } catch (error) {
      return {
        task: 'clustering',
        duration: Date.now() - start,
        itemsProcessed: 0,
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Get optimization history
   */
  getResults(): OptimizationResult[] {
    return [...this.results];
  }

  /**
   * Get current state
   */
  getState(): { isRunning: boolean; isPaused: boolean; isIdle: boolean; idleMs: number } {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      isIdle: this.isIdle(),
      idleMs: this.getIdleMs(),
    };
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    if (!this.config.enabled) return;

    this.idleTimer = setTimeout(() => {
      if (this.isIdle()) {
        this.isPaused = false;
        this.runOptimization().catch(err => {
          console.warn('Background optimization failed:', err.message);
        });
      }
    }, this.config.idleThresholdMs);

    // Allow process to exit even if timer is running
    if (this.idleTimer.unref) {
      this.idleTimer.unref();
    }
  }
}
