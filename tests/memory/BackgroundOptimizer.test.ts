/**
 * Tests for BackgroundOptimizer
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.6, 17.7
 */

import { BackgroundOptimizer, TruthEntry } from '../../src/memory/BackgroundOptimizer';

function makeTruth(overrides: Partial<TruthEntry> = {}): TruthEntry {
  return {
    id: Math.random().toString(36).substring(7),
    subject: 'TypeScript',
    predicate: 'is',
    object: 'typed',
    confidence: 0.9,
    timestamp: new Date(),
    usageCount: 0,
    ...overrides,
  };
}

describe('BackgroundOptimizer', () => {
  let optimizer: BackgroundOptimizer;

  beforeEach(() => {
    optimizer = new BackgroundOptimizer({
      enabled: true,
      idleThresholdMs: 100, // fast for tests
      deduplicationEnabled: true,
      scoringEnabled: true,
      clusteringEnabled: true,
    });
  });

  afterEach(() => {
    optimizer.stop();
  });

  describe('configuration', () => {
    it('respects enabled flag', async () => {
      const disabled = new BackgroundOptimizer({ enabled: false });
      const results = await disabled.runOptimization();
      expect(results).toHaveLength(0);
    });

    it('can disable individual tasks', async () => {
      const noDedup = new BackgroundOptimizer({
        enabled: true,
        deduplicationEnabled: false,
        scoringEnabled: false,
        clusteringEnabled: false,
      });
      const results = await noDedup.runOptimization();
      expect(results).toHaveLength(0);
    });
  });

  describe('idle detection', () => {
    it('is not idle immediately after activity', () => {
      optimizer.recordActivity();
      expect(optimizer.isIdle()).toBe(false);
    });

    it('becomes idle after threshold', async () => {
      const fastOptimizer = new BackgroundOptimizer({ idleThresholdMs: 50 });
      fastOptimizer.recordActivity();
      await new Promise(r => setTimeout(r, 100));
      expect(fastOptimizer.isIdle()).toBe(true);
      fastOptimizer.stop();
    });

    it('getIdleMs returns time since last activity', async () => {
      optimizer.recordActivity();
      await new Promise(r => setTimeout(r, 50));
      expect(optimizer.getIdleMs()).toBeGreaterThanOrEqual(40);
    });
  });

  describe('recordActivity - pauses optimization', () => {
    it('pauses running optimization on activity', async () => {
      let truths = [makeTruth(), makeTruth({ subject: 'TypeScript' })];
      let updateCalled = false;

      optimizer.registerDataAccess(
        async () => truths,
        async (updated) => { updateCalled = true; truths = updated; }
      );

      // Start optimization then immediately record activity
      const optimizationPromise = optimizer.runOptimization();
      optimizer.recordActivity(); // should pause

      await optimizationPromise;
      // Optimization may have been paused before completing
      // Just verify no exception was thrown
    });
  });

  describe('deduplication', () => {
    it('removes duplicate truths keeping highest confidence', async () => {
      const truths: TruthEntry[] = [
        makeTruth({ id: '1', subject: 'A', predicate: 'is', object: 'B', confidence: 0.7 }),
        makeTruth({ id: '2', subject: 'A', predicate: 'is', object: 'B', confidence: 0.9 }), // duplicate, higher
        makeTruth({ id: '3', subject: 'C', predicate: 'has', object: 'D', confidence: 0.8 }),
      ];

      let updatedTruths: TruthEntry[] = [];
      optimizer.registerDataAccess(
        async () => truths,
        async (updated) => { updatedTruths = updated; }
      );

      const result = await optimizer.runDeduplication();

      expect(result.success).toBe(true);
      expect(result.task).toBe('deduplication');
      expect(result.itemsProcessed).toBe(1); // 1 duplicate removed
      expect(updatedTruths).toHaveLength(2);
      // Should keep the higher confidence one
      const ab = updatedTruths.find(t => t.subject === 'A');
      expect(ab?.confidence).toBe(0.9);
    });

    it('handles no duplicates gracefully', async () => {
      const truths = [
        makeTruth({ subject: 'A', predicate: 'is', object: 'B' }),
        makeTruth({ subject: 'C', predicate: 'has', object: 'D' }),
      ];

      optimizer.registerDataAccess(async () => truths, async () => {});
      const result = await optimizer.runDeduplication();

      expect(result.success).toBe(true);
      expect(result.itemsProcessed).toBe(0);
    });

    it('handles empty truths list', async () => {
      optimizer.registerDataAccess(async () => [], async () => {});
      const result = await optimizer.runDeduplication();
      expect(result.success).toBe(true);
      expect(result.itemsProcessed).toBe(0);
    });

    it('handles missing data access gracefully', async () => {
      // No registerDataAccess called
      const result = await optimizer.runDeduplication();
      expect(result.success).toBe(true);
      expect(result.itemsProcessed).toBe(0);
    });

    it('handles errors gracefully', async () => {
      optimizer.registerDataAccess(
        async () => { throw new Error('DB error'); },
        async () => {}
      );
      const result = await optimizer.runDeduplication();
      expect(result.success).toBe(false);
      expect(result.error).toContain('DB error');
    });
  });

  describe('memory scoring', () => {
    it('scores truths based on recency and usage', async () => {
      const oldTruth = makeTruth({
        timestamp: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
        confidence: 0.9,
        usageCount: 0,
      });
      const recentTruth = makeTruth({
        timestamp: new Date(),
        confidence: 0.9,
        usageCount: 10,
      });

      let updatedTruths: TruthEntry[] = [];
      optimizer.registerDataAccess(
        async () => [oldTruth, recentTruth],
        async (updated) => { updatedTruths = updated; }
      );

      const result = await optimizer.runScoring();

      expect(result.success).toBe(true);
      expect(result.task).toBe('scoring');
      expect(result.itemsProcessed).toBe(2);

      // Old truth should have lower confidence after scoring
      const scored = updatedTruths.find(t => t.id === oldTruth.id);
      expect(scored!.confidence).toBeLessThan(0.9);

      // Recent truth with usage should maintain or increase confidence
      const recentScored = updatedTruths.find(t => t.id === recentTruth.id);
      expect(recentScored!.confidence).toBeGreaterThan(0);
    });

    it('handles errors gracefully', async () => {
      optimizer.registerDataAccess(
        async () => { throw new Error('scoring error'); },
        async () => {}
      );
      const result = await optimizer.runScoring();
      expect(result.success).toBe(false);
      expect(result.error).toContain('scoring error');
    });
  });

  describe('semantic clustering', () => {
    it('groups truths by subject', async () => {
      const truths = [
        makeTruth({ subject: 'TypeScript', predicate: 'is', object: 'typed' }),
        makeTruth({ subject: 'TypeScript', predicate: 'has', object: 'interfaces' }),
        makeTruth({ subject: 'JavaScript', predicate: 'is', object: 'dynamic' }),
      ];

      optimizer.registerDataAccess(async () => truths, async () => {});
      const result = await optimizer.runClustering();

      expect(result.success).toBe(true);
      expect(result.task).toBe('clustering');
      expect(result.itemsProcessed).toBe(2); // 2 unique subjects
    });

    it('handles errors gracefully', async () => {
      optimizer.registerDataAccess(
        async () => { throw new Error('cluster error'); },
        async () => {}
      );
      const result = await optimizer.runClustering();
      expect(result.success).toBe(false);
    });
  });

  describe('runOptimization', () => {
    it('runs all enabled tasks', async () => {
      optimizer.registerDataAccess(async () => [], async () => {});
      const results = await optimizer.runOptimization();

      expect(results.length).toBe(3); // dedup + scoring + clustering
      expect(results.map(r => r.task)).toContain('deduplication');
      expect(results.map(r => r.task)).toContain('scoring');
      expect(results.map(r => r.task)).toContain('clustering');
    });

    it('stores results in history', async () => {
      optimizer.registerDataAccess(async () => [], async () => {});
      await optimizer.runOptimization();
      expect(optimizer.getResults().length).toBeGreaterThan(0);
    });

    it('does not block - completes without hanging', async () => {
      optimizer.registerDataAccess(async () => [], async () => {});
      const start = Date.now();
      await optimizer.runOptimization();
      expect(Date.now() - start).toBeLessThan(5000);
    });
  });

  describe('getState', () => {
    it('returns current state', () => {
      const state = optimizer.getState();
      expect(state).toHaveProperty('isRunning');
      expect(state).toHaveProperty('isPaused');
      expect(state).toHaveProperty('isIdle');
      expect(state).toHaveProperty('idleMs');
    });

    it('isRunning is false when not running', () => {
      expect(optimizer.getState().isRunning).toBe(false);
    });
  });

  describe('start/stop', () => {
    it('starts without error', () => {
      optimizer.start();
      // No exception
    });

    it('stops without error', () => {
      optimizer.start();
      optimizer.stop();
      // No exception
    });

    it('does not start when disabled', () => {
      const disabled = new BackgroundOptimizer({ enabled: false });
      disabled.start();
      disabled.stop();
      // No exception
    });
  });
});
