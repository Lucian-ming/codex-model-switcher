import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CodexConfigManager } from './codex/configManager.js';
import { PathResolver } from './codex/pathResolver.js';
import { SecretManager } from './security/secretManager.js';
import { ProviderRegistry } from './providers/registry.js';
import { ProfileManager } from './profiles/profileManager.js';
import { ModelCache } from './models/cache.js';
import { ModelDiscovery } from './models/discovery.js';
import { CatalogExporter } from './models/catalogExporter.js';
import { ContextOverrideManager } from './models/contextOverride.js';
import { ReasoningManager } from './models/reasoningManager.js';
import { ProviderTester } from './providers/tester.js';
import { StatusBarController } from './ui/statusBar.js';
import { QuickPickController } from './ui/quickPick.js';
import { DiagnosticsRunner } from './commands/diagnose.js';
import { CurrentConfigTreeProvider } from './ui/currentView.js';
import { ProvidersTreeProvider, ProviderTreeElement } from './ui/providersView.js';
import { ProfilesTreeProvider } from './ui/profilesView.js';
import { SettingsTreeProvider } from './ui/settingsView.js';
import { ProviderConfig } from './providers/types.js';
import { ModelProfile } from './models/types.js';
import { CodexProfile } from './profiles/types.js';
import { ProcessHelper } from './codex/processHelper.js';
import { InstructionManager } from './instructions/instructionManager.js';

let outputChannel: vscode.OutputChannel;
let statusBar: StatusBarController;
let configManager: CodexConfigManager;
let secretManager: SecretManager;
let registry: ProviderRegistry;
let profileManager: ProfileManager;
let modelCache: ModelCache;
let overrideManager: ContextOverrideManager;
let instructionManager: InstructionManager;

