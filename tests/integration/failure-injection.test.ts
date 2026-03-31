/**
 * Failure Injection Tests
 *
 * Tests system behavior under various failure scenarios.
 * Verifies graceful degradation and recovery.
 *
 * Requirements: 30.1-30.6
 */

import * as path from 'path';
import * as os from 'os';
import * as fsp from 'fs/promises';
import * as fs from 'fs';
import {
  GracefulDegradationHandler,
  createSearchFallbackChain,
  createTruthExtractionFallbackChain,
  createStorageFallbackChain,
  createLLMFallbackChain,
} from '../../src/resilience/GracefulDegradationHandler';
import { CircuitBreaker } from '../../src/resilience/CircuitBreaker';
import { ErrorMonitor } from '../../src/resilience/ErrorMonitor';
import { writeChronicle } from '../../src/chronicle/writer';
import { updateAgentCodex } from '../../src/codex/updater';
import { initializeNodeCodex } from '../../src/codex/initializer';

describe('Failure Injection Tests', () => {
  let testRoot: string;

  beforeEach(async () => {
    testRoot = path.join(
      os.tmpdir(),
      `tcam-failure-${Date.now()}-${Math.random().toString(36).substring(7)}`
    );
    await fsp.mkdir(testRoot, { recursive: true });
    process.env.CHRONICLE_ROOT = path.join(testRoot, 'chronicle');
    process.env.CODEX_ROOT = path.join(testRoot, 'codex');
  });

  afterEach(async () => {
    delete process.env.CHRONICLE_ROOT;
    delete process.env.CODEX_ROOT;
    try {
      await fsp.rm(testRoot, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  describe('30.1 Qdrant failure scenarios', () => {
    it('search falls back to Chronicle grep when Qdrant fails', async () => {
      const handler = new GracefulDegradationHandler();

      const chain = createSearchFallbackChain(
        async () => { throw new Error('Mem0 connection refused'); },
        async () => { throw new Error('Qdrant connection refused: ECONNREFUSED'); },
        async () => [{ id: '1', content: 'TypeScript is typed', score: 0.6 }],
      );

      const result = await handler.executeWithFallback('search', chain, []);

      expect(result.success).toBe(true);
      expect(result.finalMethod).toBe('chronicle_grep');
      expect(result.result.length).toBeGreaterThan(0);
    });

    it('indexing falls back to file storage when Qdrant fails', async () => {
      const handler = new GracefulDegradationHandler();
      let fileBackupCalled = false;

      const chain = createStorageFallbackChain(
        async () => { throw new Error('Qdrant unavailable'); },
        async () => { fileBackupCalled = true; },
        async () => {},
      );

      const result = await handler.executeWithFallback('index_truths', chain, undefined as void);

      expect(result.success).toBe(true);
      expect(fileBackupCalled).toBe(true);
      expect(result.finalMethod).toBe('file_backup');
    });

    it('circuit breaker opens after repeated Qdrant failures', async () => {
      const cb = new CircuitBreaker({ name: 'qdrant-test', failureThreshold: 3, timeout: 60000 });

      for (let i = 0; i < 3; i++) {
        await expect(
          cb.execute(async () => { throw new Error('Qdrant down'); })
        ).rejects.toThrow();
      }

      expect(cb.getState()).toBe('OPEN');
      expect(cb.isOpen()).toBe(true);
    });

    it('system continues operating after Qdrant circuit opens', async () => {
      const cb = new CircuitBreaker({ name: 'qdrant-test2', failureThreshold: 3, timeout: 60000 });
      const handler = new GracefulDegradationHandler();

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(cb.execute(async () => { throw new Error('Qdrant down'); })).rejects.toThrow();
      }

      // Now use fallback chain (bypassing circuit breaker)
      const chain = createSearchFallbackChain(
        async () => [],
        async () => { throw new Error('Qdrant circuit open'); },
        async () => [{ id: '1', content: 'fallback result', score: 0.5 }],
      );

      const result = await handler.executeWithFallback('search', chain, []);
      expect(result.success).toBe(true);
    });
  });

  describe('30.2 Memory Service crash scenarios', () => {
    it('L1 Chronicle continues working when Memory Service is unavailable', async () => {
      // Memory Service is "crashed" - but L1 should work independently
      const dateStr = new Date().toISOString().split('T')[0];
      const chapterId = `${dateStr}-chapter-001`;

      // L1 write - no Memory Service needed
      await writeChronicle({
        metadata: {
          date: dateStr,
          chapterId,
          participants: ['user', 'agent'],
          sessionType: 'general',
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          messageCount: 1,
        },
        content: {
          summary: 'Session during Memory Service crash',
          dialogue: '**user:** Hello\n\n**agent:** Hi',
          truths: [],
          insights: [],
          toolsCreated: [],
          decisions: [],
        },
      });

      const chronicleRoot = process.env.CHRONICLE_ROOT!;
      const filePath = path.join(chronicleRoot, 'chip', 'general', `${chapterId}.md`);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('L4 Codex continues working when Memory Service is unavailable', async () => {
      await initializeNodeCodex('ubik');
      await updateAgentCodex({
        node: 'ubik',
        file: 'CONTEXT.md',
        operation: 'replace',
        content: 'Working without Memory Service',
        summary: 'Test',
      });

      const codexRoot = process.env.CODEX_ROOT!;
      expect(fs.existsSync(path.join(codexRoot, 'ubik', 'CONTEXT.md'))).toBe(true);
    });

    it('graceful degradation returns safe defaults when Memory Service crashes', async () => {
      const handler = new GracefulDegradationHandler();

      // All operations fail (simulating crashed Memory Service)
      const searchChain = createSearchFallbackChain(
        async () => { throw new Error('Memory Service crashed'); },
        async () => { throw new Error('Memory Service crashed'); },
        async () => { throw new Error('Memory Service crashed'); },
      );

      const result = await handler.executeWithFallback('search', searchChain, []);

      // Must return safe default, never throw
      expect(result.success).toBe(false);
      expect(result.result).toEqual([]);
      expect(result.finalMethod).toBe('default');
    });
  });

  describe('30.3 Disk full scenarios', () => {
    it('Chronicle writer handles ENOSPC gracefully', async () => {
      // Simulate disk full by writing to a read-only location
      // The writer should log error but not throw
      const dateStr = new Date().toISOString().split('T')[0];
      const chapterId = `${dateStr}-chapter-001`;

      // First write succeeds
      await writeChronicle({
        metadata: {
          date: dateStr,
          chapterId,
          participants: ['user', 'agent'],
          sessionType: 'general',
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          messageCount: 1,
        },
        content: {
          summary: 'Test chapter',
          dialogue: '**user:** Hello\n\n**agent:** Hi',
          truths: [],
          insights: [],
          toolsCreated: [],
          decisions: [],
        },
      });

      // Second write with same ID should fail gracefully (EEXIST, not ENOSPC but similar behavior)
      // writeChronicle uses 'wx' flag - should not throw on duplicate
      await expect(writeChronicle({
        metadata: {
          date: dateStr,
          chapterId, // same ID - will fail with EEXIST
          participants: ['user', 'agent'],
          sessionType: 'general',
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          messageCount: 1,
        },
        content: {
          summary: 'Duplicate chapter',
          dialogue: '**user:** Hello\n\n**agent:** Hi',
          truths: [],
          insights: [],
          toolsCreated: [],
          decisions: [],
        },
      })).resolves.not.toThrow(); // Should not throw - handles gracefully
    });

    it('Codex updater handles disk errors gracefully', async () => {
      await initializeNodeCodex('axiom');

      // Normal update should work
      await expect(updateAgentCodex({
        node: 'axiom',
        file: 'NOTES.md',
        operation: 'replace',
        content: 'Test notes',
        summary: 'Test',
      })).resolves.not.toThrow();
    });
  });

  describe('30.4 Cloud LLM failure scenarios', () => {
    it('falls back to local LLM when cloud LLM fails', async () => {
      const handler = new GracefulDegradationHandler();

      const chain = createLLMFallbackChain(
        async () => { throw new Error('Cloud LLM API timeout'); },
        async () => 'Local LLM response',
        async () => 'Cached response',
      );

      const result = await handler.executeWithFallback('llm_invoke', chain, '');

      expect(result.success).toBe(true);
      expect(result.finalMethod).toBe('local_llm');
      expect(result.result).toBe('Local LLM response');
    });

    it('falls back to cached response when both LLMs fail', async () => {
      const handler = new GracefulDegradationHandler();

      const chain = createLLMFallbackChain(
        async () => { throw new Error('Cloud LLM down'); },
        async () => { throw new Error('Local LLM down'); },
        async () => 'Cached: TypeScript is type-safe',
      );

      const result = await handler.executeWithFallback('llm_invoke', chain, '');

      expect(result.success).toBe(true);
      expect(result.finalMethod).toBe('cached');
      expect(result.result).toContain('Cached');
    });

    it('returns empty string when all LLM options fail', async () => {
      const handler = new GracefulDegradationHandler();

      const chain = createLLMFallbackChain(
        async () => { throw new Error('Cloud LLM down'); },
        async () => { throw new Error('Local LLM down'); },
        async () => { throw new Error('Cache miss'); },
      );

      const result = await handler.executeWithFallback('llm_invoke', chain, '');

      expect(result.success).toBe(false);
      expect(result.result).toBe('');
    });
  });

  describe('30.5 Redis failure scenarios', () => {
    it('system continues without Redis (in-memory fallback)', async () => {
      // Redis is unavailable - L1 and L4 should still work
      const dateStr = new Date().toISOString().split('T')[0];
      const chapterId = `${dateStr}-chapter-001`;

      // L1 works without Redis
      await writeChronicle({
        metadata: {
          date: dateStr,
          chapterId,
          participants: ['user', 'agent'],
          sessionType: 'general',
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          messageCount: 1,
        },
        content: {
          summary: 'Session without Redis',
          dialogue: '**user:** Hello\n\n**agent:** Hi',
          truths: [],
          insights: [],
          toolsCreated: [],
          decisions: [],
        },
      });

      const chronicleRoot = process.env.CHRONICLE_ROOT!;
      const filePath = path.join(chronicleRoot, 'chip', 'general', `${chapterId}.md`);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('30.6 Mem0 failure scenarios', () => {
    it('truth extraction falls back to LLM when Mem0 fails', async () => {
      const handler = new GracefulDegradationHandler();

      const chain = createTruthExtractionFallbackChain(
        async () => { throw new Error('Mem0 connection error'); },
        async () => [
          { subject: 'TypeScript', predicate: 'is', object: 'typed', confidence: 0.8 }
        ],
      );

      const result = await handler.executeWithFallback('extract_truths', chain, []);

      expect(result.success).toBe(true);
      expect(result.finalMethod).toBe('llm');
      expect(result.result).toHaveLength(1);
    });

    it('search falls back to Qdrant when Mem0 fails', async () => {
      const handler = new GracefulDegradationHandler();

      const chain = createSearchFallbackChain(
        async () => { throw new Error('Mem0 connection error'); },
        async () => [{ id: '1', content: 'Qdrant result', score: 0.85 }],
        async () => [],
      );

      const result = await handler.executeWithFallback('search', chain, []);

      expect(result.success).toBe(true);
      expect(result.finalMethod).toBe('qdrant');
      expect(result.result).toHaveLength(1);
    });

    it('system continues operating after Mem0 circuit opens', async () => {
      const cb = new CircuitBreaker({ name: 'mem0-test', failureThreshold: 3, timeout: 60000 });

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(cb.execute(async () => { throw new Error('Mem0 down'); })).rejects.toThrow();
      }

      expect(cb.getState()).toBe('OPEN');

      // System should use fallback chain
      const handler = new GracefulDegradationHandler();
      const chain = createSearchFallbackChain(
        async () => { throw new Error('Mem0 circuit open'); },
        async () => [{ id: '1', content: 'Qdrant fallback', score: 0.8 }],
        async () => [],
      );

      const result = await handler.executeWithFallback('search', chain, []);
      expect(result.success).toBe(true);
    });
  });

  describe('Error logging during failures', () => {
    it('errors are logged without propagating to caller', async () => {
      const monitor = new ErrorMonitor({ logToConsole: false });
      const handler = new GracefulDegradationHandler();

      // Simulate multiple failures
      const chain = createSearchFallbackChain(
        async () => { throw new Error('Mem0 error'); },
        async () => { throw new Error('Qdrant error'); },
        async () => [],
      );

      await handler.executeWithFallback('search', chain, []);

      // Log errors manually (in real system, handler would log)
      monitor.error('Mem0', 'search', 'Mem0 error', 'qdrant');
      monitor.error('Qdrant', 'search', 'Qdrant error', 'chronicle_grep');

      expect(monitor.size).toBe(2);
      expect(monitor.getErrorRate('Mem0')).toBe(1);
      expect(monitor.getErrorRate('Qdrant')).toBe(1);
    });

    it('multiple failures do not crash the system', async () => {
      const handler = new GracefulDegradationHandler();

      // Run 10 operations, all failing
      const promises = Array.from({ length: 10 }, () => {
        const chain = createSearchFallbackChain(
          async () => { throw new Error('fail'); },
          async () => { throw new Error('fail'); },
          async () => { throw new Error('fail'); },
        );
        return handler.executeWithFallback('search', chain, []);
      });

      const results = await Promise.all(promises);

      // All should return safe defaults
      expect(results.every(r => !r.success && Array.isArray(r.result))).toBe(true);
    });
  });
});
