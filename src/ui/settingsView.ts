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
      label: '修改全局系统提示词 (Base Instructions)',
      description: '自定义全局基础身份与工程准则',
      icon: 'edit',
      command: 'codexModelSwitcher.editBaseInstructions'
    },
    {
      label: '在当前项目配置指令 (AGENTS.md)',
      description: 'Codex 官方最高优先级项目指令',
      icon: 'file-text',
      command: 'codexModelSwitcher.createProjectInstructions'
    },
    {
      label: '恢复默认系统提示词',
      description: '重置为官方通用编程助手设置',
      icon: 'discard',
      command: 'codexModelSwitcher.resetBaseInstructions'
    },
    {
      label: '重启扩展主机 (Restart Extension Host)',
      description: '后台重载所有扩展，不刷新窗口',
      icon: 'sync',
      command: 'codexModelSwitcher.restartExtensionHost'
    },
    {
      label: '重新加载窗口 (Reload Window)',
      description: '完整重置 Webview 与服务进程',
      icon: 'refresh',
      command: 'codexModelSwitcher.reloadWindow'
    },
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
      icon: 'cloud-download',
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
