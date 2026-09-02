# Facts and Assumptions (Phase 1 & 2 Findings)

This document tracks all empirically confirmed behaviors versus theoretical assumptions.

---

## Confirmed Facts (Empirically Verified)

1. **Codex CLI Configuration Location**:
   - Primary: `~/.codex/config.toml` (`/home/lucian/.codex/config.toml` in WSL).
   - Auth: `~/.codex/auth.json` (`/home/lucian/.codex/auth.json` in WSL).
   - Verified by direct filesystem read and `codex debug` commands.

2. **Native Custom Provider Mechanism in Codex**:
   - `[model_providers.<ID>]` is natively parsed by the Codex Rust binary (`0.151.0-alpha.7.2`).
   - Fields supported: `name`, `base_url`, `wire_api`, `requires_openai_auth`, `env_key`, `http_headers`, `query_params`, `stream_max_retries`, `stream_idle_timeout_ms`, `supports_websockets`.
   - `model_provider = "<ID>"` at the root selects the active provider.
   - User's existing setup already successfully uses `[model_providers.PinAI]`.

3. **Native Model Catalog JSON Mechanism (`model_catalog_json`)**:
   - `model_catalog_json = "/path/to/catalog.json"` is an official configuration setting supported in `config.toml`.
   - The JSON file format must be `{ "models": [ <ModelObject>, ... ] }`.
   - Verified: When pointing to `/tmp/test_custom_catalog_obj.json`, `codex debug models` outputs our custom model `Claude 3.7 Sonnet (PinAI)`.

4. **VS Code Extension & Codex App-Server Architecture**:
   - VS Code Extension (`openai.chatgpt 26.825.51511`) spawns `codex app-server --stdio` in the remote environment (WSL).
   - The extension webview communicates via JSON-RPC 2.0 (`model/list`, `config/read`, `config/value/write`).
   - Verified: Our live node test against `codex app-server --stdio` with `model_catalog_json` confirmed that `model/list` returns custom models with full properties (`displayName`, `supportedReasoningEfforts`, `serviceTiers`, `isDefault`).

5. **Secrets & Credentials Protection**:
   - `auth.json` is set to `0600` permissions.
   - For custom providers, `env_key` or `http_headers` can supply authentication without overriding OpenAI's default auth token.

---

## Confirmed Limitations & Protocol Differences

1. **Official Codex Wire API**:
   - Official Codex standard wire protocol is `responses` (`wire_api = "responses"`).
   - If a provider is only `Chat Completions` (`/v1/chat/completions`) and does not implement the Responses API endpoint (`/v1/responses`), official Codex returns an error indicating `wire_api = "responses"` is required.
   - Providers like OpenRouter, DeepSeek, and various Chinese relays offer Responses API compatibility or can be accessed via an adapter.
   - Forks like Codex++ implement `wire_api = "chat"` and `wire_api = "anthropic"`.

---

## Assumptions & Mitigations

1. **Assumption**: When `model_catalog_json` is changed while VS Code is open, does the Webview model dropdown update automatically or on reopening?
   - **Mitigation**: We provide an explicit "Refresh Models" command, reload triggers, and file watcher on `~/.codex/config.toml`.

2. **Assumption**: Tool execution (such as `apply_patch`) on non-GPT models.
   - **Mitigation**: Models are tagged with capability metadata (`apply_patch_tool_type: "freeform"`, `supports_search_tool: true/false`). Users can configure reasoning effort and tool modes per model.
