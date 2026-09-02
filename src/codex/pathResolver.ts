import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export interface EnvironmentInfo {
  platform: NodeJS.Platform;
  isWsl: boolean;
  wslDistro?: string;
  homeDir: string;
  codexHome: string;
  configTomlPath: string;
  authJsonPath: string;
  modelCatalogJsonPath: string;
  codexExecutable?: string;
}

export class PathResolver {
  private static cachedInfo?: EnvironmentInfo;

  public static resolve(customHome?: string): EnvironmentInfo {
    if (this.cachedInfo && !customHome) {
      return this.cachedInfo;
    }

    const platform = process.platform;
    const isWsl = Boolean(
      process.env.WSL_DISTRO_NAME ||
      (platform === 'linux' && fs.existsSync('/proc/version') && fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft'))
    );
    const wslDistro = process.env.WSL_DISTRO_NAME;

    const homeDir = customHome || process.env.CODEX_HOME_DIR || os.homedir();
    const codexHome = process.env.CODEX_HOME || path.join(homeDir, '.codex');
    const configTomlPath = path.join(codexHome, 'config.toml');
    const authJsonPath = path.join(codexHome, 'auth.json');
    const modelCatalogJsonPath = path.join(codexHome, 'model_catalog.json');

    const codexExecutable = this.findCodexExecutable(homeDir);

    const info: EnvironmentInfo = {
      platform,
      isWsl,
      wslDistro,
      homeDir,
      codexHome,
      configTomlPath,
      authJsonPath,
      modelCatalogJsonPath,
      codexExecutable
    };

    if (!customHome) {
      this.cachedInfo = info;
    }
    return info;
  }

  private static findCodexExecutable(homeDir: string): string | undefined {
    // 1. Check if codex is in PATH
    const pathEnv = process.env.PATH || '';
    const pathDirs = pathEnv.split(path.delimiter);
    for (const dir of pathDirs) {
      const candidate = path.join(dir, process.platform === 'win32' ? 'codex.exe' : 'codex');
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    // 2. Check VS Code extension bundled location in ~/.vscode-server or ~/.vscode
    const searchBases = [
      path.join(homeDir, '.vscode-server', 'extensions'),
      path.join(homeDir, '.vscode', 'extensions'),
      path.join(homeDir, '.local', 'bin')
    ];

    for (const base of searchBases) {
      if (fs.existsSync(base)) {
        try {
          const entries = fs.readdirSync(base);
          for (const entry of entries) {
            if (entry.startsWith('openai.chatgpt-')) {
              const binCandidate = path.join(base, entry, 'bin', 'linux-x86_64', 'codex');
              if (fs.existsSync(binCandidate)) {
                return binCandidate;
              }
              const winBinCandidate = path.join(base, entry, 'bin', 'windows-x86_64', 'codex.exe');
              if (fs.existsSync(winBinCandidate)) {
                return winBinCandidate;
              }
            }
          }
        } catch {
          // Ignore
        }
      }
    }

    return undefined;
  }
}
