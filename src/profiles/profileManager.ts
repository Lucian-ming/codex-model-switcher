import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Profile } from './types.js';
import { CodexConfigManager } from '../codex/configManager.js';
import { ModelProfile } from '../models/types.js';
import { ReasoningManager } from '../models/reasoningManager.js';

export class ProfileManager {
  private profiles: Map<string, Profile> = new Map();
  private storageFilePath: string;
  private configManager: CodexConfigManager;

  constructor(configManager: CodexConfigManager, customStoragePath?: string) {
    this.configManager = configManager;
    this.storageFilePath = customStoragePath || path.join(os.homedir(), '.codex-model-switcher', 'profiles.json');
    this.init();
  }

  private init(): void {
    const defaults: Profile[] = [
      {
        id: 'openai-default',
        name: 'OpenAI GPT-5.6 Max',
        providerId: 'OpenAI',
        modelId: 'gpt-5.6-sol',
        reviewModelId: 'gpt-5.5',
        reasoningEffort: 'max',
        description: 'Official OpenAI high-reasoning development profile',
        isDefault: true
      },
      {
        id: 'fast-coding',
        name: 'Fast Coding (GPT-5.5)',
        providerId: 'OpenAI',
        modelId: 'gpt-5.5',
        reasoningEffort: 'low',
        description: 'Fast, responsive coding with light reasoning'
      },
      {
        id: 'openrouter-claude',
        name: 'OpenRouter Claude 3.7',
        providerId: 'OpenRouter',
        modelId: 'anthropic/claude-3.7-sonnet',
        reviewModelId: 'anthropic/claude-3.7-sonnet',
        reasoningEffort: 'medium',
        description: 'Claude 3.7 Sonnet via OpenRouter aggregator'
      },
      {
        id: 'deepseek-reasoner',
        name: 'DeepSeek R1 Reasoner',
        providerId: 'DeepSeek',
        modelId: 'deepseek-reasoner',
        reviewModelId: 'deepseek-chat',
        reasoningEffort: 'high',
        description: 'Cost-effective high-reasoning coding with DeepSeek'
      },
      {
        id: 'ollama-local',
        name: 'Local Ollama Qwen',
        providerId: 'Ollama',
        modelId: 'qwen2.5-coder:latest',
        description: 'Completely offline zero-latency local development'
      }
    ];

    for (const p of defaults) {
      this.profiles.set(p.id, p);
    }

    if (fs.existsSync(this.storageFilePath)) {
      try {
        const stored: Profile[] = JSON.parse(fs.readFileSync(this.storageFilePath, 'utf8'));
        for (const p of stored) {
          this.profiles.set(p.id, p);
        }
      } catch (err) {
        console.error('Failed to load stored profiles:', err);
      }
    }
  }

  public list(): Profile[] {
    return Array.from(this.profiles.values());
  }

  public get(id: string): Profile | undefined {
    return this.profiles.get(id);
  }

  /**
   * Validates a profile against target model reasoning constraints.
   */
  public validateProfile(profile: Profile, availableModels?: ModelProfile[]): { valid: boolean; error?: string } {
    if (!profile.name || !profile.name.trim()) {
      return { valid: false, error: 'Profile name cannot be empty.' };
    }
    if (!profile.providerId || !profile.modelId) {
      return { valid: false, error: 'Provider ID and Model ID are required.' };
    }

    if (availableModels && availableModels.length > 0) {
      const match = availableModels.find(
        m => m.modelId === profile.modelId && (!m.providerId || m.providerId === profile.providerId)
      );
      if (match && profile.reasoningEffort) {
        if (!ReasoningManager.isEffortSupported(match, profile.reasoningEffort)) {
          const supported = match.supportedReasoningLevels?.map(l => l.effort).join(', ') || 'none';
          return {
            valid: false,
            error: `Model "${match.displayName}" does not support reasoning effort "${profile.reasoningEffort}". Supported tiers are: [${supported}].`
          };
        }
      }
    }

    return { valid: true };
  }

  public saveProfile(profile: Profile, availableModels?: ModelProfile[]): void {
    const validation = this.validateProfile(profile, availableModels);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    this.profiles.set(profile.id, profile);
    this.persist();
  }

  public deleteProfile(id: string): void {
    this.profiles.delete(id);
    this.persist();
  }

  /**
   * Applies the profile to config.toml in a single atomic transaction.
   */
  public applyProfile(profile: Profile): void {
    const cfg = this.configManager.read();
    cfg.model_provider = profile.providerId;
    cfg.model = profile.modelId;
    if (profile.reviewModelId) {
      cfg.review_model = profile.reviewModelId;
    }
    if (profile.reasoningEffort) {
      cfg.model_reasoning_effort = profile.reasoningEffort;
    }
    this.configManager.write(cfg);
  }

  private persist(): void {
    try {
      const dir = path.dirname(this.storageFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      }
      fs.writeFileSync(this.storageFilePath, JSON.stringify(Array.from(this.profiles.values()), null, 2), {
        encoding: 'utf8',
        mode: 0o600
      });
    } catch (err) {
      console.error('Failed to persist profiles:', err);
    }
  }
}
