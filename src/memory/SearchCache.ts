/**
 * Search Cache
 *
 * Caches search results for 5 minutes to reduce latency.
 * Invalidated when new truths are indexed.
 *
 * Requirements: Performance targets
 */

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  hits: number;
}

export interface SearchCacheConfig {
  ttlMs: number;        // time-to-live (default: 5 minutes)
  maxEntries: number;   // max cache size (default: 100)
}

const DEFAULT_CONFIG: SearchCacheConfig = {
  ttlMs: 5 * 60 * 1000, // 5 minutes
  maxEntries: 100,
};

export class SearchCache<T = unknown> {
  private cache = new Map<string, CacheEntry<T>>();
  private config: SearchCacheConfig;
  private hits = 0;
  private misses = 0;

  constructor(config: Partial<SearchCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get cached value, returns null if not found or expired
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    entry.hits++;
    this.hits++;
    return entry.value;
  }

  /**
   * Set a cached value
   */
  set(key: string, value: T): void {
    // Evict oldest entry if at capacity
    if (this.cache.size >= this.config.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.config.ttlMs,
      hits: 0,
    });
  }

  /**
   * Invalidate all cache entries (call when new truths are indexed)
   */
  invalidate(): void {
    this.cache.clear();
  }

  /**
   * Invalidate entries matching a pattern
   */
  invalidatePattern(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; hits: number; misses: number; hitRate: number } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /**
   * Remove expired entries
   */
  evictExpired(): number {
    const now = Date.now();
    let evicted = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        evicted++;
      }
    }
    return evicted;
  }

  get size(): number {
    return this.cache.size;
  }
}

/**
 * Global search cache singleton
 */
export const globalSearchCache = new SearchCache();
