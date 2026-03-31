/**
 * Tests for SearchCache
 * Requirements: Performance targets
 */

import { SearchCache } from '../../src/memory/SearchCache';

describe('SearchCache', () => {
  let cache: SearchCache<string[]>;

  beforeEach(() => {
    cache = new SearchCache({ ttlMs: 1000, maxEntries: 5 });
  });

  describe('get/set', () => {
    it('returns null for missing key', () => {
      expect(cache.get('missing')).toBeNull();
    });

    it('returns cached value', () => {
      cache.set('key', ['result1', 'result2']);
      expect(cache.get('key')).toEqual(['result1', 'result2']);
    });

    it('returns null for expired entry', async () => {
      const shortCache = new SearchCache({ ttlMs: 50 });
      shortCache.set('key', ['result']);
      await new Promise(r => setTimeout(r, 100));
      expect(shortCache.get('key')).toBeNull();
    });

    it('evicts oldest entry when at capacity', () => {
      for (let i = 0; i < 5; i++) {
        cache.set(`key${i}`, [`result${i}`]);
      }
      expect(cache.size).toBe(5);

      // Adding one more should evict oldest
      cache.set('key5', ['result5']);
      expect(cache.size).toBe(5);
      expect(cache.get('key0')).toBeNull(); // oldest evicted
      expect(cache.get('key5')).toEqual(['result5']); // newest present
    });
  });

  describe('invalidate', () => {
    it('clears all entries', () => {
      cache.set('key1', ['r1']);
      cache.set('key2', ['r2']);
      cache.invalidate();
      expect(cache.size).toBe(0);
      expect(cache.get('key1')).toBeNull();
    });
  });

  describe('invalidatePattern', () => {
    it('removes matching entries', () => {
      cache.set('search:query1', ['r1']);
      cache.set('search:query2', ['r2']);
      cache.set('other:key', ['r3']);

      cache.invalidatePattern(/^search:/);

      expect(cache.get('search:query1')).toBeNull();
      expect(cache.get('search:query2')).toBeNull();
      expect(cache.get('other:key')).toEqual(['r3']);
    });
  });

  describe('getStats', () => {
    it('tracks hits and misses', () => {
      cache.set('key', ['result']);
      cache.get('key');   // hit
      cache.get('key');   // hit
      cache.get('miss');  // miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(2 / 3, 2);
    });

    it('returns 0 hitRate when no requests', () => {
      expect(cache.getStats().hitRate).toBe(0);
    });
  });

  describe('evictExpired', () => {
    it('removes expired entries', async () => {
      const shortCache = new SearchCache({ ttlMs: 50 });
      shortCache.set('key1', ['r1']);
      shortCache.set('key2', ['r2']);

      await new Promise(r => setTimeout(r, 100));

      const evicted = shortCache.evictExpired();
      expect(evicted).toBe(2);
      expect(shortCache.size).toBe(0);
    });

    it('keeps non-expired entries', () => {
      cache.set('key', ['result']);
      const evicted = cache.evictExpired();
      expect(evicted).toBe(0);
      expect(cache.size).toBe(1);
    });
  });

  describe('performance', () => {
    it('get/set operations are fast (<1ms each)', () => {
      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        cache.set(`key${i % 5}`, [`result${i}`]);
        cache.get(`key${i % 5}`);
      }
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100); // 1000 ops in <100ms
    });
  });
});
