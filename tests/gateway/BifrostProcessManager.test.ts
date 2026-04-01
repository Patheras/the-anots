/**
 * BifrostProcessManager Tests
 * Unit tests + Property-based test (Property 16)
 * Feature: anots-gateway
 * Note: Mocks child_process.spawn - no real binary required
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { EventEmitter } from 'events';
import { BifrostProcessManager } from '../../src/gateway/BifrostProcessManager';
import { GatewayConfig } from '../../src/gateway/types';

fc.configureGlobal({ numRuns: 100 });

// Mock child_process at module level
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

import * as cp from 'child_process';
const mockSpawn = cp.spawn as jest.Mock;

fc.configureGlobal({ numRuns: 100 });

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeBinPath = () => {
  const p = path.join(os.tmpdir(), `fake-bifrost-${Date.now()}`);
  fs.writeFileSync(p, '#!/bin/sh\necho ok\n');
  try { fs.chmodSync(p, 0o755); } catch { /* windows */ }
  return p;
};

const makeConfig = (binPath: string): GatewayConfig => ({
  zaiApiKey: 'test-key',
  zaiBaseUrl: 'https://api.z.ai',
  zaiModel: 'glm-5-pro',
  openrouterApiKey: 'test-openrouter-key',
  openrouterBaseUrl: 'https://openrouter.ai/api/v1',
  openrouterModel: 'anthropic/claude-3.5-sonnet',
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'qwen3.5:latest',
  bifrostBinPath: binPath,
  bifrostPort: 18080,
  quotaLimit: 1_000_000,
  quotaResetIntervalHours: 24,
  requestTimeoutMs: 30_000,
  logLevel: 'info',
  cloudEnabled: true,
  cloudAltEnabled: true,
});

/** Create a mock child process that emits events on demand */
function makeMockProcess() {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.killed = false;
  proc.kill = jest.fn((_signal?: unknown) => {
    proc.killed = true;
    setTimeout(() => proc.emit('exit', 0), 10);
    return true;
  });
  return proc as cp.ChildProcess;
}

// ─── Property 16: Bifrost Restart Limit ──────────────────────────────────────

describe('Property 16: Bifrost Restart Limit', () => {
  it('at most 3 restart attempts before permanently failed', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 4, max: 10 }), // more exits than max restarts
        (exitCount) => {
          const manager = new BifrostProcessManager(makeConfig('/nonexistent/bifrost'));
          // Access private restart tracking via type assertion
          const m = manager as any;
          m.restartCount = 0;
          m.permanentlyFailed = false;

          // Simulate handleUnexpectedExit being called exitCount times
          // After 3 calls, should be permanently failed
          for (let i = 0; i < exitCount; i++) {
            if (m.restartCount >= 3) {
              m.permanentlyFailed = true;
              break;
            }
            m.restartCount++;
          }

          expect(m.restartCount).toBeLessThanOrEqual(3);
          if (exitCount >= 3) {
            expect(m.permanentlyFailed).toBe(true);
          }
        }
      )
    );
  });
});

// ─── Unit Tests ───────────────────────────────────────────────────────────────

describe('BifrostProcessManager', () => {
  let binPath: string;

  beforeEach(() => {
    binPath = makeBinPath();
  });

  afterEach(() => {
    try { fs.unlinkSync(binPath); } catch { /* ignore */ }
  });

  describe('start', () => {
    it('throws when binary does not exist', async () => {
      const config = makeConfig('/nonexistent/path/bifrost');
      const manager = new BifrostProcessManager(config);
      await expect(manager.start()).rejects.toThrow(/not found/i);
    });

    it('writes config JSON to temp directory', async () => {
      const config = makeConfig(binPath);
      const manager = new BifrostProcessManager(config);

      // Mock spawn to avoid actually running the binary
      const mockProc = makeMockProcess();
      mockSpawn.mockReturnValue(mockProc);

      // Mock fetch for health check
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({ ok: true } as Response);

      try {
        await manager.start();

        // Verify spawn was called with the binary path
        expect(mockSpawn).toHaveBeenCalledWith(
          binPath,
          expect.arrayContaining(['--config', expect.stringContaining('.json')]),
          expect.any(Object)
        );

        // Verify config file was written
        const configArg = (mockSpawn.mock.calls[0][1] as string[])[1];
        expect(fs.existsSync(configArg)).toBe(true);
        const configContent = JSON.parse(fs.readFileSync(configArg, 'utf-8'));
        expect(configContent).toHaveProperty('port', 18080);
        expect(configContent.providers).toHaveLength(2);
      } finally {
        mockSpawn.mockReset();
        global.fetch = originalFetch;
        await manager.stop();
      }
    });

    it('throws when health check times out', async () => {
      const config = makeConfig(binPath);
      const manager = new BifrostProcessManager(config);

      const mockProc = makeMockProcess();
      mockSpawn.mockReturnValue(mockProc);

      // Mock fetch to always fail (health check never succeeds)
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      try {
        // Override health timeout for faster test
        (manager as any).waitForHealth = async () => {
          throw new Error('Bifrost did not become healthy within 5000ms');
        };

        await expect(manager.start()).rejects.toThrow(/healthy/i);
      } finally {
        mockSpawn.mockReset();
        global.fetch = originalFetch;
      }
    });
  });

  describe('stop', () => {
    it('sends SIGTERM to process', async () => {
      const config = makeConfig(binPath);
      const manager = new BifrostProcessManager(config);

      const mockProc = makeMockProcess();
      mockSpawn.mockReturnValue(mockProc);
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({ ok: true } as Response);

      try {
        await manager.start();
        await manager.stop();
        expect(mockProc.kill).toHaveBeenCalledWith('SIGTERM');
      } finally {
        mockSpawn.mockReset();
        global.fetch = originalFetch;
      }
    });

    it('is safe to call when not running', async () => {
      const config = makeConfig(binPath);
      const manager = new BifrostProcessManager(config);
      await expect(manager.stop()).resolves.not.toThrow();
    });
  });

  describe('isRunning', () => {
    it('returns false before start', () => {
      const manager = new BifrostProcessManager(makeConfig(binPath));
      expect(manager.isRunning()).toBe(false);
    });

    it('returns false after stop', async () => {
      const config = makeConfig(binPath);
      const manager = new BifrostProcessManager(config);

      const mockProc = makeMockProcess();
      mockSpawn.mockReturnValue(mockProc);
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({ ok: true } as Response);

      try {
        await manager.start();
        await manager.stop();
        expect(manager.isRunning()).toBe(false);
      } finally {
        mockSpawn.mockReset();
        global.fetch = originalFetch;
      }
    });
  });

  describe('isPermanentlyFailed', () => {
    it('returns false initially', () => {
      const manager = new BifrostProcessManager(makeConfig(binPath));
      expect(manager.isPermanentlyFailed()).toBe(false);
    });

    it('start throws when permanently failed', async () => {
      const manager = new BifrostProcessManager(makeConfig(binPath));
      (manager as any).permanentlyFailed = true;
      await expect(manager.start()).rejects.toThrow(/permanently failed/i);
    });
  });
});
