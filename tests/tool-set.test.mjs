import test from "node:test";
import assert from "node:assert/strict";
import {
  ASK_USER_QUESTION_TOOL,
  ENTER_PLAN_MODE_TOOL,
  EXIT_PLAN_MODE_TOOL,
  PLAN_WRITE_TOOL,
} from "../dist/constants.js";
import {
  buildExecutionTools,
  buildIdleTools,
  buildPlanningTools,
  getMissingPlanningTools,
} from "../dist/tool-set.js";

const all = new Set([
  "shell_command",
  "apply_patch",
  "read",
  "grep",
  "find",
  "ls",
  ENTER_PLAN_MODE_TOOL,
  EXIT_PLAN_MODE_TOOL,
  PLAN_WRITE_TOOL,
  ASK_USER_QUESTION_TOOL,
]);

test("planning exposes only structured read tools and Plan workflow tools", () => {
  assert.deepEqual(buildPlanningTools(all), [
    "read",
    "grep",
    "find",
    "ls",
    PLAN_WRITE_TOOL,
    EXIT_PLAN_MODE_TOOL,
    ASK_USER_QUESTION_TOOL,
  ]);
});

test("execution restores baseline tools and removes Plan-only tools", () => {
  const baseline = ["shell_command", "apply_patch", PLAN_WRITE_TOOL, EXIT_PLAN_MODE_TOOL];
  assert.deepEqual(buildExecutionTools(baseline, all), ["shell_command", "apply_patch", ENTER_PLAN_MODE_TOOL]);
});

test("idle mode removes Plan-only tools and exposes EnterPlanMode", () => {
  assert.deepEqual(buildIdleTools(["shell_command", PLAN_WRITE_TOOL], all), ["shell_command", ENTER_PLAN_MODE_TOOL]);
});

test("missing built-in read tools are reported", () => {
  const missing = getMissingPlanningTools(new Set([PLAN_WRITE_TOOL, EXIT_PLAN_MODE_TOOL, "read"]));
  assert.deepEqual(missing, ["grep", "find", "ls"]);
});
