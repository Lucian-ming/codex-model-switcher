# Comparative Research & Open Source Survey (Phase 2)

This document analyzes existing open source projects related to AI provider switching, model management, Codex extensions, and CLI adapters.

---

## Comparative Matrix

| Project | GitHub Repository | License | Tech Stack | Provider Mechanism | Model Catalog / Discovery | Configuration Target |
|---|---|---|---|---|---|---|
| **CC Switch** | [farion1231/cc-switch](https://github.com/farion1231/cc-switch) | MIT | Rust / Tauri / React | Multi-agent provider manager (Claude, Codex, Gemini) | Presets & dynamic endpoints | `~/.codex/config.toml`, `settings.json`, env |
| **Codex++** | [yuguorui/codex-plus](https://github.com/yuguorui/codex-plus) | AGPL-3.0 | Rust | Fork of Codex CLI adding `wire_api = "chat"` and `"anthropic"` | Embedded + dynamic catalog | `~/.codex/config.toml` |
| **CodexPlusPlus** | [BigPizzaV3/CodexPlusPlus](https://github.com/BigPizzaV3/CodexPlusPlus) | AGPL-3.0 | Rust | Custom build of Codex with multi-agent extensions | Custom catalog patches | `~/.codex/config.toml` |
| **ccswitch (CLI)** | [Cursedpotential/ccswitch](https://github.com/Cursedpotential/ccswitch) | MIT | Go | Claude Code environment variable wrapper / launchers | Preset provider model lists | Wrappers / process env |
| **CCSwitch (Auth)**| [Leu-s/CCSwitch](https://github.com/Leu-s/CCSwitch) | MIT | Python / JS | Claude session & token rotator | Subscription-based | OAuth token storage |
| **OpenAI Codex (Official)** | [openai/codex](https://github.com/openai/codex) | Proprietary / Apache-2 (core) | Rust + TypeScript | `[model_providers.<ID>]` table with `wire_api = "responses"` | `model_catalog_json` path or builtin catalog | `~/.codex/config.toml`, `auth.json` |
| **LiteLLM / AI Gateway** | [BerriAI/litellm](https://github.com/BerriAI/litellm) | MIT | Python | Proxy translating OpenAI to 100+ LLMs | `/models` endpoint | YAML config |

---

## Detailed Project Breakdowns

### 1. CC Switch (`farion1231/cc-switch`)
- **License**: MIT
- **Features**: Cross-platform desktop app (Windows/macOS/Linux) and tray menu managing configurations for Claude Code, Codex, Gemini CLI, OpenCode.
- **Provider Mechanism**: Directly updates native config files (`~/.codex/config.toml` for Codex) with zero-invasive principle. If the app is closed or uninstalled, configurations remain intact.
- **Key Takeaways**:
  - Configuration atomic writes and timestamped backups (`config.toml.backup.xxx`).
  - Speed test / latency benchmark for endpoints.
  - Built-in provider templates (OpenRouter, DeepSeek, SiliconFlow, Moonshot/Kimi, Zhipu, etc.).
- **What NOT to Copy**: Heavy desktop GUI (Tauri/desktop app). Our solution runs natively inside VS Code as a lightweight extension.

### 2. Codex++ (`yuguorui/codex-plus`)
- **License**: AGPL-3.0
- **Features**: Rebased fork of Codex CLI in Rust that adds native Chat Completions API (`wire_api = "chat"`) and Anthropic Messages API (`wire_api = "anthropic"`), Bongo cat pet, custom file tools.
- **Provider Mechanism**: Extends Codex's `model_providers` table to support non-Responses wire protocols.
- **Key Takeaways**:
  - Highlights the difference between OpenAI Responses API and standard Chat Completions.
  - Documents provider-specific quirks (`extra_body` for thinking tokens, `env_key_auth` header schemes).
- **What NOT to Copy**: Do NOT copy any AGPL-3.0 code into our MIT extension. Our project acts as an external orchestrator/manager for official Codex and Codex++ without binary forks.

### 3. ccswitch (`Cursedpotential/ccswitch`)
- **License**: MIT
- **Features**: Single CLI in Go to switch Claude Code providers with individual launchers (`ccswitch-zai`, `ccswitch-kimi`, etc.).
- **Provider Mechanism**: Injects environment variables (`ANTHROPIC_BASE_URL`, `ANTHROPIC_API_KEY`) per execution.
- **Key Takeaways**:
  - Clean separation of provider metadata: Name, ID, Base URL, Auth header, Default models.
  - Profile concept: Grouping provider + model + parameters.
- **What NOT to Copy**: Do NOT rely solely on shell environment variables for Codex. Unlike Claude Code, Codex relies on `~/.codex/config.toml` and `app-server` daemon.

### 4. OpenAI Codex Upstream (CLI `0.151.0-alpha.7.2` & VS Code Extension `26.825.51511`)
- **License**: Official OpenAI distribution
- **Features**:
  - Native `[model_providers.<ID>]` table in `~/.codex/config.toml`.
  - Native `model_catalog_json` pointing to custom JSON models.
  - `codex app-server` exposes `model/list`, `config/read`, `config/value/write`.
  - VS Code Extension webview queries `model/list` directly from `codex app-server`.
- **Key Takeaways**:
  - **No binary patching or invasive hacking is needed!** Official Codex provides native extension points (`model_providers` and `model_catalog_json`) that seamlessly populate models into the native VS Code Codex Extension!

---

## Synthesis & Architectural Decisions for `codex-model-switcher`

1. **Native-First Thin Wrapper**:
   Leverage Codex's built-in `[model_providers.<ID>]` and `model_catalog_json` capabilities.
2. **Provider Adapter Architecture**:
   Support standard endpoints with built-in presets (OpenAI, OpenRouter, DeepSeek, Kimi/Moonshot, SiliconFlow, Ollama, LM Studio, Custom).
3. **Automated Model Discovery**:
   Query upstream `/v1/models` and map to Codex model catalog format, with user overrides and fallbacks.
4. **Safety & Zero Intrusion**:
   - Atomic file writes with `.backup` history.
   - SecretStorage for API keys. Desensitized logging (`sk-***`).
   - File system watcher on `~/.codex/config.toml` to stay in sync with manual user edits.
5. **Dual UX Integration**:
   - **Codex Native**: Third-party models are exported to `model_catalog_json` so they show up directly in Codex's native picker.
   - **VS Code Extension UI**: Status bar item `$(sparkle) Codex: [Model]`, QuickPick switcher (`Ctrl+Alt+M`), Provider/Profile manager, and Diagnostics.
