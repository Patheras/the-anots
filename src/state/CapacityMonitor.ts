/**
 * Capacity Monitor
 * 
 * Monitors Active Stream capacity and triggers sleeping cycle when needed.
 * 
 * Requirements: 7.1, 7.4, 4.4
 * Whitepaper: Section 7.3 (Optimized Sleeping Cycle)
 */

import {
  ActiveStreamState,
  CapacityThresholds,
  DEFAULT_CAPACITY_THRESHOLDS,
  estimateTokenCount,
  calculateCapacity,
} from './types';

/**
 * Capacity status
 */
export interface CapacityStatus {
  estimatedTokens: number;
  capacityPercentage: number;
  shouldWarn: boolean; // 70-80% range
  shouldSleep: boolean; // 80%+ range
  phase: 'awakening' | 'active' | 'pre_sleep' | 'sleeping' | 'reawakening';
}

/**
 * Capacity Monitor
 * 
 * Tracks Active Stream capacity and determines when to trigger sleeping cycle.
 * 
 * Requirements: 7.1, 7.4
 */
export class CapacityMonitor {
  private thresholds: CapacityThresholds;
  private maxTokens: number;

  constructor(
    thresholds: CapacityThresholds = DEFAULT_CAPACITY_THRESHOLDS,
    maxTokens: number = 128000 // Qwen 3.5 9B context window
  ) {
    this.thresholds = thresholds;
    this.maxTokens = maxTokens;
  }

  /**
   * Check capacity status
   * 
   * Requirements: 7.1, 7.4
   */
  checkCapacity(state: ActiveStreamState): CapacityStatus {
    const estimatedTokens = estimateTokenCount(state.messages);
    const capacityPercentage = calculateCapacity(estimatedTokens, this.maxTokens);

    // Determine phase based on capacity
    let phase: CapacityStatus['phase'];
    if (capacityPercentage < 20) {
      phase = 'awakening';
    } else if (capacityPercentage < this.thresholds.preSleep) {
      phase = 'active';
    } else if (capacityPercentage < this.thresholds.sleep) {
      phase = 'pre_sleep';
    } else {
      phase = 'sleeping';
    }

    return {
      estimatedTokens,
      capacityPercentage,
      shouldWarn: capacityPercentage >= this.thresholds.preSleep && capacityPercentage < this.thresholds.sleep,
      shouldSleep: capacityPercentage >= this.thresholds.sleep,
      phase,
    };
  }

  /**
   * Update state with capacity info
   * 
   * Requirements: 7.1
   */
  updateStateCapacity(state: ActiveStreamState): ActiveStreamState {
    const status = this.checkCapacity(state);
    
    return {
      ...state,
      estimatedTokens: status.estimatedTokens,
      capacityPercentage: status.capacityPercentage,
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get capacity thresholds
   */
  getThresholds(): CapacityThresholds {
    return { ...this.thresholds };
  }

  /**
   * Get max tokens
   */
  getMaxTokens(): number {
    return this.maxTokens;
  }

  /**
   * Check if should warn user
   * 
   * Requirements: 7.4, 16.3
   */
  shouldWarn(state: ActiveStreamState): boolean {
    const status = this.checkCapacity(state);
    return status.shouldWarn;
  }

  /**
   * Check if should trigger sleeping cycle
   * 
   * Requirements: 7.4, 16.4
   */
  shouldSleep(state: ActiveStreamState): boolean {
    const status = this.checkCapacity(state);
    return status.shouldSleep;
  }

  /**
   * Get current phase
   * 
   * Requirements: 16.1
   */
  getCurrentPhase(state: ActiveStreamState): CapacityStatus['phase'] {
    const status = this.checkCapacity(state);
    return status.phase;
  }

  /**
   * Get warning message for user
   * 
   * Requirements: 16.3
   */
  getWarningMessage(state: ActiveStreamState): string | null {
    const status = this.checkCapacity(state);
    
    if (status.shouldSleep) {
      return `⚠️ Memory capacity at ${status.capacityPercentage}%. Consolidation required.`;
    }
    
    if (status.shouldWarn) {
      return `💭 Approaching memory consolidation (${status.capacityPercentage}%). You can continue, but consolidation will happen soon.`;
    }
    
    return null;
  }

  /**
   * Calculate remaining capacity
   */
  getRemainingCapacity(state: ActiveStreamState): number {
    const status = this.checkCapacity(state);
    return this.maxTokens - status.estimatedTokens;
  }

  /**
   * Estimate messages until sleep
   */
  estimateMessagesUntilSleep(state: ActiveStreamState, avgMessageLength: number = 200): number {
    const remaining = this.getRemainingCapacity(state);
    const tokensUntilSleep = (this.maxTokens * this.thresholds.sleep / 100) - estimateTokenCount(state.messages);
    
    if (tokensUntilSleep <= 0) {
      return 0;
    }
    
    const avgTokensPerMessage = Math.ceil(avgMessageLength / 4);
    return Math.floor(tokensUntilSleep / avgTokensPerMessage);
  }
}

/**
 * Create default capacity monitor
 */
export function createCapacityMonitor(
  thresholds?: Partial<CapacityThresholds>,
  maxTokens?: number
): CapacityMonitor {
  const finalThresholds = {
    ...DEFAULT_CAPACITY_THRESHOLDS,
    ...thresholds,
  };
  
  return new CapacityMonitor(finalThresholds, maxTokens);
}
