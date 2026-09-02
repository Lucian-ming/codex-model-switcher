export interface ReasoningLevelOption {
  effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'ultra' | string;
  description: string;
}

export interface ModelProfile {
  id: string;
  providerId: string;
  modelId: string; // The slug sent to the upstream endpoint
  displayName: string;
  description?: string;
  protocol?: 'responses' | 'chat' | 'anthropic';
  contextWindow?: number;
  maxContextWindow?: number;
  effectiveContextWindowPercent?: number;
  defaultReasoningLevel?: 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'ultra';
  supportedReasoningLevels?: ReasoningLevelOption[];
  inputModalities?: string[];
  supportsSearchTool?: boolean;
  supportsApplyPatch?: boolean;
  applyPatchToolType?: 'freeform' | 'unified' | string;
  shellType?: 'unified_exec' | 'bash' | string;
  toolMode?: 'native' | 'code_mode_only' | string;
  priority?: number;
  visibility?: 'list' | 'hide';
  enabled?: boolean;
  favorite?: boolean;
  lastUsedAt?: string;
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
  supported_reasoning_levels?: string[] | ReasoningLevelOption[];
  input_modalities?: string[];
  supports_search_tool?: boolean;
  tool_mode?: string;
  apply_patch_tool_type?: string;
  shell_type?: string;
  [key: string]: unknown;
}

export interface CodexModelCatalog {
  models: CodexCatalogModelSchema[];
}
