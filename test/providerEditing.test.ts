import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ProviderRegistry } from '../src/providers/registry.js';
import { CodexConfigManager } from '../src/codex/configManager.js';

describe('Custom Provider Name & Configuration Management', () => {
  let tempDir: string;
  let configPath: string;
  let storagePath: string;
  let configManager: CodexConfigManager;
  let registry: ProviderRegistry;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'provider-edit-test-'));
    configPath = path.join(tempDir, 'config.toml');
    storagePath = path.join(tempDir, 'providers.json');
    fs.writeFileSync(configPath, 'model = "gpt-5.6-sol"\nmodel_provider = "Custom_1"\n');

    configManager = new CodexConfigManager(configPath);
    registry = new ProviderRegistry(configManager, storagePath);
  });

  afterEach(() => {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  });

  it('should allow user to register a provider with completely custom name and URL', () => {
    registry.register({
      id: 'my_relay_station',
      name: '我的主力中转站 (自建网关)',
      baseUrl: 'https://relay.example.com/v1',
      protocol: 'responses',
      models: []
    });

    const retrieved = registry.get('my_relay_station');
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('我的主力中转站 (自建网关)');
    expect(retrieved?.baseUrl).toBe('https://relay.example.com/v1');

    // Verify synced into config.toml
    const tomlCfg = configManager.read();
    expect((tomlCfg as any).model_providers?.my_relay_station?.name).toBe('我的主力中转站 (自建网关)');
  });

  it('should allow user to modify and rename an existing provider', () => {
    registry.register({
      id: 'fast_api',
      name: '旧名字',
      baseUrl: 'https://old.example.com/v1',
      protocol: 'responses',
      models: []
    });

    // Rename and update URL
    registry.updateProviderInfo('fast_api', {
      name: '新中转站名称 (已改名)',
      baseUrl: 'https://new.example.com/v1'
    });

    const updated = registry.get('fast_api');
    expect(updated?.name).toBe('新中转站名称 (已改名)');
    expect(updated?.baseUrl).toBe('https://new.example.com/v1');

    // Reload from file to verify persistence across restarts
    const registry2 = new ProviderRegistry(configManager, storagePath);
    const reloaded = registry2.get('fast_api');
    expect(reloaded?.name).toBe('新中转站名称 (已改名)');
    expect(reloaded?.baseUrl).toBe('https://new.example.com/v1');
  });
});
