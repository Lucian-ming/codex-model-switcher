import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ProviderRegistry } from '../src/providers/registry.js';
import { CodexConfigManager } from '../src/codex/configManager.js';
import { ModelProfile } from '../src/models/types.js';

describe('Provider and Model Disablement & Visibility', () => {
  let tempDir: string;
  let configPath: string;
  let storagePath: string;
  let configManager: CodexConfigManager;
  let registry: ProviderRegistry;

  const mockModels: ModelProfile[] = [
    {
      id: 'custom_1:model-a',
      providerId: 'custom_1',
      modelId: 'model-a',
      displayName: 'Model A',
      enabled: true
    },
    {
      id: 'custom_1:model-b',
      providerId: 'custom_1',
      modelId: 'model-b',
      displayName: 'Model B',
      enabled: true
    }
  ];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'disable-test-'));
    configPath = path.join(tempDir, 'config.toml');
    storagePath = path.join(tempDir, 'providers.json');
    fs.writeFileSync(configPath, 'model = "model-a"\nmodel_provider = "custom_1"\n');

    configManager = new CodexConfigManager(configPath);
    registry = new ProviderRegistry(configManager, storagePath);
  });

  afterEach(() => {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  });

  it('should toggle provider enabled state and persist', () => {
    registry.register({
      id: 'custom_1',
      name: 'Custom 1',
      baseUrl: 'https://api.example.com/v1',
      protocol: 'responses',
      models: mockModels
    });

    expect(registry.get('custom_1')?.enabled).not.toBe(false);

    // Disable provider
    const disabledState = registry.toggleProviderEnabled('custom_1');
    expect(disabledState).toBe(false);
    expect(registry.get('custom_1')?.enabled).toBe(false);

    // Re-instantiate from storage to verify persistence
    const registry2 = new ProviderRegistry(configManager, storagePath);
    expect(registry2.get('custom_1')?.enabled).toBe(false);

    // Re-enable provider
    const enabledState = registry2.toggleProviderEnabled('custom_1');
    expect(enabledState).toBe(true);
    expect(registry2.get('custom_1')?.enabled).toBe(true);
  });

  it('should toggle individual model enabled state under a provider', () => {
    registry.register({
      id: 'custom_1',
      name: 'Custom 1',
      baseUrl: 'https://api.example.com/v1',
      protocol: 'responses',
      models: [...mockModels]
    });

    // Disable model-b
    const disabled = registry.toggleModelEnabled('custom_1', 'model-b');
    expect(disabled).toBe(false);

    const p = registry.get('custom_1');
    const modelB = p?.models.find(m => m.modelId === 'model-b');
    expect(modelB?.enabled).toBe(false);

    const modelA = p?.models.find(m => m.modelId === 'model-a');
    expect(modelA?.enabled).not.toBe(false);

    // Verify persistence across reload
    const registry2 = new ProviderRegistry(configManager, storagePath);
    const reloadedModelB = registry2.get('custom_1')?.models.find(m => m.modelId === 'model-b');
    expect(reloadedModelB?.enabled).toBe(false);
  });
});
