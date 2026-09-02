import * as vscode from 'vscode';
import * as fs from 'fs';
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
import { ProvidersTreeProvider } from './ui/providersView.js';
import { ProfilesTreeProvider } from './ui/profilesView.js';
import { SettingsTreeProvider } from './ui/settingsView.js';
import { ProviderConfig } from './providers/types.js';
import { ModelProfile } from './models/types.js';
import { CodexProfile } from './profiles/types.js';

let outputChannel: vscode.OutputChannel;
let statusBar: StatusBarController;
let configManager: CodexConfigManager;
let secretManager: SecretManager;
let registry: ProviderRegistry;
let profileManager: ProfileManager;
let modelCache: ModelCache;
let overrideManager: ContextOverrideManager;

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
  statusBar = new StatusBarController(configManager);

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

  // 启动时自动同步模型目录
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
    vscode.commands.registerCommand('codexModelSwitcher.manageProfiles', handleManageProfiles),
    vscode.commands.registerCommand('codexModelSwitcher.openConfig', handleOpenConfig),
    vscode.commands.registerCommand('codexModelSwitcher.restoreConfig', handleRestoreConfig),
    vscode.commands.registerCommand('codexModelSwitcher.diagnose', handleDiagnose),
    vscode.commands.registerCommand('codexModelSwitcher.activateModelDirectly', handleActivateModelDirectly),
    vscode.commands.registerCommand('codexModelSwitcher.applyProfileDirectly', handleApplyProfileDirectly)
  );

  context.subscriptions.push(statusBar);
  outputChannel.appendLine('Codex 模型切换器激活完成。');
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
 * 将当前已知模型按标准契约导出到 ~/.codex/model_catalog.json 并同步至 config.toml
 */
function syncCatalogToCodex(): void {
  try {
    const activeProviderId = configManager.getCurrentProvider() || 'OpenAI';
    const activeProvider = registry.get(activeProviderId);
    let allModels: ModelProfile[] = [];

    if (activeProvider && activeProvider.models) {
      allModels.push(...activeProvider.models);
    }

    for (const p of registry.list()) {
      if (p.id !== activeProviderId && p.models) {
        allModels.push(...p.models);
      }
    }

    if (allModels.length > 0) {
      const effectiveModels = overrideManager.applyToModels(allModels);
      CatalogExporter.exportCatalog(effectiveModels, undefined, configManager);
      outputChannel.appendLine(`已向 Codex 官方目录导出 ${effectiveModels.length} 个模型。`);
    }
  } catch (err: any) {
    outputChannel.appendLine(`导出模型目录失败: ${err.message}`);
  }
}

async function handleSwitchModel(): Promise<void> {
  const currentModel = configManager.getCurrentModel();
  const currentProviderId = configManager.getCurrentProvider();

  let candidateModels: ModelProfile[] = [];
  const activeProvider = currentProviderId ? registry.get(currentProviderId) : undefined;

  if (activeProvider && activeProvider.models && activeProvider.models.length > 0) {
    candidateModels.push(...activeProvider.models);
  }

  for (const p of registry.list()) {
    if (p.id !== currentProviderId && p.models) {
      candidateModels.push(...p.models);
    }
  }

  if (candidateModels.length === 0) {
    const action = await vscode.window.showWarningMessage(
      '当前未发现可用模型。是否刷新模型列表或添加服务商？',
      '刷新模型',
      '添加服务商'
    );
    if (action === '刷新模型') {
      await handleRefreshModels();
    } else if (action === '添加服务商') {
      await promptAddCustomProvider();
    }
    return;
  }

  const selected = await QuickPickController.selectModel(candidateModels, currentModel, currentProviderId);
  if (!selected) return;

  await handleActivateModelDirectly(selected);
}

