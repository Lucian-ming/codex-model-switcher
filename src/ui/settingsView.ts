import * as vscode from 'vscode';

export interface SettingTreeItem {
  label: string;
  description: string;
  icon: string;
  command: string;
}

export class SettingsTreeProvider implements vscode.TreeDataProvider<SettingTreeItem> {
  private items: SettingTreeItem[] = [
    {
      label: 'Open Codex Config (config.toml)',
      description: '~/.codex/config.toml',
      icon: 'file-code',
      command: 'codexModelSwitcher.openConfig'
    },
    {
      label: 'Restore Configuration Backup',
      description: 'One-click rollback',
      icon: 'history',
      command: 'codexModelSwitcher.restoreConfig'
    },
    {
      label: 'Run System Diagnostics',
      description: 'WSL, Codex paths & health',
      icon: 'pulse',
      command: 'codexModelSwitcher.diagnose'
    },
    {
      label: 'Refresh All Models',
      description: 'Sync upstream /v1/models',
      icon: 'refresh',
      command: 'codexModelSwitcher.refreshModels'
    }
  ];

  getTreeItem(element: SettingTreeItem): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
    item.description = element.description;
    item.iconPath = new vscode.ThemeIcon(element.icon);
    item.command = {
      command: element.command,
      title: element.label
    };
    return item;
  }

  getChildren(): Thenable<SettingTreeItem[]> {
    return Promise.resolve(this.items);
  }
}
