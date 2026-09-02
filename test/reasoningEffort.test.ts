import { describe, it, expect } from 'vitest';
import { ReasoningManager } from '../src/models/reasoningManager.js';
import { ModelProfile } from '../src/models/types.js';

describe('Model-Level Reasoning Capabilities & Adaptive Fallback', () => {
  it('should infer correct reasoning levels per model family', () => {
    // GPT-5.6 family supports ultra and max
    const sol = ReasoningManager.inferReasoningCapabilities('gpt-5.6-sol');
    expect(sol.supported).toBe(true);
    expect(sol.levels.map(l => l.effort)).toContain('max');
    expect(sol.levels.map(l => l.effort)).toContain('ultra');
    expect(sol.defaultLevel).toBe('high');

    // GPT-5.5 family supports up to xhigh, but NOT max or ultra
    const gpt55 = ReasoningManager.inferReasoningCapabilities('gpt-5.5');
    expect(gpt55.supported).toBe(true);
    expect(gpt55.levels.map(l => l.effort)).toContain('xhigh');
    expect(gpt55.levels.map(l => l.effort)).not.toContain('max');
    expect(gpt55.levels.map(l => l.effort)).not.toContain('ultra');

    // Grok-4.6 supports up to max
    const grok = ReasoningManager.inferReasoningCapabilities('grok-4.6');
    expect(grok.supported).toBe(true);
    expect(grok.levels.map(l => l.effort)).toContain('max');
    expect(grok.levels.map(l => l.effort)).not.toContain('ultra');

    // Claude / image / standard non-reasoning models
    const claude = ReasoningManager.inferReasoningCapabilities('claude-3-5-sonnet');
    expect(claude.supported).toBe(false);
  });

  it('should accurately test whether an effort is supported', () => {
    const model55: ModelProfile = {
      id: 'test:gpt-5.5',
      providerId: 'test',
      modelId: 'gpt-5.5',
      displayName: 'GPT-5.5'
    };
    expect(ReasoningManager.isEffortSupported(model55, 'medium')).toBe(true);
    expect(ReasoningManager.isEffortSupported(model55, 'xhigh')).toBe(true);
    expect(ReasoningManager.isEffortSupported(model55, 'max')).toBe(false);
    expect(ReasoningManager.isEffortSupported(model55, 'ultra')).toBe(false);

    const modelSol: ModelProfile = {
      id: 'test:gpt-5.6-sol',
      providerId: 'test',
      modelId: 'gpt-5.6-sol',
      displayName: 'GPT-5.6-Sol'
    };
    expect(ReasoningManager.isEffortSupported(modelSol, 'max')).toBe(true);
    expect(ReasoningManager.isEffortSupported(modelSol, 'ultra')).toBe(true);
  });

  it('should adapt effort on switch and trigger fallback when unsupported', () => {
    const target55: ModelProfile = {
      id: 'test:gpt-5.5',
      providerId: 'test',
      modelId: 'gpt-5.5',
      displayName: 'GPT-5.5'
    };

    // Switching from max (e.g. from gpt-5.6-sol) to gpt-5.5 -> must fallback to medium
    const res1 = ReasoningManager.adaptEffortOnSwitch('max', target55);
    expect(res1.didFallback).toBe(true);
    expect(res1.effort).toBe('medium');
    expect(res1.reason).toContain('does not support \'max\'');

    // Switching with supported effort ('high') -> preserves 'high' without fallback
    const res2 = ReasoningManager.adaptEffortOnSwitch('high', target55);
    expect(res2.didFallback).toBe(false);
    expect(res2.effort).toBe('high');

    // Switching to a non-reasoning model
    const nonReasoning: ModelProfile = {
      id: 'test:claude-3.5',
      providerId: 'test',
      modelId: 'claude-3-5-sonnet',
      displayName: 'Claude 3.5'
    };
    const res3 = ReasoningManager.adaptEffortOnSwitch('high', nonReasoning);
    expect(res3.didFallback).toBe(true);
    expect(res3.effort).toBe('none');
  });
});
