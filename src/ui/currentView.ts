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
    const activeReasoning = cfg.model_reasoning_effort || '默认 (default)';

    const provider = this.registry.get(activeProviderId);
    const providerName = provider ? provider.name : activeProviderId;
    const modelProfile = provider?.models?.find(m => m.modelId === activeModelId);

    // 计算上下文窗口
    const rawTokens = modelProfile?.contextWindow || 128000;
    const override = this.overrideManager.getOverride(activeProviderId, activeModelId);
    const effectiveTokens = override !== undefined ? override : rawTokens;
    const tokenStr = ContextOverrideManager.formatTokens(effectiveTokens);
    const sourceBadge = override !== undefined ? '(用户覆盖)' : '(接口发现)';

    const items: CurrentConfigTreeItem[] = [];

    // 1. 当前服务商
    const providerItem = new CurrentConfigTreeItem(
      `服务商: ${providerName}`,
      provider ? sanitizeText(provider.baseUrl || '官方默认') : activeProviderId,
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'codexModelSwitcher.switchProvider',
        title: '切换服务商'
      }
    );
    providerItem.iconPath = new vscode.ThemeIcon('server');
    providerItem.tooltip = `当前生效服务商: ${providerName} (${activeProviderId})\n端点: ${provider?.baseUrl || '默认'}\n点击快速切换服务商`;
    items.push(providerItem);

    // 2. 当前模型
    const modelDisplayName = modelProfile ? modelProfile.displayName : activeModelId;
    const modelItem = new CurrentConfigTreeItem(
      `模型: ${modelDisplayName}`,
      activeModelId,
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'codexModelSwitcher.switchModel',
        title: '切换模型'
      }
    );
    modelItem.iconPath = new vscode.ThemeIcon('sparkle');
    modelItem.tooltip = `当前生效模型: ${modelDisplayName} (${activeModelId})\n点击快速切换模型`;
    items.push(modelItem);

    // 3. 推理强度
    const reasoningItem = new CurrentConfigTreeItem(
      `推理强度: ${activeReasoning}`,
      modelProfile?.supportedReasoningLevels ? `[${modelProfile.supportedReasoningLevels.map(l => l.effort).join('/')}]` : '',
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'codexModelSwitcher.adjustReasoningEffort',
        title: '调整推理强度'
      }
    );
    reasoningItem.iconPath = new vscode.ThemeIcon('gear');
    reasoningItem.tooltip = `当前推理等级: ${activeReasoning}\n点击调整推理强度 (Reasoning Effort)`;
    items.push(reasoningItem);

    // 4. 上下文窗口
    const contextItem = new CurrentConfigTreeItem(
      `上下文: ${tokenStr}`,
      sourceBadge,
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'codexModelSwitcher.overrideContextWindow',
        title: '覆盖上下文窗口'
      }
    );
    contextItem.iconPath = new vscode.ThemeIcon('symbol-numeric');
    contextItem.tooltip = `当前生效上下文: ${effectiveTokens} tokens ${sourceBadge}\n点击自定义修改上下文大小`;
    items.push(contextItem);

    // 5. 快捷操作分组
    const actionHeader = new CurrentConfigTreeItem('── 常用快捷操作 ──');
    actionHeader.iconPath = new vscode.ThemeIcon('zap');
    items.push(actionHeader);

    // 切换模型
    const actionSwitchModel = new CurrentConfigTreeItem('切换激活模型', '快捷键: Ctrl+Alt+M', vscode.TreeItemCollapsibleState.None, {
      command: 'codexModelSwitcher.switchModel',
      title: '切换模型'
    });
    actionSwitchModel.iconPath = new vscode.ThemeIcon('arrow-swap');
    items.push(actionSwitchModel);

    // 切换服务商
    const actionSwitchProvider = new CurrentConfigTreeItem('切换激活服务商', '', vscode.TreeItemCollapsibleState.None, {
      command: 'codexModelSwitcher.switchProvider',
      title: '切换服务商'
    });
    actionSwitchProvider.iconPath = new vscode.ThemeIcon('globe');
    items.push(actionSwitchProvider);

    return Promise.resolve(items);
  }
}
