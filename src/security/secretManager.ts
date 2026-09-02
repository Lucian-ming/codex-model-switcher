import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class SecretManager {
  private secretStorage?: vscode.SecretStorage;
  private fallbackFilePath: string;

  constructor(secretStorage?: vscode.SecretStorage, fallbackDir?: string) {
    this.secretStorage = secretStorage;
    const baseDir = fallbackDir || path.join(os.homedir(), '.codex-model-switcher');
    this.fallbackFilePath = path.join(baseDir, 'credentials.json');
  }

  public async getSecret(key: string): Promise<string | undefined> {
    if (this.secretStorage) {
      try {
        const val = await this.secretStorage.get(key);
        if (val) return val;
      } catch {
        // Fall back to disk if secretStorage fails
      }
    }
    return this.readFromFallback(key);
  }

  public async storeSecret(key: string, value: string): Promise<void> {
    if (this.secretStorage) {
      try {
        await this.secretStorage.store(key, value);
        return;
      } catch {
        // Fall back to disk
      }
    }
    this.writeToFallback(key, value);
  }

  public async deleteSecret(key: string): Promise<void> {
    if (this.secretStorage) {
      try {
        await this.secretStorage.delete(key);
      } catch {
        // Fall through to fallback
      }
    }
    this.deleteFromFallback(key);
  }

  private readFromFallback(key: string): string | undefined {
    try {
      if (!fs.existsSync(this.fallbackFilePath)) return undefined;
      const data = JSON.parse(fs.readFileSync(this.fallbackFilePath, 'utf8'));
      return data[key];
    } catch {
      return undefined;
    }
  }

  private writeToFallback(key: string, value: string): void {
    try {
      const dir = path.dirname(this.fallbackFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      }
      let data: Record<string, string> = {};
      if (fs.existsSync(this.fallbackFilePath)) {
        try {
          data = JSON.parse(fs.readFileSync(this.fallbackFilePath, 'utf8'));
        } catch {
          data = {};
        }
      }
      data[key] = value;
      fs.writeFileSync(this.fallbackFilePath, JSON.stringify(data, null, 2), {
        encoding: 'utf8',
        mode: 0o600
      });
      fs.chmodSync(this.fallbackFilePath, 0o600);
    } catch (err) {
      console.error('Failed to write to fallback credentials file', err);
    }
  }

  private deleteFromFallback(key: string): void {
    try {
      if (!fs.existsSync(this.fallbackFilePath)) return;
      const data = JSON.parse(fs.readFileSync(this.fallbackFilePath, 'utf8'));
      delete data[key];
      fs.writeFileSync(this.fallbackFilePath, JSON.stringify(data, null, 2), {
        encoding: 'utf8',
        mode: 0o600
      });
    } catch {
      // Ignore
    }
  }
}
