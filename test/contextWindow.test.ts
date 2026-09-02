import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ContextOverrideManager } from '../src/models/contextOverride.js';
import { ModelProfile } from '../src/models/types.js';

describe('Context Window Overrides and Token Utilities', () => {
  let tempDir: string;
  let customFilePath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'context-test-'));
    customFilePath = path.join(tempDir, 'context_overrides.json');
  });

  afterEach(() => {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  });

  it('should parse token input strings accurately', () => {
    expect(ContextOverrideManager.parseTokenInput('128K')).toBe(128000);
    expect(ContextOverrideManager.parseTokenInput('256k')).toBe(256000);
    expect(ContextOverrideManager.parseTokenInput('1M')).toBe(1000000);
    expect(ContextOverrideManager.parseTokenInput('1.5M')).toBe(1500000);
    expect(ContextOverrideManager.parseTokenInput('200000')).toBe(200000);
    expect(ContextOverrideManager.parseTokenInput('200,000')).toBe(200000);
    expect(ContextOverrideManager.parseTokenInput('invalid')).toBeNull();
    expect(ContextOverrideManager.parseTokenInput('')).toBeNull();
  });

  it('should format integer token counts into human-readable strings', () => {
    expect(ContextOverrideManager.formatTokens(128000)).toBe('128K');
    expect(ContextOverrideManager.formatTokens(256000)).toBe('256K');
    expect(ContextOverrideManager.formatTokens(1000000)).toBe('1M');
    expect(ContextOverrideManager.formatTokens(1500000)).toBe('1.5M');
    expect(ContextOverrideManager.formatTokens(500)).toBe('500');
    expect(ContextOverrideManager.formatTokens(undefined)).toBe('Unknown');
  });

  it('should persist and retrieve user context window overrides across reloads', () => {
    const manager1 = new ContextOverrideManager(customFilePath);
    expect(manager1.getOverride('PinAI_A', 'gpt-5.6-sol')).toBeUndefined();

    manager1.setOverride('PinAI_A', 'gpt-5.6-sol', 200000);
    expect(manager1.getOverride('PinAI_A', 'gpt-5.6-sol')).toBe(200000);

    // Simulate extension reload by creating fresh manager pointing to same file
    const manager2 = new ContextOverrideManager(customFilePath);
    expect(manager2.getOverride('PinAI_A', 'gpt-5.6-sol')).toBe(200000);

    // Reset override
    const existed = manager2.resetOverride('PinAI_A', 'gpt-5.6-sol');
    expect(existed).toBe(true);
    expect(manager2.getOverride('PinAI_A', 'gpt-5.6-sol')).toBeUndefined();

    // Reload again to verify removal persisted
    const manager3 = new ContextOverrideManager(customFilePath);
    expect(manager3.getOverride('PinAI_A', 'gpt-5.6-sol')).toBeUndefined();
  });

  it('should apply user override to model profile and track source', () => {
    const manager = new ContextOverrideManager(customFilePath);
    manager.setOverride('PinAI_A', 'gpt-5.5', 256000);

    const baseModel: ModelProfile = {
      id: 'PinAI_A:gpt-5.5',
      providerId: 'PinAI_A',
      modelId: 'gpt-5.5',
      displayName: 'GPT-5.5',
      contextWindow: 128000
    };

    const overridden = manager.applyToModel(baseModel);
    expect(overridden.contextWindow).toBe(256000);
    expect(overridden.contextWindowInfo?.source).toBe('user');
    expect(overridden.contextWindowInfo?.discoveredValue).toBe(128000);

    // Non-overridden model
    const nonOverridden = manager.applyToModel({
      ...baseModel,
      modelId: 'other-model'
    });
    expect(nonOverridden.contextWindow).toBe(128000);
    expect(nonOverridden.contextWindowInfo?.source).toBe('discovered');
  });
});
