import test from "node:test";
import assert from "node:assert/strict";
import {
  ASK_USER_QUESTION_TOOL,
  ENTER_PLAN_MODE_TOOL,
  EXIT_PLAN_MODE_TOOL,
  PLAN_WRITE_TOOL,
} from "../dist/constants.js";
import {
  buildPlanningTools,
  getEffectivePlanningToolSelection,
  getMissingPlanningTools,
  isPlanningToolAllowed,
} from "../dist/tool-set.js";

const all = new Set([
  "read", "grep", "find", "ls", "shell_command", "github_search",
  ENTER_PLAN_MODE_TOOL, EXIT_PLAN_MODE_TOOL, PLAN_WRITE_TOOL, ASK_USER_QUESTION_TOOL,
]);

test("legacy default planning tool behavior is preserved", () => {
  assert.deepEqual(buildPlanningTools(all), [
    "read", "grep", "find", "ls", PLAN_WRITE_TOOL, EXIT_PLAN_MODE_TOOL, ASK_USER_QUESTION_TOOL,
  ]);
});

test("configured tool selection is exact apart from mandatory workflow tools", () => {
  const selected = ["read", "github_search", "shell_command"];
  assert.deepEqual(buildPlanningTools(selected, all), [
    "read", "github_search", "shell_command", PLAN_WRITE_TOOL, EXIT_PLAN_MODE_TOOL,
  ]);
  assert.equal(isPlanningToolAllowed("github_search", selected, all), true);
  assert.equal(isPlanningToolAllowed("grep", selected, all), false);
});

test("missing configured tools are reported and omitted from active tools", () => {
  const selected = ["read", "missing_tool"];
  assert.deepEqual(getMissingPlanningTools(selected, all), ["missing_tool"]);
  assert.deepEqual(buildPlanningTools(selected, all), ["read", PLAN_WRITE_TOOL, EXIT_PLAN_MODE_TOOL]);
});

test("undefined configuration resolves to built-in defaults", () => {
  assert.deepEqual(getEffectivePlanningToolSelection(undefined, all), [
    "read", "grep", "find", "ls", ASK_USER_QUESTION_TOOL,
  ]);
});
