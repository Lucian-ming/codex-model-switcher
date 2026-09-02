import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CodexConfigManager } from '../src/codex/configManager.js';

describe('CodexConfigManager', () => {
  let testDir: string;
  let testConfigFile: string;
  let manager: CodexConfigManager;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-cfg-test-'));
    testConfigFile = path.join(testDir, 'config.toml');

    // Create an initial config fixture
    const initialToml = `model_provider = "PinAI"
model = "gpt-5.6-sol"
review_model = "gpt-5.5"

[model_providers.PinAI]
name = "PinAI"
base_url = "https://api.pinaic.com"
wire_api = "responses"
requires_openai_auth = true
`;
    fs.writeFileSync(testConfigFile, initialToml, 'utf8');
    manager = new CodexConfigManager(testConfigFile);
  });

  afterEach(() => {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {}
  });

  it('should read current model and provider correctly', () => {
    expect(manager.getCurrentModel()).toBe('gpt-5.6-sol');
    expect(manager.getCurrentProvider()).toBe('PinAI');

    const providers = manager.getProviders();
    expect(providers.PinAI).toBeDefined();
    expect(providers.PinAI.base_url).toBe('https://api.pinaic.com');
  });

  it('should set active model and create automatic backup', () => {
    manager.setModel('claude-3-7-sonnet', 'claude-3-7-sonnet');
    expect(manager.getCurrentModel()).toBe('claude-3-7-sonnet');

    const backups = manager.listBackups();
    expect(backups.length).toBeGreaterThan(0);
  });

  it('should upsert a new provider without breaking existing providers', () => {
    manager.upsertProvider('DeepSeek', {
      name: 'DeepSeek',
      base_url: 'https://api.deepseek.com/v1',
      wire_api: 'responses',
      env_key: 'DEEPSEEK_API_KEY'
    });

    const providers = manager.getProviders();
    expect(providers.PinAI).toBeDefined();
    expect(providers.DeepSeek).toBeDefined();
    expect(providers.DeepSeek.base_url).toBe('https://api.deepseek.com/v1');
  });

  it('should restore from backup successfully', () => {
    const originalModel = manager.getCurrentModel();
    manager.setModel('new-model-xyz');
    expect(manager.getCurrentModel()).toBe('new-model-xyz');

    const restoredPath = manager.restoreLatestBackup();
    expect(restoredPath).toBeDefined();
    expect(manager.getCurrentModel()).toBe(originalModel);
  });

  it('should remove a provider cleanly', () => {
    manager.upsertProvider('TempProv', { name: 'Temp' });
    expect(manager.getProviders().TempProv).toBeDefined();

    manager.removeProvider('TempProv');
    expect(manager.getProviders().TempProv).toBeUndefined();
  });
});
