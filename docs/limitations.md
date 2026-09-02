# Project Limitations & Compatibility Notes

This document transparently explains technical limitations and environmental dependencies.

---

## 1. Upstream Codex Protocol Requirements
- **Official Codex Wire Protocol**: The official OpenAI Codex binary requires `wire_api = "responses"`. If an upstream custom provider only supports legacy `/v1/chat/completions` and does not provide an OpenAI Responses API endpoint or adapter, official Codex cannot communicate with it directly.
- **Solution / Recommendation**: 
  - Use providers with Responses API support (such as PinAI, OpenRouter, compatible gateways).
  - Or run with Codex++ (`codex++`) which supports `wire_api = "chat"` and `wire_api = "anthropic"`.
  - Or use a protocol proxy adapter.

## 2. Dynamic Model Picker Refresh in Native Extension
- The official VS Code Codex extension queries `model/list` when the session starts or when the model picker is opened.
- When `codex-model-switcher` updates `model_catalog_json` or `config.toml`, opening a new thread or reloading the webview/window triggers the native extension to read the updated catalog.
- `codex-model-switcher` also provides its own dedicated QuickPick (`Ctrl+Alt+M`) which switches models instantaneously and refreshes the VS Code Status Bar.

## 3. Remote-WSL vs Windows Host Path Translation
- In Remote-WSL mode, VS Code extensions execute in the Linux environment where `~/.codex` is `/home/<user>/.codex`.
- When running VS Code directly on Windows, the extension detects the WSL environment and resolves paths accordingly.
