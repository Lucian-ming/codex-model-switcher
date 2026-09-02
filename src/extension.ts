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
  outputChannel.appendLine('Activating Codex Model Switcher v0.2.0...');

  const env = PathResolver.resolve();
  outputChannel.appendLine(`Environment resolved: Platform=${env.platform}, WSL=${env.isWsl}, Distro=${env.wslDistro || 'none'}`);
  outputChannel.appendLine(`Codex Home: ${env.codexHome}`);

  configManager = new CodexConfigManager();
  secretManager = new SecretManager(context.secrets);
  registry = new ProviderRegistry(configManager);
  profileManager = new ProfileManager(configManager);
  modelCache = new ModelCache();
  overrideManager = new ContextOverrideManager();
  statusBar = new StatusBarController(configManager);

  // Initialize Sidebar Tree Providers
  currentTreeProvider = new CurrentConfigTreeProvider(configManager, registry, overrideManager);
  providersTreeProvider = new ProvidersTreeProvider(configManager, registry, overrideManager);
  profilesTreeProvider = new ProfilesTreeProvider(profileManager);
  settingsTreeProvider = new SettingsTreeProvider();

  // Register Sidebar Views
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('codexModelSwitcher.current', currentTreeProvider),
    vscode.window.registerTreeDataProvider('codexModelSwitcher.providers', providersTreeProvider),
    vscode.window.registerTreeDataProvider('codexModelSwitcher.profiles', profilesTreeProvider),
    vscode.window.registerTreeDataProvider('codexModelSwitcher.settings', settingsTreeProvider)
  );

  // File watcher on ~/.codex/config.toml to stay synchronized with external edits
  try {
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(vscode.Uri.file(env.codexHome), 'config.toml')
    );
    watcher.onDidChange(() => {
      outputChannel.appendLine('Detected external modification to config.toml, refreshing views...');
      refreshAllViews();
    });
    context.subscriptions.push(watcher);
  } catch (err) {
    outputChannel.appendLine(`Note: File watcher could not be attached directly: ${err}`);
  }

  // Auto-export catalog on startup if enabled
  const autoInject = vscode.workspace.getConfiguration('codexModelSwitcher').get<boolean>('autoInjectCatalog', true);
  if (autoInject) {
    syncCatalogToCodex();
  }

  // Register commands
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
    vscode.commands.registerCommand('codexModelSwitcher.manageProfiles', handleManageProfiles),
    vscode.commands.registerCommand('codexModelSwitcher.openConfig', handleOpenConfig),
    vscode.commands.registerCommand('codexModelSwitcher.restoreConfig', handleRestoreConfig),
    vscode.commands.registerCommand('codexModelSwitcher.diagnose', handleDiagnose),
    vscode.commands.registerCommand('codexModelSwitcher.activateModelDirectly', handleActivateModelDirectly),
    vscode.commands.registerCommand('codexModelSwitcher.applyProfileDirectly', handleApplyProfileDirectly)
  );

  context.subscriptions.push(statusBar);
  outputChannel.appendLine('Codex Model Switcher activated successfully.');
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
 * Exports currently known models into ~/.codex/model_catalog.json and config.toml
 */
