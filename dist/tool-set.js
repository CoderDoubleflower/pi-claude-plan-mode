import { ASK_USER_QUESTION_TOOL, ENTER_PLAN_MODE_TOOL, EXIT_PLAN_MODE_TOOL, PLAN_WRITE_TOOL, READ_ONLY_PLAN_TOOLS, } from "./constants.js";
function unique(values) {
    return [...new Set(values)];
}
export function buildIdleTools(current, allToolNames) {
    const tools = current.filter((name) => name !== PLAN_WRITE_TOOL && name !== EXIT_PLAN_MODE_TOOL);
    if (allToolNames.has(ENTER_PLAN_MODE_TOOL))
        tools.push(ENTER_PLAN_MODE_TOOL);
    return unique(tools.filter((name) => allToolNames.has(name)));
}
export function getMissingPlanningTools(allToolNames) {
    const required = [...READ_ONLY_PLAN_TOOLS, PLAN_WRITE_TOOL, EXIT_PLAN_MODE_TOOL];
    return required.filter((name) => !allToolNames.has(name));
}
export function buildPlanningTools(allToolNames) {
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
export function buildExecutionTools(baseline, allToolNames) {
    return buildIdleTools(baseline, allToolNames);
}
export function isPlanningToolAllowed(toolName, allToolNames) {
    const alwaysAllowed = new Set([...READ_ONLY_PLAN_TOOLS, PLAN_WRITE_TOOL, EXIT_PLAN_MODE_TOOL]);
    if (alwaysAllowed.has(toolName))
        return true;
    return toolName === ASK_USER_QUESTION_TOOL && allToolNames.has(ASK_USER_QUESTION_TOOL);
}
