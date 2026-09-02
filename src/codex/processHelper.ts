import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class ProcessHelper {
  /**
   * 清理后台常驻的旧 codex app-server 守护进程，
   * 强制官方 Codex 插件重新加载最新的 config.toml 与 model_catalog.json。
   */
  public static async restartAppServer(): Promise<void> {
    try {
      if (process.platform === 'linux' || process.platform === 'darwin') {
        await execAsync('pkill -f "codex.*app-server" || true');
      } else {
        await execAsync('powershell.exe -NoProfile -Command "Stop-Process -Name codex -Force -ErrorAction SilentlyContinue"');
      }
    } catch {
      // 忽略未运行或已终止的情况
    }
  }
}
