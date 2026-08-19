import {
  ASK_USER_QUESTION_TOOL,
  ENTER_PLAN_MODE_TOOL,
  EXIT_PLAN_MODE_TOOL,
  PLAN_WRITE_TOOL,
  READ_ONLY_PLAN_TOOLS,
} from "./constants.js";

const PLAN_CONTROL_TOOLS = new Set<string>([
  ENTER_PLAN_MODE_TOOL,
  EXIT_PLAN_MODE_TOOL,
  PLAN_WRITE_TOOL,
]);

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function resolveSelectionArgs(
  selectedOrAll: readonly string[] | ReadonlySet<string>,
  maybeAll?: ReadonlySet<string>,
): { selected: string[]; allToolNames: ReadonlySet<string> } {
  if (maybeAll) {
    return {
      selected: unique(selectedOrAll as readonly string[]),
      allToolNames: maybeAll,
    };
  }
  const allToolNames = selectedOrAll as ReadonlySet<string>;
  return {
    selected: getDefaultPlanningTools(allToolNames),
    allToolNames,
  };
}

export function getDefaultPlanningTools(allToolNames: ReadonlySet<string>): string[] {
  return [
    ...READ_ONLY_PLAN_TOOLS,
    ...(allToolNames.has(ASK_USER_QUESTION_TOOL) ? [ASK_USER_QUESTION_TOOL] : []),
  ];
}

export function getEffectivePlanningToolSelection(
  configuredTools: readonly string[] | undefined,
  allToolNames: ReadonlySet<string>,
): string[] {
  const selected = configuredTools ?? getDefaultPlanningTools(allToolNames);
  return unique(selected.filter((name) => !PLAN_CONTROL_TOOLS.has(name)));
}

export function getConfigurablePlanningTools(allToolNames: ReadonlySet<string>): string[] {
  return [...allToolNames]
    .filter((name) => !PLAN_CONTROL_TOOLS.has(name))
    .sort((left, right) => left.localeCompare(right));
}

export function buildIdleTools(current: readonly string[], allToolNames: ReadonlySet<string>): string[] {
  const tools = current.filter((name) => name !== PLAN_WRITE_TOOL && name !== EXIT_PLAN_MODE_TOOL);
  if (allToolNames.has(ENTER_PLAN_MODE_TOOL)) tools.push(ENTER_PLAN_MODE_TOOL);
  return unique(tools.filter((name) => allToolNames.has(name)));
}

export function getMissingPlanningTools(allToolNames: ReadonlySet<string>): string[];
export function getMissingPlanningTools(
  selectedTools: readonly string[],
  allToolNames: ReadonlySet<string>,
): string[];
export function getMissingPlanningTools(
  selectedOrAll: readonly string[] | ReadonlySet<string>,
  maybeAll?: ReadonlySet<string>,
): string[] {
  const { selected, allToolNames } = resolveSelectionArgs(selectedOrAll, maybeAll);
  const required = [...selected, PLAN_WRITE_TOOL, EXIT_PLAN_MODE_TOOL];
  return unique(required).filter((name) => !allToolNames.has(name));
}

export function buildPlanningTools(allToolNames: ReadonlySet<string>): string[];
export function buildPlanningTools(
  selectedTools: readonly string[],
  allToolNames: ReadonlySet<string>,
): string[];
export function buildPlanningTools(
  selectedOrAll: readonly string[] | ReadonlySet<string>,
  maybeAll?: ReadonlySet<string>,
): string[] {
  const { selected, allToolNames } = resolveSelectionArgs(selectedOrAll, maybeAll);
  const missingWorkflowTools = [PLAN_WRITE_TOOL, EXIT_PLAN_MODE_TOOL].filter(
    (name) => !allToolNames.has(name),
  );
  if (missingWorkflowTools.length > 0) {
    throw new Error(`Plan mode requires registered tools that are unavailable: ${missingWorkflowTools.join(", ")}`);
  }

  const allowed = selected.filter(
    (name) => allToolNames.has(name) && !PLAN_CONTROL_TOOLS.has(name),
  );
  const questionToolEnabled = allowed.includes(ASK_USER_QUESTION_TOOL);
  const orderedAllowed = allowed.filter((name) => name !== ASK_USER_QUESTION_TOOL);
  return unique([
    ...orderedAllowed,
    PLAN_WRITE_TOOL,
    EXIT_PLAN_MODE_TOOL,
    ...(questionToolEnabled ? [ASK_USER_QUESTION_TOOL] : []),
  ]);
}

export function buildExecutionTools(baseline: readonly string[], allToolNames: ReadonlySet<string>): string[] {
  return buildIdleTools(baseline, allToolNames);
}

export function isPlanningToolAllowed(
  toolName: string,
  allToolNames: ReadonlySet<string>,
): boolean;
export function isPlanningToolAllowed(
  toolName: string,
  selectedTools: readonly string[],
  allToolNames: ReadonlySet<string>,
): boolean;
export function isPlanningToolAllowed(
  toolName: string,
  selectedOrAll: readonly string[] | ReadonlySet<string>,
  maybeAll?: ReadonlySet<string>,
): boolean {
  const { selected, allToolNames } = resolveSelectionArgs(selectedOrAll, maybeAll);
  return buildPlanningTools(selected, allToolNames).includes(toolName);
}
