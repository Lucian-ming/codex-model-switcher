import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { MockProviderServer } from './mockServer.js';
import { ModelDiscovery } from '../src/models/discovery.js';
import { CatalogExporter } from '../src/models/catalogExporter.js';
import { ProviderConfig } from '../src/providers/types.js';

describe('ModelDiscovery and CatalogExporter', () => {
  let mockServer: MockProviderServer;
  let baseUrl: string;
  let tempDir: string;

  beforeAll(async () => {
    mockServer = new MockProviderServer();
    baseUrl = await mockServer.start();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-exp-test-'));
  });

  afterAll(async () => {
    await mockServer.stop();
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  });

  it('should discover models from mock server and apply heuristics', async () => {
    const provider: ProviderConfig = {
      id: 'MockProvider',
      name: 'Mock Provider',
      baseUrl,
      protocol: 'responses',
      models: []
    };

    const models = await ModelDiscovery.discover(provider, 'sk-test-mock');
    expect(models.length).toBe(3);

    const r1 = models.find(m => m.modelId === 'mock-deepseek-r1');
    expect(r1).toBeDefined();
    expect(r1?.defaultReasoningLevel).toBe('medium');
    expect(r1?.contextWindow).toBe(128000);

    const sonnet = models.find(m => m.modelId === 'mock-claude-3-7-sonnet');
    expect(sonnet).toBeDefined();
    expect(sonnet?.contextWindow).toBe(200000);
  });

  it('should export models to valid Codex model_catalog.json', async () => {
    const provider: ProviderConfig = {
      id: 'MockProvider',
      name: 'Mock Provider',
      baseUrl,
      protocol: 'responses',
      models: []
    };

    const models = await ModelDiscovery.discover(provider);
    const catalogPath = path.join(tempDir, 'model_catalog.json');

    CatalogExporter.exportCatalog(models, catalogPath);

    expect(fs.existsSync(catalogPath)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

    expect(parsed.models).toBeDefined();
    expect(Array.isArray(parsed.models)).toBe(true);
    expect(parsed.models.length).toBe(3);
    expect(parsed.models[0].slug).toBe('mock-deepseek-r1');
    expect(parsed.models[0].display_name).toBe('Mock DeepSeek R1');
    expect(parsed.models[0].visibility).toBe('list');
  });
});
