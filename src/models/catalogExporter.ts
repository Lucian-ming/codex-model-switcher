import * as fs from 'fs';
import * as path from 'path';
import { ModelProfile, CodexModelCatalog, CodexCatalogModelSchema, ReasoningLevelOption } from './types.js';
import { PathResolver } from '../codex/pathResolver.js';
import { CodexConfigManager } from '../codex/configManager.js';

const DEFAULT_REASONING_LEVELS: ReasoningLevelOption[] = [
  { effort: 'low', description: 'Fast responses with lighter reasoning' },
  { effort: 'medium', description: 'Balances speed and reasoning depth for everyday tasks' },
  { effort: 'high', description: 'Greater reasoning depth for complex problems' },
  { effort: 'max', description: 'Maximum reasoning depth for the hardest problems' }
];

const DEFAULT_BASE_INSTRUCTIONS = `You are a helpful assistant that can interact with the computer to solve coding and engineering tasks.`;

export class CatalogExporter {
  public static exportCatalog(
    models: ModelProfile[],
    targetPath?: string,
    configManager?: CodexConfigManager,
    baseInstructions?: string
  ): string {
    const env = PathResolver.resolve();
    const catalogPath = targetPath || env.modelCatalogJsonPath;
    const dir = path.dirname(catalogPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }

    const catalogModels: CodexCatalogModelSchema[] = models
      .filter(m => m.enabled !== false)
      .map((m, idx) => {
        const levels = (m.supportedReasoningLevels && m.supportedReasoningLevels.length > 0)
          ? m.supportedReasoningLevels
          : DEFAULT_REASONING_LEVELS;

        const contextWindow = m.contextWindow || 128000;
        const maxContextWindow = m.maxContextWindow || contextWindow;

        return {
          slug: m.modelId,
          display_name: m.displayName,
          description: m.description || `${m.displayName} model`,
          visibility: m.visibility || 'list',
          priority: m.priority || idx + 1,
          context_window: contextWindow,
          max_context_window: maxContextWindow,
          effective_context_window_percent: m.effectiveContextWindowPercent || 95,
          supported_in_api: true,
          default_reasoning_level: m.defaultReasoningLevel || 'medium',
          supported_reasoning_levels: levels,
          base_instructions: baseInstructions || DEFAULT_BASE_INSTRUCTIONS,
          input_modalities: m.inputModalities || ['text', 'image'],
          supports_search_tool: m.supportsSearchTool !== false,
          tool_mode: m.toolMode || 'code_mode_only',
          apply_patch_tool_type: m.applyPatchToolType || 'freeform',
          shell_type: m.shellType || 'unified_exec',
          upgrade: null,
          availability_nux: null,
          additional_speed_tiers: [],
          service_tiers: [],
          default_reasoning_summary: 'none',
          support_verbosity: true,
          default_verbosity: 'low',
          web_search_tool_type: 'text_and_image',
          truncation_policy: {
            mode: 'tokens',
            limit: 10000
          },
          supports_image_detail_original: true,
          use_responses_lite: true,
          node_repl_auto_review_required: false,
          node_repl_disabled: false,
          multi_agent_version: 'v2',
          include_skills_usage_instructions: false,
          include_plugin_usage_instructions: true,
          include_apps_usage_instructions: true,
          experimental_supported_tools: [],
          comp_hash: '3000'
        };
      });

    const payload: CodexModelCatalog = {
      models: catalogModels
    };

    // Atomic write
    const tmpPath = path.join(dir, `.model_catalog.tmp.${Date.now()}`);
    fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmpPath, catalogPath);

    // Sync path into config.toml if manager provided
    if (configManager) {
      const cfg = configManager.read();
      if (cfg.model_catalog_json !== catalogPath) {
        configManager.setModelCatalogJson(catalogPath);
      }
    }

    return catalogPath;
  }
}
