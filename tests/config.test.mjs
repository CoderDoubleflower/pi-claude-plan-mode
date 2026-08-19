import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadPlanModeConfig } from "../dist/config.js";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "pi-plan-config-"));
  const agentDir = join(root, "agent");
  const cwd = join(root, "project");
  await mkdir(join(cwd, ".pi"), { recursive: true });
  await mkdir(agentDir, { recursive: true });
  return { root, agentDir, cwd };
}

test("project profile fields override global fields without losing unspecified values", async () => {
  const { root, agentDir, cwd } = await fixture();
  try {
    await writeFile(
      join(agentDir, "claude-plan-mode.json"),
      JSON.stringify({
        planning: { provider: "anthropic", model: "planner", thinkingLevel: "high" },
        execution: { provider: "openai", model: "executor", thinkingLevel: "medium" },
      }),
    );
    await writeFile(
      join(cwd, ".pi", "claude-plan-mode.json"),
      JSON.stringify({ planning: { thinkingLevel: "xhigh" } }),
    );

    const loaded = loadPlanModeConfig(cwd, { agentDir, configDirName: ".pi" });
    assert.deepEqual(loaded.config.planning, {
      provider: "anthropic",
      model: "planner",
      thinkingLevel: "xhigh",
    });
    assert.deepEqual(loaded.config.execution, {
      provider: "openai",
      model: "executor",
      thinkingLevel: "medium",
    });
    assert.deepEqual(loaded.warnings, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("partial model configuration is ignored with a warning", async () => {
  const { root, agentDir, cwd } = await fixture();
  try {
    await writeFile(
      join(agentDir, "claude-plan-mode.json"),
      JSON.stringify({ planning: { provider: "anthropic" } }),
    );
    const loaded = loadPlanModeConfig(cwd, { agentDir, configDirName: ".pi" });
    assert.deepEqual(loaded.config.planning, {});
    assert.equal(loaded.warnings.length, 1);
    assert.match(loaded.warnings[0], /must be configured together/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


test("project configuration is ignored until the project is trusted", async () => {
  const { root, agentDir, cwd } = await fixture();
  try {
    await writeFile(
      join(agentDir, "claude-plan-mode.json"),
      JSON.stringify({ planning: { thinkingLevel: "high" } }),
    );
    await writeFile(
      join(cwd, ".pi", "claude-plan-mode.json"),
      JSON.stringify({ planning: { thinkingLevel: "max" } }),
    );

    const loaded = loadPlanModeConfig(cwd, {
      agentDir,
      configDirName: ".pi",
      loadProjectConfig: false,
    });
    assert.deepEqual(loaded.config.planning, { thinkingLevel: "high" });
    assert.deepEqual(loaded.warnings, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
