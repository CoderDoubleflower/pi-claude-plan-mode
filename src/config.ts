import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { THINKING_LEVELS, type LoadedPlanModeConfig, type PhaseProfileConfig, type PlanModeConfig } from "./types.js";

const DEFAULT_CONFIG: PlanModeConfig = {
  planning: {},
  execution: {},
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseProfile(value: unknown, source: string, key: "planning" | "execution", warnings: string[]): PhaseProfileConfig {
  if (value === undefined) return {};
  if (!isRecord(value)) {
    warnings.push(`${source}: "${key}" must be an object.`);
    return {};
  }

  const profile: PhaseProfileConfig = {};
  if (value.provider !== undefined) {
    if (typeof value.provider === "string" && value.provider.trim()) profile.provider = value.provider.trim();
    else warnings.push(`${source}: "${key}.provider" must be a non-empty string.`);
  }
  if (value.model !== undefined) {
    if (typeof value.model === "string" && value.model.trim()) profile.model = value.model.trim();
    else warnings.push(`${source}: "${key}.model" must be a non-empty string.`);
  }
  if (value.thinkingLevel !== undefined) {
    if (typeof value.thinkingLevel === "string" && THINKING_LEVELS.includes(value.thinkingLevel as never)) {
      profile.thinkingLevel = value.thinkingLevel as PhaseProfileConfig["thinkingLevel"];
    } else {
      warnings.push(
        `${source}: "${key}.thinkingLevel" must be one of ${THINKING_LEVELS.join(", ")}.`,
      );
    }
  }

  if ((profile.provider && !profile.model) || (!profile.provider && profile.model)) {
    warnings.push(`${source}: "${key}.provider" and "${key}.model" must be configured together; both were ignored.`);
    delete profile.provider;
    delete profile.model;
  }

  return profile;
}

function readConfigFile(filePath: string, warnings: string[]): PlanModeConfig {
  if (!existsSync(filePath)) return structuredClone(DEFAULT_CONFIG);
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
    if (!isRecord(parsed)) {
      warnings.push(`${filePath}: root value must be an object.`);
      return structuredClone(DEFAULT_CONFIG);
    }
    return {
      planning: parseProfile(parsed.planning, filePath, "planning", warnings),
      execution: parseProfile(parsed.execution, filePath, "execution", warnings),
    };
  } catch (error) {
    warnings.push(`${filePath}: unable to read configuration: ${error instanceof Error ? error.message : String(error)}`);
    return structuredClone(DEFAULT_CONFIG);
  }
}

function mergeProfile(base: PhaseProfileConfig, override: PhaseProfileConfig): PhaseProfileConfig {
  return {
    ...base,
    ...override,
  };
}

export function loadPlanModeConfig(
  cwd: string,
  options: { agentDir: string; configDirName: string; loadProjectConfig?: boolean },
): LoadedPlanModeConfig {
  const agentDir = options.agentDir;
  const configDirName = options.configDirName;
  const globalPath = join(agentDir, "claude-plan-mode.json");
  const projectPath = join(cwd, configDirName, "claude-plan-mode.json");
  const warnings: string[] = [];
  const globalConfig = readConfigFile(globalPath, warnings);
  const projectConfig = options.loadProjectConfig === false
    ? structuredClone(DEFAULT_CONFIG)
    : readConfigFile(projectPath, warnings);

  return {
    globalPath,
    projectPath,
    warnings,
    config: {
      planning: mergeProfile(globalConfig.planning, projectConfig.planning),
      execution: mergeProfile(globalConfig.execution, projectConfig.execution),
    },
  };
}
