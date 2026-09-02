import { ModelProfile } from './types.js';
import { ProviderConfig } from '../providers/types.js';
import { ReasoningManager } from './reasoningManager.js';

export class ModelDiscovery {
  public static async discover(provider: ProviderConfig, apiKey?: string): Promise<ModelProfile[]> {
    const headers: Record<string, string> = {
      'User-Agent': 'Codex-Model-Switcher/0.1.0',
      'Accept': 'application/json',
      ...(provider.headers || {})
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    let endpoint = provider.baseUrl.replace(/\/+$/, '');
    if (!endpoint.endsWith('/models') && !endpoint.endsWith('/v1/models')) {
      endpoint = `${endpoint}/models`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(endpoint, {
      method: 'GET',
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch models from ${endpoint}: HTTP ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    let rawList: any[] = [];
    if (Array.isArray(data)) {
      rawList = data;
    } else if (data && Array.isArray(data.data)) {
      rawList = data.data;
    } else if (data && Array.isArray(data.models)) {
      rawList = data.models;
    }

    return rawList.map((item, index) => this.normalizeModel(item, provider.id, index));
  }

  public static normalizeModel(raw: any, providerId: string, index: number): ModelProfile {
    const modelId = typeof raw === 'string' ? raw : (raw.id || raw.name || raw.slug || `model-${index}`);
    const displayName = raw.display_name || raw.displayName || raw.name || this.formatDisplayName(modelId);

    const reasoningInfo = ReasoningManager.inferReasoningCapabilities(modelId);
    const discoveredContext = raw.context_window || raw.contextWindow;
    const contextWindow = discoveredContext || this.guessContextWindow(modelId);

    return {
      id: `${providerId}:${modelId}`,
      providerId,
      modelId,
      displayName,
      description: raw.description || `${displayName} via ${providerId}`,
      contextWindow,
      contextWindowInfo: {
        value: contextWindow,
        source: discoveredContext ? 'discovered' : 'default',
        discoveredValue: contextWindow
      },
      maxContextWindow: contextWindow,
      effectiveContextWindowPercent: 95,
      reasoningInfo,
      defaultReasoningLevel: reasoningInfo.defaultLevel,
      supportedReasoningLevels: reasoningInfo.levels,
      inputModalities: ['text', 'image'],
      supportsSearchTool: true,
      supportsApplyPatch: true,
      applyPatchToolType: 'freeform',
      shellType: 'unified_exec',
      toolMode: 'native',
      priority: index + 1,
      visibility: 'list',
      enabled: true,
      healthStatus: 'available'
    };
  }

  private static formatDisplayName(modelId: string): string {
    const parts = modelId.split('/');
    const clean = parts[parts.length - 1];
    return clean
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private static guessContextWindow(modelId: string): number {
    const lower = modelId.toLowerCase();
    if (lower.includes('kimi') || lower.includes('moonshot')) return 256000;
    if (lower.includes('grok')) return 128000;
    if (lower.includes('claude')) return 200000;
    if (lower.includes('deepseek')) return 128000;
    if (lower.includes('qwen')) return 128000;
    if (lower.includes('gpt-5.6')) return 272000;
    if (lower.includes('gpt-4o') || lower.includes('gpt-4.5') || lower.includes('gpt-5')) return 128000;
    if (lower.includes('gemini')) return 1000000;
    return 128000;
  }
}
