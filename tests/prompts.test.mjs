import test from "node:test";
import assert from "node:assert/strict";
import { buildPlanningSystemPrompt } from "../dist/prompts.js";

const state = {
  schemaVersion: 1,
  stage: "planning",
  plan: {
    id: "plan-a",
    path: "/tmp/plan-a.md",
    revision: 2,
    hash: "abc123",
  },
  updatedAt: new Date(0).toISOString(),
};

test("planning prompt keeps the phase workflow internal and defines the final plan contract", () => {
  const prompt = buildPlanningSystemPrompt(state, true);

  assert.match(prompt, /### Phase 1: Initial Understanding/);
  assert.match(prompt, /### Phase 2: Design/);
  assert.match(prompt, /### Phase 3: Review/);
  assert.match(prompt, /### Phase 4: Final Plan/);
  assert.match(prompt, /### Phase 5: Finish/);
  assert.match(prompt, /## Context/);
  assert.match(prompt, /## Implementation Steps/);
  assert.match(prompt, /## Verification/);
  assert.match(prompt, /exact file path or paths involved/);
  assert.match(prompt, /functions, types, or utilities to reuse/);
  assert.match(prompt, /Include only the recommended approach/);
  assert.match(prompt, /complete and unambiguous/);
  assert.match(prompt, /ask_user_question/);
});
