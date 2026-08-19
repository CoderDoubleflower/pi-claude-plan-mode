import test from "node:test";
import assert from "node:assert/strict";
import { buildInitialPlan, isPlanReady } from "../dist/plan-store.js";

const validPlan = `# Implementation Plan

## Context
The Plan Mode UI currently exposes internal workflow state; the change should keep users informed without surfacing implementation details.

## Implementation Steps
1. \`src/index.ts\`
   - Replace stage-specific status and widgets with one stable Plan Mode indicator.
   - Reuse the existing \`PLAN_STATUS_KEY\` and \`PLAN_WIDGET_KEY\` constants from \`src/constants.ts\`.
2. \`tests/ui.test.mjs\`
   - Cover planning, ready, and execution transitions so internal stages cannot leak back into persistent UI.

## Verification
- \`npm test\`
- Confirm planning and ready show only Plan Mode, while execution clears the indicator.
`;

test("initial plan template teaches the Claude-style final plan structure", () => {
  const template = buildInitialPlan("Reduce Plan Mode UI noise");
  assert.match(template, /pi-claude-plan-mode:template/);
  assert.match(template, /^## Context$/m);
  assert.match(template, /^## Implementation Steps$/m);
  assert.match(template, /^## Verification$/m);
  assert.doesNotMatch(template, /^## Design Decisions$/m);
  assert.doesNotMatch(template, /^## Risks$/m);
});

test("new final plan contract is accepted", () => {
  assert.deepEqual(isPlanReady(validPlan), { ready: true });
});

test("context, ordered implementation steps, and verification are all required", () => {
  assert.match(isPlanReady(validPlan.replace("## Context", "## Background")).reason, /Context/);
  const unnumbered = validPlan
    .replace(/^1\. /m, "- ")
    .replace(/^2\. /m, "- ");
  assert.match(isPlanReady(unnumbered).reason, /numbered step/);
  assert.match(isPlanReady(validPlan.replace("## Verification", "## Checks")).reason, /Verification/);
});

test("pre-existing Objective and Validation headings remain resumable", () => {
  const legacy = validPlan
    .replace("## Context", "## Objective")
    .replace("## Verification", "## Validation");
  assert.equal(isPlanReady(legacy).ready, true);
});
