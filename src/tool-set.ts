import {
  ASK_USER_QUESTION_TOOL,
  ENTER_PLAN_MODE_TOOL,
  EXIT_PLAN_MODE_TOOL,
  PLAN_WRITE_TOOL,
  READ_ONLY_PLAN_TOOLS,
} from "./constants.js";

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export function buildIdleTools(current: readonly string[], allToolNames: ReadonlySet<string>): string[] {
  const tools = current.filter((name) => name !== PLAN_WRITE_TOOL && name !== EXIT_PLAN_MODE_TOOL);
  if (allToolNames.has(ENTER_PLAN_MODE_TOOL)) tools.push(ENTER_PLAN_MODE_TOOL);
  return unique(tools.filter((name) => allToolNames.has(name)));
}

export function getMissingPlanningTools(allToolNames: ReadonlySet<string>): string[] {
  const required = [...READ_ONLY_PLAN_TOOLS, PLAN_WRITE_TOOL, EXIT_PLAN_MODE_TOOL];
  return required.filter((name) => !allToolNames.has(name));
}

export function buildPlanningTools(allToolNames: ReadonlySet<string>): string[] {
  const missing = getMissingPlanningTools(allToolNames);
  if (missing.length > 0) {
    throw new Error(`Plan mode requires registered tools that are unavailable: ${missing.join(", ")}`);
  }
  return [
    ...READ_ONLY_PLAN_TOOLS,
    PLAN_WRITE_TOOL,
    EXIT_PLAN_MODE_TOOL,
    ...(allToolNames.has(ASK_USER_QUESTION_TOOL) ? [ASK_USER_QUESTION_TOOL] : []),
  ];
}

export function buildExecutionTools(baseline: readonly string[], allToolNames: ReadonlySet<string>): string[] {
  return buildIdleTools(baseline, allToolNames);
}

export function isPlanningToolAllowed(toolName: string, allToolNames: ReadonlySet<string>): boolean {
  const alwaysAllowed = new Set<string>([...READ_ONLY_PLAN_TOOLS, PLAN_WRITE_TOOL, EXIT_PLAN_MODE_TOOL]);
  if (alwaysAllowed.has(toolName)) return true;
  return toolName === ASK_USER_QUESTION_TOOL && allToolNames.has(ASK_USER_QUESTION_TOOL);
}
