/**
 * Circuit Breaker Pattern
 *
 * Prevents cascading failures by tracking failure counts and
 * temporarily blocking calls to failing services.
 *
 * States:
 * - CLOSED: Normal operation, calls pass through
 * - OPEN: Too many failures, calls blocked (use fallback immediately)
 * - HALF_OPEN: Testing recovery, one call allowed through
 *
 * Requirements: 12.1, 12.2, 5.4, 8.4, 11.4, 14.5
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number;   // failures before opening (default: 5)
  successThreshold: number;   // successes in HALF_OPEN before closing (default: 2)
  timeout: number;            // ms before trying HALF_OPEN (default: 60000)
  name: string;               // identifier for logging
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: Date | null;
  lastStateChange: Date;
  totalCalls: number;
  totalFailures: number;
  totalSuccesses: number;
}

const DEFAULT_CONFIG: Omit<CircuitBreakerConfig, 'name'> = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000,
};

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: Date | null = null;
  private lastStateChange = new Date();
  private totalCalls = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> & { name: string }) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute a function with circuit breaker protection
   *
   * @throws CircuitOpenError if circuit is OPEN
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalCalls++;

    if (this.state === 'OPEN') {
      // Check if timeout has elapsed - try HALF_OPEN
      if (this.shouldAttemptReset()) {
        this.transitionTo('HALF_OPEN');
      } else {
        throw new CircuitOpenError(
          `Circuit breaker [${this.config.name}] is OPEN. ` +
          `Retry after ${this.getRetryAfterMs()}ms.`
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Check if circuit is open (should use fallback immediately)
   */
  isOpen(): boolean {
    if (this.state === 'OPEN' && this.shouldAttemptReset()) {
      this.transitionTo('HALF_OPEN');
    }
    return this.state === 'OPEN';
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastStateChange: this.lastStateChange,
      totalCalls: this.totalCalls,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }

  /**
   * Manually reset circuit to CLOSED state
   */
  reset(): void {
    this.failureCount = 0;
    this.successCount = 0;
    this.transitionTo('CLOSED');
  }

  /**
   * Get milliseconds until retry is allowed
   */
  getRetryAfterMs(): number {
    if (this.state !== 'OPEN' || !this.lastFailureTime) return 0;
    const elapsed = Date.now() - this.lastFailureTime.getTime();
    return Math.max(0, this.config.timeout - elapsed);
  }

  private onSuccess(): void {
    this.totalSuccesses++;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.failureCount = 0;
        this.successCount = 0;
        this.transitionTo('CLOSED');
        console.log(`Circuit breaker [${this.config.name}] CLOSED after recovery`);
      }
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success in CLOSED state
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.totalFailures++;
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.state === 'HALF_OPEN') {
      // Failed during recovery attempt - go back to OPEN
      this.successCount = 0;
      this.transitionTo('OPEN');
      console.warn(`Circuit breaker [${this.config.name}] OPEN again after failed recovery`);
    } else if (this.state === 'CLOSED' && this.failureCount >= this.config.failureThreshold) {
      this.transitionTo('OPEN');
      console.error(
        `Circuit breaker [${this.config.name}] OPENED after ${this.failureCount} failures`
      );
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false;
    return Date.now() - this.lastFailureTime.getTime() >= this.config.timeout;
  }

  private transitionTo(newState: CircuitState): void {
    this.state = newState;
    this.lastStateChange = new Date();
  }
}

/**
 * Error thrown when circuit is open
 */
export class CircuitOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

/**
 * Pre-configured circuit breakers for each external service
 */
export const qdrantCircuitBreaker = new CircuitBreaker({
  name: 'qdrant',
  failureThreshold: 5,
  timeout: 60000,
});

export const mem0CircuitBreaker = new CircuitBreaker({
  name: 'mem0',
  failureThreshold: 5,
  timeout: 60000,
});

export const redisCircuitBreaker = new CircuitBreaker({
  name: 'redis',
  failureThreshold: 5,
  timeout: 30000,
});

export const llmCircuitBreaker = new CircuitBreaker({
  name: 'llm',
  failureThreshold: 3,
  timeout: 120000,
});
