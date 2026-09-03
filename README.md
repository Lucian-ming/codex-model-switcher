# Codex Model Switcher

<p align="center">
  <strong>Seamlessly manage and switch multiple third-party AI providers, models, and profiles for OpenAI Codex in VS Code.</strong>
</p>

<p align="center">
  <a href="https://github.com/Lucian-ming/codex-model-switcher/actions/workflows/ci.yml"><img src="https://github.com/Lucian-ming/codex-model-switcher/actions/workflows/ci.yml/badge.svg" alt="CI Status" /></a>
  <a href="https://github.com/Lucian-ming/codex-model-switcher/releases"><img src="https://img.shields.io/github/v/release/Lucian-ming/codex-model-switcher?color=blue" alt="Release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License" /></a>
  <a href="README_CN.md"><img src="https://img.shields.io/badge/中文文档-README_CN-blue" alt="Chinese Documentation" /></a>
</p>

---

## 🌟 Overview

**Codex Model Switcher** is a non-invasive, production-grade VS Code extension designed for developers using the OpenAI Codex CLI and VS Code extension (in Remote-WSL and local environments). 

It bridges the gap between third-party AI providers (OrcaRouter, OpenRouter, DeepSeek, Kimi/Moonshot, SiliconFlow, Qwen, GLM, local Ollama, and custom gateways) and OpenAI Codex's native model ecosystem.

### Key Capabilities
- **⚡ Zero-Interruption Instant Model Switching**: Atomic configuration writes update `~/.codex/config.toml` and `~/.codex/model_catalog.json` in milliseconds without disruptive full-window restarts.
- **🌐 Concurrent Multi-Provider Management**: Configure multiple API providers simultaneously without toggling activation states; models from all active providers are dynamically merged into Codex.
- **👁 Granular Visibility Controls**: Disable entire providers or hide individual models to keep quick-switch menus organized.
- **📏 4-Tier High-Precision Context Window Engine**:
  - Deep sniffing of 12 gateway attributes (`context_length`, `max_tokens`, `max_model_len`, etc.).
  - Intelligent regex recognition for explicit context suffixes (`-32k`, `-128k`, `-1m`).
  - Pre-calibrated specifications for leading LLM families (Claude 3.5 = 200K, Gemini 1.5/2.0 = 1M/2M, o1/o3 = 200K).
  - Manual gear override with persistent storage.
- **📝 System Prompt Customization**:
  - Visual editor for global base instructions (`base_instructions`).
  - One-click generation for workspace-level `AGENTS.md` instructions.
- **🛡 Enterprise-Grade Secret Management**: API keys are securely stored in VS Code `SecretStorage` (or `0600` credentials in headless WSL), never exposed in plain JSON, Git, or logs.
- **🔄 Real-Time Synchronization**: Watches `~/.codex/config.toml` and updates the VS Code Status Bar (`$(sparkle) Codex: [Model]`) instantly.

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
└─────────────────────────────────────────────────────────────┘
```

---

## ⌨️ Shortcuts & Key Commands

| Shortcut | Command | Command ID |
| :--- | :--- | :--- |
| `Ctrl + Alt + M` | Quick-pick switch model | `codexModelSwitcher.switchModel` |
| `Ctrl + Alt + P` | Switch active provider | `codexModelSwitcher.switchProvider` |
| - | Add custom provider | `codexModelSwitcher.addProvider` |
| - | Edit global base instructions | `codexModelSwitcher.editBaseInstructions` |
| - | Create project instructions (`AGENTS.md`) | `codexModelSwitcher.createProjectInstructions` |
| - | Restart Extension Host | `codexModelSwitcher.restartExtensionHost` |
| - | Reload VS Code Window | `codexModelSwitcher.reloadWindow` |

---

## 📦 Installation

### From GitHub Releases
1. Download the latest `.vsix` file from [GitHub Releases](https://github.com/Lucian-ming/codex-model-switcher/releases).
2. In VS Code, press `Ctrl + Shift + P`.
3. Select **Extensions: Install from VSIX...** and choose the downloaded file.

### From Source
```bash
git clone https://github.com/Lucian-ming/codex-model-switcher.git
cd codex-model-switcher
npm install
npm run compile
npx @vscode/vsce package --no-dependencies
code --install-extension *.vsix
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
