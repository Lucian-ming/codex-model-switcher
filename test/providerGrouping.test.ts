import { describe, it, expect } from 'vitest';
import { ModelDiscovery } from '../src/models/discovery.js';
import { ProviderConfig } from '../src/providers/types.js';

describe('Provider Grouping & Same Model ID Isolation', () => {
  it('should isolate same-name models across different providers with composite IDs', () => {
    const rawModelA = { id: 'gpt-5.5', name: 'GPT-5.5 (Provider A)', context_window: 128000 };
    const rawModelB = { id: 'gpt-5.5', name: 'GPT-5.5 (Provider B)', context_window: 256000 };

    const normA = ModelDiscovery.normalizeModel(rawModelA, 'PinAI_A', 0);
    const normB = ModelDiscovery.normalizeModel(rawModelB, 'PinAI_B', 0);

    // Both retain identical modelId for upstream requests
    expect(normA.modelId).toBe('gpt-5.5');
    expect(normB.modelId).toBe('gpt-5.5');

    // But have strictly distinct composite IDs to prevent collision in UI and registries
    expect(normA.id).toBe('PinAI_A:gpt-5.5');
    expect(normB.id).toBe('PinAI_B:gpt-5.5');
    expect(normA.id).not.toBe(normB.id);

    // Context windows and providers are isolated
    expect(normA.providerId).toBe('PinAI_A');
    expect(normB.providerId).toBe('PinAI_B');
    expect(normA.contextWindow).toBe(128000);
    expect(normB.contextWindow).toBe(256000);
  });
});
