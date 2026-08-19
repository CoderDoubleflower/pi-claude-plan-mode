import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createPlanDocument,
  ensurePlanDocument,
  hashPlan,
  isManagedPlanDocument,
  isPlanReady,
  readPlanContent,
  refreshPlanDocument,
  updatePlanDocument,
} from "../dist/plan-store.js";

test("plan document updates are revisioned and stale writes are rejected", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-plan-store-"));
  try {
    const initial = await createPlanDocument(root, "Implement feature X", { id: "plan-a" });
    assert.equal(initial.revision, 1);
    const original = await readPlanContent(initial);
    assert.match(original, /pi-claude-plan-mode:template/);

    const content = `# Implementation Plan\n\n## Objective\nImplement X safely.\n\n## Implementation Steps\n1. Inspect the current implementation and identify the integration point.\n2. Add the focused implementation while preserving existing behavior.\n3. Add tests and run the project validation commands.\n\n## Validation\nRun unit tests and type checking.\n`;
    const updated = await updatePlanDocument(initial, content, 1);
    assert.equal(updated.revision, 2);
    assert.equal(updated.hash, hashPlan(content));
    assert.equal(isPlanReady(content).ready, true);

    await assert.rejects(() => updatePlanDocument(updated, content, 1), /revision mismatch/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a symbolic-link Plan path is rejected without modifying its target", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-plan-symlink-"));
  try {
    const document = await createPlanDocument(root, "symlink safety", { id: "plan-link" });
    const target = join(root, "outside.md");
    await writeFile(target, "outside must remain unchanged\n", "utf8");
    await rm(document.path, { force: true });
    await symlink(target, document.path);

    await assert.rejects(() => ensurePlanDocument(document), /symbolic link/);
    assert.equal(await readFile(target, "utf8"), "outside must remain unchanged\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("plan document ids cannot escape the managed plans directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-plan-id-"));
  try {
    await assert.rejects(
      () => createPlanDocument(root, "invalid id", { id: "../outside" }),
      /Invalid Plan document id/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("external file changes are detected and produce a new revision", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-plan-refresh-"));
  try {
    const document = await createPlanDocument(root, undefined, { id: "plan-b" });
    const external = "# Implementation Plan\n\n## Implementation Steps\n1. A sufficiently detailed externally edited step that changes the canonical document.\n\n## Validation\nValidate the result carefully with appropriate tests and checks.\n";
    await writeFile(document.path, external, "utf8");
    const refreshed = await refreshPlanDocument(document);
    assert.equal(refreshed.changed, true);
    assert.equal(refreshed.document.revision, 2);
    assert.equal(refreshed.document.hash, hashPlan(external));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("template plans cannot be approved", () => {
  assert.equal(isPlanReady("# Implementation Plan\n<!-- pi-claude-plan-mode:template -->").ready, false);
});


test("managed Plan documents must match the agent plans directory and document id", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-plan-path-"));
  try {
    const document = await createPlanDocument(root, "path validation", { id: "managed-plan" });
    assert.equal(isManagedPlanDocument(document, root), true);
    assert.equal(isManagedPlanDocument({ ...document, path: join(root, "outside.md") }, root), false);
    assert.equal(isManagedPlanDocument({ ...document, id: "different-id" }, root), false);
    assert.equal(
      isManagedPlanDocument({ ...document, id: "../outside", path: join(root, "outside.md") }, root),
      false,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
