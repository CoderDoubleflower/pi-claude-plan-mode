import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import {
  createEmptyPlanModeConfig,
  loadPlanModeConfig,
  savePlanModeConfig,
} from "./config.js";
import {
  getConfigurablePlanningTools,
  getDefaultPlanningTools,
  getEffectivePlanningToolSelection,
} from "./tool-set.js";
import {
  THINKING_LEVELS,
  type PhaseProfileConfig,
  type PlanModeConfig,
  type ThinkingLevel,
} from "./types.js";

export interface PlanConfigUiResult {
  saved: boolean;
}

type ConfigScope = "global" | "project";

interface SelectableModel {
  provider: string;
  id: string;
  name?: string;
}

function cloneConfig(config: PlanModeConfig): PlanModeConfig {
  return {
    ...(config.tools !== undefined ? { tools: [...config.tools] } : {}),
    planning: { ...config.planning },
    execution: { ...config.execution },
  };
}

function modelKey(model: SelectableModel): string {
  return `${model.provider}/${model.id}`;
}

function getSelectableModels(ctx: ExtensionCommandContext): SelectableModel[] {
  const compatibility = ctx as ExtensionCommandContext & {
    scopedModels?: readonly { model: SelectableModel }[];
    modelRegistry: {
      getAvailable?: () => SelectableModel[];
    };
  };
  const scoped = compatibility.scopedModels ?? [];
  const candidates = scoped.length > 0
    ? scoped.map((entry) => entry.model)
    : compatibility.modelRegistry.getAvailable?.() ?? (ctx.model ? [ctx.model] : []);
  const byKey = new Map<string, SelectableModel>();
  for (const model of candidates) byKey.set(modelKey(model), model);
  return [...byKey.values()].sort((left, right) => modelKey(left).localeCompare(modelKey(right)));
}

function formatModel(profile: PhaseProfileConfig): string {
  return profile.provider && profile.model ? `${profile.provider}/${profile.model}` : "inherit";
}

function formatTools(config: PlanModeConfig, scope: ConfigScope): string {
  if (config.tools === undefined) return scope === "project" ? "inherit" : "built-in defaults";
  if (config.tools.length === 0) return "none";
  if (config.tools.length <= 3) return config.tools.join(", ");
  return `${config.tools.slice(0, 3).join(", ")} +${config.tools.length - 3}`;
}

function clearModel(profile: PhaseProfileConfig): PhaseProfileConfig {
  const next = { ...profile };
  delete next.provider;
  delete next.model;
  return next;
}

function clearThinking(profile: PhaseProfileConfig): PhaseProfileConfig {
  const next = { ...profile };
  delete next.thinkingLevel;
  return next;
}

async function selectModel(
  ctx: ExtensionCommandContext,
  title: string,
  profile: PhaseProfileConfig,
): Promise<PhaseProfileConfig> {
  const models = getSelectableModels(ctx);
  const inheritLabel = "Inherit current/default model";
  const labels = models.map((model) => {
    const name = model.name && model.name !== model.id ? ` — ${model.name}` : "";
    return `${modelKey(model)}${name}`;
  });
  const choice = await ctx.ui.select(title, [inheritLabel, ...labels]);
  if (!choice) return profile;
  if (choice === inheritLabel) return clearModel(profile);
  const index = labels.indexOf(choice);
  const model = index >= 0 ? models[index] : undefined;
  return model ? { ...profile, provider: model.provider, model: model.id } : profile;
}

async function selectThinkingLevel(
  ctx: ExtensionCommandContext,
  title: string,
  profile: PhaseProfileConfig,
): Promise<PhaseProfileConfig> {
  const inheritLabel = "Inherit current/default thinking level";
  const choice = await ctx.ui.select(title, [inheritLabel, ...THINKING_LEVELS]);
  if (!choice) return profile;
  if (choice === inheritLabel) return clearThinking(profile);
  return THINKING_LEVELS.includes(choice as ThinkingLevel)
    ? { ...profile, thinkingLevel: choice as ThinkingLevel }
    : profile;
}

async function selectToolAllowlist(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  scope: ConfigScope,
  configured: string[] | undefined,
  inheritedTools: readonly string[],
): Promise<string[] | undefined> {
  const allToolNames = new Set(pi.getAllTools().map((tool) => tool.name));
  let explicit = configured === undefined ? undefined : [...configured];

  while (true) {
    const selected = new Set(explicit ?? inheritedTools);
    const names = [...new Set([
      ...getConfigurablePlanningTools(allToolNames),
      ...(explicit ?? []),
      ...inheritedTools,
    ])].sort((left, right) => left.localeCompare(right));
    const entries = names.map((name) => {
      const registered = allToolNames.has(name);
      const label = `${selected.has(name) ? "[x]" : "[ ]"} ${name}${registered ? "" : " (not registered now)"}`;
      return { label, name };
    });
    const inheritLabel = explicit === undefined
      ? `✓ ${scope === "project" ? "Inherit global/default tools" : "Use built-in default tools"}`
      : scope === "project"
        ? "Inherit global/default tools"
        : "Use built-in default tools";
    const choice = await ctx.ui.select(
      "Plan Mode allowed tools · toggle entries, then choose Done",
      [inheritLabel, ...entries.map((entry) => entry.label), "Done"],
    );
    if (!choice || choice === "Done") return explicit;
    if (choice === inheritLabel) {
      explicit = undefined;
      continue;
    }
    const entry = entries.find((candidate) => candidate.label === choice);
    if (!entry) continue;
    const next = new Set(explicit ?? inheritedTools);
    if (next.has(entry.name)) next.delete(entry.name);
    else next.add(entry.name);
    explicit = [...next].sort((left, right) => left.localeCompare(right));
  }
}

