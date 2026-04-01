/**
 * Router Tests
 * Unit tests + Property-based tests (Properties 4, 5, 6, 8, 11)
 * Feature: anots-gateway
 */

import * as fc from 'fast-check';
import { Router } from '../../src/gateway/Router';
import { ModelSelector } from '../../src/gateway/ModelSelector';
import {
  ClassificationResult,
  QuotaStatus,
  ProviderHealth,
  TaskType,
  EntropyLevel,
} from '../../src/gateway/types';

fc.configureGlobal({ numRuns: 100 });

const modelSelector = new ModelSelector({
  opus: 'glm-5.1',
  sonnet: 'glm-4.7',
  haiku: 'glm-4.5-air',
});
const router = new Router(modelSelector, 'qwen3.5:latest');

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const arbitraryTaskType = (): fc.Arbitrary<TaskType> =>
  fc.constantFrom(
    'philosophical-dialogue', 'code-generation', 'mcp-orchestration',
    'truth-extraction', 'chronicle-writing', 'research-synthesis', 'testing-validation'
  );

const arbitraryEntropy = (): fc.Arbitrary<EntropyLevel> =>
  fc.constantFrom('high' as const, 'low' as const);

const arbitraryClassification = (): fc.Arbitrary<ClassificationResult> =>
  fc.record({
    taskType: arbitraryTaskType(),
    entropy: arbitraryEntropy(),
    confidence: fc.constantFrom('hint' as const, 'keyword' as const, 'default' as const),
  });

const arbitraryQuotaStatus = (exhausted?: boolean): fc.Arbitrary<QuotaStatus> =>
  fc.record({
    consumed: fc.integer({ min: 0, max: 1_000_000 }),
    limit: fc.integer({ min: 1, max: 1_000_000 }),
    exhausted: exhausted !== undefined ? fc.constant(exhausted) : fc.boolean(),
    resetAt: fc.date(),
  });

const arbitraryProviderHealth = (status?: 'healthy' | 'degraded' | 'down'): fc.Arbitrary<ProviderHealth> =>
  fc.record({
    provider: fc.constantFrom('cloud' as const, 'local' as const),
    latencyP50: fc.integer({ min: 0, max: 5000 }),
    latencyP95: fc.integer({ min: 0, max: 15000 }),
    latencyP99: fc.integer({ min: 0, max: 20000 }),
    errorRate: fc.float({ min: 0, max: 1 }),
    status: status !== undefined
      ? fc.constant(status)
      : fc.constantFrom('healthy' as const, 'degraded' as const, 'down' as const),
    lastChecked: fc.date(),
  });

// ─── Helpers ──────────────────────────────────────────────────────────────────

const healthyCloud = (): ProviderHealth => ({
  provider: 'cloud', latencyP50: 100, latencyP95: 300, latencyP99: 500,
  errorRate: 0.01, status: 'healthy', lastChecked: new Date(),
});

const healthyCloudAlt = (): ProviderHealth => ({
  provider: 'cloud-alt', latencyP50: 120, latencyP95: 350, latencyP99: 550,
  errorRate: 0.01, status: 'healthy', lastChecked: new Date(),
});

const healthyLocal = (): ProviderHealth => ({
  provider: 'local', latencyP50: 50, latencyP95: 150, latencyP99: 300,
  errorRate: 0.01, status: 'healthy', lastChecked: new Date(),
});

const degradedCloud = (): ProviderHealth => ({ ...healthyCloud(), status: 'degraded' });
const downCloud = (): ProviderHealth => ({ ...healthyCloud(), status: 'down' });
const degradedCloudAlt = (): ProviderHealth => ({ ...healthyCloudAlt(), status: 'degraded' });
const degradedLocal = (): ProviderHealth => ({ ...healthyLocal(), status: 'degraded' });

const activeQuota = (): QuotaStatus => ({
  consumed: 100, limit: 1_000_000, exhausted: false, resetAt: new Date(),
});

const exhaustedQuota = (): QuotaStatus => ({
  consumed: 1_000_000, limit: 1_000_000, exhausted: true, resetAt: new Date(),
});

// ─── Property 4: Routing Determinism ─────────────────────────────────────────

describe('Property 4: Routing Determinism', () => {
  it('same inputs produce same selectedProvider, model, fallbackChain', () => {
    fc.assert(
      fc.property(
        arbitraryClassification(),
        arbitraryQuotaStatus(),
        arbitraryProviderHealth(),
        arbitraryProviderHealth(),
        arbitraryProviderHealth(),
        (classification, quota, cloudHealth, cloudAltHealth, localHealth) => {
          const r1 = router.decide(classification, quota, cloudHealth, cloudAltHealth, localHealth);
          const r2 = router.decide(classification, quota, cloudHealth, cloudAltHealth, localHealth);
          expect(r1.selectedProvider).toBe(r2.selectedProvider);
          expect(r1.model).toBe(r2.model);
          expect(r1.fallbackChain).toEqual(r2.fallbackChain);
        }
      )
    );
  });
});

// ─── Property 5: High-Entropy Cloud Routing ───────────────────────────────────