let currentTreeProvider: CurrentConfigTreeProvider;
let providersTreeProvider: ProvidersTreeProvider;
let profilesTreeProvider: ProfilesTreeProvider;
let settingsTreeProvider: SettingsTreeProvider;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('Codex Model Switcher');
  outputChannel.appendLine('正在激活 Codex 模型切换器...');

  const env = PathResolver.resolve();
  outputChannel.appendLine(`环境已检测: Platform=${env.platform}, WSL=${env.isWsl}, Distro=${env.wslDistro || '无'}`);
  outputChannel.appendLine(`Codex 配置目录: ${env.codexHome}`);

  configManager = new CodexConfigManager();
  secretManager = new SecretManager(context.secrets);
  registry = new ProviderRegistry(configManager);
  profileManager = new ProfileManager(configManager);
  modelCache = new ModelCache();
  overrideManager = new ContextOverrideManager();
  instructionManager = new InstructionManager();
  statusBar = new StatusBarController(configManager);

  // 监听系统提示词文档保存事件，即时热重载
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(doc => {
      if (doc.uri.fsPath === instructionManager.getInstructionsPath()) {
        outputChannel.appendLine('检测到 base_instructions.md 保存，正在重新同步 Codex 模型目录...');
        syncCatalogToCodex();
        vscode.window.showInformationMessage('全局默认系统提示词已更新并同步写入 Codex 模型目录！切换模型或重载窗口即可生效。');
      }
    })
  );

  // 初始化侧边栏四大原生视图
  currentTreeProvider = new CurrentConfigTreeProvider(configManager, registry, overrideManager);
  providersTreeProvider = new ProvidersTreeProvider(configManager, registry, overrideManager);
  profilesTreeProvider = new ProfilesTreeProvider(profileManager);
  settingsTreeProvider = new SettingsTreeProvider();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('codexModelSwitcher.current', currentTreeProvider),
    vscode.window.registerTreeDataProvider('codexModelSwitcher.providers', providersTreeProvider),
    vscode.window.registerTreeDataProvider('codexModelSwitcher.profiles', profilesTreeProvider),
    vscode.window.registerTreeDataProvider('codexModelSwitcher.settings', settingsTreeProvider)
  );

  // 监听 ~/.codex/config.toml 文件变动，保证外部或命令行编辑时实时同步
  try {
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(vscode.Uri.file(env.codexHome), 'config.toml')
    );
    watcher.onDidChange(() => {
      outputChannel.appendLine('检测到 config.toml 发生变动，正在同步更新视图与状态栏...');
      refreshAllViews();
    });
    context.subscriptions.push(watcher);
  } catch (err) {
    outputChannel.appendLine(`提示: 文件变动监听器已降级启动: ${err}`);
  }

  // 启动时自动将所有已配置服务商和模型合并注入 Codex
  const autoInject = vscode.workspace.getConfiguration('codexModelSwitcher').get<boolean>('autoInjectCatalog', true);
  if (autoInject) {
    syncCatalogToCodex();
  }

  // 注册命令
  context.subscriptions.push(
    vscode.commands.registerCommand('codexModelSwitcher.switchModel', handleSwitchModel),
    vscode.commands.registerCommand('codexModelSwitcher.switchProvider', handleSwitchProvider),
    vscode.commands.registerCommand('codexModelSwitcher.switchProfile', handleSwitchProfile),
    vscode.commands.registerCommand('codexModelSwitcher.adjustReasoningEffort', handleAdjustReasoningEffort),
    vscode.commands.registerCommand('codexModelSwitcher.overrideContextWindow', handleOverrideContextWindow),
    vscode.commands.registerCommand('codexModelSwitcher.resetContextWindow', handleResetContextWindow),
    vscode.commands.registerCommand('codexModelSwitcher.refreshModels', handleRefreshModels),
    vscode.commands.registerCommand('codexModelSwitcher.testProvider', handleTestProvider),
    vscode.commands.registerCommand('codexModelSwitcher.manageProviders', handleManageProviders),
    vscode.commands.registerCommand('codexModelSwitcher.addProvider', promptAddCustomProvider),
    vscode.commands.registerCommand('codexModelSwitcher.editProvider', promptEditProvider),
    vscode.commands.registerCommand('codexModelSwitcher.toggleProviderEnabled', handleToggleProviderEnabled),
    vscode.commands.registerCommand('codexModelSwitcher.disableProvider', handleToggleProviderEnabled),
    vscode.commands.registerCommand('codexModelSwitcher.enableProvider', handleToggleProviderEnabled),
    vscode.commands.registerCommand('codexModelSwitcher.toggleModelEnabled', handleToggleModelEnabled),
    vscode.commands.registerCommand('codexModelSwitcher.disableModel', handleToggleModelEnabled),
    vscode.commands.registerCommand('codexModelSwitcher.enableModel', handleToggleModelEnabled),
    vscode.commands.registerCommand('codexModelSwitcher.deleteProviderDirectly', handleDeleteProviderDirectly),
    vscode.commands.registerCommand('codexModelSwitcher.manageProfiles', handleManageProfiles),
    vscode.commands.registerCommand('codexModelSwitcher.openConfig', handleOpenConfig),
    vscode.commands.registerCommand('codexModelSwitcher.restoreConfig', handleRestoreConfig),
    vscode.commands.registerCommand('codexModelSwitcher.editBaseInstructions', handleEditBaseInstructions),
    vscode.commands.registerCommand('codexModelSwitcher.createProjectInstructions', handleCreateProjectInstructions),
    vscode.commands.registerCommand('codexModelSwitcher.resetBaseInstructions', handleResetBaseInstructions),
    vscode.commands.registerCommand('codexModelSwitcher.restartExtensionHost', () => ProcessHelper.restartExtensionHost()),
    vscode.commands.registerCommand('codexModelSwitcher.reloadWindow', () => ProcessHelper.reloadWindow()),
    vscode.commands.registerCommand('codexModelSwitcher.openOrcaRouterRef', () => {
      vscode.env.openExternal(vscode.Uri.parse('https://www.orcarouter.ai/ref/ref_b779bf29c6f860b78f52'));
    }),
    vscode.commands.registerCommand('codexModelSwitcher.diagnose', handleDiagnose),
    vscode.commands.registerCommand('codexModelSwitcher.activateModelDirectly', handleActivateModelDirectly),
    vscode.commands.registerCommand('codexModelSwitcher.applyProfileDirectly', handleApplyProfileDirectly)
  );

  context.subscriptions.push(statusBar);
  outputChannel.appendLine('Codex 模型切换器激活完成。所有中转站均已就绪。');
}

export function deactivate() {
  if (statusBar) {
    statusBar.dispose();
  }
}

function refreshAllViews(): void {
  if (currentTreeProvider) currentTreeProvider.refresh();
  if (providersTreeProvider) providersTreeProvider.refresh();
  if (profilesTreeProvider) profilesTreeProvider.refresh();
  if (statusBar) statusBar.update();
}

/**
 * 将所有已配置的中转站及其模型并发写入 Codex 系统：
 * 1. 确保每一个服务商都在 config.toml 的 [model_providers] 表中同时注册生效；
 * 2. 将所有中转站的模型汇总导出至 model_catalog.json，使官方 Codex 扩展可跨站直选。
 */
