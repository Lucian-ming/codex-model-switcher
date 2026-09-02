import { ProviderConfig } from './types.js';

export const BUILTIN_PROVIDERS: ProviderConfig[] = [
  {
    id: 'OpenAI',
    name: 'OpenAI Official',
    baseUrl: 'https://api.openai.com/v1',
    protocol: 'responses',
    requiresOpenaiAuth: true,
    builtin: true,
    models: [
      {
        id: 'openai-gpt-5.6-sol',
        providerId: 'OpenAI',
        modelId: 'gpt-5.6-sol',
        displayName: 'GPT-5.6-Sol',
        description: 'OpenAI GPT-5.6 Sol reasoning model',
        contextWindow: 200000,
        defaultReasoningLevel: 'medium',
        supportedReasoningLevels: [
          { effort: 'low', description: 'Fast responses with lighter reasoning' },
          { effort: 'medium', description: 'Balanced speed and reasoning depth' },
          { effort: 'high', description: 'Greater reasoning depth' },
          { effort: 'max', description: 'Maximum reasoning depth' }
        ],
        supportsSearchTool: true,
        priority: 1,
        visibility: 'list',
        enabled: true
      },
      {
        id: 'openai-gpt-5.5',
        providerId: 'OpenAI',
        modelId: 'gpt-5.5',
        displayName: 'GPT-5.5',
        description: 'OpenAI GPT-5.5 balanced model',
        contextWindow: 128000,
        priority: 2,
        visibility: 'list',
        enabled: true
      }
    ]
  },
  {
    id: 'OpenRouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    protocol: 'responses',
    requiresOpenaiAuth: false,
    envKey: 'OPENROUTER_API_KEY',
    builtin: true,
    models: [
      {
        id: 'openrouter-anthropic-claude-3-7-sonnet',
        providerId: 'OpenRouter',
        modelId: 'anthropic/claude-3.7-sonnet',
        displayName: 'Claude 3.7 Sonnet (OpenRouter)',
        description: 'Anthropic Claude 3.7 Sonnet hybrid reasoning model',
        contextWindow: 200000,
        defaultReasoningLevel: 'medium',
        supportedReasoningLevels: [
          { effort: 'low', description: 'Light reasoning' },
          { effort: 'medium', description: 'Standard thinking' },
          { effort: 'high', description: 'Deep thinking' }
        ],
        supportsSearchTool: true,
        priority: 1,
        visibility: 'list',
        enabled: true
      },
      {
        id: 'openrouter-deepseek-r1',
        providerId: 'OpenRouter',
        modelId: 'deepseek/deepseek-r1',
        displayName: 'DeepSeek R1 (OpenRouter)',
        description: 'DeepSeek R1 full reasoning model',
        contextWindow: 128000,
        priority: 2,
        visibility: 'list',
        enabled: true
      }
    ]
  },
  {
    id: 'DeepSeek',
    name: 'DeepSeek Official',
    baseUrl: 'https://api.deepseek.com/v1',
    protocol: 'responses',
    requiresOpenaiAuth: false,
    envKey: 'DEEPSEEK_API_KEY',
    builtin: true,
    models: [
      {
        id: 'deepseek-reasoner',
        providerId: 'DeepSeek',
        modelId: 'deepseek-reasoner',
        displayName: 'DeepSeek R1 Reasoner',
        description: 'DeepSeek R1 Open Reasoning Model',
        contextWindow: 128000,
        defaultReasoningLevel: 'medium',
        priority: 1,
        visibility: 'list',
        enabled: true
      },
      {
        id: 'deepseek-chat',
        providerId: 'DeepSeek',
        modelId: 'deepseek-chat',
        displayName: 'DeepSeek V3 Chat',
        description: 'DeepSeek V3 general intelligence model',
        contextWindow: 128000,
        priority: 2,
        visibility: 'list',
        enabled: true
      }
    ]
  },
  {
    id: 'MoonshotKimi',
    name: 'Moonshot / Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    protocol: 'responses',
    requiresOpenaiAuth: false,
    envKey: 'MOONSHOT_API_KEY',
    builtin: true,
    models: [
      {
        id: 'kimi-k2.5',
        providerId: 'MoonshotKimi',
        modelId: 'kimi-k2.5',
        displayName: 'Kimi K2.5',
        description: 'Moonshot Kimi K2.5 large context model',
        contextWindow: 256000,
        priority: 1,
        visibility: 'list',
        enabled: true
      }
    ]
  },
  {
    id: 'SiliconFlow',
    name: 'SiliconFlow (硅基流动)',
    baseUrl: 'https://api.siliconflow.cn/v1',
    protocol: 'responses',
    requiresOpenaiAuth: false,
    envKey: 'SILICONFLOW_API_KEY',
    builtin: true,
    models: [
      {
        id: 'sf-deepseek-r1',
        providerId: 'SiliconFlow',
        modelId: 'deepseek-ai/DeepSeek-R1',
        displayName: 'DeepSeek R1 (SiliconFlow)',
        description: 'DeepSeek R1 hosted on SiliconFlow cloud',
        contextWindow: 128000,
        priority: 1,
        visibility: 'list',
        enabled: true
      },
      {
        id: 'sf-qwen-2.5-coder-32b',
        providerId: 'SiliconFlow',
        modelId: 'Qwen/Qwen2.5-Coder-32B-Instruct',
        displayName: 'Qwen 2.5 Coder 32B (SiliconFlow)',
        description: 'Alibaba Qwen 2.5 Coder',
        contextWindow: 128000,
        priority: 2,
        visibility: 'list',
        enabled: true
      }
    ]
  },
  {
    id: 'Ollama',
    name: 'Ollama Local',
    baseUrl: 'http://localhost:11434/v1',
    protocol: 'responses',
    requiresOpenaiAuth: false,
    builtin: true,
    models: [
      {
        id: 'ollama-qwen2.5-coder',
        providerId: 'Ollama',
        modelId: 'qwen2.5-coder:latest',
        displayName: 'Qwen 2.5 Coder (Ollama)',
        description: 'Local Ollama Qwen 2.5 Coder',
        contextWindow: 32768,
        priority: 1,
        visibility: 'list',
        enabled: true
      }
    ]
  }
];
