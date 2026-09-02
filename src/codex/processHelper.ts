import * as vscode from 'vscode';

export class ProcessHelper {
  /**
   * 优雅重启 Codex 运行环境：
   * 采用 VS Code 官方原生标准重载机制（与官方 Codex 界面中的 Restart Codex 行为完全一致），
   * 彻底废除底层直接 pkill 导致的 "Codex app-server process exited unexpectedly" 异常报错。
   */
  public static async restartCodex(): Promise<void> {
    await vscode.commands.executeCommand('workbench.action.reloadWindow');
  }

  // 兼容旧调用名
  public static async restartAppServer(): Promise<void> {
    await this.restartCodex();
  }
}
