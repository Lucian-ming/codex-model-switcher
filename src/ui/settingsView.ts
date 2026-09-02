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
      label: '打开 Codex 配置文件 (config.toml)',
      description: '~/.codex/config.toml',
      icon: 'file-code',
      command: 'codexModelSwitcher.openConfig'
    },
    {
      label: '恢复配置历史备份',
      description: '一键回滚历史配置',
      icon: 'history',
      command: 'codexModelSwitcher.restoreConfig'
    },
    {
      label: '运行系统与环境诊断',
      description: '检查 WSL 路径、权限与服务商状态',
      icon: 'pulse',
      command: 'codexModelSwitcher.diagnose'
    },
    {
      label: '刷新全部服务商模型目录',
      description: '向所有端点同步最新 /v1/models',
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