describe('Property 5: High-Entropy Cloud Routing', () => {
  it('entropy=high + cloud healthy + quota not exhausted → cloud', () => {
    fc.assert(
      fc.property(
        arbitraryClassification(),
        (classification) => {
          const highEntropy = { ...classification, entropy: 'high' as const };
          const result = router.decide(highEntropy, activeQuota(), healthyCloud(), healthyCloudAlt(), healthyLocal());
          expect(result.selectedProvider).toBe('cloud');
          expect(result.model).toBe('glm-5.1'); // Opus-tier for high-entropy
        }
      )
    );
  });
});

// ─── Property 6: Low-Entropy Local Routing ────────────────────────────────────

describe('Property 6: Low-Entropy Local Routing', () => {
  it('entropy=low + local healthy + cloud down → local', () => {
    fc.assert(
      fc.property(
        arbitraryClassification(),
        (classification) => {
          const lowEntropy = { ...classification, entropy: 'low' as const };
          // With cloud down and cloud-alt down, should route to local
          const result = router.decide(lowEntropy, activeQuota(), downCloud(), degradedCloudAlt(), healthyLocal());
          expect(result.selectedProvider).toBe('local');
          expect(result.model).toBe('qwen3.5:latest');
        }
      )
    );
  });
});

// ─── Property 8: Quota Exhaustion Overrides Routing ──────────────────────────

describe('Property 8: Quota Exhaustion Overrides Routing', () => {
  it('quota exhausted → routes to cloud-alt or local', () => {
    fc.assert(
      fc.property(
        arbitraryClassification(),
        (classification) => {
          const result = router.decide(classification, exhaustedQuota(), healthyCloud(), healthyCloudAlt(), healthyLocal());
          // With quota exhausted, should prefer cloud-alt or local (not cloud)
          expect(['cloud-alt', 'local']).toContain(result.selectedProvider);
        }
      )
    );
  });
});

// ─── Property 11: Degraded Provider Excluded ─────────────────────────────────

describe('Property 11: Degraded Provider Excluded from Routing', () => {
  it('degraded cloud → never selected as primary', () => {
    fc.assert(
      fc.property(
        arbitraryClassification(),
        (classification) => {
          const highEntropy = { ...classification, entropy: 'high' as const };
          const result = router.decide(highEntropy, activeQuota(), degradedCloud(), healthyCloudAlt(), healthyLocal());
          expect(result.selectedProvider).not.toBe('cloud');
        }
      )
    );
  });

  it('down cloud → never selected as primary', () => {
    fc.assert(
      fc.property(
        arbitraryClassification(),
        (classification) => {
          const highEntropy = { ...classification, entropy: 'high' as const };
          const result = router.decide(highEntropy, activeQuota(), downCloud(), healthyCloudAlt(), healthyLocal());
          expect(result.selectedProvider).not.toBe('cloud');
        }
      )
    );
  });
});

// ─── Unit Tests: Edge Cases ───────────────────────────────────────────────────

describe('Router edge cases', () => {
  it('cloud degraded + high-entropy → falls back to cloud-alt', () => {
    const result = router.decide(
      { taskType: 'philosophical-dialogue', entropy: 'high', confidence: 'keyword' },
      activeQuota(), degradedCloud(), healthyCloudAlt(), healthyLocal()
    );
    expect(result.selectedProvider).toBe('cloud-alt');
  });

  it('all cloud providers degraded → selects local', () => {
    const result = router.decide(
      { taskType: 'philosophical-dialogue', entropy: 'high', confidence: 'keyword' },
      activeQuota(), degradedCloud(), degradedCloudAlt(), healthyLocal()
    );
    expect(result.selectedProvider).toBe('local');
  });

  it('high-entropy + healthy cloud + healthy cloud-alt + healthy local → cloud with fallbacks', () => {
    const result = router.decide(
      { taskType: 'research-synthesis', entropy: 'high', confidence: 'keyword' },
      activeQuota(), healthyCloud(), healthyCloudAlt(), healthyLocal()
    );
    expect(result.selectedProvider).toBe('cloud');
    expect(result.fallbackChain.length).toBeGreaterThan(0);
  });

  it('low-entropy + healthy local + healthy cloud-alt → cloud-alt', () => {
    const result = router.decide(
      { taskType: 'code-generation', entropy: 'low', confidence: 'keyword' },
      activeQuota(), degradedCloud(), healthyCloudAlt(), healthyLocal()
    );
    expect(result.selectedProvider).toBe('cloud-alt');
  });

  it('low-entropy + local down + cloud-alt healthy → cloud-alt', () => {
    const result = router.decide(
      { taskType: 'code-generation', entropy: 'low', confidence: 'keyword' },
      activeQuota(), degradedCloud(), healthyCloudAlt(), degradedLocal()
    );
    expect(result.selectedProvider).toBe('cloud-alt');
  });

  it('routing decision includes requestId (UUID format)', () => {
    const result = router.decide(
      { taskType: 'code-generation', entropy: 'low', confidence: 'keyword' },
      activeQuota(), healthyCloud(), healthyCloudAlt(), healthyLocal()
    );
    expect(result.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('routing decision includes timestamp', () => {
    const before = new Date();
    const result = router.decide(
      { taskType: 'code-generation', entropy: 'low', confidence: 'keyword' },
      activeQuota(), healthyCloud(), healthyCloudAlt(), healthyLocal()
    );
    expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });
});
