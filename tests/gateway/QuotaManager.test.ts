/**
 * QuotaManager Tests
 * Unit tests + Property-based tests (Properties 7, 9)
 * Feature: anots-gateway
 */

import * as fc from 'fast-check';
import { QuotaManager } from '../../src/gateway/QuotaManager';
import { TokenUsage } from '../../src/gateway/types';

fc.configureGlobal({ numRuns: 100 });

describe('QuotaManager', () => {
  let manager: QuotaManager;

  beforeEach(() => {
    manager = new QuotaManager(1000, 24);
  });

  afterEach(() => {
    manager.stop();
  });

  // ─── Property 7: Quota Accumulation and Exhaustion ─────────────────────────

  describe('Property 7: Quota Accumulation and Exhaustion', () => {
    it('sum of consumeTokens >= limit → exhausted=true, consumed=sum', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 1, max: 500 }), { minLength: 1, maxLength: 10 }),
          (tokenCounts) => {
            const m = new QuotaManager(1000, 24);
            let total = 0;
            for (const count of tokenCounts) {
              m.consumeTokens({ prompt_tokens: 0, completion_tokens: 0, total_tokens: count });
              total += count;
            }
            const status = m.getQuotaStatus();
            expect(status.consumed).toBe(total);
            if (total >= 1000) {
              expect(status.exhausted).toBe(true);
            }
            m.stop();
          }
        )
      );
    });
  });

  // ─── Property 9: Quota Reset Round-Trip ────────────────────────────────────

  describe('Property 9: Quota Reset Round-Trip', () => {
    it('after reset(), exhausted=false and consumed=0', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 10000 }), // always exhausted
          (tokens) => {
            const m = new QuotaManager(500, 24);
            m.consumeTokens({ prompt_tokens: 0, completion_tokens: 0, total_tokens: tokens });
            expect(m.getQuotaStatus().exhausted).toBe(true);
            m.reset();
            const status = m.getQuotaStatus();
            expect(status.exhausted).toBe(false);
            expect(status.consumed).toBe(0);
            m.stop();
          }
        )
      );
    });
  });

  // ─── Unit Tests ────────────────────────────────────────────────────────────

  describe('consumeTokens', () => {
    it('accumulates token counts', () => {
      manager.consumeTokens({ prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 });
      manager.consumeTokens({ prompt_tokens: 5, completion_tokens: 15, total_tokens: 20 });
      expect(manager.getQuotaStatus().consumed).toBe(50);
    });

    it('partial consumption does not exhaust quota', () => {
      manager.consumeTokens({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 500 });
      expect(manager.getQuotaStatus().exhausted).toBe(false);
    });

    it('exact limit consumption exhausts quota', () => {
      manager.consumeTokens({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 1000 });
      expect(manager.getQuotaStatus().exhausted).toBe(true);
    });
  });

  describe('getQuotaStatus', () => {
    it('returns correct limit from config', () => {
      expect(manager.getQuotaStatus().limit).toBe(1000);
    });

    it('starts with consumed=0 and exhausted=false', () => {
      const status = manager.getQuotaStatus();
      expect(status.consumed).toBe(0);
      expect(status.exhausted).toBe(false);
    });

    it('includes resetAt date in the future', () => {
      const status = manager.getQuotaStatus();
      expect(status.resetAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('reset', () => {
    it('clears consumed tokens', () => {
      manager.consumeTokens({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 500 });
      manager.reset();
      expect(manager.getQuotaStatus().consumed).toBe(0);
    });

    it('updates resetAt to future', () => {
      const before = manager.getQuotaStatus().resetAt;
      manager.reset();
      const after = manager.getQuotaStatus().resetAt;
      expect(after.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });
});
