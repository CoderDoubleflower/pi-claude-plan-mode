import test from "node:test";
import assert from "node:assert/strict";
import {
  approvePlan,
  buildExecutionHandoffMessage,
  buildExecutionState,
  buildHandoffDetails,
} from "../dist/handoff.js";

function readyState() {
  return {
    schemaVersion: 1,
    stage: "ready",
    updatedAt: new Date().toISOString(),
    plan: { id: "plan-1", path: "/tmp/plan-1.md", revision: 4, hash: "abc123" },
    baseline: {
      profile: { provider: "base", model: "base-model", thinkingLevel: "medium" },
      tools: ["shell_command", "apply_patch", "EnterPlanMode"],
    },
    planningProfile: { provider: "planner", model: "planner-model", thinkingLevel: "high" },
    executionProfile: { provider: "executor", model: "executor-model", thinkingLevel: "xhigh" },
    executionTools: ["shell_command", "apply_patch", "EnterPlanMode"],
    ready: { revision: 4, hash: "abc123", preparedAt: new Date().toISOString() },
  };
}

test("fresh-session handoff preserves the approved snapshot and source transcript", () => {
  const content = "# Plan\n\n## Implementation Steps\n1. Implement the approved behavior.\n";
  const approved = approvePlan(readyState(), content).state;
  const execution = buildExecutionState(approved, {
    sourceSessionId: "session-a",
    sourceSessionFile: "/tmp/session-a.jsonl",
    sourceSessionName: "feature-a",
    clearContext: true,
  });
  const message = buildExecutionHandoffMessage(execution);
  assert.equal(execution.stage, "executing");
  assert.equal(execution.approved.content, content);
  assert.match(message, /session-a/);
  assert.match(message, /\/tmp\/session-a\.jsonl/);
  assert.match(message, /Implement the approved behavior/);
  assert.deepEqual(buildHandoffDetails(execution, true), {
    planId: "plan-1",
    planPath: "/tmp/plan-1.md",
    revision: 4,
    hash: "abc123",
    sourceSessionId: "session-a",
    sourceSessionFile: "/tmp/session-a.jsonl",
    clearContext: true,
  });
});
