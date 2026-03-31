/**
 * Bifrost Client
 *
 * HTTP client for Bifrost's OpenAI-compatible API.
 * Wraps each provider call in a CircuitBreaker.
 * Uses AbortController for per-request timeout enforcement.
 *
 * Requirements: 1.1, 8.1, 10.2, 10.3
 */

import { CircuitBreaker, CircuitOpenError } from '../resilience/CircuitBreaker';
import { ChatMessage, ChatCompletion, ProviderId } from './types';

export class BifrostClient {
  private readonly baseUrl: string;
  private readonly cloudBreaker: CircuitBreaker;
  private readonly localBreaker: CircuitBreaker;

  constructor(bifrostPort = 8080) {
    this.baseUrl = `http://localhost:${bifrostPort}`;
    this.cloudBreaker = new CircuitBreaker({
      name: 'gateway-cloud',
      failureThreshold: 3,
      timeout: 60_000,
    });
    this.localBreaker = new CircuitBreaker({
      name: 'gateway-local',
      failureThreshold: 5,
      timeout: 30_000,
    });
  }

  /**
   * Send a chat completion request to Bifrost.
   * Throws on error (caller handles fallback).
   */
  async chat(
    messages: ChatMessage[],
    provider: ProviderId,
    model: string,
    timeoutMs: number,
  ): Promise<ChatCompletion> {
    const breaker = provider === 'cloud' ? this.cloudBreaker : this.localBreaker;

    return breaker.execute(async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Provider': provider,
          },
          body: JSON.stringify({ model, messages }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Bifrost HTTP ${response.status}: ${response.statusText}`);
        }

        return (await response.json()) as ChatCompletion;
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          throw new Error(`Request timeout after ${timeoutMs}ms`);
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }
    });
  }

  /** Check if a provider's circuit breaker is open */
  isCircuitOpen(provider: ProviderId): boolean {
    const breaker = provider === 'cloud' ? this.cloudBreaker : this.localBreaker;
    return breaker.isOpen();
  }

  /** Get circuit breaker state for a provider */
  getCircuitState(provider: ProviderId) {
    const breaker = provider === 'cloud' ? this.cloudBreaker : this.localBreaker;
    return breaker.getState();
  }
}