async function handleActivateModelDirectly(selected: ModelProfile): Promise<void> {
  const currentProviderId = configManager.getCurrentProvider();
  const currentEffort = configManager.read().model_reasoning_effort || 'default';

  try {
    // 1. 自适应推理等级校验与回退
    const fallback = ReasoningManager.adaptEffortOnSwitch(currentEffort, selected);
    if (fallback.didFallback && fallback.reason) {
      vscode.window.showWarningMessage(fallback.reason);
    }

    // 2. 原子更新 config.toml
    const cfg = configManager.read();
    cfg.model = selected.modelId;
    if (selected.providerId && selected.providerId !== currentProviderId) {
      cfg.model_provider = selected.providerId;
    }
    if (fallback.effort && fallback.effort !== 'none') {
      cfg.model_reasoning_effort = fallback.effort;
    } else {
      delete cfg.model_reasoning_effort;
    }
    configManager.write(cfg);

    // 3. 导出模型目录并更新所有视图
    syncCatalogToCodex();
    refreshAllViews();

    vscode.window.showInformationMessage(
      `已切换当前 Codex 模型为: ${selected.displayName} (${selected.modelId}) [推理等级: ${fallback.effort}]`
    );
  } catch (err: any) {
    vscode.window.showErrorMessage(`切换模型失败: ${err.message}`);
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
      vscode.window.showInformationMessage(`已激活服务商: ${selected.name}`);
    }
  } catch (err: any) {
    vscode.window.showErrorMessage(`切换服务商失败: ${err.message}`);
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

async function handleOverrideContextWindow(): Promise<void> {
  const currentModelId = configManager.getCurrentModel() || 'gpt-5.6-sol';
  const currentProviderId = configManager.getCurrentProvider() || 'OpenAI';
  const provider = registry.get(currentProviderId);
  const model = provider?.models?.find(m => m.modelId === currentModelId);

  const discoveredTokens = model?.contextWindow || 128000;
  const currentOverride = overrideManager.getOverride(currentProviderId, currentModelId);
  const currentTokens = currentOverride !== undefined ? currentOverride : discoveredTokens;

  const input = await vscode.window.showInputBox({
    prompt: `请输入模型 ${currentModelId} 的上下文容量 (支持: 128K, 200K, 256K, 1M 或纯数字 token)`,
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
    overrideManager.setOverride(currentProviderId, currentModelId, tokens);
    syncCatalogToCodex();
    refreshAllViews();
    vscode.window.showInformationMessage(
      `已将 ${currentModelId} 的上下文容量覆盖为 ${ContextOverrideManager.formatTokens(tokens)} (${tokens} tokens)。`
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
    vscode.window.showInformationMessage(`已应用配置预设: ${profile.name}`);
  } catch (err: any) {
    vscode.window.showErrorMessage(`应用预设失败: ${err.message}`);
  }
}

async function handleRefreshModels(): Promise<void> {
  const currentProviderId = configManager.getCurrentProvider() || 'OpenAI';
  const provider = registry.get(currentProviderId);

  if (!provider) {
    vscode.window.showErrorMessage(`在注册表中未找到当前激活的服务商 "${currentProviderId}"。`);
    return;
  }

  if (!provider.baseUrl) {
    vscode.window.showInformationMessage(`服务商 ${provider.name} 使用官方默认端点，无需接口刷新。`);
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `正在从 ${provider.name} 发现模型...`,
      cancellable: false
    },
    async () => {
      try {
        const apiKey = await secretManager.getSecret(`provider.${provider.id}.apiKey`);
        const discovered = await ModelDiscovery.discover(provider, apiKey);

        registry.updateModels(provider.id, discovered);
        modelCache.set(provider.id, discovered);
        syncCatalogToCodex();
        refreshAllViews();

        vscode.window.showInformationMessage(
          `成功从 ${provider.name} 刷新并同步了 ${discovered.length} 个模型。`
        );
      } catch (err: any) {
        vscode.window.showErrorMessage(`模型发现失败: ${err.message}`);
      }
    }
  );
}

async function handleTestProvider(): Promise<void> {
  const providers = registry.list();
  const selected = await QuickPickController.selectProvider(providers, configManager.getCurrentProvider());
  if (!selected) return;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `正在测试与 ${selected.name} 的连通性...`,
      cancellable: false
    },
    async () => {
      const apiKey = await secretManager.getSecret(`provider.${selected.id}.apiKey`);
      const health = await ProviderTester.test(selected, apiKey);

      registry.updateHealth(selected.id, health.latencyMs, health.reachable && health.authValid);
      refreshAllViews();

      if (health.reachable && health.authValid) {
        vscode.window.showInformationMessage(
          `✓ ${selected.name} 连接正常 (延迟: ${health.latencyMs}ms)。成功获取到 ${health.modelCount} 个模型。`
        );
      } else {
        vscode.window.showWarningMessage(`✗ ${selected.name}: ${health.message}`);
      }
    }
  );
}

async function handleManageProviders(): Promise<void> {
  const actions = [
    { label: '$(add) 添加中转站 / 服务商', action: 'add' },
    { label: '$(edit) 修改中转站名字 / 端点地址', action: 'edit' },
    { label: '$(key) 设置 / 更换 API Key', action: 'apiKey' },
    { label: '$(refresh) 刷新服务商模型列表', action: 'refresh' },
    { label: '$(pulse) 测试服务商连通状态', action: 'test' },
    { label: '$(trash) 删除自定义服务商', action: 'remove' }
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
    await promptRemoveProvider();
  }
}

/**
 * 步骤式添加自定义服务商，支持完全自定义中转站名字
 */
