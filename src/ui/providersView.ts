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
      const isProviderEnabled = p.enabled !== false;
      const currentProviderId = this.configManager.getCurrentProvider();
      const currentModelId = this.configManager.getCurrentModel();
      const hasActiveModel = isProviderEnabled && (p.models?.some(m => m.modelId === currentModelId && m.providerId === currentProviderId) || p.id === currentProviderId);

      const modelCount = p.models ? p.models.length : 0;
      const enabledModelCount = p.models ? p.models.filter(m => m.enabled !== false).length : 0;

      let desc = '';
      if (!isProviderEnabled) {
        desc = `${modelCount} 个模型 • [已禁用]`;
      } else {
        desc = `${enabledModelCount}/${modelCount} 个可用 • ${p.protocol} • 已就绪 ${hasActiveModel ? '● [包含当前使用模型]' : ''}`;
      }

      const item = new vscode.TreeItem(
        p.name,
        modelCount > 0
          ? (hasActiveModel ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed)
          : vscode.TreeItemCollapsibleState.None
      );

      item.description = desc;
      item.contextValue = isProviderEnabled ? 'customProvider_enabled' : 'customProvider_disabled';
      item.iconPath = isProviderEnabled
        ? new vscode.ThemeIcon(hasActiveModel ? 'server-process' : 'server')
        : new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('disabledForeground'));

      item.tooltip = `中转站名称: ${p.name}\n唯一标识: ${p.id}\n端点地址: ${sanitizeText(p.baseUrl || '默认')}\n状态: ${isProviderEnabled ? '已启用 (在 Codex 中激活)' : '已禁用 (不显示在切换列表中)'}`;

      return item;
    }

    // Model item
    const m = element.model;
    const isProviderEnabled = element.provider.enabled !== false;
    const isModelEnabled = m.enabled !== false && isProviderEnabled;

    const currentModelId = this.configManager.getCurrentModel();
    const currentProviderId = this.configManager.getCurrentProvider();
    const isActive = isModelEnabled && m.modelId === currentModelId && (m.providerId === currentProviderId || !currentProviderId);

    const override = this.overrideManager.getOverride(m.providerId, m.modelId);
    const tokens = override !== undefined ? override : (m.contextWindow || 128000);
    const tokenStr = ContextOverrideManager.formatTokens(tokens);

    const levels = m.supportedReasoningLevels?.map(l => l.effort).join('/') || m.defaultReasoningLevel || '无推理';

    const item = new vscode.TreeItem(m.displayName, vscode.TreeItemCollapsibleState.None);

    if (!isModelEnabled) {
      item.description = `${m.modelId} • [已禁用]`;
      item.contextValue = 'modelItem_disabled';
      item.iconPath = new vscode.ThemeIcon('circle-slash', new vscode.ThemeColor('disabledForeground'));
      item.tooltip = `模型: ${m.displayName} (${m.modelId})\n状态: 已禁用 (不显示在快速切换列表中)`;
    } else {
      const sourceDesc = override !== undefined
        ? '用户手动自定义覆盖'
        : (m.contextWindowInfo?.source === 'pattern'
          ? '名称后缀精准提取'
          : m.contextWindowInfo?.source === 'knowledge_base'
            ? '权威大模型规格库'
            : m.contextWindowInfo?.source === 'discovered'
              ? '中转站接口直接返回'
              : '默认保底值');

      item.description = `${m.modelId} • ${tokenStr} • [${levels}] ${isActive ? '● [正在使用]' : ''}`;
      item.contextValue = 'modelItem_enabled';
      item.iconPath = new vscode.ThemeIcon(isActive ? 'check' : 'sparkle');
      item.tooltip = `模型: ${m.displayName} (${m.modelId})\n所属服务商: ${element.provider.name}\n上下文容量: ${tokenStr} (${tokens} tokens) [来源: ${sourceDesc}]\n支持推理级别: ${levels}\n点击一键切换 Codex 为该模型`;

      item.command = {
        command: 'codexModelSwitcher.activateModelDirectly',
        title: '激活该模型',
        arguments: [m]
      };
    }

    return item;
  }

  getChildren(element?: ProviderTreeElement): Thenable<ProviderTreeElement[]> {
    if (!element) {
      const providers = this.registry.list();
      if (providers.length === 0) {
        return Promise.resolve([{ type: 'empty', message: '暂未配置中转站，请点击右上角 + 按钮添加自定义服务商。' }]);
      }
      return Promise.resolve(providers.map(p => ({ type: 'provider', provider: p })));
    }

    if (element.type === 'provider') {
      const p = element.provider;
      if (!p.models || p.models.length === 0) {
        return Promise.resolve([{ type: 'empty', message: '未发现模型，请点击右上角 ↻ 刷新图标从接口获取。' }]);
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