function syncCatalogToCodex(): void {
  try {
    const allProviders = registry.list();
    let allModels: ModelProfile[] = [];

    for (const p of allProviders) {
      if (p.enabled === false) {
        // 禁用的服务商从 config.toml 中临时解绑
        configManager.removeProvider(p.id);
        continue;
      }

      // 确保每个已启用的服务商在 config.toml 的 model_providers 中均有定义
      configManager.upsertProvider(p.id, {
        name: p.name,
        base_url: p.baseUrl,
        wire_api: p.protocol,
        requires_openai_auth: p.requiresOpenaiAuth,
        env_key: p.envKey,
        http_headers: p.headers,
        query_params: p.queryParams
      });

      if (p.models && p.models.length > 0) {
        const activeModels = p.models.filter(m => m.enabled !== false);
        allModels.push(...activeModels);
      }
    }

    const instructions = instructionManager ? instructionManager.getInstructions() : undefined;
    if (allModels.length > 0) {
      const effectiveModels = overrideManager.applyToModels(allModels);
      CatalogExporter.exportCatalog(effectiveModels, undefined, configManager, instructions);
      outputChannel.appendLine(`已向 Codex 官方目录合并导出 ${effectiveModels.length} 个可用模型 (自定义提示词已注入)。`);
    } else {
      CatalogExporter.exportCatalog([], undefined, configManager, instructions);
    }
  } catch (err: any) {
    outputChannel.appendLine(`同步多站模型目录失败: ${err.message}`);
  }
}

async function handleSwitchModel(): Promise<void> {
  const currentModel = configManager.getCurrentModel();
  const currentProviderId = configManager.getCurrentProvider();

  // 仅跨已启用的中转站收集未被禁用的可用模型
  let candidateModels: ModelProfile[] = [];
  for (const p of registry.list()) {
    if (p.enabled === false) continue;
    if (p.models && p.models.length > 0) {
      candidateModels.push(...p.models.filter(m => m.enabled !== false));
    }
  }

  if (candidateModels.length === 0) {
    const action = await vscode.window.showWarningMessage(
      '当前未发现可用模型（或全部模型/服务商已被禁用）。是否从接口刷新模型或添加新中转站？',
      '刷新模型',
      '添加中转站'
    );
    if (action === '刷新模型') {
      await handleRefreshModels();
    } else if (action === '添加中转站') {
      await promptAddCustomProvider();
    }
    return;
  }

  const selected = await QuickPickController.selectModel(candidateModels, currentModel, currentProviderId);
  if (!selected) return;

  await handleActivateModelDirectly(selected);
}

async function handleActivateModelDirectly(selected: ModelProfile): Promise<void> {
  const currentEffort = configManager.read().model_reasoning_effort || 'default';

  try {
    // 1. 自适应推理等级校验与回退
    const fallback = ReasoningManager.adaptEffortOnSwitch(currentEffort, selected);
    if (fallback.didFallback && fallback.reason) {
      vscode.window.showWarningMessage(fallback.reason);
    }

    // 2. 原子更新 config.toml: 同时设置 model 和对应的 model_provider
    const cfg = configManager.read();
    cfg.model = selected.modelId;
    if (selected.providerId) {
      cfg.model_provider = selected.providerId;
    }
    if (fallback.effort && fallback.effort !== 'none') {
      cfg.model_reasoning_effort = fallback.effort;
    } else {
      delete cfg.model_reasoning_effort;
    }
    configManager.write(cfg);

    // 3. 导出模型目录并更新所有视图与状态栏
    syncCatalogToCodex();
    refreshAllViews();

    // 4. 零打扰极速生效：毫秒级完成，窗口不白屏、不打断心流
    const providerObj = registry.get(selected.providerId);
    const providerName = providerObj ? providerObj.name : selected.providerId;
    vscode.window.setStatusBarMessage(`$(check) Codex 当前模型已切换为: ${selected.displayName} (${providerName})`, 4000);

    // 轻量非阻塞通知（带重载快捷操作，无需处理亦可直接在后续会话中生效）
    vscode.window.showInformationMessage(
      `已切换至模型: ${selected.displayName} (${providerName})。新对话将自动生效。`,
      '重启扩展主机',
      '重载窗口'
    ).then(action => {
      if (action === '重启扩展主机') {
        ProcessHelper.restartExtensionHost();
      } else if (action === '重载窗口') {
        ProcessHelper.reloadWindow();
      }
    });
  } catch (err: any) {
    vscode.window.showErrorMessage(`激活模型失败: ${err.message}`);
  }
}

async function handleSwitchProvider(): Promise<void> {
  const providers = registry.list();
  const currentProvider = configManager.getCurrentProvider();

  const selected = await QuickPickController.selectProvider(providers, currentProvider);
  if (!selected) return;

  try {
    configManager.setProvider(selected.id);

    if (selected.models && selected.models.length > 0) {
      await handleActivateModelDirectly(selected.models[0]);
    } else {
      syncCatalogToCodex();
      refreshAllViews();
      vscode.window.showInformationMessage(`已切换为中转站: ${selected.name}`);
    }
  } catch (err: any) {
    vscode.window.showErrorMessage(`切换中转站失败: ${err.message}`);
  }
}

