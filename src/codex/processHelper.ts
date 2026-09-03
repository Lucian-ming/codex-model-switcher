import * as vscode from 'vscode';

export class ProcessHelper {
  /**
   * 重载当前 VS Code 窗口：
   * 干净且彻底地重置 Webview 渲染进程、RPC 会话和底层的常驻守护进程。
   */
  public static async reloadWindow(): Promise<void> {
    await vscode.commands.executeCommand('workbench.action.reloadWindow');
  }

  /**
   * 重启 VS Code 扩展主机（Extension Host）：
   * 仅重启后台扩展运行进程，不刷新窗口，不打断编辑器界面。
   */
  public static async restartExtensionHost(): Promise<void> {
    await vscode.commands.executeCommand('workbench.action.restartExtensionHost');
  }

  // 别名方法
  public static async restartCodex(): Promise<void> {
    await this.reloadWindow();
  }

  public static async restartAppServer(): Promise<void> {
    await this.reloadWindow();
  }
}
