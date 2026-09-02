import * as vscode from 'vscode';
import { CodexConfigManager } from '../codex/configManager.js';
import { ProviderRegistry } from '../providers/registry.js';
import { ContextOverrideManager } from '../models/contextOverride.js';
import { ProviderConfig } from '../providers/types.js';
import { ModelProfile } from '../models/types.js';
import { sanitizeText } from '../security/redactor.js';

export type ProviderTreeElement =
  | { type: 'provider'; provider: ProviderConfig }
  | { type: 'model'; model: ModelProfile; provider: ProviderConfig }
  | { type: 'empty'; message: string };

export class ProvidersTreeProvider implements vscode.TreeDataProvider<ProviderTreeElement> {
  private _onDidChangeTreeData: vscode.EventEmitter<ProviderTreeElement | undefined | void> =
    new vscode.EventEmitter<ProviderTreeElement | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<ProviderTreeElement | undefined | void> =
    this._onDidChangeTreeData.event;

  constructor(
    private configManager: CodexConfigManager,
    private registry: ProviderRegistry,
    private overrideManager: ContextOverrideManager
  ) {}

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ProviderTreeElement): vscode.TreeItem {
    if (element.type === 'empty') {
      const item = new vscode.TreeItem(element.message, vscode.TreeItemCollapsibleState.None);
      item.iconPath = new vscode.ThemeIcon('info');
      return item;
    }

    if (element.type === 'provider') {
      const p = element.provider;
      const currentProviderId = this.configManager.getCurrentProvider();
      const isActive = p.id === currentProviderId;

      const modelCount = p.models ? p.models.length : 0;
      const desc = `${modelCount} models • ${p.protocol} ${isActive ? '● (Active)' : ''}`;

      const item = new vscode.TreeItem(
        p.name,
        modelCount > 0
          ? (isActive ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed)
          : vscode.TreeItemCollapsibleState.None
      );

      item.description = desc;
      item.contextValue = p.builtin ? 'builtinProvider' : 'customProvider';
      item.iconPath = new vscode.ThemeIcon(isActive ? 'server-process' : 'server');
      item.tooltip = `Provider ID: ${p.id}\nBase URL: ${sanitizeText(p.baseUrl || 'Default')}\nProtocol: ${p.protocol}\nHealth: ${p.healthStatus || 'untested'}`;

      return item;
    }

    // Model item
    const m = element.model;
    const currentModelId = this.configManager.getCurrentModel();
    const currentProviderId = this.configManager.getCurrentProvider();
    const isActive = m.modelId === currentModelId && m.providerId === currentProviderId;

    const override = this.overrideManager.getOverride(m.providerId, m.modelId);
    const tokens = override !== undefined ? override : (m.contextWindow || 128000);
    const tokenStr = ContextOverrideManager.formatTokens(tokens);

    const levels = m.supportedReasoningLevels?.map(l => l.effort).join('/') || m.defaultReasoningLevel || 'none';

    const item = new vscode.TreeItem(m.displayName, vscode.TreeItemCollapsibleState.None);
    item.description = `${m.modelId} • ${tokenStr} • [${levels}]`;
    item.contextValue = 'modelItem';
    item.iconPath = new vscode.ThemeIcon(isActive ? 'check' : 'sparkle');
    item.tooltip = `Model: ${m.displayName} (${m.modelId})\nProvider: ${element.provider.name}\nContext Window: ${tokens} tokens\nReasoning Tiers: ${levels}\nClick to activate this model`;

    item.command = {
      command: 'codexModelSwitcher.activateModelDirectly',
      title: 'Activate Model',
      arguments: [m]
    };

    return item;
  }

  getChildren(element?: ProviderTreeElement): Thenable<ProviderTreeElement[]> {
    if (!element) {
      const providers = this.registry.list();
      if (providers.length === 0) {
        return Promise.resolve([{ type: 'empty', message: 'No providers configured. Click + to add.' }]);
      }
      return Promise.resolve(providers.map(p => ({ type: 'provider', provider: p })));
    }

    if (element.type === 'provider') {
      const p = element.provider;
      if (!p.models || p.models.length === 0) {
        return Promise.resolve([{ type: 'empty', message: 'No models discovered yet. Click refresh icon.' }]);
      }
      return Promise.resolve(
        p.models.map(m => ({
          type: 'model',
          model: m,
          provider: p
        }))
      );
    }

    return Promise.resolve([]);
  }
}