async function handleAdjustReasoningEffort(): Promise<void> {
  const currentModelId = configManager.getCurrentModel() || 'gpt-5.6-sol';
  const currentProviderId = configManager.getCurrentProvider();
  const provider = currentProviderId ? registry.get(currentProviderId) : undefined;
  const modelProfile = provider?.models?.find(m => m.modelId === currentModelId);

  const reasoningInfo = modelProfile?.reasoningInfo || ReasoningManager.inferReasoningCapabilities(currentModelId);

  if (!reasoningInfo.supported || reasoningInfo.levels.length === 0) {
    vscode.window.showInformationMessage(`当前模型 "${currentModelId}" 不支持推理强度配置。`);
    return;
  }

  const currentEffort = configManager.read().model_reasoning_effort || reasoningInfo.defaultLevel;
  const items = reasoningInfo.levels.map(l => ({
    label: `${l.effort === currentEffort ? '● ' : ''}${l.effort}`,
    description: l.description,
    effort: l.effort
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: `选择 ${currentModelId} 的推理强度 (当前: ${currentEffort})`
  });
  if (!selected) return;

  try {
    const cfg = configManager.read();
    cfg.model_reasoning_effort = selected.effort;
    configManager.write(cfg);

    refreshAllViews();
    vscode.window.showInformationMessage(`推理强度已更新为: ${selected.effort}`);
  } catch (err: any) {
    vscode.window.showErrorMessage(`调整推理强度失败: ${err.message}`);
  }
}

async function handleOverrideContextWindow(element?: ProviderTreeElement): Promise<void> {
  let targetModelId = configManager.getCurrentModel() || 'gpt-5.6-sol';
  let targetProviderId = configManager.getCurrentProvider() || 'OpenAI';

  if (element && element.type === 'model') {
    targetModelId = element.model.modelId;
    targetProviderId = element.model.providerId;
  }

  const provider = registry.get(targetProviderId);
  const model = provider?.models?.find(m => m.modelId === targetModelId);

  const discoveredTokens = model?.contextWindow || 128000;
  const currentOverride = overrideManager.getOverride(targetProviderId, targetModelId);
  const currentTokens = currentOverride !== undefined ? currentOverride : discoveredTokens;

  const input = await vscode.window.showInputBox({
    prompt: `请输入模型 ${targetModelId} 的上下文容量 (支持: 128K, 200K, 256K, 1M 或纯数字 token)`,
    value: ContextOverrideManager.formatTokens(currentTokens),
    validateInput: val => {
      const parsed = ContextOverrideManager.parseTokenInput(val);
      if (!parsed || parsed < 1000) {
        return '请输入有效的大小表达 (如 128K, 200K, 1M, 或 >= 1000 的数字)';
      }
      return null;
    }
  });
  if (!input) return;

  const tokens = ContextOverrideManager.parseTokenInput(input);
  if (!tokens) return;

  try {
    overrideManager.setOverride(targetProviderId, targetModelId, tokens);
    syncCatalogToCodex();
    refreshAllViews();
    vscode.window.showInformationMessage(
      `已将 ${targetModelId} 的上下文容量覆盖为 ${ContextOverrideManager.formatTokens(tokens)} (${tokens} tokens)。`
    );
  } catch (err: any) {
    vscode.window.showErrorMessage(`覆盖上下文窗口失败: ${err.message}`);
  }
}

async function handleResetContextWindow(): Promise<void> {
  const currentModelId = configManager.getCurrentModel() || 'gpt-5.6-sol';
  const currentProviderId = configManager.getCurrentProvider() || 'OpenAI';

  const existed = overrideManager.resetOverride(currentProviderId, currentModelId);
  if (existed) {
    syncCatalogToCodex();
    refreshAllViews();
    vscode.window.showInformationMessage(`已重置 ${currentModelId} 的上下文窗口至接口发现值。`);
  } else {
    vscode.window.showInformationMessage(`模型 ${currentModelId} 当前没有自定义覆盖记录。`);
  }
}

async function handleSwitchProfile(): Promise<void> {
  const profiles = profileManager.list();
  if (profiles.length === 0) {
    const action = await vscode.window.showInformationMessage(
      '暂无配置预设。是否立即基于当前配置创建？',
      '创建预设'
    );
    if (action === '创建预设') {
      await handleManageProfiles();
    }
    return;
  }

  const items = profiles.map(p => ({
    label: p.name,
    description: `${p.providerId} • ${p.modelId}`,
    detail: `${p.description || ''} ${p.reasoningEffort ? `[推理: ${p.reasoningEffort}]` : ''}`,
    profile: p
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: '选择要应用的 Codex 配置预设'
  });
  if (!selected) return;

  await handleApplyProfileDirectly(selected.profile);
}

async function handleApplyProfileDirectly(profile: CodexProfile): Promise<void> {
  try {
    profileManager.applyProfile(profile);
    syncCatalogToCodex();
    refreshAllViews();
    vscode.window.setStatusBarMessage(`$(check) 已应用配置预设: ${profile.name}`, 4000);
    vscode.window.showInformationMessage(
      `已成功应用配置预设: ${profile.name}。`,
      '重启扩展主机',
      '重载窗口'
    ).then(action => {
      if (action === '重启扩展主机') {
        ProcessHelper.restartExtensionHost();
      } else if (action === '重载窗口') {
        ProcessHelper.reloadWindow();
      }
    });
  } catch (err: any) {
    vscode.window.showErrorMessage(`应用预设失败: ${err.message}`);
  }
}

async function handleRefreshModels(element?: ProviderTreeElement): Promise<void> {
  let targetProviders: ProviderConfig[] = [];

  if (element && element.type === 'provider') {
    targetProviders = [element.provider];
  } else {
    targetProviders = registry.list();
  }

  if (targetProviders.length === 0) {
    vscode.window.showInformationMessage('当前未配置任何中转站。请先添加中转站。');
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: '正在向中转站同步最新模型目录...',
      cancellable: false
    },
    async (progress) => {
      let totalDiscovered = 0;
      for (const p of targetProviders) {
        if (!p.baseUrl) continue;
        progress.report({ message: `正在请求 ${p.name}...` });
        try {
          const apiKey = await secretManager.getSecret(`provider.${p.id}.apiKey`);
          const discovered = await ModelDiscovery.discover(p, apiKey);
          registry.updateModels(p.id, discovered);
          modelCache.set(p.id, discovered);
          totalDiscovered += discovered.length;
        } catch (err: any) {
          outputChannel.appendLine(`中转站 ${p.name} 模型发现失败: ${err.message}`);
        }
      }

      syncCatalogToCodex();
      refreshAllViews();
      vscode.window.showInformationMessage(`模型列表刷新完成，共汇总 ${totalDiscovered} 个模型。`);
    }
  );
}

async function handleTestProvider(element?: ProviderTreeElement): Promise<void> {
  let selected: ProviderConfig | undefined;
  if (element && element.type === 'provider') {
    selected = element.provider;
  } else {
    const providers = registry.list();
    selected = await QuickPickController.selectProvider(providers, configManager.getCurrentProvider());
  }
  if (!selected) return;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `正在测试与 ${selected.name} 的连通性...`,
      cancellable: false
    },
    async () => {
      const apiKey = await secretManager.getSecret(`provider.${selected!.id}.apiKey`);
      const health = await ProviderTester.test(selected!, apiKey);

      registry.updateHealth(selected!.id, health.latencyMs, health.reachable && health.authValid);
      refreshAllViews();

      if (health.reachable && health.authValid) {
        vscode.window.showInformationMessage(
          `✓ ${selected!.name} 连接正常 (延迟: ${health.latencyMs}ms)。成功获取到 ${health.modelCount} 个模型。`
        );
      } else {
        vscode.window.showWarningMessage(`✗ ${selected!.name}: ${health.message}`);
      }
    }
  );
}

