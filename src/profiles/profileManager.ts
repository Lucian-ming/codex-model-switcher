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
    // 不预设任何第三方配置，所有预设由用户自行创建与管理
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
   * 校验 Profile 是否与目标模型的推理能力兼容
   */
  public validateProfile(profile: Profile, availableModels?: ModelProfile[]): { valid: boolean; error?: string } {
    if (!profile.name || !profile.name.trim()) {
      return { valid: false, error: '配置预设名称不能为空。' };
    }
    if (!profile.providerId || !profile.modelId) {
      return { valid: false, error: '服务商 ID 与模型 ID 为必填项。' };
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
            error: `模型 "${match.displayName}" 不支持推理强度 "${profile.reasoningEffort}"。支持的级别为: [${supported}]。`
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
   * 将 Profile 一键原子应用到 config.toml
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
