/**
 * Property 9: Graceful Degradation Chain
 * Property 17: Error Logging Without Exception Propagation
 *
 * Validates: Requirements 1.4, 4.3, 5.4, 12.1, 12.2, 12.3, 12.4, 1.7, 12.6
 *
 * Tag: feature=memory-system, property=9, property=17
 */

import * as fc from 'fast-check';
import {
  GracefulDegradationHandler,
  createSearchFallbackChain,
  createTruthExtractionFallbackChain,
} from '../../src/resilience/GracefulDegradationHandler';
import { ErrorMonitor } from '../../src/resilience/ErrorMonitor';

fc.configureGlobal({ numRuns: 100 });

describe('Property 9: Graceful Degradation Chain', () => {
  it('search always returns array (never throws) regardless of failures', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          mem0Fails: fc.boolean(),
          qdrantFails: fc.boolean(),
          chronicleFails: fc.boolean(),
        }),
        async (input) => {
          const handler = new GracefulDegradationHandler();

          const chain = createSearchFallbackChain(
            input.mem0Fails
              ? async () => { throw new Error('Mem0 down'); }
              : async () => [{ id: '1', content: 'result', score: 0.9 }],
            input.qdrantFails
              ? async () => { throw new Error('Qdrant down'); }
              : async () => [{ id: '2', content: 'qdrant result', score: 0.8 }],
            input.chronicleFails
              ? async () => { throw new Error('Chronicle down'); }
              : async () => [{ id: '3', content: 'chronicle result', score: 0.5 }],
          );

          const result = await handler.executeWithFallback('search', chain, []);

          // Must always return a result object (never throw)
          expect(result).toBeDefined();
          expect(Array.isArray(result.result)).toBe(true);

          // If all fail, returns empty array
          if (input.mem0Fails && input.qdrantFails && input.chronicleFails) {
            expect(result.result).toHaveLength(0);
            expect(result.success).toBe(false);
          } else {
            expect(result.success).toBe(true);
          }
        }
      )
    );
  });

  it('truth extraction always returns array (never throws) regardless of failures', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          mem0Fails: fc.boolean(),
          llmFails: fc.boolean(),
        }),
        async (input) => {
          const handler = new GracefulDegradationHandler();

          const chain = createTruthExtractionFallbackChain(
            input.mem0Fails
              ? async () => { throw new Error('Mem0 down'); }
              : async () => [{ subject: 'A', predicate: 'is', object: 'B', confidence: 0.9 }],
            input.llmFails
              ? async () => { throw new Error('LLM down'); }
              : async () => [{ subject: 'C', predicate: 'has', object: 'D', confidence: 0.7 }],
          );

          const result = await handler.executeWithFallback('extract_truths', chain, []);

          expect(Array.isArray(result.result)).toBe(true);
          if (input.mem0Fails && input.llmFails) {
            expect(result.result).toHaveLength(0);
            expect(result.success).toBe(false);
          } else {
            expect(result.success).toBe(true);
          }
        }
      )
    );
  });

  it('fallback chain is followed in order (Mem0 → Qdrant → Chronicle → empty)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 3 }), // how many levels fail
        async (failLevels) => {
          const handler = new GracefulDegradationHandler();
          const callOrder: string[] = [];

          const chain = createSearchFallbackChain(
            failLevels >= 1
              ? async () => { callOrder.push('mem0'); throw new Error('fail'); }
              : async () => { callOrder.push('mem0'); return [{ id: '1', content: 'r', score: 0.9 }]; },
            failLevels >= 2
              ? async () => { callOrder.push('qdrant'); throw new Error('fail'); }
              : async () => { callOrder.push('qdrant'); return [{ id: '2', content: 'r', score: 0.8 }]; },
            failLevels >= 3
              ? async () => { callOrder.push('chronicle'); throw new Error('fail'); }
              : async () => { callOrder.push('chronicle'); return [{ id: '3', content: 'r', score: 0.5 }]; },
          );

          const result = await handler.executeWithFallback('search', chain, []);

          expect(Array.isArray(result.result)).toBe(true);

          // Verify fallback order
          if (failLevels === 0) {
            expect(callOrder[0]).toBe('mem0');
            expect(callOrder.length).toBe(1); // stopped at first success
          } else if (failLevels === 1) {
            expect(callOrder).toContain('mem0');
            expect(callOrder).toContain('qdrant');
          } else if (failLevels === 2) {
            expect(callOrder).toContain('mem0');
            expect(callOrder).toContain('qdrant');
            expect(callOrder).toContain('chronicle');
          } else {
            // All failed - empty result
            expect(result.result).toHaveLength(0);
          }
        }
      )
    );
  });

  it('system continues operating after repeated failures', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.boolean(), { minLength: 5, maxLength: 20 }),
        async (failPattern) => {
          const handler = new GracefulDegradationHandler();
          let callCount = 0;

          // Multiple calls - system must never throw
          for (let i = 0; i < 5; i++) {
            const shouldFail = failPattern[callCount % failPattern.length];
            callCount++;

            const chain = createSearchFallbackChain(
              shouldFail
                ? async () => { throw new Error('Intermittent failure'); }
                : async () => [{ id: '1', content: 'result', score: 0.9 }],
              async () => [],
              async () => [],
            );

            const result = await handler.executeWithFallback('search', chain, []);
            expect(Array.isArray(result.result)).toBe(true);
          }
        }
      )
    );
  });

  it('fallback stats track which method succeeded', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(), // mem0 fails
        async (mem0Fails) => {
          const handler = new GracefulDegradationHandler();

          const chain = createSearchFallbackChain(
            mem0Fails
              ? async () => { throw new Error('Mem0 down'); }
              : async () => [{ id: '1', content: 'r', score: 0.9 }],
            async () => [{ id: '2', content: 'r', score: 0.8 }],
            async () => [],
          );

          const result = await handler.executeWithFallback('search', chain, []);

          if (mem0Fails) {
            expect(result.finalMethod).toBe('qdrant');
          } else {
            expect(result.finalMethod).toBe('mem0');
          }

          expect(result.attempts.length).toBeGreaterThan(0);
        }
      )
    );
  });
});

