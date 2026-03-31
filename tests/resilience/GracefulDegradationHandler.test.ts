/**
 * Tests for Graceful Degradation Handler
 * 
 * Requirements: 1.4, 4.3, 5.4, 8.4, 8.5, 11.4, 11.5, 11.7, 12.1-12.4
 */

import {
  GracefulDegradationHandler,
  createGracefulDegradationHandler,
  createSearchFallbackChain,
  createTruthExtractionFallbackChain,
  createLLMFallbackChain,
  createStorageFallbackChain,
} from '../../src/resilience/GracefulDegradationHandler';

describe('GracefulDegradationHandler', () => {
  let handler: GracefulDegradationHandler;

  beforeEach(() => {
    handler = createGracefulDegradationHandler();
  });

  describe('Initialization', () => {
    it('should create handler', () => {
      expect(handler).toBeDefined();
    });

    it('should start with no statistics', () => {
      const stats = handler.getStats();
      expect(stats).toEqual({});
    });
  });

  describe('Basic Fallback Execution', () => {
    it('should execute first fallback successfully', async () => {
      const fallbacks = [
        { method: 'primary', fn: async () => 'success' },
        { method: 'secondary', fn: async () => 'fallback' },
      ];

      const result = await handler.executeWithFallback('search', fallbacks, 'default');

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.finalMethod).toBe('primary');
      expect(result.attempts.length).toBe(1);
    });

    it('should fallback to second method when first fails', async () => {
      const fallbacks = [
        { method: 'primary', fn: async () => { throw new Error('Primary failed'); } },
        { method: 'secondary', fn: async () => 'fallback_success' },
      ];

      const result = await handler.executeWithFallback('search', fallbacks, 'default');

      expect(result.success).toBe(true);
      expect(result.result).toBe('fallback_success');
      expect(result.finalMethod).toBe('secondary');
      expect(result.attempts.length).toBe(2);
      expect(result.attempts[0].success).toBe(false);
      expect(result.attempts[1].success).toBe(true);
    });

    it('should return default value when all fallbacks fail', async () => {
      const fallbacks = [
        { method: 'primary', fn: async () => { throw new Error('Failed'); } },
        { method: 'secondary', fn: async () => { throw new Error('Failed'); } },
        { method: 'tertiary', fn: async () => { throw new Error('Failed'); } },
      ];

      const result = await handler.executeWithFallback('search', fallbacks, 'default_value');

      expect(result.success).toBe(false);
      expect(result.result).toBe('default_value');
      expect(result.finalMethod).toBe('default');
      expect(result.attempts.length).toBe(3);
      expect(result.attempts.every((a) => !a.success)).toBe(true);
    });
  });

  describe('Search Fallback Chain', () => {
    it('should try Mem0 first', async () => {
      const mem0Results = [{ id: '1', content: 'result' }];
      
      const fallbacks = createSearchFallbackChain(
        async () => mem0Results,
        async () => { throw new Error('Should not be called'); },
        async () => { throw new Error('Should not be called'); }
      );

      const result = await handler.executeWithFallback('search', fallbacks, []);

      expect(result.success).toBe(true);
      expect(result.result).toEqual(mem0Results);
      expect(result.finalMethod).toBe('mem0');
    });

    it('should fallback to Qdrant when Mem0 fails', async () => {
      const qdrantResults = [{ id: '2', content: 'qdrant_result' }];
      
      const fallbacks = createSearchFallbackChain(
        async () => { throw new Error('Mem0 failed'); },
        async () => qdrantResults,
        async () => { throw new Error('Should not be called'); }
      );

      const result = await handler.executeWithFallback('search', fallbacks, []);

      expect(result.success).toBe(true);
      expect(result.result).toEqual(qdrantResults);
      expect(result.finalMethod).toBe('qdrant');
    });

    it('should fallback to Chronicle grep when Qdrant fails', async () => {
      const grepResults = [{ id: '3', content: 'grep_result' }];
      
      const fallbacks = createSearchFallbackChain(
        async () => { throw new Error('Mem0 failed'); },
        async () => { throw new Error('Qdrant failed'); },
        async () => grepResults
      );

      const result = await handler.executeWithFallback('search', fallbacks, []);

      expect(result.success).toBe(true);
      expect(result.result).toEqual(grepResults);
      expect(result.finalMethod).toBe('chronicle_grep');
    });

    it('should return empty array when all search methods fail', async () => {
      const fallbacks = createSearchFallbackChain(
        async () => { throw new Error('Mem0 failed'); },
        async () => { throw new Error('Qdrant failed'); },
        async () => { throw new Error('Grep failed'); }
      );

      const result = await handler.executeWithFallback('search', fallbacks, []);

      expect(result.success).toBe(false);
      expect(result.result).toEqual([]);
      expect(result.finalMethod).toBe('default');
    });
  });

  describe('Truth Extraction Fallback Chain', () => {
    it('should try Mem0 first', async () => {
      const truths = [{ subject: 'a', predicate: 'b', object: 'c' }];
      
      const fallbacks = createTruthExtractionFallbackChain(
        async () => truths,
        async () => { throw new Error('Should not be called'); }
      );

      const result = await handler.executeWithFallback('extract_truths', fallbacks, []);

      expect(result.success).toBe(true);
      expect(result.result).toEqual(truths);
      expect(result.finalMethod).toBe('mem0');
    });

    it('should fallback to LLM when Mem0 fails', async () => {
      const llmTruths = [{ subject: 'x', predicate: 'y', object: 'z' }];
      
      const fallbacks = createTruthExtractionFallbackChain(
        async () => { throw new Error('Mem0 failed'); },
        async () => llmTruths
      );

      const result = await handler.executeWithFallback('extract_truths', fallbacks, []);

      expect(result.success).toBe(true);
      expect(result.result).toEqual(llmTruths);
      expect(result.finalMethod).toBe('llm');
    });

    it('should return empty array when both fail', async () => {
      const fallbacks = createTruthExtractionFallbackChain(
        async () => { throw new Error('Mem0 failed'); },
        async () => { throw new Error('LLM failed'); }
      );

      const result = await handler.executeWithFallback('extract_truths', fallbacks, []);

      expect(result.success).toBe(false);
      expect(result.result).toEqual([]);
    });
  });

  describe('LLM Fallback Chain', () => {
    it('should try cloud LLM first', async () => {
      const fallbacks = createLLMFallbackChain(
        async () => 'cloud_response',
        async () => { throw new Error('Should not be called'); },
        async () => { throw new Error('Should not be called'); }
      );

      const result = await handler.executeWithFallback('llm_invoke', fallbacks, '');

      expect(result.success).toBe(true);
      expect(result.result).toBe('cloud_response');
      expect(result.finalMethod).toBe('cloud_llm');
    });

    it('should fallback to local LLM when cloud fails', async () => {
      const fallbacks = createLLMFallbackChain(
        async () => { throw new Error('Cloud failed'); },
        async () => 'local_response',
        async () => { throw new Error('Should not be called'); }
      );

      const result = await handler.executeWithFallback('llm_invoke', fallbacks, '');

      expect(result.success).toBe(true);
      expect(result.result).toBe('local_response');
      expect(result.finalMethod).toBe('local_llm');
    });

    it('should use cached response when both LLMs fail', async () => {
      const fallbacks = createLLMFallbackChain(
        async () => { throw new Error('Cloud failed'); },
        async () => { throw new Error('Local failed'); },
        async () => 'cached_response'
      );

      const result = await handler.executeWithFallback('llm_invoke', fallbacks, '');

      expect(result.success).toBe(true);
      expect(result.result).toBe('cached_response');
      expect(result.finalMethod).toBe('cached');
    });
  });

  describe('Storage Fallback Chain', () => {
    it('should try Qdrant first', async () => {
      let qdrantCalled = false;
      
      const fallbacks = createStorageFallbackChain(
        async () => { qdrantCalled = true; },
        async () => { throw new Error('Should not be called'); },
        async () => { throw new Error('Should not be called'); }
      );

      const result = await handler.executeWithFallback('index_truths', fallbacks, undefined);

      expect(result.success).toBe(true);
      expect(qdrantCalled).toBe(true);
      expect(result.finalMethod).toBe('qdrant');
    });

    it('should fallback to file backup when Qdrant fails', async () => {
      let fileCalled = false;
      
      const fallbacks = createStorageFallbackChain(
        async () => { throw new Error('Qdrant failed'); },
        async () => { fileCalled = true; },
        async () => { throw new Error('Should not be called'); }
      );

      const result = await handler.executeWithFallback('index_truths', fallbacks, undefined);

      expect(result.success).toBe(true);
      expect(fileCalled).toBe(true);
      expect(result.finalMethod).toBe('file_backup');
    });

    it('should use memory cache when file backup fails', async () => {
      let cacheCalled = false;
      
      const fallbacks = createStorageFallbackChain(
        async () => { throw new Error('Qdrant failed'); },
        async () => { throw new Error('File failed'); },
        async () => { cacheCalled = true; }
      );

      const result = await handler.executeWithFallback('index_truths', fallbacks, undefined);

      expect(result.success).toBe(true);
      expect(cacheCalled).toBe(true);
      expect(result.finalMethod).toBe('memory_cache');
    });
  });

  describe('Statistics Tracking', () => {
    it('should track successful attempts', async () => {
      const fallbacks = [
        { method: 'primary', fn: async () => 'success' },
      ];

      await handler.executeWithFallback('search', fallbacks, '');
      await handler.executeWithFallback('search', fallbacks, '');

      const stats = handler.getStats('search');
      expect(stats.totalAttempts).toBe(2);
      expect(stats.successfulAttempts).toBe(2);
      expect(stats.failedAttempts).toBe(0);
    });

    it('should track failed attempts', async () => {
      const fallbacks = [
        { method: 'primary', fn: async () => { throw new Error('Failed'); } },
      ];

      await handler.executeWithFallback('search', fallbacks, '');

      const stats = handler.getStats('search');
      expect(stats.totalAttempts).toBe(1);
      expect(stats.successfulAttempts).toBe(0);
      expect(stats.failedAttempts).toBe(1);
    });

    it('should track fallback usage', async () => {
      const fallbacks = [
        { method: 'primary', fn: async () => { throw new Error('Failed'); } },
        { method: 'secondary', fn: async () => 'success' },
      ];

      await handler.executeWithFallback('search', fallbacks, '');
      await handler.executeWithFallback('search', fallbacks, '');

      const stats = handler.getStats('search');
      expect(stats.fallbackUsage.get('secondary')).toBe(2);
    });

    it('should calculate success rate', async () => {
      const successFallbacks = [
        { method: 'primary', fn: async () => 'success' },
      ];
      
      const failFallbacks = [
        { method: 'primary', fn: async () => { throw new Error('Failed'); } },
      ];

      await handler.executeWithFallback('search', successFallbacks, '');
      await handler.executeWithFallback('search', successFallbacks, '');
      await handler.executeWithFallback('search', failFallbacks, '');

      const successRate = handler.getSuccessRate('search');
      expect(successRate).toBeCloseTo(2 / 3);
    });

    it('should identify most used fallback', async () => {
      const fallbacks1 = [
        { method: 'primary', fn: async () => 'success' },
      ];
      
      const fallbacks2 = [
        { method: 'primary', fn: async () => { throw new Error('Failed'); } },
        { method: 'secondary', fn: async () => 'success' },
      ];

      await handler.executeWithFallback('search', fallbacks1, '');
      await handler.executeWithFallback('search', fallbacks2, '');
      await handler.executeWithFallback('search', fallbacks2, '');

      const mostUsed = handler.getMostUsedFallback('search');
      expect(mostUsed).toBe('secondary');
    });

    it('should reset statistics', async () => {
      const fallbacks = [
        { method: 'primary', fn: async () => 'success' },
      ];

      await handler.executeWithFallback('search', fallbacks, '');

      expect(handler.getStats('search')).toBeDefined();

      handler.resetStats();

      expect(handler.getStats('search')).toBeNull();
    });
  });

  describe('Attempt Tracking', () => {
    it('should track duration of each attempt', async () => {
      const fallbacks = [
        { method: 'slow', fn: async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return 'success';
        }},
      ];

      const result = await handler.executeWithFallback('search', fallbacks, '');

      expect(result.attempts[0].duration).toBeGreaterThan(40);
    });

    it('should track total duration', async () => {
      const fallbacks = [
        { method: 'first', fn: async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          throw new Error('Failed');
        }},
        { method: 'second', fn: async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          return 'success';
        }},
      ];

      const result = await handler.executeWithFallback('search', fallbacks, '');

      expect(result.totalDuration).toBeGreaterThan(35);
    });

    it('should record error messages', async () => {
      const fallbacks = [
        { method: 'primary', fn: async () => { throw new Error('Custom error message'); } },
        { method: 'secondary', fn: async () => 'success' },
      ];

      const result = await handler.executeWithFallback('search', fallbacks, '');

      expect(result.attempts[0].error).toBe('Custom error message');
    });
  });
});
