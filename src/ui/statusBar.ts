import * as vscode from 'vscode';
import { CodexConfigManager } from '../codex/configManager.js';

export class StatusBarController {
  private statusBarItem: vscode.StatusBarItem;
  private configManager: CodexConfigManager;

  constructor(configManager: CodexConfigManager) {
    this.configManager = configManager;
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.command = 'codexModelSwitcher.switchModel';
    this.statusBarItem.tooltip = 'Click to switch Codex model or provider';

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
        this.statusBarItem.text = '$(warning) Codex: No Model';
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      } else {
        this.statusBarItem.text = `$(sparkle) Codex: ${model}`;
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.tooltip = `Codex Active Model: ${model}\nProvider: ${provider || 'Default'}\nReasoning Effort: ${cfg.model_reasoning_effort || 'default'}\nClick to switch`;
      }
      this.statusBarItem.show();
    } catch {
      this.statusBarItem.text = '$(error) Codex: Config Error';
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      this.statusBarItem.show();
    }
  }

  public dispose(): void {
    this.statusBarItem.dispose();
  }
}
