import * as fs from 'fs';
import * as path from 'path';
import { parse, stringify } from 'smol-toml';
import { PathResolver, EnvironmentInfo } from './pathResolver.js';
import { CodexConfig, CodexProviderTableConfig } from './types.js';

export interface BackupInfo {
  filename: string;
  filePath: string;
  timestamp: string;
  size: number;
}

export class CodexConfigManager {
  private envInfo: EnvironmentInfo;
  private configPath: string;
  private listeners: Array<() => void> = [];

  constructor(customConfigPath?: string) {
    this.envInfo = PathResolver.resolve();
    this.configPath = customConfigPath || this.envInfo.configTomlPath;
  }

  public getConfigPath(): string {
    return this.configPath;
  }

  public getEnvironment(): EnvironmentInfo {
    return this.envInfo;
  }

  /**
   * Reads and parses config.toml. Returns an empty object if file does not exist.
   */
  public read(): CodexConfig {
    if (!fs.existsSync(this.configPath)) {
      return {};
    }
    const content = fs.readFileSync(this.configPath, 'utf8');
    try {
      return (parse(content) as CodexConfig) || {};
    } catch (err: any) {
      throw new Error(`Failed to parse Codex TOML at ${this.configPath}: ${err.message}`);
    }
  }

  public getCurrentModel(): string | undefined {
    const cfg = this.read();
    return cfg.model;
  }

  public getCurrentProvider(): string | undefined {
    const cfg = this.read();
    return cfg.model_provider;
  }

  public getProviders(): Record<string, CodexProviderTableConfig> {
    const cfg = this.read();
    return cfg.model_providers || {};
  }

  /**
   * Updates the active model in config.toml.
   */
  public setModel(model: string, reviewModel?: string): void {
    const cfg = this.read();
    cfg.model = model;
    if (reviewModel) {
      cfg.review_model = reviewModel;
    }
    this.write(cfg);
  }

  /**
   * Sets the active provider in config.toml.
   */
  public setProvider(providerId: string): void {
    const cfg = this.read();
    cfg.model_provider = providerId;
    this.write(cfg);
  }

  /**
   * Sets or updates model_catalog_json path.
   */
  public setModelCatalogJson(catalogPath: string): void {
    const cfg = this.read();
    cfg.model_catalog_json = catalogPath;
    this.write(cfg);
  }

  /**
   * Upserts a provider into [model_providers.<id>] while preserving all other providers.
   */
  public upsertProvider(providerId: string, providerConfig: CodexProviderTableConfig): void {
    const cfg = this.read();
    if (!cfg.model_providers) {
      cfg.model_providers = {};
    }
    cfg.model_providers[providerId] = {
      ...(cfg.model_providers[providerId] || {}),
      ...providerConfig
    };
    this.write(cfg);
  }

  /**
   * Removes a provider table from config.toml.
   */
  public removeProvider(providerId: string): void {
    const cfg = this.read();
    if (cfg.model_providers && cfg.model_providers[providerId]) {
      delete cfg.model_providers[providerId];
      if (cfg.model_provider === providerId) {
        cfg.model_provider = undefined;
      }
      this.write(cfg);
    }
  }

  /**
   * Atomic write with automatic timestamped backup and validation.
   */
  public write(config: CodexConfig): void {
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }

    // 1. Create automatic backup if config file already exists
    if (fs.existsSync(this.configPath)) {
      this.createBackup();
    }

    // 2. Serialize to TOML
    const tomlString = stringify(config as any);

    // 3. Write to temporary file in the same directory (guarantees same filesystem for atomic rename)
    const tmpFile = path.join(dir, `.config.toml.tmp.${Date.now()}.${Math.random().toString(36).substring(7)}`);
    fs.writeFileSync(tmpFile, tomlString, { encoding: 'utf8', mode: 0o600 });

    // 4. Validate that the temp file can be parsed back properly
    try {
      const readBack = fs.readFileSync(tmpFile, 'utf8');
      parse(readBack);
    } catch (validationErr: any) {
      try { fs.unlinkSync(tmpFile); } catch {}
      throw new Error(`TOML validation failed before atomic write: ${validationErr.message}`);
    }

    // 5. Atomic rename
    fs.renameSync(tmpFile, this.configPath);

    // 6. Notify listeners
    this.notifyListeners();
  }

  public createBackup(): string {
    const dateStr = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
    const backupName = `config.toml.backup.${dateStr}`;
    const backupPath = path.join(path.dirname(this.configPath), backupName);

    fs.copyFileSync(this.configPath, backupPath);

    // Rotate backups: keep maximum 10 latest backups
    this.pruneOldBackups(10);
    return backupPath;
  }

  public listBackups(): BackupInfo[] {
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) return [];

    const files = fs.readdirSync(dir);
    const backups: BackupInfo[] = [];

    for (const f of files) {
      if (f.startsWith('config.toml.backup.')) {
        const fullPath = path.join(dir, f);
        try {
          const stat = fs.statSync(fullPath);
          const timestamp = f.replace('config.toml.backup.', '');
          backups.push({
            filename: f,
            filePath: fullPath,
            timestamp,
            size: stat.size
          });
        } catch {}
      }
    }

    return backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  public restoreLatestBackup(): string | undefined {
    const backups = this.listBackups();
    if (backups.length === 0) {
      return undefined;
    }
    const latest = backups[0];
    fs.copyFileSync(latest.filePath, this.configPath);
    this.notifyListeners();
    return latest.filePath;
  }

  public restoreBackup(filePath: string): void {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Backup file does not exist: ${filePath}`);
    }
    fs.copyFileSync(filePath, this.configPath);
    this.notifyListeners();
  }

  private pruneOldBackups(maxKeep: number): void {
    const backups = this.listBackups();
    if (backups.length > maxKeep) {
      const toDelete = backups.slice(maxKeep);
      for (const b of toDelete) {
        try { fs.unlinkSync(b.filePath); } catch {}
      }
    }
  }

  public onConfigChanged(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try { listener(); } catch {}
    }
  }
}
