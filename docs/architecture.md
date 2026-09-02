# System Architecture & Technical Design

This document details the architectural design for `codex-model-switcher`.

```
                    ┌──────────────────────────────────┐
                    │       VS Code UI / Commands      │
                    │  - Status Bar Item               │
                    │  - QuickPick Model/Provider      │
                    │  - Provider / Profile Manager    │
                    │  - Diagnostics                   │
                    └─────────────────┬────────────────┘
                                      │
                         Codex Model Switcher Core
                                      │
     ┌─────────────────┬──────────────┴───────────────┬─────────────────┐
     │                 │                              │                 │
     ▼                 ▼                              ▼                 ▼
┌──────────┐   ┌───────────────┐              ┌───────────────┐   ┌────────────┐
│ Provider │   │ Model Catalog │              │ Codex Config  │   │  Security  │
│ Registry │   │   & Discovery │              │    Manager    │   │  Storage   │
│          │   │               │              │               │   │            │
│- Presets │   │- /v1/models   │              │- TOML Parser  │   │- VS Code   │
│- Health  │   │- Metadata     │              │- Atomic Write │   │  Secret-   │
│  Check   │   │- Overrides    │              │- Backup/Roll  │   │  Storage   │
│- Custom  │   │- Export to    │              │  back         │   │- 0600 file │
│  Gateway │   │  catalog.json │              │- File Watcher │   │- Redaction │
└────┬─────┘   └───────┬───────┘              └───────┬───────┘   └────────────┘
     │                 │                              │
     │                 │                              │
     ▼                 ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Target Artifacts                      │
│                                                             │
│  1. ~/.codex/config.toml (Provider table & active selection)│
│  2. ~/.codex/model_catalog.json (Injected custom models)    │
│  3. ~/.codex-model-switcher/profiles.json (Local profiles)  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
            ┌────────────────────────────────────┐
            │   VS Code Codex Extension Runtime  │
            │   (openai.chatgpt / codex-cli)     │
            │                                    │
            │   - codex app-server reads config  │
            │   - Native Model Picker populated  │
            │   - Zero binary patch required!    │
            └────────────────────────────────────┘
```

---

## 1. Provider System (`src/providers`)

### Provider Interface
```typescript
export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  wireApi: 'responses' | 'chat' | 'anthropic' | 'custom';
  requiresOpenaiAuth?: boolean;
  envKey?: string;
  headers?: Record<string, string>;
  models?: ModelProfile[];
}

export interface ProviderAdapter {
  id: string;
  name: string;
  getModels(apiKey?: string): Promise<ModelProfile[]>;
  validate(apiKey?: string): Promise<ProviderHealth>;
  toCodexProviderConfig(): Record<string, unknown>;
}
```

### Built-in Provider Presets
- **OpenAI Official**: Direct ChatGPT / OpenAI endpoint.
- **OpenRouter**: Aggregator endpoint supporting Responses and OpenAI-compatible models.
- **DeepSeek**: DeepSeek V3 & R1 models.
- **Kimi / Moonshot**: Kimi K2 & K2.5 endpoints.
- **SiliconFlow (硅基流动)**: Fast inference cloud for Qwen, DeepSeek, GLM.
- **Ollama**: Local models (`http://localhost:11434/v1`).
- **Custom Provider**: Any user-defined URL, headers, and protocol.

---

## 2. Model Catalog & Discovery (`src/models`)

### Model Discovery Flow
1. Fetch models via `GET /v1/models` (or provider-specific adapter).
2. Filter & normalize model IDs.
3. Enrich with metadata presets (context window, reasoning effort levels, image capabilities, tool calling flags).
4. Persist to cache in `~/.codex-model-switcher/model_cache.json`.
5. Export to `~/.codex/model_catalog.json` with the official Codex schema (`{ "models": [...] }`).
6. Update `model_catalog_json = "/home/.../.codex/model_catalog.json"` in `config.toml`.

---

## 3. Configuration Manager (`src/codex/configManager.ts`)

### Safety Guarantees
- **Atomic Writes**: Write to a `.tmp` file in the same directory, validate syntax, then atomically rename via `fs.rename`.
- **Automatic Versioned Backups**: Prior to any write, create `config.toml.backup.<timestamp>`. Keep up to 10 backups.
- **Rollback Support**: Command `Codex: Restore Previous Configuration` restores the latest or chosen backup.
- **AST-preserving TOML Parser**: Uses `smol-toml` / `@iarna/toml` to preserve comments and table structure.
- **File System Watcher**: Listens for external edits to `~/.codex/config.toml` to immediately update the status bar and internal state without desync.

---

## 4. Secret Storage & Redaction (`src/security`)

- Sensitive API keys are stored in `vscode.ExtensionContext.secrets` (VS Code SecretStorage).
- Fallback for headless/CLI environments: chmod `0600` credentials file.
- Logging Redaction: All logging passes through `sanitizeSecret(text)` which masks keys (`sk-***123`).

---

## 5. UI & Commands (`src/ui` & `src/commands`)

- **Status Bar**: `$(sparkle) Codex: [Provider] / [Model]`, click triggers `codexModelSwitcher.switchModel`.
- **QuickPick**: Searchable, grouped by provider, shows reasoning and context badges.
- **Diagnostic Command**: Inspects OS, WSL, Codex CLI path, permissions, active provider, model catalog, and connection health.
