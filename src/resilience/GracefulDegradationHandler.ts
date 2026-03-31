/**
 * Graceful Degradation Handler
 * 
 * Implements fallback chains for all memory operations.
 * Ensures system continues operating even when components fail.
 * 
 * Requirements: 1.4, 4.3, 5.4, 8.4, 8.5, 11.4, 11.5, 11.7, 12.1-12.4
 * Whitepaper: Section 7.0 (Design Philosophy), Section 7.1 (Failure Handling)
 */

/**
 * Operation type
 */
export type OperationType = 
  | 'search'
  | 'extract_truths'
  | 'index_truths'
  | 'inscribe_chronicle'
  | 'llm_invoke';

/**
 * Fallback attempt
 */
export interface FallbackAttempt<T> {
  method: string;
  attempt: number;
  success: boolean;
  result?: T;
  error?: string;
  duration: number; // milliseconds
}

/**
 * Fallback result
 */
export interface FallbackResult<T> {
  success: boolean;
  result: T;
  attempts: FallbackAttempt<T>[];
  finalMethod: string;
  totalDuration: number;
}

/**
 * Fallback function
 */
export type FallbackFunction<T> = () => Promise<T>;

/**
 * Graceful Degradation Handler
 * 
 * Executes operations with fallback chains.
 * Tracks which fallback was used for monitoring.
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.4
 */
export class GracefulDegradationHandler {
  private fallbackStats: Map<string, {
    totalAttempts: number;
    successfulAttempts: number;
    failedAttempts: number;
    fallbackUsage: Map<string, number>;
  }>;

  constructor() {
    this.fallbackStats = new Map();
  }

  /**
   * Execute operation with fallback chain
   * 
   * Requirements: 12.1, 12.2, 12.3, 12.4
   */
  async executeWithFallback<T>(
    operationType: OperationType,
    fallbacks: Array<{ method: string; fn: FallbackFunction<T> }>,
    defaultValue: T
  ): Promise<FallbackResult<T>> {
    const startTime = Date.now();
    const attempts: FallbackAttempt<T>[] = [];

    // Initialize stats for this operation type
    if (!this.fallbackStats.has(operationType)) {
      this.fallbackStats.set(operationType, {
        totalAttempts: 0,
        successfulAttempts: 0,
        failedAttempts: 0,
        fallbackUsage: new Map(),
      });
    }

    const stats = this.fallbackStats.get(operationType)!;
    stats.totalAttempts++;

    // Try each fallback in order
    for (let i = 0; i < fallbacks.length; i++) {
      const { method, fn } = fallbacks[i];
      const attemptStart = Date.now();

      try {
        const result = await fn();
        const duration = Date.now() - attemptStart;

        attempts.push({
          method,
          attempt: i + 1,
          success: true,
          result,
          duration,
        });

        // Update stats
        stats.successfulAttempts++;
        stats.fallbackUsage.set(method, (stats.fallbackUsage.get(method) || 0) + 1);

        return {
          success: true,
          result,
          attempts,
          finalMethod: method,
          totalDuration: Date.now() - startTime,
        };
      } catch (error) {
        const duration = Date.now() - attemptStart;

        attempts.push({
          method,
          attempt: i + 1,
          success: false,
          error: (error as Error).message,
          duration,
        });

        console.warn(`[GracefulDegradation] ${operationType} failed with ${method}:`, (error as Error).message);
      }
    }

    // All fallbacks failed - return default value
    stats.failedAttempts++;
    
    console.error(`[GracefulDegradation] All fallbacks failed for ${operationType}, using default value`);

    return {
      success: false,
      result: defaultValue,
      attempts,
      finalMethod: 'default',
      totalDuration: Date.now() - startTime,
    };
  }

  /**
   * Get fallback statistics
   */
  getStats(operationType?: OperationType): any {
    if (operationType) {
      return this.fallbackStats.get(operationType) || null;
    }

    const allStats: any = {};
    this.fallbackStats.forEach((stats, type) => {
      allStats[type] = {
        ...stats,
        fallbackUsage: Object.fromEntries(stats.fallbackUsage),
      };
    });

    return allStats;
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.fallbackStats.clear();
  }

  /**
   * Get success rate for operation type
   */
  getSuccessRate(operationType: OperationType): number {
    const stats = this.fallbackStats.get(operationType);
    if (!stats || stats.totalAttempts === 0) {
      return 0;
    }

    return stats.successfulAttempts / stats.totalAttempts;
  }

  /**
   * Get most used fallback method
   */
  getMostUsedFallback(operationType: OperationType): string | null {
    const stats = this.fallbackStats.get(operationType);
    if (!stats || stats.fallbackUsage.size === 0) {
      return null;
    }

    let maxMethod = '';
    let maxCount = 0;

    stats.fallbackUsage.forEach((count, method) => {
      if (count > maxCount) {
        maxCount = count;
        maxMethod = method;
      }
    });

    return maxMethod || null;
  }
}

/**
 * Create graceful degradation handler
 */
export function createGracefulDegradationHandler(): GracefulDegradationHandler {
  return new GracefulDegradationHandler();
}

/**
 * Pre-configured fallback chains
 */

/**
 * Search fallback chain
 * 
 * Requirements: 1.4, 5.4, 11.4, 11.5, 11.7
 */
export function createSearchFallbackChain(
  mem0Search: () => Promise<any[]>,
  qdrantSearch: () => Promise<any[]>,
  chronicleGrep: () => Promise<any[]>
): Array<{ method: string; fn: FallbackFunction<any[]> }> {
  return [
    { method: 'mem0', fn: mem0Search },
    { method: 'qdrant', fn: qdrantSearch },
    { method: 'chronicle_grep', fn: chronicleGrep },
  ];
}

/**
 * Truth extraction fallback chain
 * 
 * Requirements: 8.4, 8.5
 */
export function createTruthExtractionFallbackChain(
  mem0Extract: () => Promise<any[]>,
  llmExtract: () => Promise<any[]>
): Array<{ method: string; fn: FallbackFunction<any[]> }> {
  return [
    { method: 'mem0', fn: mem0Extract },
    { method: 'llm', fn: llmExtract },
  ];
}

/**
 * LLM fallback chain
 * 
 * Requirements: 4.3, 12.4
 */
export function createLLMFallbackChain(
  cloudLLM: () => Promise<string>,
  localLLM: () => Promise<string>,
  cachedResponse: () => Promise<string>
): Array<{ method: string; fn: FallbackFunction<string> }> {
  return [
    { method: 'cloud_llm', fn: cloudLLM },
    { method: 'local_llm', fn: localLLM },
    { method: 'cached', fn: cachedResponse },
  ];
}

/**
 * Storage fallback chain
 * 
 * Requirements: 10.3, 12.3
 */
export function createStorageFallbackChain(
  qdrantStore: () => Promise<void>,
  fileBackup: () => Promise<void>,
  memoryCache: () => Promise<void>
): Array<{ method: string; fn: FallbackFunction<void> }> {
  return [
    { method: 'qdrant', fn: qdrantStore },
    { method: 'file_backup', fn: fileBackup },
    { method: 'memory_cache', fn: memoryCache },
  ];
}
