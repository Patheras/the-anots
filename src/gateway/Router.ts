/**
 * Router
 *
 * Pure function routing logic. Given classification + quota + health,
 * returns a deterministic RoutingDecision. No side effects.
 *
 * Whitepaper: Section 3.2 (Routing Decision Matrix)
 * Requirements: 3.1–3.4, 4.4, 5.4
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ClassificationResult,
  QuotaStatus,
  ProviderHealth,
  RoutingDecision,
  ProviderId,
} from './types';
import { ModelSelector } from './ModelSelector';

export class Router {
  private readonly modelSelector: ModelSelector;
  private readonly localModel: string;
  private readonly cloudAltModel: string;

  constructor(
    modelSelector?: ModelSelector,
    localModel = 'qwen3.5:latest',
    cloudAltModel = 'anthropic/claude-3.5-sonnet'
  ) {
    this.modelSelector = modelSelector ?? new ModelSelector();
    this.localModel = localModel;
    this.cloudAltModel = cloudAltModel;
  }

  /**
   * Produce a deterministic RoutingDecision.
   *
   * Decision logic (3-provider system):
   * 1. If entropy=high AND cloud healthy AND quota not exhausted → cloud (Z.ai)
   * 2. If cloud unavailable/exhausted AND cloud-alt healthy → cloud-alt (OpenRouter)
   * 3. Otherwise (low entropy OR all cloud exhausted/down) → local (Ollama)
   * 4. Fallback chain: primary → cloud-alt → local → cache
   */
  decide(
    classification: ClassificationResult,
    quotaStatus: QuotaStatus,
    cloudHealth: ProviderHealth,
    cloudAltHealth: ProviderHealth,
    localHealth: ProviderHealth,
  ): RoutingDecision {
    const cloudAvailable = this.isAvailable(cloudHealth);
    const cloudAltAvailable = this.isAvailable(cloudAltHealth);
    const localAvailable = this.isAvailable(localHealth);

    // Determine preferred provider
    const preferCloud =
      classification.entropy === 'high' &&
      cloudAvailable &&
      !quotaStatus.exhausted;

    let selectedProvider: ProviderId;
    let model: string;
    let fallbackChain: ProviderId[];

    if (preferCloud) {
      // High-entropy task: prefer Z.ai cloud
      selectedProvider = 'cloud';
      model = this.modelSelector.selectModel(classification.taskType, classification.entropy);
      // Fallback: cloud-alt → local
      fallbackChain = [];
      if (cloudAltAvailable) fallbackChain.push('cloud-alt');
      if (localAvailable) fallbackChain.push('local');
    } else if (cloudAltAvailable) {
      // Cloud unavailable/exhausted but cloud-alt available
      selectedProvider = 'cloud-alt';
      model = this.cloudAltModel;
      // Fallback: local → cloud (if quota available)
      fallbackChain = [];
      if (localAvailable) fallbackChain.push('local');
      if (cloudAvailable && !quotaStatus.exhausted) fallbackChain.push('cloud');
    } else if (localAvailable) {
      // Low entropy or all cloud providers unavailable
      selectedProvider = 'local';
      model = this.localModel;
      // Fallback: cloud-alt → cloud (if quota available)
      fallbackChain = [];
      if (cloudAltAvailable) fallbackChain.push('cloud-alt');
      if (cloudAvailable && !quotaStatus.exhausted) fallbackChain.push('cloud');
    } else {
      // All providers unavailable - will use cache
      selectedProvider = 'local'; // nominal
      model = this.localModel;
      fallbackChain = [];
    }

    return {
      requestId: uuidv4(),
      taskType: classification.taskType,
      entropy: classification.entropy,
      selectedProvider,
      model,
      fallbackChain,
      quotaStatus,
      cloudHealthStatus: cloudHealth.status,
      localHealthStatus: localHealth.status,
      timestamp: new Date(),
    };
  }

  private isAvailable(health: ProviderHealth): boolean {
    return health.status === 'healthy';
  }
}
