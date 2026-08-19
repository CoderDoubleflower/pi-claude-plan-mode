import type {
  ApprovedPlanSnapshot,
  PlanHandoffDetails,
  PlanModeState,
} from "./types.js";

export function approvePlan(
  state: PlanModeState,
  content: string,
): { state: PlanModeState; approved: ApprovedPlanSnapshot } {
  if (!state.plan || !state.baseline || !state.executionProfile) {
    throw new Error("Plan state is incomplete and cannot be approved.");
  }
  const approved: ApprovedPlanSnapshot = {
    revision: state.plan.revision,
    hash: state.plan.hash,
    content,
    approvedAt: new Date().toISOString(),
  };
  return {
    approved,
    state: {
      ...state,
      approved,
      ready: undefined,
      updatedAt: new Date().toISOString(),
    },
  };
}

export function buildHandoffDetails(state: PlanModeState, clearContext: boolean): PlanHandoffDetails {
  if (!state.plan || !state.approved || !state.source) {
    throw new Error("Execution handoff state is incomplete.");
  }
  return {
    planId: state.plan.id,
    planPath: state.plan.path,
    revision: state.approved.revision,
    hash: state.approved.hash,
    sourceSessionId: state.source.sourceSessionId,
    sourceSessionFile: state.source.sourceSessionFile,
    clearContext,
  };
}

export function buildExecutionHandoffMessage(state: PlanModeState): string {
  if (!state.approved || !state.plan || !state.source) {
    throw new Error("Execution handoff state is incomplete.");
  }
  const transcript = state.source.sourceSessionFile
    ? `\nPlanning transcript: ${state.source.sourceSessionFile}`
    : "";
  return `Implement the following user-approved plan.

<approved-plan revision="${state.approved.revision}" sha256="${state.approved.hash}">
${state.approved.content.trimEnd()}
</approved-plan>

Plan file: ${state.plan.path}
Planning session: ${state.source.sourceSessionId}${transcript}

The plan above is the exact approved revision. Keep its scope stable. If a specific implementation detail is missing, inspect the repository first; consult the planning transcript only when necessary. Begin implementation now.`;
}

export function buildExecutionState(
  approvedState: PlanModeState,
  source: {
    sourceSessionId: string;
    sourceSessionFile?: string;
    sourceSessionName?: string;
    clearContext: boolean;
  },
): PlanModeState {
  if (!approvedState.baseline || !approvedState.approved) {
    throw new Error("Approved state is incomplete.");
  }
  return {
    ...approvedState,
    stage: "executing",
    source,
    ready: undefined,
    updatedAt: new Date().toISOString(),
  };
}
