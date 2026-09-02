export interface CodexProviderTableConfig {
  name: string;
  base_url?: string;
  wire_api?: 'responses' | 'chat' | 'anthropic' | string;
  requires_openai_auth?: boolean;
  env_key?: string;
  http_headers?: Record<string, string>;
  query_params?: Record<string, string>;
  stream_max_retries?: number;
  stream_idle_timeout_ms?: number;
  supports_websockets?: boolean;
  experimental_bearer_token?: string;
  [key: string]: unknown;
}

export interface CodexConfig {
  model_provider?: string;
  model?: string;
  review_model?: string;
  model_reasoning_effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'ultra' | string;
  model_catalog_json?: string;
  personality?: string;
  approvals_reviewer?: string;
  model_providers?: Record<string, CodexProviderTableConfig>;
  features?: Record<string, boolean>;
  projects?: Record<string, { trust_level?: string }>;
  [key: string]: unknown;
}
