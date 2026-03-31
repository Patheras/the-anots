/**
 * BifrostClient Tests
 * Unit tests - mocks fetch to avoid real HTTP calls
 * Feature: anots-gateway
 */

import { BifrostClient } from '../../src/gateway/BifrostClient';
import { ChatMessage, ChatCompletion } from '../../src/gateway/types';

const mockCompletion: ChatCompletion = {
  id: 'test-completion',
  choices: [{ message: { role: 'assistant', content: 'Hello!' }, finish_reason: 'stop' }],
  model: 'test-model',
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
};

const messages: ChatMessage[] = [{ role: 'user', content: 'Hello' }];

describe('BifrostClient', () => {
  let client: BifrostClient;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    client = new BifrostClient(8080);
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('chat', () => {
    it('sends POST to /v1/chat/completions with correct body', async () => {
      let capturedUrl = '';
      let capturedBody: unknown = null;

      global.fetch = jest.fn().mockImplementation(async (url: string, options: RequestInit) => {
        capturedUrl = url;
        capturedBody = JSON.parse(options.body as string);
        return {
          ok: true,
          json: async () => mockCompletion,
        } as Response;
      });

      await client.chat(messages, 'local', 'qwen3.5:latest', 5000);

      expect(capturedUrl).toBe('http://localhost:8080/v1/chat/completions');
      expect(capturedBody).toMatchObject({
        model: 'qwen3.5:latest',
        messages,
      });
    });

    it('includes X-Provider header', async () => {
      let capturedHeaders: Record<string, string> = {};

      global.fetch = jest.fn().mockImplementation(async (_url: string, options: RequestInit) => {
        capturedHeaders = options.headers as Record<string, string>;
        return { ok: true, json: async () => mockCompletion } as Response;
      });

      await client.chat(messages, 'cloud', 'glm-5-pro', 5000);
      expect(capturedHeaders['X-Provider']).toBe('cloud');
    });

    it('returns parsed ChatCompletion', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockCompletion,
      } as Response);

      const result = await client.chat(messages, 'local', 'qwen3.5:latest', 5000);
      expect(result.id).toBe('test-completion');
      expect(result.choices[0].message.content).toBe('Hello!');
    });

    it('throws on HTTP error response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      } as Response);

      await expect(
        client.chat(messages, 'local', 'qwen3.5:latest', 5000)
      ).rejects.toThrow('503');
    });

    it('throws timeout error when AbortController fires', async () => {
      global.fetch = jest.fn().mockImplementation(async (_url: string, options: RequestInit) => {
        // Simulate slow response - check if signal is aborted
        await new Promise<void>((_, reject) => {
          const signal = options.signal as AbortSignal;
          if (signal?.aborted) {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          }
          signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
        return {} as Response;
      });

      await expect(
        client.chat(messages, 'local', 'qwen3.5:latest', 50) // 50ms timeout
      ).rejects.toThrow(/timeout/i);
    });

    it('circuit breaker open → throws without making fetch call', async () => {
      let fetchCalled = false;
      global.fetch = jest.fn().mockImplementation(async () => {
        fetchCalled = true;
        throw new Error('Should not be called');
      });

      // Open the circuit by failing 5 times (local threshold)
      global.fetch = jest.fn().mockRejectedValue(new Error('connection refused'));
      for (let i = 0; i < 5; i++) {
        await client.chat(messages, 'local', 'qwen3.5:latest', 5000).catch(() => {});
      }

      expect(client.getCircuitState('local')).toBe('OPEN');

      // Now circuit is open - should throw CircuitOpenError without calling fetch
      fetchCalled = false;
      global.fetch = jest.fn().mockImplementation(async () => {
        fetchCalled = true;
        return { ok: true, json: async () => mockCompletion } as Response;
      });

      await expect(
        client.chat(messages, 'local', 'qwen3.5:latest', 5000)
      ).rejects.toThrow();

      expect(fetchCalled).toBe(false);
    });
  });

  describe('isCircuitOpen / getCircuitState', () => {
    it('circuit starts closed', () => {
      expect(client.isCircuitOpen('cloud')).toBe(false);
      expect(client.isCircuitOpen('local')).toBe(false);
      expect(client.getCircuitState('cloud')).toBe('CLOSED');
      expect(client.getCircuitState('local')).toBe('CLOSED');
    });
  });
});
