import type { PlanModeState } from "./types.js";
export declare function buildPlanningSystemPrompt(state: PlanModeState, hasQuestionTool: boolean): string;
export declare function buildPlanningSystemPrompt(state: PlanModeState, allowedTools: readonly string[], hasQuestionTool: boolean): string;
export declare function buildReadySystemPrompt(state: PlanModeState): string;
export declare function buildExecutionSystemPrompt(state: PlanModeState): string;
