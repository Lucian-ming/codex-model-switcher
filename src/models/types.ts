export interface ReasoningLevelOption {
  effort: 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'ultra' | string;
  description: string;
}

export interface ContextWindowInfo {
  value: number;
  source: 'discovered' | 'user' | 'default' | 'pattern' | 'knowledge_base';
  discoveredValue?: number;
}

export interface ModelReasoningInfo {
  supported: boolean;
  levels: ReasoningLevelOption[];
  defaultLevel: string;
}

export interface ModelProfile {
  id: string; // Unique composite ID: `${providerId}:${modelId}`
  providerId: string;
  modelId: string; // The slug sent to the upstream endpoint
  displayName: string;
  description?: string;
  protocol?: 'responses' | 'chat' | 'anthropic';
  
  // Context Window (Discovered & Overridable)
  contextWindow?: number;
  contextWindowInfo?: ContextWindowInfo;
  maxContextWindow?: number;
  effectiveContextWindowPercent?: number;

  // Reasoning Capabilities (Per-Model)
  defaultReasoningLevel?: 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'ultra' | string;
  supportedReasoningLevels?: ReasoningLevelOption[];
  reasoningInfo?: ModelReasoningInfo;

  // Modalities & Tools
  inputModalities?: string[];
  supportsSearchTool?: boolean;
  supportsApplyPatch?: boolean;
  applyPatchToolType?: 'freeform' | 'unified' | string;
  shellType?: 'unified_exec' | 'bash' | string;
  toolMode?: 'native' | 'code_mode_only' | string;

  // UI & Selection Metadata
  priority?: number;
  visibility?: 'list' | 'hide';
  enabled?: boolean;
  favorite?: boolean;
  lastUsedAt?: string;
  healthStatus?: 'available' | 'cached' | 'unreachable' | 'unknown';
}

export interface CodexCatalogModelSchema {
  slug: string;
  display_name: string;
  description?: string;
  visibility: 'list' | 'hide';
  priority: number;
  context_window?: number;
  max_context_window?: number;
  effective_context_window_percent?: number;
  default_reasoning_level?: string;
  supported_reasoning_levels?: ReasoningLevelOption[];
  input_modalities?: string[];
  supports_search_tool?: boolean;
  tool_mode?: string;
  apply_patch_tool_type?: string;
  shell_type?: string;
  base_instructions?: string;
  supported_in_api?: boolean;
  [key: string]: unknown;
}

export interface CodexModelCatalog {
  models: CodexCatalogModelSchema[];
}
