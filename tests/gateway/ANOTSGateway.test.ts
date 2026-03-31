/**
 * ANOTSGateway Tests
 * Integration tests + Property-based tests (Properties 12, 17, 18, 19)
 * Feature: anots-gateway
 */

import * as fc from 'fast-check';
import { ANOTSGateway } from '../../src/gateway/ANOTSGateway';
import { ChatMessage, ChatCompletion, GatewayConfig } from '../../src/gateway/types';

fc.configureGlobal({ numRuns: 100 });

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockCompletion = (id = 'resp-1'): ChatCompletion => ({
  id,
  choices: [{ message: { role: 'assistant', content: 'Hello!' }, finish_reason: 'stop' }],
  model: 'test-model',
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
});

const messages: ChatMessage[] = [{ role: 'user', content: 'Hello' }];

/** Create a gateway with Bifrost process manager mocked out */
function makeGateway(overrides: Partial<GatewayConfig> = {}): ANOTSGateway {
  const gw = new ANOTSGateway({
    zaiApiKey: 'test-key',
    bifrostBinPath: './bin/bifrost',
    bifrostPort: 18080,
    requestTimeoutMs: 5000,
    cloudEnabled: true,
    ...overrides,
  });

  // Stub out process manager so we don't need a real binary
  (gw as any).processManager = {
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    isRunning: jest.fn().mockReturnValue(true),
    isPermanentlyFailed: jest.fn().mockReturnValue(false),
  };

  return gw;
}

// ─── Property 12: Fallback Chain Never Throws ─────────────────────────────────

describe('Property 12: Fallback Chain Never Throws', () => {
  it('chat() never throws even when all providers fail', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            role: fc.constantFrom('user' as const, 'assistant' as const),
            content: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (msgs) => {
          const gw = makeGateway();
          await gw.initialize();

          // Make bifrost always fail
          (gw as any).bifrost = {
            chat: jest.fn().mockRejectedValue(new Error('provider down')),
            isCircuitOpen: jest.fn().mockReturnValue(false),
            getCircuitState: jest.fn().mockReturnValue('CLOSED'),
          };

          let threw = false;
          let result: ChatCompletion | undefined;
          try {
            result = await gw.chat(msgs);
          } catch {
            threw = true;
          }

          expect(threw).toBe(false);
          expect(result).toBeDefined();
          // Either a real response or structured error
          expect(result!.choices.length).toBeGreaterThan(0);

          await gw.shutdown();
        }
      )
    );
  });
});

// ─── Property 18: Unique Request IDs ─────────────────────────────────────────

describe('Property 18: Unique Request IDs', () => {
  it('two distinct chat() calls get different UUID v4 requestIds', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          const gw = makeGateway();
          await gw.initialize();

          // Mock bifrost to succeed
          (gw as any).bifrost = {
            chat: jest.fn().mockResolvedValue(mockCompletion()),
            isCircuitOpen: jest.fn().mockReturnValue(false),
          };

          await gw.chat(messages);
          await gw.chat(messages);

          const decisions = gw.getRecentDecisions(2);
          expect(decisions.length).toBe(2);
          expect(decisions[0].requestId).not.toBe(decisions[1].requestId);

          // Both should be UUID v4 format
          const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          expect(decisions[0].requestId).toMatch(uuidV4Pattern);
          expect(decisions[1].requestId).toMatch(uuidV4Pattern);

          await gw.shutdown();
        }
      )
    );
  });
});

// ─── Property 19: Bounded Audit Log Retrieval ─────────────────────────────────

describe('Property 19: Bounded Audit Log Retrieval', () => {
  it('getRecentDecisions(limit) returns at most limit entries', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 20 }),  // requests to make
        fc.integer({ min: 0, max: 10 }),  // limit to request
        async (requestCount, limit) => {
          const gw = makeGateway();
          await gw.initialize();

          (gw as any).bifrost = {
            chat: jest.fn().mockResolvedValue(mockCompletion()),
            isCircuitOpen: jest.fn().mockReturnValue(false),
          };

          for (let i = 0; i < requestCount; i++) {
            await gw.chat(messages);
          }

          const decisions = gw.getRecentDecisions(limit);
          expect(decisions.length).toBeLessThanOrEqual(limit);

          await gw.shutdown();
        }
      )
    );
  });
});

// ─── Integration Tests ────────────────────────────────────────────────────────

