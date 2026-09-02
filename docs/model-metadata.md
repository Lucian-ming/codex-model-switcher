# Model Metadata & Reasoning Adaptation Specification

This document details how `codex-model-switcher` models metadata, per-model reasoning effort levels, context window overrides, and upstream schema compatibility.

---

## 1. Model Data Model

```typescript
export interface ModelProfile {
  id: string; // Composite unique key: `${providerId}:${modelId}`
  providerId: string;
  modelId: string; // Raw slug for upstream endpoint (e.g. 'gpt-5.5')
  displayName: string;
  description?: string;
  protocol?: 'responses' | 'chat' | 'anthropic';

  // Context Window
  contextWindow?: number;
  contextWindowInfo?: {
    value: number;
    source: 'discovered' | 'user' | 'default';
    discoveredValue?: number;
  };

  // Reasoning Capabilities (Per-Model)
  defaultReasoningLevel?: string;
  supportedReasoningLevels?: ReasoningLevelOption[];
  reasoningInfo?: ModelReasoningInfo;

  // Modalities & Tools
  inputModalities?: string[];
  supportsSearchTool?: boolean;
  toolMode?: string;
  applyPatchToolType?: string;
  shellType?: string;
}
```

---

## 2. Per-Model Reasoning Capabilities

Rather than imposing a global hardcoded reasoning array, reasoning effort is treated as a first-class, model-level property:

| Model Family | Supported Reasoning Tiers | Default Tier | Notes |
|---|---|---|---|
| **GPT-5.6 / Daybreak** (`gpt-5.6-sol`, `gpt-5.6-terra`, `daybreak-*`) | `low`, `medium`, `high`, `xhigh`, `max`, `ultra` | `high` | Supports deepest reasoning and task delegation |
| **GPT-5.5 / GPT-5.4 / GPT-5.2** (`gpt-5.5`, `gpt-5.4`, `gpt-5.2`) | `none`, `low`, `medium`, `high`, `xhigh` | `medium` | Upstream rejects `max` / `ultra` with HTTP 400 |
| **Grok Family** (`grok-4.6`, `grok-4.5`) | `low`, `medium`, `high`, `max` | `medium` | Does not support `ultra` |
| **DeepSeek R1 / Reasoning** (`deepseek-r1`, `deepseek-reasoner`) | `low`, `medium`, `high`, `max` | `medium` | Reasoning-first architecture |
| **Standard Non-Reasoning** (`gpt-4o`, `claude-3-5-sonnet`, `image-*`) | `none` / Unsupported | `none` | No reasoning effort parameter allowed |

### Adaptive Fallback Logic
When a user switches from Model A to Model B:
1. If Model B supports the user's current effort setting, the effort is preserved.
2. If Model B does not support it (e.g. switching from `gpt-5.6-sol` with `max` to `gpt-5.5`), the extension automatically adjusts to Model B's `defaultReasoningLevel` (`medium`) and issues an informative notification.
3. This prevents runtime 400 errors from the upstream API.

---

## 3. Context Window Resolution Pipeline

Context window size is resolved with the following strict priority:

```
1. User Manual Override (~/.codex-model-switcher/context_overrides.json)
        ↓
2. Discovered Value from Upstream GET /v1/models
        ↓
3. Model Family Known Heuristics (e.g. 272K for GPT-5.6, 256K for Kimi, 200K for Claude)
        ↓
4. Conservative Fallback (128K tokens)
```

Users can override context windows via input formats such as `128K`, `200K`, `256k`, `1M`, or raw integer tokens. Resetting returns the model to its discovered baseline.
