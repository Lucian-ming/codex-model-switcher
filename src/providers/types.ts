import { ModelProfile } from '../models/types.js';

export type ApiProtocol = 'responses' | 'chat' | 'anthropic' | 'custom';

export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  protocol: ApiProtocol;
  requiresOpenaiAuth?: boolean;
  envKey?: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  models: ModelProfile[];
  builtin?: boolean;
  lastTestedAt?: string;
  latencyMs?: number;
  healthStatus?: 'healthy' | 'unhealthy' | 'untested';
}

export interface ProviderHealth {
  reachable: boolean;
  latencyMs: number;
  authValid: boolean;
  modelCount: number;
  message: string;
  error?: string;
}

export interface ProviderAdapter {
  readonly id: string;
  readonly name: string;
  getModels(apiKey?: string): Promise<ModelProfile[]>;
  validate(apiKey?: string): Promise<ProviderHealth>;
  toCodexProviderConfig(): Record<string, unknown>;
}
