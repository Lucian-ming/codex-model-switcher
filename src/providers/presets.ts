import { ProviderConfig } from './types.js';

/**
 * 官方预置支持的主流中转站与网关配置模板。
 */
export const BUILTIN_PROVIDERS: ProviderConfig[] = [
  {
    id: 'orcarouter',
    name: 'OrcaRouter',
    baseUrl: 'https://api.orcarouter.ai/v1',
    protocol: 'chat',
    description: 'OpenAI-compatible unified model routing gateway',
    website: 'https://www.orcarouter.ai/ref/ref_b779bf29c6f860b78f52',
    builtin: true,
    enabled: true,
    models: []
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    protocol: 'chat',
    description: 'Unified interface for LLMs and cognitive APIs',
    website: 'https://openrouter.ai',
    builtin: true,
    enabled: true,
    models: []
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    protocol: 'chat',
    description: 'DeepSeek Official API (V3 & R1)',
    website: 'https://deepseek.com',
    builtin: true,
    enabled: true,
    models: []
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    protocol: 'chat',
    description: 'SiliconFlow Model Platform',
    website: 'https://siliconflow.cn',
    builtin: true,
    enabled: true,
    models: []
  }
];
