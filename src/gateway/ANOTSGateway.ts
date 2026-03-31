/**
 * ANOTS Gateway - Main Orchestrator
 *
 * The cognitive routing matrix for TCAM. Classifies requests by entropy,
 * routes to cloud or local LLM via Bifrost, manages quota and health,
 * and never throws to the caller.
 *
 * Whitepaper: Section 3 (The Cognitive Gateway)
 * Requirements: 1.1–1.4, 6.1–6.6, 7.2–7.3, 8.1, 9.1–9.5, 10.1, 10.4, 11.1–11.3
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ChatMessage,
  ChatOptions,
  ChatCompletion,
  GatewayConfig,
  GatewayMetricsSnapshot,
  RoutingDecision,
  PerformanceRecord,
  loadGatewayConfig,
} from './types';
import { TaskClassifier } from './TaskClassifier';
import { Router } from './Router';
import { QuotaManager } from './QuotaManager';
import { GatewayHealthMonitor } from './GatewayHealthMonitor';
import { BifrostClient } from './BifrostClient';
import { BifrostProcessManager } from './BifrostProcessManager';
import { ResponseCache } from './ResponseCache';
import { GatewayMetrics } from './GatewayMetrics';
import { GatewayAuditLog } from './GatewayAuditLog';

/** Structured error response when all providers fail */
const makeErrorResponse = (requestId: string, details: string[]): ChatCompletion => ({
  id: requestId,
  choices: [{
    message: {
      role: 'assistant',
      content: '[Gateway Error] All providers unavailable. Please retry.',
    },
    finish_reason: 'error',
  }],
  model: 'none',
  error: { code: 'all_providers_unavailable', details },
});

export class ANOTSGateway {
  private readonly config: GatewayConfig;
  private readonly classifier: TaskClassifier;
  private readonly router: Router;
  private readonly quota: QuotaManager;
  private readonly health: GatewayHealthMonitor;
  private readonly bifrost: BifrostClient;
  private readonly processManager: BifrostProcessManager;
  private readonly cache: ResponseCache;
  private readonly metrics: GatewayMetrics;
  private readonly auditLog: GatewayAuditLog;

  constructor(config?: Partial<GatewayConfig>) {
    const base = loadGatewayConfig();
    this.config = { ...base, ...config };

    if (!this.config.cloudEnabled) {
      console.warn('[ANOTSGateway] ZAI_API_KEY not set — cloud provider disabled, routing all requests to local');
    }

    this.classifier = new TaskClassifier();
    this.router = new Router(this.config.zaiModel, this.config.ollamaModel);
    this.quota = new QuotaManager(this.config.quotaLimit, this.config.quotaResetIntervalHours);
    this.health = new GatewayHealthMonitor();
    this.bifrost = new BifrostClient(this.config.bifrostPort);
    this.processManager = new BifrostProcessManager(this.config);
    this.cache = new ResponseCache();
    this.metrics = new GatewayMetrics();
    this.auditLog = new GatewayAuditLog();
  }

  /** Start Bifrost process and health monitoring */
  async initialize(): Promise<void> {
    await this.processManager.start();
    this.health.startPeriodicProbes();
  }

  /** Stop health monitoring and Bifrost process */
  async shutdown(): Promise<void> {
    this.health.stopPeriodicProbes();
    this.quota.stop();
    await this.processManager.stop();
  }

