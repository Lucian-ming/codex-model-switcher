# VS Code Extension UI & Interaction Design

This document details the user interface architecture, Activity Bar integration, TreeViews, and user flows introduced in Stage 2 of `codex-model-switcher`.

---

## 1. Visual Hierarchy & Sidebar Architecture

```
Activity Bar
    └── [Codex Switcher Icon] (resources/codex-icon.svg)
            │
            ├── View 1: Current Active State (codexModelSwitcher.current)
            │     ├── Provider: PinAI A (https://api.pinaic.com)
            │     ├── Model: gpt-5.6-sol [gpt-5.6-sol]
            │     ├── Reasoning: high (low/medium/high/xhigh/max/ultra)
            │     ├── Context: 272K (Discovered) [Click to override]
            │     └── Quick Actions: Switch Model, Switch Provider
            │
            ├── View 2: Providers & Models (codexModelSwitcher.providers)
            │     ├── ▼ PinAI A (12 models • responses • Active)
            │     │     ├── ✓ gpt-5.6-sol (272K • high)
            │     │     ├── • gpt-5.5 (128K • medium)
            │     │     └── • gpt-5.2 (128K • medium)
            │     ├── ▼ PinAI B (1 models • responses)
            │     │     └── • grok-4.6 (128K • medium)
            │     └── Actions: [+] Add Provider, [↻] Refresh Models, [⚡] Test
            │
            ├── View 3: Profiles (codexModelSwitcher.profiles)
            │     ├── • OpenAI GPT-5.6 Max [OpenAI • gpt-5.6-sol • max]
            │     ├── • Fast Coding [OpenAI • gpt-5.5 • low]
            │     ├── • DeepSeek R1 Reasoner [DeepSeek • deepseek-reasoner • high]
            │     └── Actions: [+] New Profile from Current Settings
            │
            └── View 4: Tools & Settings (codexModelSwitcher.settings)
                  ├── • Open Codex Config (config.toml)
                  ├── • Restore Configuration Backup
                  ├── • Run System Diagnostics
                  └── • Refresh All Models
```

---

## 2. Core User Flows

### A. One-Click Model Activation
1. User expands a Provider node in the **Providers & Models** view.
2. User clicks on any model (e.g. `grok-4.6` or `gpt-5.5`).
3. The extension performs **Adaptive Reasoning Check**:
   - If current reasoning effort (e.g. `max`) is not supported by target model (e.g. `gpt-5.5`), it automatically falls back to target model's default (`medium`) and notifies the user.
4. Updates `~/.codex/config.toml` atomically with new `model` and `model_provider`.
5. Syncs `model_catalog.json` so the model is immediately recognized by Codex CLI and `codex app-server`.
6. Status Bar and all TreeViews update instantly.

### B. Context Window Override Flow
1. User clicks on `Context: 128K` in **Current Active State** or selects inline action in **Providers & Models**.
2. Input Box prompts: `Enter Context Window (e.g. 128K, 200K, 256K, 1M, or raw tokens)`.
3. Input is validated and parsed into integer tokens (e.g. `200000`).
4. Overrides are persisted to `~/.codex-model-switcher/context_overrides.json`.
5. `model_catalog.json` is re-exported with the new context limit.
6. The UI immediately displays `Context: 200K (User Override)`.

### C. Profile Creation with Compatibility Validation
1. User customizes Provider, Model, and Reasoning Effort.
2. In **Profiles** view, user clicks `+`.
3. Input Box prompts for Profile Name.
4. Profile is checked against model capabilities. If invalid (e.g. `gpt-5.5` with `max`), the system blocks creation and prompts with supported tiers.
5. Once valid, profile is saved to `~/.codex-model-switcher/profiles.json`.
