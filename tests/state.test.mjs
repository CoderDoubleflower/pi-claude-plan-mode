import test from "node:test";
import assert from "node:assert/strict";
import { PLAN_STATE_ENTRY } from "../dist/constants.js";
import { restorePlanModeState, touchState } from "../dist/state.js";

function workflowState(stage) {
  const base = {
    schemaVersion: 1,
    stage,
    plan: { id: "p", path: "/tmp/p.md", revision: 2, hash: "hash" },
    baseline: {
      profile: { provider: "base", model: "model", thinkingLevel: "medium" },
      tools: ["shell_command", "apply_patch", "EnterPlanMode"],
    },
    planningProfile: { provider: "planner", model: "model", thinkingLevel: "high" },
    executionProfile: { provider: "executor", model: "model", thinkingLevel: "xhigh" },
  };
  if (stage === "ready") {
    base.ready = { revision: 2, hash: "hash", preparedAt: new Date().toISOString() };
  }
  if (stage === "executing" || stage === "handed_off") {
    base.approved = {
      revision: 2,
      hash: "hash",
      content: "approved plan",
      approvedAt: new Date().toISOString(),
    };
    base.source = { sourceSessionId: "source", clearContext: stage === "handed_off" };
  }
  return touchState(base);
}

test("latest valid state entry wins", () => {
  const first = workflowState("planning");
  const second = workflowState("ready");
  const restored = restorePlanModeState([
    { type: "custom", customType: PLAN_STATE_ENTRY, data: first },
    { type: "custom", customType: PLAN_STATE_ENTRY, data: { schemaVersion: 999 } },
    { type: "custom", customType: PLAN_STATE_ENTRY, data: second },
  ]);
  assert.equal(restored?.stage, "ready");
});

test("invalid state entries are ignored", () => {
  const restored = restorePlanModeState([
    { type: "custom", customType: PLAN_STATE_ENTRY, data: { schemaVersion: 1, stage: "unknown" } },
  ]);
  assert.equal(restored, undefined);
});

test("incomplete active workflow state is ignored", () => {
  const restored = restorePlanModeState([
    {
      type: "custom",
      customType: PLAN_STATE_ENTRY,
      data: touchState({ schemaVersion: 1, stage: "planning" }),
    },
  ]);
  assert.equal(restored, undefined);
});

test("malformed nested state is ignored", () => {
  const malformed = workflowState("planning");
  malformed.plan.revision = "not-a-number";
  const restored = restorePlanModeState([
    { type: "custom", customType: PLAN_STATE_ENTRY, data: malformed },
  ]);
  assert.equal(restored, undefined);
});