function syncCatalogToCodex(): void {
  try {
    const activeProviderId = configManager.getCurrentProvider() || 'OpenAI';
    const activeProvider = registry.get(activeProviderId);
    let allModels: ModelProfile[] = [];

    // Include models from active provider first
    if (activeProvider && activeProvider.models) {
      allModels.push(...activeProvider.models);
    }

    // Include models from other providers so they are visible in picker
    for (const p of registry.list()) {
      if (p.id !== activeProviderId && p.models) {
        allModels.push(...p.models);
      }
    }

    if (allModels.length > 0) {
      // Apply user context window overrides
      const effectiveModels = overrideManager.applyToModels(allModels);
      CatalogExporter.exportCatalog(effectiveModels, undefined, configManager);
      outputChannel.appendLine(`Synchronized ${effectiveModels.length} models to Codex model catalog.`);
    }
  } catch (err: any) {
    outputChannel.appendLine(`Failed to sync model catalog: ${err.message}`);
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
      'No models found in the catalog. Would you like to refresh models or select a provider?',
      'Refresh Models',
      'Switch Provider'
    );
    if (action === 'Refresh Models') {
      await handleRefreshModels();
    } else if (action === 'Switch Provider') {
      await handleSwitchProvider();
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
    // 1. Adaptive Reasoning Fallback
    const fallback = ReasoningManager.adaptEffortOnSwitch(currentEffort, selected);
    if (fallback.didFallback && fallback.reason) {
      vscode.window.showWarningMessage(fallback.reason);
    }

    // 2. Update config.toml
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

    // 3. Export updated catalog & refresh views
    syncCatalogToCodex();
    refreshAllViews();

    vscode.window.showInformationMessage(
      `Codex active model set to: ${selected.displayName} (${selected.modelId}) [Reasoning: ${fallback.effort}]`
    );
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to switch model: ${err.message}`);
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
      vscode.window.showInformationMessage(`Codex active provider set to: ${selected.name}`);
    }
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to switch provider: ${err.message}`);
  }
}

async function handleAdjustReasoningEffort(): Promise<void> {
  const currentModelId = configManager.getCurrentModel() || 'gpt-5.6-sol';
  const currentProviderId = configManager.getCurrentProvider();
  const provider = currentProviderId ? registry.get(currentProviderId) : undefined;
  const modelProfile = provider?.models?.find(m => m.modelId === currentModelId);

  const reasoningInfo = modelProfile?.reasoningInfo || ReasoningManager.inferReasoningCapabilities(currentModelId);

  if (!reasoningInfo.supported || reasoningInfo.levels.length === 0) {
    vscode.window.showInformationMessage(`Model "${currentModelId}" does not support reasoning effort configuration.`);
    return;
  }

  const currentEffort = configManager.read().model_reasoning_effort || reasoningInfo.defaultLevel;
  const items = reasoningInfo.levels.map(l => ({
    label: `${l.effort === currentEffort ? '● ' : ''}${l.effort}`,
    description: l.description,
    effort: l.effort
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: `Select Reasoning Effort for ${currentModelId} (Current: ${currentEffort})`
  });
  if (!selected) return;

  try {
    const cfg = configManager.read();
    cfg.model_reasoning_effort = selected.effort;
    configManager.write(cfg);

    refreshAllViews();
    vscode.window.showInformationMessage(`Reasoning effort set to: ${selected.effort}`);
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to adjust reasoning effort: ${err.message}`);
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
    prompt: `Enter Context Window for ${currentModelId} (e.g. 128K, 200K, 256K, 1M, or raw integer tokens)`,
    value: ContextOverrideManager.formatTokens(currentTokens),
    validateInput: val => {
      const parsed = ContextOverrideManager.parseTokenInput(val);
      if (!parsed || parsed < 1000) {
        return 'Please enter a valid token count (e.g. 128K, 200K, 1M, or positive integer >= 1000)';
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
      `Context window for ${currentModelId} overridden to ${ContextOverrideManager.formatTokens(tokens)} (${tokens} tokens).`
    );
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to override context window: ${err.message}`);
  }
}

async function handleResetContextWindow(): Promise<void> {
  const currentModelId = configManager.getCurrentModel() || 'gpt-5.6-sol';
  const currentProviderId = configManager.getCurrentProvider() || 'OpenAI';

  const existed = overrideManager.resetOverride(currentProviderId, currentModelId);
  if (existed) {
    syncCatalogToCodex();
    refreshAllViews();
    vscode.window.showInformationMessage(`Reset context window for ${currentModelId} to discovered value.`);
  } else {
    vscode.window.showInformationMessage(`No user override exists for ${currentModelId}.`);
  }
}