async function handleManageProviders(): Promise<void> {
  const actions = [
    { label: '$(add) 添加中转站 / 服务商', action: 'add' },
    { label: '$(edit) 修改中转站名字 / 端点地址', action: 'edit' },
    { label: '$(key) 设置 / 更换 API Key', action: 'apiKey' },
    { label: '$(refresh) 刷新全部中转站模型列表', action: 'refresh' },
    { label: '$(pulse) 测试中转站连通状态', action: 'test' },
    { label: '$(trash) 删除中转站', action: 'remove' }
  ];

  const picked = await vscode.window.showQuickPick(actions, { placeHolder: '请选择中转站管理操作' });
  if (!picked) return;

  if (picked.action === 'add') {
    await promptAddCustomProvider();
  } else if (picked.action === 'edit') {
    await promptEditProvider();
  } else if (picked.action === 'apiKey') {
    await promptSetApiKey();
  } else if (picked.action === 'refresh') {
    await handleRefreshModels();
  } else if (picked.action === 'test') {
    await handleTestProvider();
  } else if (picked.action === 'remove') {
    await handleDeleteProviderDirectly();
  }
}

/**
 * 步骤式添加自定义服务商，支持完全自定义中转站名字
 */
async function promptAddCustomProvider(): Promise<void> {
  const presetOptions = [
    {
      label: '$(sparkle) OrcaRouter',
      description: 'https://api.orcarouter.ai/v1',
      detail: 'OpenAI 兼容聚合模型路由网关 (Claude / OpenAI / Gemini / DeepSeek)',
      presetId: 'orcarouter',
      name: 'OrcaRouter',
      baseUrl: 'https://api.orcarouter.ai/v1',
      protocol: 'chat',
      website: 'https://www.orcarouter.ai/ref/ref_b779bf29c6f860b78f52'
    },
    {
      label: '$(cloud) OpenRouter',
      description: 'https://openrouter.ai/api/v1',
      detail: 'Unified interface for LLMs and cognitive APIs',
      presetId: 'openrouter',
      name: 'OpenRouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      protocol: 'chat',
      website: 'https://openrouter.ai'
    },
    {
      label: '$(server) DeepSeek',
      description: 'https://api.deepseek.com/v1',
      detail: 'DeepSeek 官方 API (DeepSeek-V3 / DeepSeek-R1)',
      presetId: 'deepseek',
      name: 'DeepSeek',
      baseUrl: 'https://api.deepseek.com/v1',
      protocol: 'chat',
      website: 'https://deepseek.com'
    },
    {
      label: '$(zap) SiliconFlow (硅基流动)',
      description: 'https://api.siliconflow.cn/v1',
      detail: 'SiliconFlow 大模型计算与分发平台',
      presetId: 'siliconflow',
      name: 'SiliconFlow',
      baseUrl: 'https://api.siliconflow.cn/v1',
      protocol: 'chat',
      website: 'https://siliconflow.cn'
    },
    {
      label: '$(add) 自定义服务商 / 中转站 (Custom Provider)',
      description: '手动输入中转站名称、端点 URL 与通信协议',
      detail: '支持各类私有中转网关、OneAPI / NewAPI 与本地 Ollama 兼容端点',
      presetId: 'custom',
      name: '',
      baseUrl: '',
      protocol: 'responses',
      website: ''
    }
  ];

  const selectedPreset = await vscode.window.showQuickPick(presetOptions, {
    placeHolder: '选择要添加的服务商预设或自定义中转站'
  });
  if (!selectedPreset) return;

  let name = selectedPreset.name;
  let baseUrl = selectedPreset.baseUrl;
  let protocolStr = selectedPreset.protocol;

  if (selectedPreset.presetId === 'custom') {
    // 第 1 步: 自定义显示名称
    const customName = await vscode.window.showInputBox({
      prompt: '第 1/4 步: 请输入服务商/中转站显示名称 (如: 主力中转站、我的专用网关)',
      placeHolder: '例如: 我的中转站'
    });
    if (!customName) return;
    name = customName;

    // 第 2 步: API 端点 URL
    const customUrl = await vscode.window.showInputBox({
      prompt: '第 2/4 步: 请输入 API 基础端点 URL (如: https://api.example.com/v1)',
      placeHolder: 'https://...',
      validateInput: v => (v && (v.startsWith('http://') || v.startsWith('https://')) ? null : '必须以 http:// 或 https:// 开头')
    });
    if (!customUrl) return;
    baseUrl = customUrl;

    // 第 3 步: 通信协议
    const protocolPick = await vscode.window.showQuickPick(
      [
        { label: 'responses', description: 'OpenAI Responses API (Codex 官方标准协议，强烈推荐)' },
        { label: 'chat', description: 'OpenAI Chat Completions 协议 (部分兼容网关支持)' },
        { label: 'anthropic', description: 'Anthropic 格式协议' }
      ],
      { placeHolder: '第 3/4 步: 选择通信协议 (推荐直接选 responses)' }
    );
    if (!protocolPick) return;
    protocolStr = protocolPick.label;
  }

  // 内部唯一 ID 后台静默自动生成，无需打扰用户
  const id = selectedPreset.presetId !== 'custom'
    ? selectedPreset.presetId
    : 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);

  // 第 4 步: API Key
  const apiKey = await vscode.window.showInputBox({
    prompt: selectedPreset.website
      ? `请输入 ${name} API Key (可在 ${selectedPreset.website} 获取):`
      : `请输入 ${name} 的 API Key (可选，将安全加密存入 VS Code SecretStorage):`,
    password: true
  });

  const newProvider: ProviderConfig = {
    id,
    name,
    baseUrl,
    protocol: protocolStr as any,
    models: []
  };

  if (apiKey) {
    await secretManager.storeSecret(`provider.${id}.apiKey`, apiKey);
    newProvider.headers = {
      'Authorization': `Bearer ${apiKey}`
    };
  }

  registry.register(newProvider);
  syncCatalogToCodex();
  refreshAllViews();
  vscode.window.showInformationMessage(`中转站 "${name}" (${id}) 添加成功并已激活生效。`);

  // 自动拉取发现模型
  try {
    const discovered = await ModelDiscovery.discover(newProvider, apiKey);
    if (discovered.length > 0) {
      registry.updateModels(id, discovered);
      syncCatalogToCodex();
      refreshAllViews();
      vscode.window.showInformationMessage(`自动从 "${name}" 发现了 ${discovered.length} 个模型并已注入 Codex。`);
    }
  } catch (err: any) {
    outputChannel.appendLine(`添加服务商后的自动发现提示: ${err.message}`);
  }
}

