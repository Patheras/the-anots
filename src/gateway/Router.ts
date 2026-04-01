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

  constructor(modelSelector?: ModelSelector, localModel = 'qwen3.5:latest') {
    this.modelSelector = modelSelector ?? new ModelSelector();
    this.localModel = localModel;
  }

  /**
   * Produce a deterministic RoutingDecision.
   *
   * Decision logic:
   * 1. If entropy=high AND cloud healthy AND quota not exhausted → cloud
   * 2. Otherwise (low entropy OR quota exhausted OR cloud degraded) → local
   * 3. If primary is degraded/down → swap to next in fallback chain
   * 4. If both degraded → fallback chain contains only 'cache' sentinel
   */
  decide(
    classification: ClassificationResult,
    quotaStatus: QuotaStatus,
    cloudHealth: ProviderHealth,
    localHealth: ProviderHealth,
  ): RoutingDecision {
    const cloudAvailable = this.isAvailable(cloudHealth);
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
      selectedProvider = 'cloud';
      // Use ModelSelector to choose appropriate cloud model based on task
      model = this.modelSelector.selectModel(classification.taskType, classification.entropy);
      fallbackChain = localAvailable ? ['local'] : [];
    } else {
      // Low entropy, quota exhausted, or cloud unavailable
      if (localAvailable) {
        selectedProvider = 'local';
        model = this.localModel;
        // Cloud as fallback only if available and quota not exhausted
        fallbackChain = cloudAvailable && !quotaStatus.exhausted ? ['cloud'] : [];
      } else if (cloudAvailable && !quotaStatus.exhausted) {
        // Local down, fall back to cloud even for low-entropy
        selectedProvider = 'cloud';
        // Use appropriate model tier for the task
        model = this.modelSelector.selectModel(classification.taskType, classification.entropy);
        fallbackChain = [];
      } else {
        // Both unavailable - no live provider, cache only
        selectedProvider = 'local'; // nominal, will fail and use cache
        model = this.localModel;
        fallbackChain = [];
      }
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
