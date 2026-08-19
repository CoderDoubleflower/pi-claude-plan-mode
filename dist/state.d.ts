import { type PlanModeState } from "./types.js";
export declare function isPlanModeState(value: unknown): value is PlanModeState;
export declare function restorePlanModeState(entries: ReadonlyArray<{
    type: string;
    customType?: string;
    data?: unknown;
}>): PlanModeState | undefined;
export declare function touchState(state: Omit<PlanModeState, "updatedAt"> | PlanModeState): PlanModeState;
