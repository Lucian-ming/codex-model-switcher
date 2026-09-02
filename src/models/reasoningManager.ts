import { ModelProfile, ReasoningLevelOption, ModelReasoningInfo } from './types.js';

export interface ReasoningFallbackResult {
  effort: string;
  didFallback: boolean;
  previousEffort?: string;
  reason?: string;
}

export class ReasoningManager {
  /**
   * Infers reasoning capabilities for a given model ID / slug.
   */
  public static inferReasoningCapabilities(modelId: string): ModelReasoningInfo {
    const slug = modelId.toLowerCase();

    // Models supporting ultra / max reasoning tiers (GPT-5.6 family, Daybreak)
    if (slug.includes('gpt-5.6') || slug.includes('daybreak')) {
      const levels: ReasoningLevelOption[] = [
        { effort: 'low', description: 'Fast responses with lighter reasoning' },
        { effort: 'medium', description: 'Balances speed and reasoning depth for everyday tasks' },
        { effort: 'high', description: 'Greater reasoning depth for complex problems' },
        { effort: 'xhigh', description: 'Extra high reasoning depth for complex problems' },
        { effort: 'max', description: 'Maximum reasoning depth for the hardest problems' },
        { effort: 'ultra', description: 'Maximum reasoning with automatic task delegation' }
      ];
      return {
        supported: true,
        levels,
        defaultLevel: 'high'
      };
    }

    // Models supporting up to xhigh (GPT-5.5, GPT-5.4, GPT-5.2)
    if (slug.includes('gpt-5.5') || slug.includes('gpt-5.4') || slug.includes('gpt-5.2')) {
      const levels: ReasoningLevelOption[] = [
        { effort: 'none', description: 'Direct responses without extended reasoning chain' },
        { effort: 'low', description: 'Fast responses with lighter reasoning' },
        { effort: 'medium', description: 'Balances speed and reasoning depth' },
        { effort: 'high', description: 'Greater reasoning depth for complex problems' },
        { effort: 'xhigh', description: 'Extra high reasoning depth for complex problems' }
      ];
      return {
        supported: true,
        levels,
        defaultLevel: 'medium'
      };
    }

    // Models supporting up to max (Grok 4.6, DeepSeek R1 / Reasoner, o3, o1)
    if (slug.includes('grok') || slug.includes('deepseek-r') || slug.includes('reasoner') || slug.includes('o3') || slug.includes('o1')) {
      const levels: ReasoningLevelOption[] = [
        { effort: 'low', description: 'Fast reasoning' },
        { effort: 'medium', description: 'Balanced reasoning depth' },
        { effort: 'high', description: 'Deep reasoning' },
        { effort: 'max', description: 'Maximum reasoning depth' }
      ];
      return {
        supported: true,
        levels,
        defaultLevel: 'medium'
      };
    }

    // Non-reasoning standard models (GPT-4o, Claude 3.5, general completion models)
    if (slug.includes('gpt-4') || slug.includes('claude') || slug.includes('image') || slug.includes('mini')) {
      return {
        supported: false,
        levels: [],
        defaultLevel: 'none'
      };
    }

    // Generic fallback for custom / unknown reasoning models
    const defaultLevels: ReasoningLevelOption[] = [
      { effort: 'low', description: 'Lighter reasoning' },
      { effort: 'medium', description: 'Balanced reasoning' },
      { effort: 'high', description: 'Deep reasoning' }
    ];
    return {
      supported: true,
      levels: defaultLevels,
      defaultLevel: 'medium'
    };
  }

  /**
   * Enriches a model profile with reasoning metadata.
   */
  public static enrichModel(model: ModelProfile): ModelProfile {
    const info = model.reasoningInfo || this.inferReasoningCapabilities(model.modelId);
    return {
      ...model,
      reasoningInfo: info,
      supportedReasoningLevels: info.levels,
      defaultReasoningLevel: (model.defaultReasoningLevel as any) || info.defaultLevel
    };
  }

  /**
   * Checks if an effort level is supported by a model.
   */
  public static isEffortSupported(model: ModelProfile, effort: string): boolean {
    const info = model.reasoningInfo || this.inferReasoningCapabilities(model.modelId);
    if (!info.supported) {
      return effort === 'none' || effort === '';
    }
    return info.levels.some(l => l.effort.toLowerCase() === effort.toLowerCase());
  }

  /**
   * Adapts reasoning effort when switching between models.
   * If the target model does not support the current effort, automatically falls back to target model's default effort.
   */
  public static adaptEffortOnSwitch(
    currentEffort: string,
    targetModel: ModelProfile
  ): ReasoningFallbackResult {
    const info = targetModel.reasoningInfo || this.inferReasoningCapabilities(targetModel.modelId);

    // If target model does not support reasoning
    if (!info.supported) {
      if (currentEffort && currentEffort !== 'none') {
        return {
          effort: 'none',
          didFallback: true,
          previousEffort: currentEffort,
          reason: `${targetModel.displayName} does not support reasoning effort. Adjusted to 'none'.`
        };
      }
      return { effort: 'none', didFallback: false };
    }

    // If current effort is supported by target model, preserve it
    if (this.isEffortSupported(targetModel, currentEffort)) {
      return { effort: currentEffort, didFallback: false };
    }

    // Otherwise, fallback to target model's default
    const fallback = info.defaultLevel || 'medium';
    return {
      effort: fallback,
      didFallback: true,
      previousEffort: currentEffort,
      reason: `${targetModel.displayName} does not support '${currentEffort}'. Reasoning effort changed to '${fallback}'.`
    };
  }
}
