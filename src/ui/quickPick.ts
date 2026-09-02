import * as vscode from 'vscode';
import { ModelProfile } from '../models/types.js';
import { ProviderConfig } from '../providers/types.js';
import { ContextOverrideManager } from '../models/contextOverride.js';

export interface ModelQuickPickItem extends vscode.QuickPickItem {
  modelProfile: ModelProfile;
}

export class QuickPickController {
  public static async selectModel(
    models: ModelProfile[],
    currentModel?: string,
    currentProvider?: string
  ): Promise<ModelProfile | undefined> {
    if (models.length === 0) {
      vscode.window.showWarningMessage('当前服务商目录下未发现可用模型。');
      return undefined;
    }

    const items: vscode.QuickPickItem[] = models.map((m) => {
      const isCurrent = m.modelId === currentModel;
      const contextK = ContextOverrideManager.formatTokens(m.contextWindow);
      const reasoning = m.defaultReasoningLevel ? `[推理: ${m.defaultReasoningLevel}]` : '';

      return {
        label: `${isCurrent ? '$(check) ' : ''}${m.displayName}`,
        description: `${m.providerId} • ${m.modelId}`,
        detail: `${contextK ? `上下文: ${contextK} • ` : ''}${reasoning ? `${reasoning} • ` : ''}${m.description || ''}`,
        modelProfile: m
      } as any;
    });

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: `选择要切换的 Codex 模型 (当前: ${currentModel || '未设置'} / 服务商: ${currentProvider || '未设置'})`,
      matchOnDescription: true,
      matchOnDetail: true
    });

    return (selected as any)?.modelProfile;
  }

  public static async selectProvider(
    providers: ProviderConfig[],
    currentProvider?: string
  ): Promise<ProviderConfig | undefined> {
    if (providers.length === 0) {
      vscode.window.showWarningMessage('暂未配置任何服务商。请先添加服务商。');
      return undefined;
    }

    const items: vscode.QuickPickItem[] = providers.map((p) => {
      const isCurrent = p.id === currentProvider;
      const modelCount = p.models?.length || 0;
      const healthBadge = p.healthStatus === 'healthy' ? '$(pass-filled) 连通正常' : p.healthStatus === 'unhealthy' ? '$(error) 连接异常' : '$(circle-outline) 未测试';
      const latency = p.latencyMs ? ` (${p.latencyMs}ms)` : '';

      return {
        label: `${isCurrent ? '$(check) ' : ''}${p.name}`,
        description: `${healthBadge} ${p.baseUrl || '官方默认'}${latency}`,
        detail: `协议: ${p.protocol} • 模型数量: ${modelCount} • 标识 ID: ${p.id}`,
        provider: p
      } as any;
    });

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: `选择要激活的 AI 服务商 (当前: ${currentProvider || '未设置'})`,
      matchOnDescription: true,
      matchOnDetail: true
    });

    return (selected as any)?.provider;
  }
}
