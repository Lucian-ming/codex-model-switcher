# Provider Architecture & Compatibility Guide

This document details how providers are represented, authenticated, isolated, and connected to the OpenAI Codex ecosystem.

---

## 1. Provider Isolation & Composite Model IDs

To allow identical model names across multiple providers (e.g. `Provider A` offering `gpt-5.5` and `Provider B` offering `gpt-5.5`), all models are identified internally via a composite key:

```text
${providerId}:${modelId}
```

Example:
- `PinAI_A:gpt-5.5`
- `PinAI_B:gpt-5.5`

When activating `PinAI_A:gpt-5.5`, the extension simultaneously sets:
```toml
model = "gpt-5.5"
model_provider = "PinAI_A"
```
When activating `PinAI_B:gpt-5.5`, it sets:
```toml
model = "gpt-5.5"
model_provider = "PinAI_B"
```
This completely avoids state collision and ensures that credentials, endpoints, and headers remain strictly isolated.

---

## 2. Authentication & Secret Management

Providers can authenticate via two non-invasive patterns:
1. **Environment Variable Reference (`env_key`)**:
   - `env_key = "PROVIDER_API_KEY"` in `config.toml`
   - Key is stored in VS Code `SecretStorage` and supplied during CLI invocation or session spawn.
2. **Custom HTTP Headers (`http_headers`)**:
   - `http_headers = { Authorization = "Bearer ..." }` in `config.toml`
   - Generated dynamically when needed and never checked into source control.

---

## 3. Wire Protocols & Upstream Gateways

| Wire Protocol (`wire_api`) | Codex Direct Support | Description |
|---|---|---|
| `responses` | ✅ Native | Standard OpenAI Responses API (`/v1/responses`). Supported by PinAI, OpenRouter, and enterprise Codex proxies. |
| `chat` | ⚠️ Requires Gateway / Codex++ | Standard OpenAI Chat Completions API (`/v1/chat/completions`). |
| `anthropic` | ⚠️ Requires Gateway / Codex++ | Anthropic Messages API. |
