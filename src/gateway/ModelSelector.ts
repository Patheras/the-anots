/**
 * ModelSelector
 *
 * Selects the appropriate Z.ai model based on task entropy and complexity.
 * Implements intelligent model tiering to optimize quota usage.
 *
 * Model Tiers (Z.ai GLM Coding Plan):
 * - Opus-tier (3x quota): GLM-5.1, GLM-5, GLM-5-Turbo - Complex reasoning, large-scale engineering
 * - Sonnet-tier (1x quota): GLM-4.7 - Daily development, routine tasks
 * - Haiku-tier (<1x quota): GLM-4.5-Air - Simple, deterministic tasks
 *
 * Strategy:
 * - High-entropy tasks → Opus-tier (GLM-5.1)
 * - Low-entropy tasks → Sonnet-tier (GLM-4.7)
 * - Simple deterministic tasks → Haiku-tier (GLM-4.5-Air) [optional]
 */

import { EntropyLevel, TaskType } from './types';

export type ModelTier = 'opus' | 'sonnet' | 'haiku';

export interface ModelTierConfig {
  opus: string;    // High-complexity model (e.g., glm-5.1)
  sonnet: string;  // Medium-complexity model (e.g., glm-4.7)
  haiku: string;   // Low-complexity model (e.g., glm-4.5-air)
}

/**
 * Tasks that benefit from Opus-tier models (complex reasoning)
 */
const OPUS_TIER_TASKS: TaskType[] = [
  'philosophical-dialogue',
  'mcp-orchestration',
  'research-synthesis',
];

/**
 * Tasks that can use Haiku-tier models (simple, deterministic)
 */
const HAIKU_TIER_TASKS: TaskType[] = [
  'chronicle-writing',
  'testing-validation',
];

export class ModelSelector {
  private readonly config: ModelTierConfig;
  private readonly enableHaikuTier: boolean;

  constructor(config?: Partial<ModelTierConfig>, enableHaikuTier = false) {
    this.config = {
      opus: config?.opus ?? 'glm-5.1',
      sonnet: config?.sonnet ?? 'glm-4.7',
      haiku: config?.haiku ?? 'glm-4.5-air',
    };
    this.enableHaikuTier = enableHaikuTier;
  }

  /**
   * Select the appropriate model based on task type and entropy
   */
  selectModel(taskType: TaskType, entropy: EntropyLevel): string {
    // High-entropy tasks always use Opus-tier
    if (entropy === 'high' || OPUS_TIER_TASKS.includes(taskType)) {
      return this.config.opus;
    }

    // Simple deterministic tasks can use Haiku-tier (if enabled)
    if (this.enableHaikuTier && HAIKU_TIER_TASKS.includes(taskType)) {
      return this.config.haiku;
    }

    // Default to Sonnet-tier for most tasks
    return this.config.sonnet;
  }

  /**
   * Get the tier for a given model
   */
  getTier(model: string): ModelTier {
    if (model === this.config.opus) return 'opus';
    if (model === this.config.haiku) return 'haiku';
    return 'sonnet';
  }

  /**
   * Get quota multiplier for a model (relative to Sonnet baseline)
   */
  getQuotaMultiplier(model: string): number {
    const tier = this.getTier(model);
    switch (tier) {
      case 'opus':
        return 3.0; // 3x quota consumption (peak hours)
      case 'haiku':
        return 0.5; // ~0.5x quota consumption
      case 'sonnet':
      default:
        return 1.0; // 1x quota consumption (baseline)
    }
  }

  /**
   * Get all available models
   */
  getAvailableModels(): ModelTierConfig {
    return { ...this.config };
  }
}