function formatConfig(config: PlanModeConfig): string {
  return JSON.stringify(config, null, 2);
}

async function editScopeConfig(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  scope: ConfigScope,
  filePath: string,
  current: PlanModeConfig,
  inheritedTools: readonly string[],
): Promise<boolean> {
  const original = formatConfig(current);
  let draft = cloneConfig(current);
  const scopeLabel = scope === "global" ? "Global" : "Project";

  while (true) {
    const choice = await ctx.ui.select(`Plan Mode configuration · ${scopeLabel}`, [
      `Allowed tools · ${formatTools(draft, scope)}`,
      `Plan model · ${formatModel(draft.planning)}`,
      `Plan thinking · ${draft.planning.thinkingLevel ?? "inherit"}`,
      `Execute model · ${formatModel(draft.execution)}`,
      `Execute thinking · ${draft.execution.thinkingLevel ?? "inherit"}`,
      "Show configuration JSON",
      "Reset this scope",
      "Save and close",
      "Cancel",
    ]);
    if (!choice || choice === "Cancel") return false;

    if (choice.startsWith("Allowed tools")) {
      const tools = await selectToolAllowlist(pi, ctx, scope, draft.tools, inheritedTools);
      if (tools === undefined) delete draft.tools;
      else draft.tools = tools;
      continue;
    }
    if (choice.startsWith("Plan model")) {
      draft.planning = await selectModel(ctx, "Select Plan model", draft.planning);
      continue;
    }
    if (choice.startsWith("Plan thinking")) {
      draft.planning = await selectThinkingLevel(ctx, "Select Plan thinking level", draft.planning);
      continue;
    }
    if (choice.startsWith("Execute model")) {
      draft.execution = await selectModel(ctx, "Select Execute model", draft.execution);
      continue;
    }
    if (choice.startsWith("Execute thinking")) {
      draft.execution = await selectThinkingLevel(ctx, "Select Execute thinking level", draft.execution);
      continue;
    }
    if (choice === "Show configuration JSON") {
      ctx.ui.notify(formatConfig(draft), "info");
      continue;
    }
    if (choice === "Reset this scope") {
      const confirmed = await ctx.ui.confirm(
        `Reset ${scopeLabel} Plan Mode configuration?`,
        scope === "project"
          ? "All project overrides will be removed and the global/default configuration will be inherited."
          : "All global overrides will be removed and built-in defaults will be used.",
      );
      if (confirmed) draft = createEmptyPlanModeConfig();
      continue;
    }
    if (choice === "Save and close") {
      if (formatConfig(draft) === original) {
        ctx.ui.notify("Plan Mode configuration was not changed.", "info");
        return false;
      }
      await savePlanModeConfig(filePath, draft);
      ctx.ui.notify(`${scopeLabel} Plan Mode configuration saved to ${filePath}.`, "info");
      return true;
    }
  }
}

function effectiveConfigText(
  config: PlanModeConfig,
  allToolNames: ReadonlySet<string>,
  globalPath: string,
  projectPath: string,
): string {
  return [
    `Global: ${globalPath}`,
    `Project: ${projectPath}`,
    "",
    JSON.stringify(
      {
        tools: getEffectivePlanningToolSelection(config.tools, allToolNames),
        planning: config.planning,
        execution: config.execution,
      },
      null,
      2,
    ),
  ].join("\n");
}

export async function openPlanModeConfig(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  options: { agentDir: string; configDirName: string },
): Promise<PlanConfigUiResult> {
  let saved = false;

  while (true) {
    const trusted = ctx.isProjectTrusted();
    const loaded = loadPlanModeConfig(ctx.cwd, {
      ...options,
      loadProjectConfig: trusted,
    });
    for (const warning of loaded.warnings) ctx.ui.notify(warning, "warning");
    const allToolNames = new Set(pi.getAllTools().map((tool) => tool.name));

    if (!ctx.hasUI) {
      ctx.ui.notify(
        effectiveConfigText(loaded.config, allToolNames, loaded.globalPath, loaded.projectPath),
        "info",
      );
      return { saved };
    }

    const projectLabel = trusted
      ? "Project configuration"
      : "Project configuration (project is not trusted)";
    const choice = await ctx.ui.select("Plan Mode configuration", [
      "Global configuration",
      projectLabel,
      "Show effective configuration",
      "Close",
    ]);
    if (!choice || choice === "Close") return { saved };
    if (choice === "Show effective configuration") {
      ctx.ui.notify(
        effectiveConfigText(loaded.config, allToolNames, loaded.globalPath, loaded.projectPath),
        "info",
      );
      continue;
    }
    if (choice === projectLabel && !trusted) {
      ctx.ui.notify("Project configuration is unavailable until the project is trusted.", "warning");
      continue;
    }

    const scope: ConfigScope = choice === "Global configuration" ? "global" : "project";
    const current = scope === "global" ? loaded.globalConfig : loaded.projectConfig;
    const inheritedTools = scope === "project"
      ? getEffectivePlanningToolSelection(loaded.globalConfig.tools, allToolNames)
      : getDefaultPlanningTools(allToolNames);
    const changed = await editScopeConfig(
      pi,
      ctx,
      scope,
      scope === "global" ? loaded.globalPath : loaded.projectPath,
      current,
      inheritedTools,
    );
    saved = saved || changed;
  }
}
