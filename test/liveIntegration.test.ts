import { describe, it, expect } from 'vitest';
import { spawnSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';
import { PathResolver } from '../src/codex/pathResolver.js';
import { ProviderConfig } from '../src/providers/types.js';
import { ModelDiscovery } from '../src/models/discovery.js';
import { CatalogExporter } from '../src/models/catalogExporter.js';

describe('Live API Integration & Codex Compatibility', () => {
  const key1 = process.env.TEST_KEY_1;
  const key2 = process.env.TEST_KEY_2;
  const hasKeys = Boolean(key1 && key2);

  it.skipIf(!hasKeys)('Provider A: model discovery and real prompt response', async () => {
    const providerA: ProviderConfig = {
      id: 'PinAI_Live_A',
      name: 'PinAI Provider A',
      baseUrl: 'https://api.pinaic.com/v1',
      protocol: 'responses',
      models: []
    };

    const models = await ModelDiscovery.discover(providerA, key1);
    expect(models.length).toBeGreaterThan(0);
    expect(models.some(m => m.modelId === 'gpt-5.5' || m.modelId === 'gpt-5.6-sol')).toBe(true);

    const env = PathResolver.resolve();
    if (env.codexExecutable && fs.existsSync(env.codexExecutable)) {
      const argsA = [
        'exec',
        '--skip-git-repo-check',
        '--ephemeral',
        '-c', 'model_provider="PinAI_A"',
        '-c', 'model="gpt-5.6-sol"',
        '-c', 'model_reasoning_effort="max"',
        '-c', 'model_providers.PinAI_A.name="PinAI-A"',
        '-c', 'model_providers.PinAI_A.base_url="https://api.pinaic.com"',
        '-c', 'model_providers.PinAI_A.wire_api="responses"',
        '-c', 'model_providers.PinAI_A.requires_openai_auth=false',
        '-c', 'model_providers.PinAI_A.env_key="TEST_KEY_1"',
        'Reply with exactly: TEST_PROVIDER_A_OK'
      ];
      const res = spawnSync(env.codexExecutable, argsA, {
        env: { ...process.env, TEST_KEY_1: key1 },
        encoding: 'utf8'
      });
      expect(res.status).toBe(0);
      expect(res.stdout).toContain('TEST_PROVIDER_A_OK');
    }
  });

  it.skipIf(!hasKeys)('Provider B: model discovery and real prompt response', async () => {
    const providerB: ProviderConfig = {
      id: 'PinAI_Live_B',
      name: 'PinAI Provider B',
      baseUrl: 'https://api.pinaic.com/v1',
      protocol: 'responses',
      models: []
    };

    const models = await ModelDiscovery.discover(providerB, key2);
    expect(models.length).toBe(1);
    expect(models[0].modelId).toBe('grok-4.6');

    const env = PathResolver.resolve();
    if (env.codexExecutable && fs.existsSync(env.codexExecutable)) {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-b-'));
      const catalogPath = path.join(tempDir, 'catalog.json');
      CatalogExporter.exportCatalog(models, catalogPath);

      const argsB = [
        'exec',
        '--skip-git-repo-check',
        '--ephemeral',
        '-c', `model_catalog_json="${catalogPath}"`,
        '-c', 'model_provider="PinAI_B"',
        '-c', 'model="grok-4.6"',
        '-c', 'model_providers.PinAI_B.name="PinAI-B"',
        '-c', 'model_providers.PinAI_B.base_url="https://api.pinaic.com"',
        '-c', 'model_providers.PinAI_B.wire_api="responses"',
        '-c', 'model_providers.PinAI_B.requires_openai_auth=false',
        '-c', 'model_providers.PinAI_B.env_key="TEST_KEY_2"',
        'Reply with exactly: TEST_PROVIDER_B_OK'
      ];
      const res = spawnSync(env.codexExecutable, argsB, {
        env: { ...process.env, TEST_KEY_2: key2 },
        encoding: 'utf8'
      });
      expect(res.status).toBe(0);
      expect(res.stdout).toContain('TEST_PROVIDER_B_OK');

      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    }
  });

  it.skipIf(!hasKeys)('Native Codex Model Picker integration via app-server model/list', async () => {
    const env = PathResolver.resolve();
    if (!env.codexExecutable || !fs.existsSync(env.codexExecutable)) return;

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-picker-'));
    const catalogPath = path.join(tempDir, 'catalog.json');

    const testModels = [
      {
        id: 'grok-4.6-test',
        providerId: 'PinAI_B',
        modelId: 'grok-4.6',
        displayName: 'Grok 4.6 (Provider B)',
        contextWindow: 128000,
        priority: 1,
        visibility: 'list' as const,
        enabled: true
      }
    ];
    CatalogExporter.exportCatalog(testModels, catalogPath);

    const proc = spawn(env.codexExecutable, [
      '-c', `model_catalog_json="${catalogPath}"`,
      '-c', 'features.code_mode_host=true',
      'app-server',
      '--stdio'
    ]);

    const rl = readline.createInterface({ input: proc.stdout });
    let returnedModels: any[] = [];

    await new Promise<void>((resolve) => {
      rl.on('line', (line) => {
        try {
          const msg = JSON.parse(line);
          if (msg.id === 1) {
            proc.stdin.write(JSON.stringify({
              id: 2,
              method: 'model/list',
              params: {}
            }) + '\n');
          } else if (msg.id === 2) {
            returnedModels = msg.result?.data || [];
            proc.kill();
            resolve();
          }
        } catch {}
      });

      proc.stdin.write(JSON.stringify({
        id: 1,
        method: 'initialize',
        params: { clientInfo: { name: 'test-client', version: '1.0' }, capabilities: {} }
      }) + '\n');

      setTimeout(() => {
        proc.kill();
        resolve();
      }, 8000);
    });

    expect(returnedModels.length).toBeGreaterThan(0);
    const found = returnedModels.find(m => m.id === 'grok-4.6' || m.model === 'grok-4.6');
    expect(found).toBeDefined();
    expect(found.displayName).toBe('Grok 4.6 (Provider B)');

    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  });
});
