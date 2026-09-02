import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { MockProviderServer } from './mockServer.js';
import { CodexConfigManager } from '../src/codex/configManager.js';
import { ProviderRegistry } from '../src/providers/registry.js';
import { ModelDiscovery } from '../src/models/discovery.js';
import { CatalogExporter } from '../src/models/catalogExporter.js';
import { PathResolver } from '../src/codex/pathResolver.js';

describe('End-to-End Provider and Codex Integration', () => {
  let mockServer: MockProviderServer;
  let baseUrl: string;
  let tempDir: string;
  let testConfigFile: string;
  let catalogFile: string;
  let configManager: CodexConfigManager;
  let registry: ProviderRegistry;

  beforeAll(async () => {
    mockServer = new MockProviderServer();
    baseUrl = await mockServer.start();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-e2e-test-'));
    testConfigFile = path.join(tempDir, 'config.toml');
    catalogFile = path.join(tempDir, 'model_catalog.json');

    // Create base config
    fs.writeFileSync(testConfigFile, 'model_provider = "OpenAI"\nmodel = "gpt-5.6-sol"\n', 'utf8');

    configManager = new CodexConfigManager(testConfigFile);
    registry = new ProviderRegistry(configManager, path.join(tempDir, 'providers.json'));
  });

  afterAll(async () => {
    await mockServer.stop();
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  });

  it('should complete the full lifecycle: Register -> Discover -> Export -> Switch -> Verify in Codex CLI', async () => {
    // 1. Register new custom provider
    const providerId = 'E2EProvider';
    registry.register({
      id: providerId,
      name: 'E2E Test Provider',
      baseUrl,
      protocol: 'responses',
      models: []
    });

    // 2. Discover models from endpoint
    const provider = registry.get(providerId)!;
    const discovered = await ModelDiscovery.discover(provider);
    expect(discovered.length).toBe(3);
    registry.updateModels(providerId, discovered);

    // 3. Export to model_catalog.json
    CatalogExporter.exportCatalog(discovered, catalogFile, configManager);
    expect(fs.existsSync(catalogFile)).toBe(true);

    // 4. Switch active provider and model
    configManager.setProvider(providerId);
    configManager.setModel('mock-deepseek-r1');

    const cfg = configManager.read();
    expect(cfg.model_provider).toBe(providerId);
    expect(cfg.model).toBe('mock-deepseek-r1');
    expect(cfg.model_catalog_json).toBe(catalogFile);

    // 5. Test with real Codex CLI binary if available
    const env = PathResolver.resolve();
    if (env.codexExecutable && fs.existsSync(env.codexExecutable)) {
      const output = execSync(
        `"${env.codexExecutable}" -c model_catalog_json=\\"${catalogFile}\\" debug models`,
        { encoding: 'utf8' }
      );
      const parsed = JSON.parse(output);
      expect(parsed.models).toBeDefined();

      const found = parsed.models.find((m: any) => m.slug === 'mock-deepseek-r1');
      expect(found).toBeDefined();
      expect(found.display_name).toBe('Mock DeepSeek R1');
    }
  });
});
