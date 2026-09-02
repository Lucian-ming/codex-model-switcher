# Codex Architecture & Configuration Research (Phase 1)

## 1. Executive Summary & Breakthrough Findings
Through reverse engineering of the `codex` CLI binary (`0.151.0-alpha.7.2`), extraction of TypeScript definitions via `codex app-server generate-ts`, and empirical testing with the live `app-server` daemon, we have confirmed:

1. **Native Custom Provider Support**:
   Codex natively supports custom providers in `~/.codex/config.toml` under the `[model_providers.<ID>]` table.
   The active provider is chosen with the top-level key `model_provider = "<ID>"`.

2. **Native Custom Model Catalog Injection**:
   Codex natively supports the `model_catalog_json` configuration key in `~/.codex/config.toml`:
   ```toml
   model_catalog_json = "/path/to/custom_catalog.json"
   ```
   When `model_catalog_json` is specified, `codex app-server` loads the models from this JSON file. The webview's `model/list` RPC call returns these exact models. **This proves that third-party models can directly enter the native VS Code Codex Extension's Model Picker!**

3. **Active Model Selection**:
   The active model is chosen with `model = "<slug>"` and `review_model = "<slug>"`.

## 2. Configuration Schema in `config.toml`

### Top-Level Fields
| Field | Type | Description |
|---|---|---|
| `model_provider` | string | ID of the active model provider in `[model_providers.<ID>]` |
| `model` | string | Model slug (e.g., `gpt-5.6-sol`, `claude-3-7-sonnet`, `deepseek-chat`) |
| `review_model` | string | Model slug used for automated code reviews |
| `model_reasoning_effort` | string | `low`, `medium`, `high`, `xhigh`, `max`, `ultra` |
| `model_catalog_json` | string | Absolute path to a JSON file containing custom model definitions |
| `personality` | string | Assistant personality (e.g. `pragmatic`) |
| `approvals_reviewer` | string | `user` or `guardian` |

### Provider Configuration Table: `[model_providers.<ID>]`
| Key | Type | Description |
|---|---|---|
| `name` | string | Human-readable provider name |
| `base_url` | string | API base URL (e.g. `https://api.pinaic.com` or `https://openrouter.ai/api/v1`) |
| `wire_api` | string | Wire protocol: `"responses"` (official standard). In forks like Codex++, also `"chat"` and `"anthropic"`. |
| `requires_openai_auth` | boolean | If `true`, reuses OpenAI credentials from `~/.codex/auth.json`. If `false`, uses custom auth. |
| `env_key` | string | Environment variable name storing the API Key (e.g., `"OPENROUTER_API_KEY"`) |
| `http_headers` | table | Custom HTTP headers map, e.g. `{ Authorization = "Bearer ..." }` |
| `query_params` | table | Query parameters to append to requests |
| `stream_max_retries` | integer | Max retries for streaming connections |
| `stream_idle_timeout_ms`| integer | Timeout in milliseconds for idle streams |
| `supports_websockets` | boolean | Whether provider supports websocket streaming |

## 3. Model Catalog JSON Schema (`model_catalog_json`)
Codex expects a JSON object with a `models` array:
```json
{
  "models": [
    {
      "slug": "claude-3-7-sonnet",
      "display_name": "Claude 3.7 Sonnet",
      "description": "Anthropic Claude 3.7 Sonnet via provider",
      "visibility": "list",
      "priority": 1,
      "context_window": 200000,
      "max_context_window": 200000,
      "effective_context_window_percent": 95,
      "supported_reasoning_levels": ["low", "medium", "high", "max"],
      "default_reasoning_level": "medium",
      "input_modalities": ["text", "image"],
      "supports_search_tool": true,
      "tool_mode": "native",
      "apply_patch_tool_type": "freeform",
      "shell_type": "bash"
    }
  ]
}
```

### Empirical Proof of App-Server Integration
We ran a live test spawning `codex app-server --stdio` with `model_catalog_json` pointing to a custom model:
- `initialize` RPC succeeded.
- `model/list` RPC returned 6 models, including `Claude 3.7 Sonnet (PinAI)`.
- The model structure matches the official `Model.ts` contract required by the VS Code extension webview.

## 4. How the VS Code Extension Talks to Codex
```
VS Code UI (Sidebar / Editor)
      │  (VS Code Webview Message Bridge)
      ▼
extension.js (Remote-WSL Extension Host)
      │  (JSON-RPC 2.0 over Stdio)
      ▼
codex app-server --stdio
      │  (Reads ~/.codex/config.toml & model_catalog_json)
      ▼
Config Engine & Model Catalog
```
1. Extension launches `codex -c features.code_mode_host=true app-server --analytics-default-enabled`.
2. When the user opens the Model Picker, the webview sends `model/list` RPC to `extension.js`, which proxies it to `app-server`.
3. Changes to `~/.codex/config.toml` or `model_catalog_json` update the source of truth.