describe('Property 17: Error Logging Without Exception Propagation', () => {
  it('errors are logged but never thrown to caller', () => {
    fc.assert(
      fc.property(
        fc.record({
          errorMessage: fc.string({ minLength: 5, maxLength: 50 })
            .filter(s => s.trim() === s && s.trim().length > 0),
          component: fc.constantFrom('Qdrant', 'Mem0', 'Redis', 'LLM', 'Chronicle'),
          operation: fc.constantFrom('search', 'extract', 'index', 'write', 'read'),
        }),
        (input) => {
          const monitor = new ErrorMonitor({ logToConsole: false });
          let exceptionPropagated = false;

          try {
            monitor.error(input.component, input.operation, input.errorMessage);
            monitor.warn(input.component, input.operation, `Warning: ${input.errorMessage}`);
          } catch {
            exceptionPropagated = true;
          }

          expect(exceptionPropagated).toBe(false);
          expect(monitor.size).toBe(2);

          const entries = monitor.getEntriesByComponent(input.component);
          expect(entries.some(e => e.error === input.errorMessage)).toBe(true);
        }
      )
    );
  });

  it('high error rates trigger alerts without throwing', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        (errorCount) => {
          const monitor = new ErrorMonitor({ alertThreshold: 5, logToConsole: false });
          let exceptionPropagated = false;

          try {
            for (let i = 0; i < errorCount; i++) {
              monitor.error('test', 'op', `error ${i}`);
            }
          } catch {
            exceptionPropagated = true;
          }

          expect(exceptionPropagated).toBe(false);
          expect(monitor.size).toBe(errorCount);

          if (errorCount > 5) {
            expect(monitor.isAlertThresholdExceeded()).toBe(true);
          }
        }
      )
    );
  });

  it('GracefulDegradationHandler logs errors without propagating them', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.boolean(), { minLength: 3, maxLength: 3 }),
        async (failures) => {
          const handler = new GracefulDegradationHandler();

          const chain = createSearchFallbackChain(
            failures[0] ? async () => { throw new Error('Mem0 error'); } : async () => [],
            failures[1] ? async () => { throw new Error('Qdrant error'); } : async () => [],
            failures[2] ? async () => { throw new Error('Chronicle error'); } : async () => [],
          );

          // Must never throw regardless of failures
          const result = await handler.executeWithFallback('search', chain, []);
          expect(Array.isArray(result.result)).toBe(true);
        }
      )
    );
  });

  it('error monitor stats are accurate after many errors', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            component: fc.constantFrom('Qdrant', 'Mem0', 'Redis'),
            level: fc.constantFrom('ERROR' as const, 'WARN' as const),
          }),
          { minLength: 1, maxLength: 50 }
        ),
        (entries) => {
          const monitor = new ErrorMonitor({ logToConsole: false });

          for (const entry of entries) {
            if (entry.level === 'ERROR') {
              monitor.error(entry.component, 'op', 'test error');
            } else {
              monitor.warn(entry.component, 'op', 'test warning');
            }
          }

          expect(monitor.size).toBe(entries.length);

          const stats = monitor.getStats();
          const totalFromStats = stats.reduce((sum, s) => sum + s.count, 0);
          expect(totalFromStats).toBe(entries.length);
        }
      )
    );
  });
});
