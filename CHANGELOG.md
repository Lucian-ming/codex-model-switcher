# Changelog

All notable changes to the `codex-model-switcher` extension will be documented in this file.

## [0.1.0] - 2026-09-02

### Added
- Native Codex model catalog integration via `model_catalog_json`.
- Provider Registry supporting built-in presets (OpenAI, OpenRouter, DeepSeek, Moonshot/Kimi, SiliconFlow, Ollama) and custom endpoints.
- Dynamic `/v1/models` discovery with heuristics for context window and reasoning effort levels.
- Safe TOML configuration management with atomic writes, syntax validation, and automatic timestamped backups (`config.toml.backup.<timestamp>`).
- One-click rollback command (`Codex: Restore Previous Configuration`).
- Secure secret management using VS Code `SecretStorage` and `0600` fallback mode.
- Real-time `~/.codex/config.toml` file watcher and Status Bar UI (`$(sparkle) Codex: [Model]`).
- Searchable QuickPick model and provider switcher (`Ctrl+Alt+M`).
- Diagnostic runner command (`Codex: Diagnose Environment & Configuration`).
- Comprehensive unit and end-to-end integration test suite with mock servers and live Codex CLI validation.