  /**
   * Send a chat completion request.
   * Never throws — returns ChatCompletion or structured error response.
   */
  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatCompletion> {
    const requestId = uuidv4();
    const gatewayStart = Date.now();
    const timeoutMs = options?.timeoutMs ?? this.config.requestTimeoutMs;

    // 1. Classify
    const classification = this.classifier.classify(messages, options?.taskHint);

    // 2. Get quota + health
    const quotaStatus = this.quota.getQuotaStatus();
    const cloudHealth = this.health.getProviderHealth('cloud');
    const localHealth = this.health.getProviderHealth('local');

    // Override cloud health if cloud is disabled
    const effectiveCloudHealth = this.config.cloudEnabled
      ? cloudHealth
      : { ...cloudHealth, status: 'down' as const };

    // 3. Route
    const decision = this.router.decide(
      classification,
      quotaStatus,
      effectiveCloudHealth,
      localHealth,
    );
    // Stamp the real requestId
    (decision as any).requestId = requestId;

    // 4. Audit
    this.auditLog.append(decision);

    if (this.config.logLevel === 'debug') {
      console.debug(
        `[Gateway] ${requestId} | ${classification.taskType} (${classification.entropy}) → ${decision.selectedProvider} | quota: ${quotaStatus.exhausted ? 'exhausted' : 'ok'}`
      );
    }

    // 5. Execute with fallback chain
    const providerOrder = [decision.selectedProvider, ...decision.fallbackChain];
    const attemptLog: string[] = [];
    let providerStart = 0;
    let providerLatencyMs = 0;

    for (const provider of providerOrder) {
      const model = provider === 'cloud' ? this.config.zaiModel : this.config.ollamaModel;
      providerStart = Date.now();

      try {
        const response = await this.bifrost.chat(messages, provider, model, timeoutMs);
        providerLatencyMs = Date.now() - providerStart;

        // 6. On success: update quota, cache, metrics
        if (response.usage) {
          this.quota.consumeTokens(response.usage);
        }
        this.cache.store(classification.taskType, response);
        this.health.recordRequest(provider, providerLatencyMs, true);

        const totalLatencyMs = Date.now() - gatewayStart;
        this.recordMetrics(requestId, decision, provider, model, providerLatencyMs, totalLatencyMs, true);

        if (provider !== decision.selectedProvider) {
          console.warn(`[Gateway] ${requestId} fallback used: ${decision.selectedProvider} → ${provider}`);
        }

        return response;

      } catch (error) {
        providerLatencyMs = Date.now() - providerStart;
        const msg = (error as Error).message;
        attemptLog.push(`${provider}: ${msg}`);
        this.health.recordRequest(provider, providerLatencyMs, false);
        console.warn(`[Gateway] ${requestId} provider ${provider} failed: ${msg}`);
      }
    }

    // 7. Try cache as last resort
    const cached = this.cache.get(classification.taskType);
    if (cached) {
      console.warn(`[Gateway] ${requestId} using cached response for ${classification.taskType}`);
      const totalLatencyMs = Date.now() - gatewayStart;
      this.recordMetrics(requestId, decision, decision.selectedProvider, 'cache', 0, totalLatencyMs, true);
      return cached;
    }

    // 8. All failed — structured error response
    const totalLatencyMs = Date.now() - gatewayStart;
    this.recordMetrics(requestId, decision, decision.selectedProvider, 'none', 0, totalLatencyMs, false);
    return makeErrorResponse(requestId, attemptLog);
  }

  /** Get aggregate performance metrics */
  getMetrics(): GatewayMetricsSnapshot {
    return this.metrics.getSnapshot();
  }

  /** Get recent routing decisions for audit/debug */
  getRecentDecisions(limit: number): RoutingDecision[] {
    return this.auditLog.getRecent(limit);
  }

  private recordMetrics(
    requestId: string,
    decision: RoutingDecision,
    provider: string,
    model: string,
    providerLatencyMs: number,
    totalLatencyMs: number,
    success: boolean,
  ): void {
    const gatewayOverheadMs = totalLatencyMs - providerLatencyMs;
    const record: PerformanceRecord = {
      requestId,
      totalLatencyMs,
      providerLatencyMs,
      gatewayOverheadMs,
      provider: provider as any,
      model,
      taskType: decision.taskType,
      entropy: decision.entropy,
      success,
      timestamp: new Date(),
    };
    this.metrics.record(record);
  }
}

/** Factory function */
export function createANOTSGateway(config?: Partial<GatewayConfig>): ANOTSGateway {
  return new ANOTSGateway(config);
}
