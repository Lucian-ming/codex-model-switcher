import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ProviderConfig } from './types.js';
import { BUILTIN_PROVIDERS } from './presets.js';
import { CodexConfigManager } from '../codex/configManager.js';

export class ProviderRegistry {
  private providers: Map<string, ProviderConfig> = new Map();
  private storageFilePath: string;
  private configManager: CodexConfigManager;

  constructor(configManager: CodexConfigManager, customStoragePath?: string) {
    this.configManager = configManager;
    this.storageFilePath = customStoragePath || path.join(os.homedir(), '.codex-model-switcher', 'providers.json');
    this.init();
  }

  private init(): void {
    // 1. Load built-ins (if any)
    for (const p of BUILTIN_PROVIDERS) {
      this.providers.set(p.id, { ...p });
    }

    // 2. Load stored custom providers
    if (fs.existsSync(this.storageFilePath)) {
      try {
        const custom: ProviderConfig[] = JSON.parse(fs.readFileSync(this.storageFilePath, 'utf8'));
        for (const p of custom) {
          this.providers.set(p.id, p);
        }
      } catch (err) {
        console.error('Failed to load custom providers:', err);
      }
    }

    // 3. Auto-discover existing providers in ~/.codex/config.toml (e.g. PinAI)
    try {
      const existingTables = this.configManager.getProviders();
      for (const [id, table] of Object.entries(existingTables)) {
        if (!this.providers.has(id)) {
          this.providers.set(id, {
            id,
            name: table.name || id,
            baseUrl: table.base_url || '',
            protocol: (table.wire_api as any) || 'responses',
            requiresOpenaiAuth: table.requires_openai_auth,
            envKey: table.env_key,
            headers: table.http_headers,
            models: []
          });
        }
      }
    } catch {}
  }

  public list(): ProviderConfig[] {
    return Array.from(this.providers.values());
  }

  public get(id: string): ProviderConfig | undefined {
    return this.providers.get(id);
  }

  public register(provider: ProviderConfig): void {
    this.providers.set(provider.id, provider);
    this.saveCustomProviders();

    // Sync provider table into config.toml
    this.configManager.upsertProvider(provider.id, {
      name: provider.name,
      base_url: provider.baseUrl,
      wire_api: provider.protocol,
      requires_openai_auth: provider.requiresOpenaiAuth,
      env_key: provider.envKey,
      http_headers: provider.headers,
      query_params: provider.queryParams
    });
  }

  public updateProviderInfo(id: string, updates: Partial<ProviderConfig>): void {
    const existing = this.providers.get(id);
    if (!existing) return;

    const updated: ProviderConfig = {
      ...existing,
      ...updates
    };
    this.providers.set(id, updated);
    this.saveCustomProviders();

    this.configManager.upsertProvider(id, {
      name: updated.name,
      base_url: updated.baseUrl,
      wire_api: updated.protocol,
      requires_openai_auth: updated.requiresOpenaiAuth,
      env_key: updated.envKey,
      http_headers: updated.headers,
      query_params: updated.queryParams
    });
  }

  public unregister(id: string): void {
    const existing = this.providers.get(id);
    if (existing) {
      this.providers.delete(id);
      this.saveCustomProviders();
      this.configManager.removeProvider(id);
    }
  }

  public updateModels(providerId: string, models: any[]): void {
    const p = this.providers.get(providerId);
    if (p) {
      p.models = models;
      this.saveCustomProviders();
    }
  }

  public updateHealth(providerId: string, latencyMs: number, healthy: boolean): void {
    const p = this.providers.get(providerId);
    if (p) {
      p.latencyMs = latencyMs;
      p.healthStatus = healthy ? 'healthy' : 'unhealthy';
      p.lastTestedAt = new Date().toISOString();
      this.saveCustomProviders();
    }
  }

  public toggleProviderEnabled(id: string): boolean {
    const p = this.providers.get(id);
    if (!p) return false;
    p.enabled = !(p.enabled !== false);
    this.saveCustomProviders();
    return p.enabled;
  }

  public toggleModelEnabled(providerId: string, modelId: string): boolean {
    const p = this.providers.get(providerId);
    if (!p || !p.models) return false;
    const m = p.models.find(item => item.modelId === modelId);
    if (!m) return false;
    m.enabled = !(m.enabled !== false);
    this.saveCustomProviders();
    return m.enabled;
  }

  private saveCustomProviders(): void {
    try {
      const dir = path.dirname(this.storageFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      }
      const custom = Array.from(this.providers.values()).filter(p => !p.builtin);
      fs.writeFileSync(this.storageFilePath, JSON.stringify(custom, null, 2), { encoding: 'utf8', mode: 0o600 });
    } catch (err) {
      console.error('Failed to persist custom providers', err);
    }
  }
}
