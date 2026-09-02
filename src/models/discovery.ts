import { ModelProfile, ReasoningLevelOption } from './types.js';
import { ProviderConfig } from '../providers/types.js';

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

    const isReasoning = this.isReasoningModel(modelId);
    const contextWindow = raw.context_window || raw.contextWindow || this.guessContextWindow(modelId);

    let supportedReasoningLevels: ReasoningLevelOption[] | undefined;
    let defaultReasoningLevel: 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'ultra' | undefined;

    if (isReasoning) {
      supportedReasoningLevels = [
        { effort: 'low', description: 'Fast responses with lighter reasoning' },
        { effort: 'medium', description: 'Balanced speed and reasoning depth' },
        { effort: 'high', description: 'Greater reasoning depth' },
        { effort: 'max', description: 'Maximum reasoning depth' }
      ];
      defaultReasoningLevel = 'medium';
    }

    return {
      id: `${providerId.toLowerCase()}-${modelId.replace(/[^a-zA-Z0-9_\-\.]/g, '-')}`,
      providerId,
      modelId,
      displayName,
      description: raw.description || `${displayName} via ${providerId}`,
      contextWindow,
      maxContextWindow: contextWindow,
      effectiveContextWindowPercent: 95,
      defaultReasoningLevel,
      supportedReasoningLevels,
      inputModalities: ['text', 'image'],
      supportsSearchTool: true,
      supportsApplyPatch: true,
      applyPatchToolType: 'freeform',
      shellType: 'unified_exec',
      toolMode: 'native',
      priority: index + 1,
      visibility: 'list',
      enabled: true
    };
  }

  private static formatDisplayName(modelId: string): string {
    // Convert 'anthropic/claude-3-7-sonnet' -> 'Claude 3.7 Sonnet'
    const parts = modelId.split('/');
    const clean = parts[parts.length - 1];
    return clean
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private static isReasoningModel(modelId: string): boolean {
    const lower = modelId.toLowerCase();
    return (
      lower.includes('reasoner') ||
      lower.includes('r1') ||
      lower.includes('o1') ||
      lower.includes('o3') ||
      lower.includes('o4') ||
      lower.includes('thinking') ||
      lower.includes('gpt-5.6') ||
      lower.includes('sonnet-3-7') ||
      lower.includes('sonnet-3.7')
    );
  }

  private static guessContextWindow(modelId: string): number {
    const lower = modelId.toLowerCase();
    if (lower.includes('kimi') || lower.includes('moonshot')) return 256000;
    if (lower.includes('claude')) return 200000;
    if (lower.includes('deepseek')) return 128000;
    if (lower.includes('qwen')) return 128000;
    if (lower.includes('gpt-4o') || lower.includes('gpt-4.5') || lower.includes('gpt-5')) return 128000;
    if (lower.includes('gemini')) return 1000000;
    return 128000;
  }
}
