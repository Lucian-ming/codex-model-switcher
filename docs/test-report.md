# Codex Model Switcher: Engineering Acceptance & Verification Report

This document records the independent quality assurance, code audit, and live API integration tests performed on `codex-model-switcher`.

---

## 1. Test Matrix

| Test Category | Test Item | Status | Evidence / Log Reference | Notes |
|---|---|---|---|---|
| **Build & Type Safety** | TypeScript Compilation (`tsc --noEmit`) | **PASS** | `npm run lint` -> 0 errors | Full type coverage without missing imports |
| **Build & Bundle** | Bundle Generation (`esbuild.js`) | **PASS** | `npm run compile` -> `dist/extension.js` (96.7 KB) | CommonJS bundle with source map |
| **VSIX Packaging** | VSIX Generation (`vsce package`) | **PASS** | `codex-model-switcher-0.1.0.vsix` (50.6 KB) | Standalone package verified with `.vscodeignore` |
| **Unit Testing** | Security & SecretStorage Tests | **PASS** | `test/security.test.ts` (4/4 passed) | Redaction, masking, 0600 file fallback |
| **Unit Testing** | TOML Config Manager & Safety | **PASS** | `test/configManager.test.ts` (5/5 passed) | Atomic rename, timestamped backups, rollback |
| **Unit Testing** | Model Discovery & Normalization | **PASS** | `test/modelDiscovery.test.ts` (2/2 passed) | Normalizes raw `/v1/models` to Codex schema |
| **Integration** | Mock Server E2E Pipeline | **PASS** | `test/e2e.test.ts` (1/1 passed) | Mock server -> Discovery -> Export -> Codex CLI |
| **Live Integration** | Provider A Model Discovery | **PASS** | `test/liveIntegration.test.ts` | Discovered 12 models from `https://api.pinaic.com` |
| **Live Integration** | Provider A Codex CLI Execution | **PASS** | `codex exec` with `gpt-5.6-sol` | Returned exact match `TEST_PROVIDER_A_OK` |
| **Live Integration** | Provider B Model Discovery | **PASS** | `test/liveIntegration.test.ts` | Discovered `grok-4.6` from `https://api.pinaic.com` |
| **Live Integration** | Provider B Codex CLI Execution | **PASS** | `codex exec` with `grok-4.6` | Returned exact match `TEST_PROVIDER_B_OK` |
| **Live Integration** | Dual Provider Switching (A -> B -> A) | **PASS** | `test_full_suite.js` | Switch verified with zero config corruption |
| **Native Integration** | Codex Native Model Picker Injection | **PASS** | `codex app-server` `model/list` RPC | Both `grok-4.6` and `gpt-5.6-sol` listed in native picker |
| **Security Audit** | Secret Leaks & Git Audit | **PASS** | `grep -rn 'sk-'` across repo | No live keys stored in git, logs, or disk |

---

## 2. Live API Test Execution Details

### Provider A
- **Endpoint**: `https://api.pinaic.com/v1`
- **Authentication**: `Bearer sk-e4d2****dd44`
- **Wire Protocol**: `responses` & `chat.completions` (HTTP 200 OK)
- **Discovered Models (12)**: `gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.3-codex-spark`, `gpt-5.2`, `gpt-image-1`, `gpt-image-1.5`, `gpt-image-2`, `codex-auto-review`, `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`
- **Test Prompt**: `Reply with exactly: TEST_PROVIDER_A_OK`
- **Codex CLI Model**: `gpt-5.6-sol` (reasoning effort: `max`) & `gpt-5.5` (reasoning effort: `high`)
- **Codex CLI Result**:
  ```text
  codex
  TEST_PROVIDER_A_OK
  tokens used: 4,518
  Exit Code: 0
  ```

### Provider B
- **Endpoint**: `https://api.pinaic.com/v1`
- **Authentication**: `Bearer sk-9af8****ab49`
- **Wire Protocol**: `responses` & `chat.completions` (HTTP 200 OK)
- **Discovered Models (1)**: `grok-4.6`
- **Test Prompt**: `Reply with exactly: TEST_PROVIDER_B_OK`
- **Codex CLI Model**: `grok-4.6`
- **Codex CLI Result**:
  ```text
  codex
  TEST_PROVIDER_B_OK
  tokens used: 10,211
  Exit Code: 0
  ```

---

## 3. Native Model Picker Verification Evidence

When `model_catalog_json` points to the catalog exported by `CatalogExporter`, `codex app-server --stdio` was invoked with the `initialize` and `model/list` JSON-RPC methods:

```json
{
  "id": 2,
  "method": "model/list",
  "params": {}
}
```

**App-Server Response**:
```json
{
  "id": 2,
  "result": {
    "data": [
      {
        "id": "grok-4.6",
        "model": "grok-4.6",
        "displayName": "Grok 4.6 (Provider B)",
        "description": "Grok 4.6 via Provider B",
        "supportedReasoningEfforts": [ ... ],
        "defaultReasoningEffort": "low",
        "inputModalities": ["text", "image"],
        "isDefault": true
      },
      {
        "id": "gpt-5.6-sol",
        "model": "gpt-5.6-sol",
        "displayName": "GPT-5.6-Sol",
        ...
      }
    ]
  }
}
```

**Conclusion**: The third-party model `grok-4.6` successfully entered the native Codex model list returned by `codex app-server` to the official VS Code Codex extension webview.
