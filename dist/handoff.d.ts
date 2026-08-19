import type { ApprovedPlanSnapshot, PlanHandoffDetails, PlanModeState } from "./types.js";
export declare function approvePlan(state: PlanModeState, content: string): {
    state: PlanModeState;
    approved: ApprovedPlanSnapshot;
};
export declare function buildHandoffDetails(state: PlanModeState, clearContext: boolean): PlanHandoffDetails;
export declare function buildExecutionHandoffMessage(state: PlanModeState): string;
export declare function buildExecutionState(approvedState: PlanModeState, source: {
    sourceSessionId: string;
    sourceSessionFile?: string;
    sourceSessionName?: string;
    clearContext: boolean;
}): PlanModeState;
