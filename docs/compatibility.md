# Provider & Protocol Compatibility Matrix

This document outlines compatibility across different AI providers, wire protocols, discovery interfaces, and Codex integration tiers.

---

## Compatibility Matrix

| Provider / Service | Protocol Type | Model Discovery (`/v1/models`) | Codex CLI Direct Execution | Native Codex Model Picker | Recommended Setup |
|---|---|---|---|---|---|
| **PinAI (Provider A)** | `responses` | ✅ HTTP 200 (12 models) | ✅ Supported (`gpt-5.6-sol`, `gpt-5.5`) | ✅ Injected via `model_catalog_json` | `wire_api = "responses"`, `requires_openai_auth = false` |
| **PinAI (Provider B)** | `responses` | ✅ HTTP 200 (`grok-4.6`) | ✅ Supported (`grok-4.6`) | ✅ Injected via `model_catalog_json` | `wire_api = "responses"`, `requires_openai_auth = false` |
| **OpenAI Official** | `responses` | ✅ HTTP 200 | ✅ Native Support | ✅ Native Builtin | Standard OAuth or `auth.json` |
| **OpenRouter** | `responses` & `chat` | ✅ HTTP 200 | ✅ Supported (via responses endpoint) | ✅ Injected via `model_catalog_json` | `wire_api = "responses"`, `env_key = "OPENROUTER_API_KEY"` |
| **DeepSeek Official** | `chat` | ✅ HTTP 200 | ⚠️ Requires Responses Gateway or Codex++ | ✅ Injected via `model_catalog_json` | Responses Adapter or Codex++ |
| **Moonshot / Kimi** | `chat` | ✅ HTTP 200 | ⚠️ Requires Responses Gateway or Codex++ | ✅ Injected via `model_catalog_json` | Responses Adapter or Codex++ |
| **SiliconFlow** | `chat` | ✅ HTTP 200 | ⚠️ Requires Responses Gateway or Codex++ | ✅ Injected via `model_catalog_json` | Responses Adapter or Codex++ |
| **Ollama (Local)** | `chat` | ✅ HTTP 200 | ⚠️ Requires Responses Gateway or Codex++ | ✅ Injected via `model_catalog_json` | `--oss --local-provider ollama` or Adapter |

---

## Technical Notes
1. **Responses API vs Chat Completions**:
   - Official OpenAI Codex CLI (`codex`) strictly mandates `wire_api = "responses"`.
   - Providers offering native Responses API endpoints (e.g. PinAI, OpenRouter, and enterprise proxies) work out-of-the-box with official Codex.
   - For pure Chat Completions endpoints, requests can be routed through a protocol adapter or executed using Codex++ (`yuguorui/codex-plus`), which adds native `wire_api = "chat"`.
2. **Model Metadata Constraints**:
   - Models like `gpt-5.5` only support reasoning effort levels up to `xhigh`.
   - Models like `gpt-5.6-sol` support `max`.
   - When models are registered through `model_catalog_json`, Codex properly constrains and displays available reasoning effort tiers.
