# Codex Model Switcher

<p align="center">
  <strong>Seamlessly manage and switch multiple third-party AI providers, models, and profiles for OpenAI Codex in VS Code.</strong>
</p>

---

## 🌟 Overview

**Codex Model Switcher** is a non-invasive, production-grade VS Code extension designed for developers using the OpenAI Codex CLI and VS Code extension (in Remote-WSL and local environments). 

It bridges the gap between third-party AI providers (OpenRouter, DeepSeek, Kimi/Moonshot, SiliconFlow, local Ollama, and custom gateways) and OpenAI Codex's native model ecosystem.

### Key Capabilities
- **Direct Integration with Native Codex Model Picker**: Uses Codex's official `model_catalog_json` and `[model_providers.<id>]` hooks so third-party models appear directly in Codex's native picker and `codex app-server` RPC.
- **Zero Binary Patching**: Pure configuration orchestration without modifying or patching the official `openai.chatgpt` extension or Codex CLI binaries.
- **Multi-Provider Management**: Pre-configured templates for OpenAI, OpenRouter, DeepSeek, Kimi, SiliconFlow, and Ollama, plus custom provider endpoints.
- **Automated Model Discovery**: Automatically queries `/v1/models` and applies intelligent heuristics for context window, reasoning effort levels, and tool capabilities.
- **Configuration Safety**: Atomic file writes, validation passes, and automatic timestamped backups (`config.toml.backup.<timestamp>`) with one-click rollback.
- **Enterprise-Grade Secret Management**: API keys are securely stored in VS Code `SecretStorage` (or `0600` credentials in headless WSL), never exposed in plain JSON, Git, or logs.
- **Real-Time Synchronization**: Watches `~/.codex/config.toml` and updates the VS Code Status Bar (`$(sparkle) Codex: [Model]`) instantly.

---

## 📐 Architecture

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

## 🚀 Quick Start

### Installation
1. Open this repository in VS Code (Remote-WSL):
   ```bash
   cd /home/lucian/projects/codex-model-switcher
   code .
   ```
2. Build the extension:
   ```bash
   npm install
   npm run compile
   ```
3. Press `F5` in VS Code to launch the Extension Development Host.

---

## ⌨️ Command Palette Shortcuts

| Command | Keybinding | Action |
|---|---|---|
| `Codex: Switch Model` | `Ctrl+Alt+M` | Search and switch active Codex model across providers |
| `Codex: Switch Provider` | — | Switch active AI provider endpoint |
| `Codex: Switch Profile` | — | One-click profile switch (model + provider + reasoning) |
| `Codex: Refresh Models` | — | Fetch latest `/v1/models` from active provider |
| `Codex: Test Provider Connection` | — | Benchmark latency and verify credentials |
| `Codex: Manage Providers` | — | Add, edit, or remove custom AI providers |
| `Codex: Manage Profiles` | — | Save current settings to a named profile |
| `Codex: Open Codex Config` | — | Open `~/.codex/config.toml` in VS Code editor |
| `Codex: Restore Previous Configuration` | — | Roll back to an earlier configuration backup |
| `Codex: Diagnose Environment & Configuration` | — | Print environment, paths, and config health |

---

## 🛠️ Configuration Structure (`~/.codex/config.toml`)

When managing providers and models, `codex-model-switcher` cleanly updates `config.toml`:

```toml
model_provider = "OpenRouter"
model = "anthropic/claude-3.7-sonnet"
model_reasoning_effort = "medium"
model_catalog_json = "/home/lucian/.codex/model_catalog.json"

[model_providers.OpenRouter]
name = "OpenRouter"
base_url = "https://openrouter.ai/api/v1"
wire_api = "responses"
requires_openai_auth = false
env_key = "OPENROUTER_API_KEY"

# Existing providers are preserved to prevent past chat threads from breaking!
[model_providers.PinAI]
name = "PinAI"
base_url = "https://api.pinaic.com"
wire_api = "responses"
requires_openai_auth = true
```

---

## 🔒 Security & Privacy

1. **Secret Storage**: Keys entered in the provider manager are saved in `vscode.SecretStorage`.
2. **Log Redaction**: All logging strips sensitive keys (`sk-***123`).
3. **Local File Permissions**: On Linux/WSL, fallback credentials files are locked down to `0600`.
4. **Git Safety**: Credentials and local `.env` files are ignored by `.gitignore`.

---

## 🧪 Testing

The repository includes a comprehensive test suite with mock servers and end-to-end integration against the real Codex binary:

```bash
# Run test suite
npm test

# Check type safety
npm run lint

# Build extension bundle
npm run compile
```

---

## 📄 License
MIT License. See [LICENSE](./LICENSE) and [THIRD_PARTY.md](./docs/THIRD_PARTY.md).
