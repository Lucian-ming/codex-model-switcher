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
    const activeModelId = cfg.model || '未选模型';
    const activeReasoning = cfg.model_reasoning_effort || '默认 (default)';

    const provider = this.registry.get(activeProviderId);
    const providerName = provider ? provider.name : activeProviderId;
    const modelProfile = provider?.models?.find(m => m.modelId === activeModelId);

    // 计算上下文窗口
    const rawTokens = modelProfile?.contextWindow || 128000;
    const override = this.overrideManager.getOverride(activeProviderId, activeModelId);
    const effectiveTokens = override !== undefined ? override : rawTokens;
    const tokenStr = ContextOverrideManager.formatTokens(effectiveTokens);
    const sourceBadge = override !== undefined ? '(用户自定义)' : '(接口发现)';

    const allProviders = this.registry.list();
    const items: CurrentConfigTreeItem[] = [];

    // 1. 当前生效模型
    const modelDisplayName = modelProfile ? modelProfile.displayName : activeModelId;
    const modelItem = new CurrentConfigTreeItem(
      `当前使用模型: ${modelDisplayName}`,
      activeModelId,
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'codexModelSwitcher.switchModel',
        title: '切换模型'
      }
    );
    modelItem.iconPath = new vscode.ThemeIcon('sparkle');
    modelItem.tooltip = `当前生效模型: ${modelDisplayName} (${activeModelId})\n点击可在所有已配置中转站中切换任意模型`;
    items.push(modelItem);

    // 2. 所属中转站
    const providerItem = new CurrentConfigTreeItem(
      `所属中转站: ${providerName}`,
      provider ? sanitizeText(provider.baseUrl || '官方默认') : activeProviderId,
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'codexModelSwitcher.switchProvider',
        title: '切换服务商'
      }
    );
    providerItem.iconPath = new vscode.ThemeIcon('server');
    providerItem.tooltip = `当前模型所属中转站: ${providerName}\n接口端点: ${provider?.baseUrl || '默认'}`;
    items.push(providerItem);

    // 3. 同时激活中转站状态
    const multiProviderItem = new CurrentConfigTreeItem(
      `多站就绪状态: ${allProviders.length} 个中转站已生效`,
      '全部中转站模型可直接切换',
      vscode.TreeItemCollapsibleState.None
    );
    multiProviderItem.iconPath = new vscode.ThemeIcon('check-all');
    multiProviderItem.tooltip = `当前系统中已配置的 ${allProviders.length} 个中转站均已在 Codex 中生效就绪，所有模型无缝互通。`;
    items.push(multiProviderItem);

    // 4. 推理强度
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

    // 5. 上下文容量
    const contextItem = new CurrentConfigTreeItem(
      `上下文容量: ${tokenStr}`,
      sourceBadge,
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'codexModelSwitcher.overrideContextWindow',
        title: '覆盖上下文容量'
      }
    );
    contextItem.iconPath = new vscode.ThemeIcon('symbol-numeric');
    contextItem.tooltip = `当前生效上下文: ${effectiveTokens} tokens ${sourceBadge}\n点击自定义修改上下文大小`;
    items.push(contextItem);

    // 6. 常用快捷操作
    const actionHeader = new CurrentConfigTreeItem('── 常用操作 ──');
    actionHeader.iconPath = new vscode.ThemeIcon('zap');
    items.push(actionHeader);

    const actionSwitchModel = new CurrentConfigTreeItem('跨站快速切换模型', '快捷键: Ctrl+Alt+M', vscode.TreeItemCollapsibleState.None, {
      command: 'codexModelSwitcher.switchModel',
      title: '切换模型'
    });
    actionSwitchModel.iconPath = new vscode.ThemeIcon('arrow-swap');
    items.push(actionSwitchModel);

    const actionAddProvider = new CurrentConfigTreeItem('添加新中转站', '自定义名称与接口', vscode.TreeItemCollapsibleState.None, {
      command: 'codexModelSwitcher.addProvider',
      title: '添加中转站'
    });
    actionAddProvider.iconPath = new vscode.ThemeIcon('add');
    items.push(actionAddProvider);

    return Promise.resolve(items);
  }
}
