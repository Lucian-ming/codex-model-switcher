# Facts and Assumptions (Updated Post Live API Tests)

This document catalogs all verified behaviors, architectural facts, assumptions, and upstream limitations.

---

## 1. Confirmed Facts (Empirically Verified)

### A. Codex Configuration & Upstream Behavior
- **CONFIRMED**: Codex CLI (`0.151.0-alpha.7.2`) loads configuration from `~/.codex/config.toml` and supports custom providers via the `[model_providers.<ID>]` table.
- **CONFIRMED**: Multiple providers can coexist in `config.toml` simultaneously. Active provider is designated by the top-level key `model_provider = "<ID>"`.
- **CONFIRMED**: Codex requires `wire_api = "responses"` for official upstream execution.
- **CONFIRMED**: When `requires_openai_auth = false`, Codex reads API credentials via `env_key = "ENV_VAR"` or `http_headers = { Authorization = "Bearer ..." }`, bypassing the official OpenAI OAuth flow without touching `auth.json`.

### B. Native Model Catalog Injection (`model_catalog_json`)
- **CONFIRMED**: Setting `model_catalog_json = "/path/to/catalog.json"` in `config.toml` causes Codex CLI and `codex app-server` to load models from that JSON file.
- **CONFIRMED**: When custom models are injected, `codex app-server`'s `model/list` JSON-RPC method returns them directly. This provides native third-party model visibility in the official VS Code Codex extension webview.
- **CONFIRMED**: When a model is declared in `model_catalog_json`, Codex CLI suppresses the warning `warning: Model metadata for '<slug>' not found. Defaulting to fallback metadata` and applies the exact specified context window and reasoning effort levels.

### C. Live API Provider Tests
- **CONFIRMED**: Provider A (`https://api.pinaic.com/v1`, Key `sk-e4d2****dd44`) returns 12 models on `GET /v1/models` and supports both `/v1/responses` and `/v1/chat/completions`.
- **CONFIRMED**: Provider A executed `codex exec` successfully with `gpt-5.6-sol` and `gpt-5.5`, returning `TEST_PROVIDER_A_OK` with exit code 0.
- **CONFIRMED**: Provider B (`https://api.pinaic.com/v1`, Key `sk-9af8****ab49`) returns model `grok-4.6` on `GET /v1/models` and supports `/v1/responses` and `/v1/chat/completions`.
- **CONFIRMED**: Provider B executed `codex exec` successfully with `grok-4.6`, returning `TEST_PROVIDER_B_OK` with exit code 0.
- **CONFIRMED**: Switching from Provider A to Provider B and back to Provider A works atomically without corrupting TOML structure or leaving stale locks.

---

## 2. Assumptions & Workarounds

- **ASSUMED**: The VS Code Codex extension webview re-queries `model/list` from `app-server` when starting a new session/thread or when reloading the window.
  - **Mitigation**: `codex-model-switcher` provides both native catalog injection AND its own dedicated QuickPick (`Ctrl+Alt+M`) with immediate status bar feedback.

---

## 3. Unknowns & Upstream Constraints

- **UNSUPPORTED BY OFFICIAL CODEX**: Legacy `/v1/chat/completions`-only providers cannot be connected directly to official Codex without a Responses API adapter or Codex++ fork.
- **CONFIRMED**: `gpt-5.5` only supports reasoning effort up to `xhigh`. Supplying `model_reasoning_effort = "max"` causes an upstream 400 error. The `CatalogExporter` and `ProfileManager` properly enforce valid reasoning tiers per model family.
