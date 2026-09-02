import * as vscode from 'vscode';
import { ModelProfile } from '../models/types.js';
import { ProviderConfig } from '../providers/types.js';

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
      vscode.window.showWarningMessage('No models found in the active provider catalog.');
      return undefined;
    }

    const items: vscode.QuickPickItem[] = models.map((m) => {
      const isCurrent = m.modelId === currentModel;
      const contextK = m.contextWindow ? `${Math.round(m.contextWindow / 1000)}k` : '';
      const reasoning = m.defaultReasoningLevel ? `[Reasoning: ${m.defaultReasoningLevel}]` : '';

      return {
        label: `${isCurrent ? '$(check) ' : ''}${m.displayName}`,
        description: `${m.providerId} • ${m.modelId}`,
        detail: `${contextK ? `Context: ${contextK} • ` : ''}${reasoning ? `${reasoning} • ` : ''}${m.description || ''}`,
        modelProfile: m
      } as any;
    });

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: `Select Codex Model (Current: ${currentModel || 'None'} / ${currentProvider || 'None'})`,
      matchOnDescription: true,
      matchOnDetail: true
    });

    return (selected as any)?.modelProfile;
  }

  public static async selectProvider(
    providers: ProviderConfig[],
    currentProvider?: string
  ): Promise<ProviderConfig | undefined> {
    const items: vscode.QuickPickItem[] = providers.map((p) => {
      const isCurrent = p.id === currentProvider;
      const modelCount = p.models?.length || 0;
      const healthBadge = p.healthStatus === 'healthy' ? '$(pass-filled)' : p.healthStatus === 'unhealthy' ? '$(error)' : '$(circle-outline)';
      const latency = p.latencyMs ? ` (${p.latencyMs}ms)` : '';

      return {
        label: `${isCurrent ? '$(check) ' : ''}${p.name}`,
        description: `${healthBadge} ${p.baseUrl || 'Default'}${latency}`,
        detail: `Protocol: ${p.protocol} • ${modelCount} models • ID: ${p.id}`,
        provider: p
      } as any;
    });

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: `Select Active AI Provider (Current: ${currentProvider || 'None'})`,
      matchOnDescription: true,
      matchOnDetail: true
    });

    return (selected as any)?.provider;
  }
}
