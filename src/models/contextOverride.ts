import * as fs from 'fs';
import * as path from 'path';
import { ModelProfile } from './types.js';
import { PathResolver } from '../codex/pathResolver.js';

export interface ContextOverrideRecord {
  providerId: string;
  modelId: string;
  contextWindow: number;
  updatedAt: string;
}

export class ContextOverrideManager {
  private filePath: string;
  private overrides: Map<string, ContextOverrideRecord> = new Map();

  constructor(customPath?: string) {
    if (customPath) {
      this.filePath = customPath;
    } else {
      const env = PathResolver.resolve();
      const dir = path.join(env.homeDir, '.codex-model-switcher');
      this.filePath = path.join(dir, 'context_overrides.json');
    }
    this.load();
  }

  private getKey(providerId: string, modelId: string): string {
    return `${providerId}:${modelId}`;
  }

  private load(): void {
    this.overrides.clear();
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          for (const item of data) {
            if (item.providerId && item.modelId && typeof item.contextWindow === 'number') {
              this.overrides.set(this.getKey(item.providerId, item.modelId), item);
            }
          }
        }
      }
    } catch {
      // Fallback to empty map on parse error
    }
  }

  private save(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }

    const list = Array.from(this.overrides.values());
    const tmp = path.join(dir, `.context_overrides.tmp.${Date.now()}`);
    fs.writeFileSync(tmp, JSON.stringify(list, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmp, this.filePath);
  }

  public getOverride(providerId: string, modelId: string): number | undefined {
    const rec = this.overrides.get(this.getKey(providerId, modelId));
    return rec?.contextWindow;
  }

  public setOverride(providerId: string, modelId: string, tokens: number): void {
    const key = this.getKey(providerId, modelId);
    this.overrides.set(key, {
      providerId,
      modelId,
      contextWindow: tokens,
      updatedAt: new Date().toISOString()
    });
    this.save();
  }

  public resetOverride(providerId: string, modelId: string): boolean {
    const key = this.getKey(providerId, modelId);
    const existed = this.overrides.delete(key);
    if (existed) {
      this.save();
    }
    return existed;
  }

  public applyToModel(model: ModelProfile): ModelProfile {
    const override = this.getOverride(model.providerId, model.modelId);
    const discovered = model.contextWindow || 128000;

    if (override !== undefined) {
      return {
        ...model,
        contextWindow: override,
        maxContextWindow: Math.max(override, model.maxContextWindow || override),
        contextWindowInfo: {
          value: override,
          source: 'user',
          discoveredValue: discovered
        }
      };
    }

    return {
      ...model,
      contextWindow: discovered,
      contextWindowInfo: {
        value: discovered,
        source: 'discovered',
        discoveredValue: discovered
      }
    };
  }

  public applyToModels(models: ModelProfile[]): ModelProfile[] {
    return models.map(m => this.applyToModel(m));
  }

  /**
   * Parses token strings like '128K', '256k', '1M', '200000', '1.5M' into integer token counts.
   */
  public static parseTokenInput(input: string): number | null {
    if (!input) return null;
    const clean = input.trim().replace(/,/g, '').toUpperCase();

    if (/^\d+$/.test(clean)) {
      const val = parseInt(clean, 10);
      return val > 0 ? val : null;
    }

    const kMatch = clean.match(/^(\d+(?:\.\d+)?)\s*K$/);
    if (kMatch) {
      return Math.round(parseFloat(kMatch[1]) * 1000);
    }

    const mMatch = clean.match(/^(\d+(?:\.\d+)?)\s*M$/);
    if (mMatch) {
      return Math.round(parseFloat(mMatch[1]) * 1000000);
    }

    return null;
  }

  /**
   * Formats integer token numbers like 128000 -> '128K', 1000000 -> '1M'.
   */
  public static formatTokens(tokens?: number): string {
    if (!tokens || tokens <= 0) return 'Unknown';
    if (tokens >= 1000000) {
      const m = tokens / 1000000;
      return `${m % 1 === 0 ? m : m.toFixed(1)}M`;
    }
    if (tokens >= 1000) {
      const k = tokens / 1000;
      return `${k % 1 === 0 ? k : k.toFixed(0)}K`;
    }
    return `${tokens}`;
  }
}
