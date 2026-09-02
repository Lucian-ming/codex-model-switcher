import * as vscode from 'vscode';
import { CodexConfigManager } from '../codex/configManager.js';

export class StatusBarController {
  private statusBarItem: vscode.StatusBarItem;
  private configManager: CodexConfigManager;

  constructor(configManager: CodexConfigManager) {
    this.configManager = configManager;
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.command = 'codexModelSwitcher.switchModel';
    this.statusBarItem.tooltip = '点击快速切换 Codex 模型或服务商';

    this.update();

    // Listen to config changes
    this.configManager.onConfigChanged(() => {
      this.update();
    });
  }

  public update(): void {
    try {
      const cfg = this.configManager.read();
      const model = cfg.model;
      const provider = cfg.model_provider;

      if (!model) {
        this.statusBarItem.text = '$(warning) Codex: 未选模型';
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      } else {
        this.statusBarItem.text = `$(sparkle) Codex: ${model}`;
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.tooltip = `当前激活模型: ${model}\n服务商: ${provider || '默认'}\n推理等级: ${cfg.model_reasoning_effort || '默认'}\n点击切换模型或服务商`;
      }
      this.statusBarItem.show();
    } catch {
      this.statusBarItem.text = '$(error) Codex: 配置异常';
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      this.statusBarItem.show();
    }
  }

  public dispose(): void {
    this.statusBarItem.dispose();
  }
}
