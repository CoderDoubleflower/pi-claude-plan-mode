import test from "node:test";
import assert from "node:assert/strict";
import { buildPlanningSystemPrompt } from "../dist/prompts.js";

const state = {
  schemaVersion: 1,
  stage: "planning",
  plan: { id: "a", path: "/tmp/a.md", revision: 1, hash: "abc" },
  planningTools: ["read", "github_search"],
  updatedAt: new Date(0).toISOString(),
};

test("planning prompt names the configured allowlist and keeps side-effect policy", () => {
  const prompt = buildPlanningSystemPrompt(state, ["read", "github_search"], false);
  assert.match(prompt, /`read`, `github_search`/);
  assert.match(prompt, /does not grant permission to implement changes or perform side effects/);
  assert.doesNotMatch(prompt, /ask_user_question/);
});
