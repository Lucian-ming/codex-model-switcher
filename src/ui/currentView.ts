import * as vscode from 'vscode';
import { CodexConfigManager } from '../codex/configManager.js';
import { ProviderRegistry } from '../providers/registry.js';
import { ContextOverrideManager } from '../models/contextOverride.js';
import { sanitizeText } from '../security/redactor.js';

export class CurrentConfigTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    description?: string,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
    command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.description = description;
    this.command = command;
  }
}

export class CurrentConfigTreeProvider implements vscode.TreeDataProvider<CurrentConfigTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<CurrentConfigTreeItem | undefined | void> =
    new vscode.EventEmitter<CurrentConfigTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<CurrentConfigTreeItem | undefined | void> =
    this._onDidChangeTreeData.event;

  constructor(
    private configManager: CodexConfigManager,
    private registry: ProviderRegistry,
    private overrideManager: ContextOverrideManager
  ) {}

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: CurrentConfigTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: CurrentConfigTreeItem): Thenable<CurrentConfigTreeItem[]> {
    if (element) {
      return Promise.resolve([]);
    }

    const cfg = this.configManager.read();
    const activeProviderId = cfg.model_provider || 'OpenAI';
    const activeModelId = cfg.model || 'gpt-5.6-sol';
    const activeReasoning = cfg.model_reasoning_effort || 'default';

    const provider = this.registry.get(activeProviderId);
    const providerName = provider ? provider.name : activeProviderId;
    const modelProfile = provider?.models?.find(m => m.modelId === activeModelId);

    // Calculate context window
    const rawTokens = modelProfile?.contextWindow || 128000;
    const override = this.overrideManager.getOverride(activeProviderId, activeModelId);
    const effectiveTokens = override !== undefined ? override : rawTokens;
    const tokenStr = ContextOverrideManager.formatTokens(effectiveTokens);
    const sourceBadge = override !== undefined ? '(User Override)' : '(Discovered)';

    const items: CurrentConfigTreeItem[] = [];

    // 1. Active Provider Item
    const providerItem = new CurrentConfigTreeItem(
      `Provider: ${providerName}`,
      provider ? sanitizeText(provider.baseUrl || 'Official Default') : activeProviderId,
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'codexModelSwitcher.switchProvider',
        title: 'Switch Provider'
      }
    );
    providerItem.iconPath = new vscode.ThemeIcon('server');
    providerItem.tooltip = `Active Provider: ${providerName}\nClick to switch provider`;
    items.push(providerItem);

    // 2. Active Model Item
    const modelDisplayName = modelProfile ? modelProfile.displayName : activeModelId;
    const modelItem = new CurrentConfigTreeItem(
      `Model: ${modelDisplayName}`,
      activeModelId,
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'codexModelSwitcher.switchModel',
        title: 'Switch Model'
      }
    );
    modelItem.iconPath = new vscode.ThemeIcon('sparkle');
    modelItem.tooltip = `Active Model: ${modelDisplayName} (${activeModelId})\nClick to switch model`;
    items.push(modelItem);

    // 3. Reasoning Effort Item
    const reasoningItem = new CurrentConfigTreeItem(
      `Reasoning: ${activeReasoning}`,
      modelProfile?.supportedReasoningLevels ? `(${modelProfile.supportedReasoningLevels.map(l => l.effort).join('/')})` : '',
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'codexModelSwitcher.adjustReasoningEffort',
        title: 'Adjust Reasoning Effort'
      }
    );
    reasoningItem.iconPath = new vscode.ThemeIcon('gear');
    reasoningItem.tooltip = `Active Reasoning Effort: ${activeReasoning}\nClick to adjust reasoning tier`;
    items.push(reasoningItem);

    // 4. Context Window Item
    const contextItem = new CurrentConfigTreeItem(
      `Context: ${tokenStr}`,
      sourceBadge,
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'codexModelSwitcher.overrideContextWindow',
        title: 'Override Context Window'
      }
    );
    contextItem.iconPath = new vscode.ThemeIcon('symbol-numeric');
    contextItem.tooltip = `Effective Context Window: ${effectiveTokens} tokens ${sourceBadge}\nClick to override context limit`;
    items.push(contextItem);

    // 5. Separator / Action Header
    const actionHeader = new CurrentConfigTreeItem('── Quick Actions ──');
    actionHeader.iconPath = new vscode.ThemeIcon('zap');
    items.push(actionHeader);

    // Quick Action: Switch Model
    const actionSwitchModel = new CurrentConfigTreeItem('Switch Model', 'Ctrl+Alt+M', vscode.TreeItemCollapsibleState.None, {
      command: 'codexModelSwitcher.switchModel',
      title: 'Switch Model'
    });
    actionSwitchModel.iconPath = new vscode.ThemeIcon('arrow-swap');
    items.push(actionSwitchModel);

    // Quick Action: Switch Provider
    const actionSwitchProvider = new CurrentConfigTreeItem('Switch Provider', '', vscode.TreeItemCollapsibleState.None, {
      command: 'codexModelSwitcher.switchProvider',
      title: 'Switch Provider'
    });
    actionSwitchProvider.iconPath = new vscode.ThemeIcon('globe');
    items.push(actionSwitchProvider);

    return Promise.resolve(items);
  }
}