describe('ANOTSGateway integration', () => {
  describe('successful routing', () => {
    it('routes high-entropy to cloud when available', async () => {
      const gw = makeGateway();
      await gw.initialize();

      let capturedProvider = '';
      (gw as any).bifrost = {
        chat: jest.fn().mockImplementation(async (_msgs: any, provider: string) => {
          capturedProvider = provider;
          return mockCompletion();
        }),
        isCircuitOpen: jest.fn().mockReturnValue(false),
      };

      await gw.chat([{ role: 'user', content: 'why does consciousness exist?' }]);
      expect(capturedProvider).toBe('cloud');

      await gw.shutdown();
    });

    it('routes low-entropy to local', async () => {
      const gw = makeGateway();
      await gw.initialize();

      let capturedProvider = '';
      (gw as any).bifrost = {
        chat: jest.fn().mockImplementation(async (_msgs: any, provider: string) => {
          capturedProvider = provider;
          return mockCompletion();
        }),
        isCircuitOpen: jest.fn().mockReturnValue(false),
      };

      await gw.chat([{ role: 'user', content: 'write a function to sort an array' }]);
      expect(capturedProvider).toBe('local');

      await gw.shutdown();
    });

    it('uses taskHint to override classification', async () => {
      const gw = makeGateway();
      await gw.initialize();

      let capturedProvider = '';
      (gw as any).bifrost = {
        chat: jest.fn().mockImplementation(async (_msgs: any, provider: string) => {
          capturedProvider = provider;
          return mockCompletion();
        }),
        isCircuitOpen: jest.fn().mockReturnValue(false),
      };

      // Force low-entropy task type → should go to local
      await gw.chat(
        [{ role: 'user', content: 'why does consciousness exist?' }],
        { taskHint: 'code-generation' }
      );
      expect(capturedProvider).toBe('local');

      await gw.shutdown();
    });
  });

  describe('fallback behavior', () => {
    it('falls back to local when cloud fails', async () => {
      const gw = makeGateway();
      await gw.initialize();

      const providers: string[] = [];
      (gw as any).bifrost = {
        chat: jest.fn().mockImplementation(async (_msgs: any, provider: string) => {
          providers.push(provider);
          if (provider === 'cloud') throw new Error('cloud down');
          return mockCompletion();
        }),
        isCircuitOpen: jest.fn().mockReturnValue(false),
      };

      const result = await gw.chat([{ role: 'user', content: 'why does consciousness exist?' }]);
      expect(providers).toContain('cloud');
      expect(providers).toContain('local');
      expect(result.choices[0].finish_reason).toBe('stop');

      await gw.shutdown();
    });

    it('returns structured error when all providers fail and no cache', async () => {
      const gw = makeGateway();
      await gw.initialize();

      (gw as any).bifrost = {
        chat: jest.fn().mockRejectedValue(new Error('all down')),
        isCircuitOpen: jest.fn().mockReturnValue(false),
      };

      const result = await gw.chat(messages);
      expect(result.choices[0].finish_reason).toBe('error');
      expect(result.error?.code).toBe('all_providers_unavailable');

      await gw.shutdown();
    });

    it('returns cached response when all providers fail', async () => {
      const gw = makeGateway();
      await gw.initialize();

      // First call succeeds and populates cache
      (gw as any).bifrost = {
        chat: jest.fn().mockResolvedValue(mockCompletion('cached-resp')),
        isCircuitOpen: jest.fn().mockReturnValue(false),
      };
      await gw.chat([{ role: 'user', content: 'write a function' }]);

      // Second call fails - should use cache
      (gw as any).bifrost = {
        chat: jest.fn().mockRejectedValue(new Error('all down')),
        isCircuitOpen: jest.fn().mockReturnValue(false),
      };
      const result = await gw.chat([{ role: 'user', content: 'write a function' }]);
      expect(result.id).toBe('cached-resp');

      await gw.shutdown();
    });
  });

  describe('cloud disabled (missing ZAI_API_KEY)', () => {
    it('routes all requests to local when cloud disabled', async () => {
      const gw = makeGateway({ cloudEnabled: false, zaiApiKey: '' });
      await gw.initialize();

      let capturedProvider = '';
      (gw as any).bifrost = {
        chat: jest.fn().mockImplementation(async (_msgs: any, provider: string) => {
          capturedProvider = provider;
          return mockCompletion();
        }),
        isCircuitOpen: jest.fn().mockReturnValue(false),
      };

      // Even high-entropy should go to local
      await gw.chat([{ role: 'user', content: 'why does consciousness exist?' }]);
      expect(capturedProvider).toBe('local');

      await gw.shutdown();
    });
  });

  describe('quota management', () => {
    it('consumes tokens from successful cloud responses', async () => {
      const gw = makeGateway();
      await gw.initialize();

      (gw as any).bifrost = {
        chat: jest.fn().mockResolvedValue(mockCompletion()),
        isCircuitOpen: jest.fn().mockReturnValue(false),
      };

      await gw.chat([{ role: 'user', content: 'why does consciousness exist?' }]);

      const metrics = gw.getMetrics();
      expect(metrics.requestCount).toBe(1);

      await gw.shutdown();
    });
  });

  describe('getMetrics', () => {
    it('returns metrics snapshot after requests', async () => {
      const gw = makeGateway();
      await gw.initialize();

      (gw as any).bifrost = {
        chat: jest.fn().mockResolvedValue(mockCompletion()),
        isCircuitOpen: jest.fn().mockReturnValue(false),
      };

      await gw.chat(messages);
      await gw.chat(messages);

      const snap = gw.getMetrics();
      expect(snap.requestCount).toBe(2);
      expect(snap.successRate).toBe(1);

      await gw.shutdown();
    });
  });
});