async function handleSwitchProfile(): Promise<void> {
  const profiles = profileManager.list();
  const items = profiles.map(p => ({
    label: p.name,
    description: `${p.providerId} • ${p.modelId}`,
    detail: `${p.description || ''} ${p.reasoningEffort ? `[Reasoning: ${p.reasoningEffort}]` : ''}`,
    profile: p
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a Codex Profile'
  });
  if (!selected) return;

  await handleApplyProfileDirectly(selected.profile);
}

async function handleApplyProfileDirectly(profile: CodexProfile): Promise<void> {
  try {
    profileManager.applyProfile(profile);
    syncCatalogToCodex();
    refreshAllViews();
    vscode.window.showInformationMessage(`Applied profile: ${profile.name}`);
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to apply profile: ${err.message}`);
  }
}

async function handleRefreshModels(): Promise<void> {
  const currentProviderId = configManager.getCurrentProvider() || 'OpenAI';
  const provider = registry.get(currentProviderId);

  if (!provider) {
    vscode.window.showErrorMessage(`Active provider "${currentProviderId}" not found in registry.`);
    return;
  }

  if (!provider.baseUrl) {
    vscode.window.showInformationMessage(`Provider ${provider.name} uses official default endpoint.`);
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Discovering models from ${provider.name}...`,
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
          `Successfully refreshed ${discovered.length} models from ${provider.name}.`
        );
      } catch (err: any) {
        vscode.window.showErrorMessage(`Model discovery failed: ${err.message}`);
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
      title: `Testing connection to ${selected.name}...`,
      cancellable: false
    },
    async () => {
      const apiKey = await secretManager.getSecret(`provider.${selected.id}.apiKey`);
      const health = await ProviderTester.test(selected, apiKey);

      registry.updateHealth(selected.id, health.latencyMs, health.reachable && health.authValid);
      refreshAllViews();

      if (health.reachable && health.authValid) {
        vscode.window.showInformationMessage(
          `✓ ${selected.name} is reachable (${health.latencyMs}ms). Discovered ${health.modelCount} models.`
        );
      } else {
        vscode.window.showWarningMessage(`✗ ${selected.name}: ${health.message}`);
      }
    }
  );
}

