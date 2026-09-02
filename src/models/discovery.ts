import { ModelProfile } from './types.js';
import { ProviderConfig } from '../providers/types.js';
import { ReasoningManager } from './reasoningManager.js';

export class ModelDiscovery {
  public static async discover(provider: ProviderConfig, apiKey?: string): Promise<ModelProfile[]> {
    const headers: Record<string, string> = {
      'User-Agent': 'Codex-Model-Switcher/0.2.5',
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

    const data = (await response.json()) as any;
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

    // 1. 多字段容错提取接口真实上下文容量
    const discoveredContext = this.extractDiscoveredContext(raw);

    // 2. 结合名称后缀正则与权威数据库精准解析
    const resolvedContext = discoveredContext
      ? { value: discoveredContext, source: 'discovered' as const }
      : this.resolvePreciseContext(modelId);

    return {
      id: `${providerId}:${modelId}`,
      providerId,
      modelId,
      displayName,
      description: raw.description || `${displayName} via ${providerId}`,
      contextWindow: resolvedContext.value,
      contextWindowInfo: {
        value: resolvedContext.value,
        source: resolvedContext.source,
        discoveredValue: discoveredContext || resolvedContext.value
      },
      maxContextWindow: resolvedContext.value,
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

  /**
   * 兼容主流中转站与网关返回的各类上下文窗口字段
   */
  private static extractDiscoveredContext(raw: any): number | undefined {
    if (typeof raw !== 'object' || raw === null) return undefined;

    const candidates = [
      raw.context_window,
      raw.contextWindow,
      raw.context_length,
      raw.contextLength,
      raw.max_tokens,
      raw.maxTokens,
      raw.max_model_len,
      raw.max_input_tokens,
      raw.max_position_embeddings,
      raw.architecture?.context_window,
      raw.top_provider?.context_length,
      raw.pricing?.context_length
    ];

    for (const val of candidates) {
      if (typeof val === 'number' && val >= 1024) {
        return val;
      }
      if (typeof val === 'string') {
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed) && parsed >= 1024) {
          return parsed;
        }
      }
    }

    return undefined;
  }

  /**
   * 高精度上下文容量推导引擎：
   * 优先匹配模型名称中的显式容量后缀（如 -1m, -200k, -32k），
   * 其次匹配全球权威开源与闭源大模型精确规格指纹库。
   */
  public static resolvePreciseContext(modelId: string): { value: number; source: 'pattern' | 'knowledge_base' | 'default' } {
    const lower = modelId.toLowerCase();

    // 1. 匹配模型名称中的显式容量后缀 (例如: moonshot-v1-32k, qwen-1m, glm-4-long-1m)
    const suffixMatch = lower.match(/(?:^|[-_.:/])(\d+)(k|m)(?:$|[-_.:/])/);
    if (suffixMatch) {
      const num = parseInt(suffixMatch[1], 10);
      const unit = suffixMatch[2].toLowerCase();
      if (!isNaN(num) && num > 0) {
        const tokens = unit === 'm' ? num * 1000000 : num * 1000;
        return { value: tokens, source: 'pattern' };
      }
    }

    // 2. 匹配权威大模型精确规格指纹库
    // Google Gemini 家族
    if (lower.includes('gemini-1.5') || lower.includes('gemini-2.0') || lower.includes('gemini-2.5') || lower.includes('gemini-exp')) {
      if (lower.includes('pro')) return { value: 2000000, source: 'knowledge_base' }; // 2M tokens
      return { value: 1000000, source: 'knowledge_base' }; // 1M tokens
    }
    if (lower.includes('gemini-1.0')) {
      return { value: 32768, source: 'knowledge_base' };
    }

    // Anthropic Claude 家族 (全面 200K)
    if (lower.includes('claude-3') || lower.includes('claude-2.1') || lower.includes('sonnet') || lower.includes('opus') || lower.includes('haiku')) {
      return { value: 200000, source: 'knowledge_base' }; // 200K tokens
    }
    if (lower.includes('claude-2.0') || lower.includes('claude-instant')) {
      return { value: 100000, source: 'knowledge_base' }; // 100K tokens
    }

    // OpenAI o1 / o3 深度推理家族 (全面 200K)
    if (lower.includes('o1') || lower.includes('o3') || lower.includes('gpt-5.6-sol') || lower.includes('gpt-5.6')) {
      return { value: 200000, source: 'knowledge_base' }; // 200K tokens
    }

    // OpenAI GPT-4 / 4o 家族
    if (lower.includes('gpt-4o') || lower.includes('gpt-4-turbo') || lower.includes('chatgpt-4o') || lower.includes('gpt-4.5')) {
      return { value: 128000, source: 'knowledge_base' }; // 128K tokens
    }
    if (lower.includes('gpt-4-32k')) {
      return { value: 32768, source: 'knowledge_base' };
    }
    if (lower.includes('gpt-4')) {
      return { value: 8192, source: 'knowledge_base' };
    }
    if (lower.includes('gpt-3.5-turbo-16k')) {
      return { value: 16384, source: 'knowledge_base' };
    }
    if (lower.includes('gpt-3.5')) {
      return { value: 4096, source: 'knowledge_base' };
    }

    // Moonshot / Kimi 家族
    if (lower.includes('kimi-k1.5') || lower.includes('kimi-latest')) {
      return { value: 256000, source: 'knowledge_base' }; // 256K tokens
    }
    if (lower.includes('moonshot') || lower.includes('kimi')) {
      return { value: 128000, source: 'knowledge_base' };
    }

    // 智谱 GLM 家族
    if (lower.includes('glm-4-long') || lower.includes('glm-4long')) {
      return { value: 1000000, source: 'knowledge_base' }; // 1M tokens
    }
    if (lower.includes('glm-4')) {
      return { value: 128000, source: 'knowledge_base' };
    }

    // 阿里通义千问 Qwen 家族
    if (lower.includes('qwen-long') || lower.includes('qwen2.5-long')) {
      return { value: 1000000, source: 'knowledge_base' }; // 1M tokens
    }
    if (lower.includes('qwen-2.5') || lower.includes('qwen2.5')) {
      return { value: 128000, source: 'knowledge_base' };
    }
    if (lower.includes('qwen-plus') || lower.includes('qwen-max') || lower.includes('qwen-turbo')) {
      return { value: 32768, source: 'knowledge_base' };
    }

    // Meta Llama 家族
    if (lower.includes('llama-3.1') || lower.includes('llama-3.2') || lower.includes('llama-3.3')) {
      return { value: 128000, source: 'knowledge_base' };
    }
    if (lower.includes('llama-3')) {
      return { value: 8192, source: 'knowledge_base' };
    }
    if (lower.includes('llama-2')) {
      return { value: 4096, source: 'knowledge_base' };
    }

    // Mistral 家族
    if (lower.includes('mistral-large') || lower.includes('mistral-small') || lower.includes('mistral-nemo')) {
      return { value: 128000, source: 'knowledge_base' };
    }
    if (lower.includes('codestral') || lower.includes('mixtral-8x7b')) {
      return { value: 32768, source: 'knowledge_base' };
    }
    if (lower.includes('mixtral-8x22b')) {
      return { value: 65536, source: 'knowledge_base' };
    }

    // DeepSeek 家族 (标准上下文 64K / 128K)
    if (lower.includes('deepseek')) {
      return { value: 128000, source: 'knowledge_base' };
    }

    // xAI Grok 家族
    if (lower.includes('grok')) {
      return { value: 128000, source: 'knowledge_base' };
    }

    // 兜底通用安全值
    return { value: 128000, source: 'default' };
  }

  private static formatDisplayName(modelId: string): string {
    const parts = modelId.split('/');
    const clean = parts[parts.length - 1];
    return clean
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
