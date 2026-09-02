import * as vscode from 'vscode';
import { ProfileManager } from '../profiles/profileManager.js';
import { CodexProfile } from '../profiles/types.js';

export type ProfileTreeElement =
  | { type: 'profile'; profile: CodexProfile }
  | { type: 'empty'; message: string };

export class ProfilesTreeProvider implements vscode.TreeDataProvider<ProfileTreeElement> {
  private _onDidChangeTreeData: vscode.EventEmitter<ProfileTreeElement | undefined | void> =
    new vscode.EventEmitter<ProfileTreeElement | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<ProfileTreeElement | undefined | void> =
    this._onDidChangeTreeData.event;

  constructor(private profileManager: ProfileManager) {}

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ProfileTreeElement): vscode.TreeItem {
    if (element.type === 'empty') {
      const item = new vscode.TreeItem(element.message, vscode.TreeItemCollapsibleState.None);
      item.iconPath = new vscode.ThemeIcon('info');
      return item;
    }

    const p = element.profile;
    const item = new vscode.TreeItem(p.name, vscode.TreeItemCollapsibleState.None);
    item.description = `${p.providerId} • ${p.modelId} ${p.reasoningEffort ? `[${p.reasoningEffort}]` : ''}`;
    item.contextValue = 'profileItem';
    item.iconPath = new vscode.ThemeIcon('bookmark');
    item.tooltip = `Profile: ${p.name}\nProvider: ${p.providerId}\nModel: ${p.modelId}\nReasoning: ${p.reasoningEffort || 'default'}\n${p.description || ''}\nClick to apply this profile`;

    item.command = {
      command: 'codexModelSwitcher.applyProfileDirectly',
      title: 'Apply Profile',
      arguments: [p]
    };

    return item;
  }

  getChildren(element?: ProfileTreeElement): Thenable<ProfileTreeElement[]> {
    if (element) {
      return Promise.resolve([]);
    }

    const profiles = this.profileManager.list();
    if (profiles.length === 0) {
      return Promise.resolve([{ type: 'empty', message: 'No profiles saved. Click + to create.' }]);
    }

    return Promise.resolve(profiles.map(p => ({ type: 'profile', profile: p })));
  }
}
