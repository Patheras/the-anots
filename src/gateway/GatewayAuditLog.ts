/**
 * Gateway Audit Log
 *
 * Circular buffer of the last 1,000 RoutingDecision entries.
 * Provides structured audit trail for every routing decision.
 *
 * Requirements: 11.1, 11.4
 */

import { RoutingDecision } from './types';

const MAX_ENTRIES = 1_000;

export class GatewayAuditLog {
  private entries: RoutingDecision[] = [];

  /** Append a routing decision to the log */
  append(decision: RoutingDecision): void {
    this.entries.push(decision);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(-MAX_ENTRIES);
    }
  }

  /** Get the most recent N decisions (at most `limit`) */
  getRecent(limit: number): RoutingDecision[] {
    const safeLimit = Math.max(0, Math.floor(limit));
    if (safeLimit === 0) return [];
    return this.entries.slice(-safeLimit);
  }

  clear(): void {
    this.entries = [];
  }

  get size(): number {
    return this.entries.length;
  }
}
