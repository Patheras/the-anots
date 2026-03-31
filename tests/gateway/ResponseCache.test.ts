/**
 * ResponseCache Tests
 * Unit tests + Property-based test (Property 13)
 * Feature: anots-gateway
 */

import * as fc from 'fast-check';
import { ResponseCache } from '../../src/gateway/ResponseCache';
import { TaskType, ChatCompletion } from '../../src/gateway/types';

fc.configureGlobal({ numRuns: 100 });

const makeCompletion = (id: string): ChatCompletion => ({
  id,
  choices: [{ message: { role: 'assistant', content: `Response ${id}` }, finish_reason: 'stop' }],
  model: 'test-model',
});

const arbitraryTaskType = (): fc.Arbitrary<TaskType> =>
  fc.constantFrom(
    'philosophical-dialogue', 'code-generation', 'mcp-orchestration',
    'truth-extraction', 'chronicle-writing', 'research-synthesis', 'testing-validation'
  );

describe('ResponseCache', () => {
  let cache: ResponseCache;

  beforeEach(() => {
    cache = new ResponseCache();
  });

  // ─── Property 13: Cache Store-Retrieve Round-Trip ──────────────────────────

  describe('Property 13: Cache Store-Retrieve Round-Trip', () => {
    it('store then get returns the same response', () => {
      fc.assert(
        fc.property(
          arbitraryTaskType(),
          fc.uuid(),
          (taskType, id) => {
            const response = makeCompletion(id);
            cache.store(taskType, response);
            const retrieved = cache.get(taskType);
            expect(retrieved).toEqual(response);
          }
        )
      );
    });
  });

  // ─── Unit Tests ────────────────────────────────────────────────────────────

  describe('get', () => {
    it('returns null for unknown task type', () => {
      expect(cache.get('code-generation')).toBeNull();
    });

    it('returns stored response', () => {
      const r = makeCompletion('abc');
      cache.store('code-generation', r);
      expect(cache.get('code-generation')).toEqual(r);
    });

    it('overwrites previous response for same task type', () => {
      cache.store('code-generation', makeCompletion('first'));
      cache.store('code-generation', makeCompletion('second'));
      expect(cache.get('code-generation')!.id).toBe('second');
    });
  });

  describe('store', () => {
    it('stores independently per task type', () => {
      cache.store('code-generation', makeCompletion('code'));
      cache.store('research-synthesis', makeCompletion('research'));
      expect(cache.get('code-generation')!.id).toBe('code');
      expect(cache.get('research-synthesis')!.id).toBe('research');
    });
  });

  describe('clear', () => {
    it('removes all entries', () => {
      cache.store('code-generation', makeCompletion('x'));
      cache.store('truth-extraction', makeCompletion('y'));
      cache.clear();
      expect(cache.get('code-generation')).toBeNull();
      expect(cache.get('truth-extraction')).toBeNull();
      expect(cache.size).toBe(0);
    });
  });

  describe('size', () => {
    it('tracks number of stored entries', () => {
      expect(cache.size).toBe(0);
      cache.store('code-generation', makeCompletion('a'));
      expect(cache.size).toBe(1);
      cache.store('research-synthesis', makeCompletion('b'));
      expect(cache.size).toBe(2);
    });
  });
});
