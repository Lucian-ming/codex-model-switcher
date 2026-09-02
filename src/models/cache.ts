import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ModelProfile } from './types.js';

interface CacheEntry {
  providerId: string;
  updatedAt: number;
  models: ModelProfile[];
}

export class ModelCache {
  private cacheFilePath: string;
  private defaultTtlMs: number = 3600 * 1000; // 1 hour

  constructor(customPath?: string, ttlMinutes: number = 60) {
    this.cacheFilePath = customPath || path.join(os.homedir(), '.codex-model-switcher', 'model_cache.json');
    this.defaultTtlMs = ttlMinutes * 60 * 1000;
  }

  public get(providerId: string): ModelProfile[] | undefined {
    try {
      if (!fs.existsSync(this.cacheFilePath)) return undefined;
      const data: Record<string, CacheEntry> = JSON.parse(fs.readFileSync(this.cacheFilePath, 'utf8'));
      const entry = data[providerId];
      if (!entry) return undefined;

      // Check TTL (0 means never expires)
      if (this.defaultTtlMs > 0 && Date.now() - entry.updatedAt > this.defaultTtlMs) {
        return undefined;
      }
      return entry.models;
    } catch {
      return undefined;
    }
  }

  public set(providerId: string, models: ModelProfile[]): void {
    try {
      const dir = path.dirname(this.cacheFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      }
      let data: Record<string, CacheEntry> = {};
      if (fs.existsSync(this.cacheFilePath)) {
        try {
          data = JSON.parse(fs.readFileSync(this.cacheFilePath, 'utf8'));
        } catch {}
      }
      data[providerId] = {
        providerId,
        updatedAt: Date.now(),
        models
      };
      fs.writeFileSync(this.cacheFilePath, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
    } catch (err) {
      console.error('Failed to write model cache', err);
    }
  }

  public clear(): void {
    try {
      if (fs.existsSync(this.cacheFilePath)) {
        fs.unlinkSync(this.cacheFilePath);
      }
    } catch {}
  }
}