async function handleManageProviders(): Promise<void> {
  const actions = [
    { label: '$(add) Add Custom Provider', action: 'add' },
    { label: '$(key) Set Provider API Key', action: 'apiKey' },
    { label: '$(refresh) Refresh Models for Provider', action: 'refresh' },
    { label: '$(pulse) Test Provider Connectivity', action: 'test' },
    { label: '$(trash) Remove Custom Provider', action: 'remove' }
  ];

  const picked = await vscode.window.showQuickPick(actions, { placeHolder: 'Provider Management Actions' });
  if (!picked) return;

  if (picked.action === 'add') {
    await promptAddCustomProvider();
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

async function promptAddCustomProvider(): Promise<void> {
  const id = await vscode.window.showInputBox({
    prompt: 'Enter unique Provider ID (e.g. MyProxy, SiliconFlow)',
    validateInput: v => (v && /^[a-zA-Z0-9_\-]+$/.test(v) ? null : 'Alphanumeric, dashes, underscores only')
  });
  if (!id) return;

  const name = await vscode.window.showInputBox({
    prompt: 'Enter Provider Display Name (e.g. SiliconFlow Cloud)',
    value: id
  });
  if (!name) return;

  const baseUrl = await vscode.window.showInputBox({
    prompt: 'Enter Provider API Base URL (e.g. https://api.siliconflow.cn/v1)',
    validateInput: v => (v && (v.startsWith('http://') || v.startsWith('https://')) ? null : 'Must start with http:// or https://')
  });
  if (!baseUrl) return;

  const protocol = await vscode.window.showQuickPick(['responses', 'chat', 'anthropic'], {
    placeHolder: 'Select Wire Protocol (Use "responses" for official standard)'
  }) as any;
  if (!protocol) return;

  const apiKey = await vscode.window.showInputBox({
    prompt: 'Enter API Key (Optional - will be stored securely in SecretStorage)',
    password: true
  });

  const newProvider: ProviderConfig = {
    id,
    name,
    baseUrl,
    protocol,
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
  vscode.window.showInformationMessage(`Custom provider "${name}" registered successfully.`);

  // Auto-discover models
  try {
    const discovered = await ModelDiscovery.discover(newProvider, apiKey);
    if (discovered.length > 0) {
      registry.updateModels(id, discovered);
      syncCatalogToCodex();
      refreshAllViews();
      vscode.window.showInformationMessage(`Discovered and registered ${discovered.length} models for ${name}.`);
    }
  } catch (err: any) {
    outputChannel.appendLine(`Model discovery warning for new provider: ${err.message}`);
  }
}

async function promptSetApiKey(): Promise<void> {
  const providers = registry.list();
  const selected = await QuickPickController.selectProvider(providers);
  if (!selected) return;

  const key = await vscode.window.showInputBox({
    prompt: `Enter API Key for ${selected.name} (stored in SecretStorage)`,
    password: true
  });
  if (!key) return;

  await secretManager.storeSecret(`provider.${selected.id}.apiKey`, key);
  refreshAllViews();
  vscode.window.showInformationMessage(`API Key for ${selected.name} updated securely.`);
}

async function promptRemoveProvider(): Promise<void> {
  const customProviders = registry.list().filter(p => !p.builtin);
  if (customProviders.length === 0) {
    vscode.window.showInformationMessage('No custom providers available to remove.');
    return;
  }

  const selected = await QuickPickController.selectProvider(customProviders);
  if (!selected) return;

  const confirm = await vscode.window.showWarningMessage(
    `Are you sure you want to remove provider "${selected.name}"?`,
    { modal: true },
    'Delete'
  );
  if (confirm === 'Delete') {
    registry.unregister(selected.id);
    await secretManager.deleteSecret(`provider.${selected.id}.apiKey`);
    refreshAllViews();
    vscode.window.showInformationMessage(`Provider "${selected.name}" removed.`);
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
    label: '$(add) Create New Profile from Current Settings',
    description: '',
    profile: null as any
  });

  const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Manage Profiles' });
  if (!selected) return;

  if (!selected.profile) {
    const name = await vscode.window.showInputBox({ prompt: 'Enter Profile Name' });
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
        description: `Saved from active settings: ${currentProvider} / ${currentModel} [${currentReasoning}]`
      });
      refreshAllViews();
      vscode.window.showInformationMessage(`Profile "${name}" created.`);
    } catch (err: any) {
      vscode.window.showErrorMessage(`Cannot save profile: ${err.message}`);
    }
  }
}

async function handleOpenConfig(): Promise<void> {
  const env = PathResolver.resolve();
  if (fs.existsSync(env.configTomlPath)) {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(env.configTomlPath));
    await vscode.window.showTextDocument(doc);
  } else {
    vscode.window.showErrorMessage(`Codex config.toml does not exist at ${env.configTomlPath}`);
  }
}

async function handleRestoreConfig(): Promise<void> {
  const backups = configManager.listBackups();
  if (backups.length === 0) {
    vscode.window.showInformationMessage('No configuration backups found.');
    return;
  }

  const items = backups.map(b => ({
    label: b.filename,
    description: `${b.size} bytes`,
    detail: `Timestamp: ${b.timestamp}`,
    backup: b
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a previous config.toml backup to restore'
  });
  if (!selected) return;

  try {
    configManager.restoreBackup(selected.backup.filePath);
    refreshAllViews();
    vscode.window.showInformationMessage(`Restored configuration from ${selected.backup.filename}`);
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to restore backup: ${err.message}`);
  }
}

async function handleDiagnose(): Promise<void> {
  await DiagnosticsRunner.run(configManager, registry, outputChannel);
}