async function promptAddCustomProvider(): Promise<void> {
  // 第 1 步: 自定义显示名称
  const name = await vscode.window.showInputBox({
    prompt: '第 1/5 步: 请输入中转站/服务商显示名称 (如: 主力中转站、PinAI A、我的专用网关)',
    placeHolder: '例如: 我的中转站'
  });
  if (!name) return;

  // 第 2 步: 唯一标识 ID (默认基于名称生成)
  const defaultSlug = name.replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase() || 'custom_provider';
  const id = await vscode.window.showInputBox({
    prompt: '第 2/5 步: 请确认服务商唯一标识 ID (仅支持字母、数字、下划线、连字符)',
    value: defaultSlug,
    validateInput: v => (v && /^[a-zA-Z0-9_\-]+$/.test(v) ? null : '标识 ID 只能包含字母、数字、下划线和连字符')
  });
  if (!id) return;

  // 第 3 步: API 端点 URL
  const baseUrl = await vscode.window.showInputBox({
    prompt: '第 3/5 步: 请输入 API 基础端点 URL (如: https://api.example.com/v1)',
    placeHolder: 'https://...',
    validateInput: v => (v && (v.startsWith('http://') || v.startsWith('https://')) ? null : '必须以 http:// 或 https:// 开头')
  });
  if (!baseUrl) return;

  // 第 4 步: 通信协议
  const protocol = await vscode.window.showQuickPick(
    [
      { label: 'responses', description: 'OpenAI Responses API (Codex 官方标准协议，强烈推荐)' },
      { label: 'chat', description: 'OpenAI Chat Completions 协议 (部分兼容网关支持)' },
      { label: 'anthropic', description: 'Anthropic 格式协议' }
    ],
    { placeHolder: '第 4/5 步: 选择通信协议' }
  );
  if (!protocol) return;

  // 第 5 步: API Key
  const apiKey = await vscode.window.showInputBox({
    prompt: '第 5/5 步: 请输入 API Key (可选，将安全加密存入 VS Code SecretStorage)',
    password: true
  });

  const newProvider: ProviderConfig = {
    id,
    name,
    baseUrl,
    protocol: protocol.label as any,
    models: []
  };

  if (apiKey) {
    await secretManager.storeSecret(`provider.${id}.apiKey`, apiKey);
    newProvider.headers = {
      'Authorization': `Bearer ${apiKey}`
    };
  }

  registry.register(newProvider);
  refreshAllViews();
  vscode.window.showInformationMessage(`服务商 "${name}" (${id}) 添加成功。`);

  // 尝试自动发现模型
  try {
    const discovered = await ModelDiscovery.discover(newProvider, apiKey);
    if (discovered.length > 0) {
      registry.updateModels(id, discovered);
      syncCatalogToCodex();
      refreshAllViews();
      vscode.window.showInformationMessage(`自动从 "${name}" 发现了 ${discovered.length} 个模型并已注册。`);
    }
  } catch (err: any) {
    outputChannel.appendLine(`添加服务商后的自动发现提示: ${err.message}`);
  }
}

/**
 * 修改服务商信息（允许自定义名字和端点 URL）
 */
async function promptEditProvider(): Promise<void> {
  const providers = registry.list();
  if (providers.length === 0) {
    vscode.window.showInformationMessage('暂未配置任何服务商。');
    return;
  }

  const selected = await QuickPickController.selectProvider(providers);
  if (!selected) return;

  const newName = await vscode.window.showInputBox({
    prompt: `修改服务商 "${selected.name}" 的显示名称:`,
    value: selected.name
  });
  if (!newName) return;

  const newUrl = await vscode.window.showInputBox({
    prompt: `修改服务商端点 URL:`,
    value: selected.baseUrl,
    validateInput: v => (v && (v.startsWith('http://') || v.startsWith('https://')) ? null : '必须以 http:// 或 https:// 开头')
  });
  if (!newUrl) return;

  registry.updateProviderInfo(selected.id, {
    name: newName,
    baseUrl: newUrl
  });

  refreshAllViews();
  vscode.window.showInformationMessage(`服务商信息已更新为: ${newName} (${newUrl})`);
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

async function promptRemoveProvider(): Promise<void> {
  const providers = registry.list();
  if (providers.length === 0) {
    vscode.window.showInformationMessage('暂无服务商可删除。');
    return;
  }

  const selected = await QuickPickController.selectProvider(providers);
  if (!selected) return;

  const confirm = await vscode.window.showWarningMessage(
    `确定要删除服务商 "${selected.name}" 吗？该操作同时会从 config.toml 中移除该配置。`,
    { modal: true },
    '确认删除'
  );
  if (confirm === '确认删除') {
    registry.unregister(selected.id);
    await secretManager.deleteSecret(`provider.${selected.id}.apiKey`);
    refreshAllViews();
    vscode.window.showInformationMessage(`服务商 "${selected.name}" 已成功删除。`);
  }
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
