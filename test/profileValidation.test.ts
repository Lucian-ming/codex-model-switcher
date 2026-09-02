import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ProfileManager } from '../src/profiles/profileManager.js';
import { CodexConfigManager } from '../src/codex/configManager.js';
import { ModelProfile } from '../src/models/types.js';

describe('Profile Validation and Management', () => {
  let tempDir: string;
  let configPath: string;
  let storagePath: string;
  let configManager: CodexConfigManager;
  let profileManager: ProfileManager;

  const mockModels: ModelProfile[] = [
    {
      id: 'PinAI_A:gpt-5.5',
      providerId: 'PinAI_A',
      modelId: 'gpt-5.5',
      displayName: 'GPT-5.5',
      supportedReasoningLevels: [
        { effort: 'low', description: 'Low' },
        { effort: 'medium', description: 'Medium' },
        { effort: 'high', description: 'High' },
        { effort: 'xhigh', description: 'Extra High' }
      ]
    },
    {
      id: 'PinAI_A:gpt-5.6-sol',
      providerId: 'PinAI_A',
      modelId: 'gpt-5.6-sol',
      displayName: 'GPT-5.6-Sol',
      supportedReasoningLevels: [
        { effort: 'low', description: 'Low' },
        { effort: 'medium', description: 'Medium' },
        { effort: 'high', description: 'High' },
        { effort: 'max', description: 'Max' }
      ]
    }
  ];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-test-'));
    configPath = path.join(tempDir, 'config.toml');
    storagePath = path.join(tempDir, 'profiles.json');
    fs.writeFileSync(configPath, 'model = "gpt-5.6-sol"\nmodel_provider = "PinAI_A"\n');

    configManager = new CodexConfigManager(configPath);
    profileManager = new ProfileManager(configManager, storagePath);
  });

  afterEach(() => {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  });

  it('should validate and reject a profile with unsupported reasoning effort', () => {
    // gpt-5.5 does NOT support max reasoning effort
    const invalidProfile = {
      id: 'test-invalid',
      name: 'Invalid Profile',
      providerId: 'PinAI_A',
      modelId: 'gpt-5.5',
      reasoningEffort: 'max' as const
    };

    const validation = profileManager.validateProfile(invalidProfile, mockModels);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('不支持推理强度 "max"');

    expect(() => profileManager.saveProfile(invalidProfile, mockModels)).toThrow();
  });

  it('should validate and save a compatible profile successfully', () => {
    const validProfile = {
      id: 'test-valid',
      name: 'Valid High Profile',
      providerId: 'PinAI_A',
      modelId: 'gpt-5.5',
      reasoningEffort: 'high' as const
    };

    const validation = profileManager.validateProfile(validProfile, mockModels);
    expect(validation.valid).toBe(true);

    profileManager.saveProfile(validProfile, mockModels);
    expect(profileManager.get('test-valid')).toBeDefined();

    // Apply profile to config.toml
    profileManager.applyProfile(validProfile);
    const updated = configManager.read();
    expect(updated.model).toBe('gpt-5.5');
    expect(updated.model_provider).toBe('PinAI_A');
    expect(updated.model_reasoning_effort).toBe('high');
  });
});