/**
 * 修改服务商信息（允许自定义名字和端点 URL）
 */
async function promptEditProvider(element?: ProviderTreeElement): Promise<void> {
  let selected: ProviderConfig | undefined;
  if (element && element.type === 'provider') {
    selected = element.provider;
  } else {
    const providers = registry.list();
    if (providers.length === 0) {
      vscode.window.showInformationMessage('暂未配置任何服务商。');
      return;
    }
    selected = await QuickPickController.selectProvider(providers);
  }
  if (!selected) return;

  const newName = await vscode.window.showInputBox({
    prompt: `修改中转站 "${selected.name}" 的显示名称:`,
    value: selected.name
  });
  if (!newName) return;

  const newUrl = await vscode.window.showInputBox({
    prompt: `修改中转站端点 URL:`,
    value: selected.baseUrl,
    validateInput: v => (v && (v.startsWith('http://') || v.startsWith('https://')) ? null : '必须以 http:// 或 https:// 开头')
  });
  if (!newUrl) return;

  registry.updateProviderInfo(selected.id, {
    name: newName,
    baseUrl: newUrl
  });

  syncCatalogToCodex();
  refreshAllViews();
  vscode.window.showInformationMessage(`中转站信息已更新为: ${newName} (${newUrl})`);
}

/**
 * 启用 / 禁用整个中转站
 */
