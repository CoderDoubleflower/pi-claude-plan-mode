import { ASK_USER_QUESTION_TOOL, EXIT_PLAN_MODE_TOOL, PLAN_WRITE_TOOL } from "./constants.js";
import type { PlanModeState } from "./types.js";

export function buildPlanningSystemPrompt(state: PlanModeState, hasQuestionTool: boolean): string {
  if (!state.plan) return "";
  const questionInstruction = hasQuestionTool
    ? `Use ${ASK_USER_QUESTION_TOOL} when the user's decision materially affects the plan.`
    : "Ask concise clarification questions in normal text when a user decision materially affects the plan.";
  return `[PLAN MODE ACTIVE]

You are planning, not implementing.

Hard constraints:
- Do not modify project files, configuration, dependencies, Git state, external systems, or running services.
- The only writable artifact is the canonical plan document below, and it may only be changed with ${PLAN_WRITE_TOOL}.
- Use only the structured read-only tools read, grep, find, and ls for repository exploration.
- Do not claim that code was changed or tests were run.
- Do not attempt to bypass unavailable tools.

Canonical plan:
- Path: ${state.plan.path}
- Revision: ${state.plan.revision}
- SHA-256: ${state.plan.hash}

Planning workflow:
1. Explore the repository and identify the relevant architecture and existing patterns.
2. ${questionInstruction}
3. Record concrete findings, design decisions, files, ordered implementation steps, validation, and risks in the canonical plan.
4. Replace the initial template completely; do not leave placeholder text or the template marker.
5. When the plan is complete, call ${EXIT_PLAN_MODE_TOOL} by itself in a tool-call turn.

Do not begin implementation until the user approves the plan through /plan-approve.`;
}

export function buildReadySystemPrompt(state: PlanModeState): string {
  if (!state.plan) return "";
  return `[PLAN READY FOR APPROVAL]

The canonical plan at ${state.plan.path} revision ${state.plan.revision} is awaiting user review.
Do not implement it. The user can run /plan-approve to approve, edit, or return feedback.
If the user provides ordinary feedback instead, resume Plan Mode and revise the canonical plan before calling ExitPlanMode again.`;
}

export function buildExecutionSystemPrompt(state: PlanModeState): string {
  if (!state.approved) return "";
  return `[EXECUTING APPROVED PLAN]

Implement the exact approved plan revision ${state.approved.revision} (${state.approved.hash}).
Use the implementation tools available in this session. Keep scope stable, verify changes appropriately, and report blockers rather than silently changing the design.`;
}
