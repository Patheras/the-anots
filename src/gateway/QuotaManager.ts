/**
 * Quota Manager
 *
 * Tracks Z.ai API token consumption and signals when quota is exhausted.
 * In-memory only — resets on process restart (acceptable for TCAM use case).
 *
 * Requirements: 4.1–4.6
 */

import { QuotaStatus, TokenUsage } from './types';

export class QuotaManager {
  private consumed = 0;
  private readonly limit: number;
  private readonly resetIntervalHours: number;
  private resetAt: Date;
  private resetTimer: NodeJS.Timeout | null = null;

  constructor(limit = 1_000_000, resetIntervalHours = 24) {
    this.limit = limit;
    this.resetIntervalHours = resetIntervalHours;
    this.resetAt = this.nextResetTime();
    this.scheduleReset();
  }

  /** Record token usage from a completed cloud request */
  consumeTokens(usage: TokenUsage): void {
    this.consumed += usage.total_tokens;
  }

  /** Current quota state */
  getQuotaStatus(): QuotaStatus {
    return {
      consumed: this.consumed,
      limit: this.limit,
      exhausted: this.consumed >= this.limit,
      resetAt: this.resetAt,
    };
  }

  /** Manually reset quota (also called by the periodic timer) */
  reset(): void {
    this.consumed = 0;
    this.resetAt = this.nextResetTime();
  }

  /** Stop the reset timer (call on shutdown) */
  stop(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }

  private nextResetTime(): Date {
    return new Date(Date.now() + this.resetIntervalHours * 60 * 60 * 1000);
  }

  private scheduleReset(): void {
    const ms = this.resetIntervalHours * 60 * 60 * 1000;
    this.resetTimer = setTimeout(() => {
      this.reset();
      this.scheduleReset(); // reschedule
    }, ms);
    // Allow process to exit even if timer is running
    if (this.resetTimer.unref) this.resetTimer.unref();
  }
}