async function handleToggleProviderEnabled(element?: ProviderTreeElement): Promise<void> {
  let selected: ProviderConfig | undefined;
  if (element && element.type === 'provider') {
    selected = element.provider;
  } else {
    selected = await QuickPickController.selectProvider(registry.list());
  }
  if (!selected) return;

  const newState = registry.toggleProviderEnabled(selected.id);
  syncCatalogToCodex();
  refreshAllViews();

  vscode.window.showInformationMessage(
    `中转站 "${selected.name}" 已${newState ? '启用' : '禁用'}。${newState ? '其所有模型已恢复到切换列表中。' : '其所有模型已从切换列表与 Codex 目录中隐藏。'}`
  );
}

/**
 * 启用 / 禁用某个具体模型
 */
async function handleToggleModelEnabled(element?: ProviderTreeElement): Promise<void> {
  if (!element || element.type !== 'model') {
    vscode.window.showInformationMessage('请在侧边栏模型节点上点击此操作。');
    return;
  }

  const m = element.model;
  const newState = registry.toggleModelEnabled(m.providerId, m.modelId);
  syncCatalogToCodex();
  refreshAllViews();

  vscode.window.showInformationMessage(
    `模型 "${m.displayName}" (${m.modelId}) 已${newState ? '启用' : '禁用'}。${newState ? '已恢复到快速切换列表中。' : '已从快速切换列表与 Codex 目录中隐藏。'}`
  );
}

/**
 * 一键删除服务商（支持侧栏 inline 按钮直接点击）
 */
async function handleDeleteProviderDirectly(element?: ProviderTreeElement): Promise<void> {
  let selected: ProviderConfig | undefined;
  if (element && element.type === 'provider') {
    selected = element.provider;
  } else {
    const providers = registry.list();
    if (providers.length === 0) {
      vscode.window.showInformationMessage('暂无中转站可删除。');
      return;
    }
    selected = await QuickPickController.selectProvider(providers);
  }
  if (!selected) return;

  const confirm = await vscode.window.showWarningMessage(
    `确定要删除中转站 "${selected.name}" (${selected.id}) 吗？此操作将彻底移除该站点及其在 Codex 中的配置。`,
    { modal: true },
    '确认删除'
  );
  if (confirm === '确认删除') {
    registry.unregister(selected.id);
    await secretManager.deleteSecret(`provider.${selected.id}.apiKey`);
    syncCatalogToCodex();
    refreshAllViews();
    vscode.window.showInformationMessage(`中转站 "${selected.name}" 已成功删除。`);
  }
}

async function promptSetApiKey(): Promise<void> {
  const providers = registry.list();
  const selected = await QuickPickController.selectProvider(providers);
  if (!selected) return;

  const key = await vscode.window.showInputBox({
    prompt: `请输入 ${selected.name} 的 API Key (将安全保存至 SecretStorage):`,
    password: true
  });
  if (!key) return;

  await secretManager.storeSecret(`provider.${selected.id}.apiKey`, key);
  refreshAllViews();
  vscode.window.showInformationMessage(`${selected.name} 的 API Key 已安全更新。`);
}

async function handleManageProfiles(): Promise<void> {
  const profiles = profileManager.list();
  const items = profiles.map(p => ({
    label: p.name,
    description: `${p.providerId} / ${p.modelId}`,
    profile: p
  }));

  items.unshift({
    label: '$(add) 基于当前生效设置创建新预设',
    description: '一键保存当前 Provider + Model + Reasoning',
    profile: null as any
  });

  const selected = await vscode.window.showQuickPick(items, { placeHolder: '配置预设管理' });
  if (!selected) return;

  if (!selected.profile) {
    const name = await vscode.window.showInputBox({ prompt: '请输入新预设的名称 (如: 极速编码、深度推理)' });
    if (!name) return;

    const currentProvider = configManager.getCurrentProvider() || 'OpenAI';
    const currentModel = configManager.getCurrentModel() || 'gpt-5.6-sol';
    const currentReasoning = configManager.read().model_reasoning_effort || 'medium';

    try {
      profileManager.saveProfile({
        id: `profile-${Date.now()}`,
        name,
        providerId: currentProvider,
        modelId: currentModel,
        reasoningEffort: currentReasoning as any,
        description: `保存自当前激活环境: ${currentProvider} / ${currentModel} [${currentReasoning}]`
      });
      refreshAllViews();
      vscode.window.showInformationMessage(`配置预设 "${name}" 创建成功。`);
    } catch (err: any) {
      vscode.window.showErrorMessage(`保存预设失败: ${err.message}`);
    }
  }
}

async function handleOpenConfig(): Promise<void> {
  const env = PathResolver.resolve();
  if (fs.existsSync(env.configTomlPath)) {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(env.configTomlPath));
    await vscode.window.showTextDocument(doc);
  } else {
    vscode.window.showErrorMessage(`Codex 配置文件不存在: ${env.configTomlPath}`);
  }
}

async function handleRestoreConfig(): Promise<void> {
  const backups = configManager.listBackups();
  if (backups.length === 0) {
    vscode.window.showInformationMessage('未找到任何配置历史备份。');
    return;
  }

  const items = backups.map(b => ({
    label: b.filename,
    description: `${b.size} 字节`,
    detail: `备份生成时间: ${b.timestamp}`,
    backup: b
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: '选择要回滚恢复的 config.toml 历史备份'
  });
  if (!selected) return;

  try {
    configManager.restoreBackup(selected.backup.filePath);
    refreshAllViews();
    vscode.window.showInformationMessage(`已成功从 ${selected.backup.filename} 恢复配置。`);
  } catch (err: any) {
    vscode.window.showErrorMessage(`恢复备份失败: ${err.message}`);
  }
}

async function handleDiagnose(): Promise<void> {
  await DiagnosticsRunner.run(configManager, registry, outputChannel);
}

async function handleEditBaseInstructions(): Promise<void> {
  const filePath = instructionManager.getInstructionsPath();
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
  await vscode.window.showTextDocument(doc);
  vscode.window.showInformationMessage('您正在编辑 Codex 全局系统提示词 (Base Instructions)。编辑完成后保存 (Ctrl+S) 即可即时生效。');
}

async function handleCreateProjectInstructions(): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscode.window.showWarningMessage('当前未打开任何工作区文件夹，无法创建项目级提示词。');
    return;
  }
  const rootPath = folders[0].uri.fsPath;
  const agentsMdPath = path.join(rootPath, 'AGENTS.md');
  if (!fs.existsSync(agentsMdPath)) {
    const template = `# 项目级 AI 指令 (AGENTS.md)\n\n> 本文件是 OpenAI Codex 官方识别的最高优先级项目指令文件。\n\n## 角色与职责\n- 你是一个资深软件工程师。\n- 请使用中文与我沟通交流。\n- 编写的代码要求具有高可读性与完善的类型定义。\n`;
    fs.writeFileSync(agentsMdPath, template, 'utf8');
  }
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(agentsMdPath));
  await vscode.window.showTextDocument(doc);
  vscode.window.showInformationMessage('已为您打开项目级提示词文件 (AGENTS.md)。Codex 在该项目中将严格优先遵循此指令！');
}

async function handleResetBaseInstructions(): Promise<void> {
  const confirm = await vscode.window.showWarningMessage(
    '确定要将全局系统提示词恢复为官方默认设置吗？',
    { modal: true },
    '确认恢复'
  );
  if (confirm === '确认恢复') {
    instructionManager.reset();
    syncCatalogToCodex();
    await ProcessHelper.restartCodex();
    vscode.window.showInformationMessage('Codex 全局系统提示词已成功恢复为默认设置。');
  }
}
