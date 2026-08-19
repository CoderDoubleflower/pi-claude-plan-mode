import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadPlanModeConfig, savePlanModeConfig } from "../dist/config.js";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "pi-plan-config-"));
  const agentDir = join(root, "agent");
  const cwd = join(root, "project");
  await mkdir(join(cwd, ".pi"), { recursive: true });
  await mkdir(agentDir, { recursive: true });
  return { root, agentDir, cwd };
}

test("project tools override global tools while profile fields still merge", async () => {
  const { root, agentDir, cwd } = await fixture();
  try {
    await writeFile(join(agentDir, "claude-plan-mode.json"), JSON.stringify({
      tools: ["read", "grep"],
      planning: { provider: "anthropic", model: "planner", thinkingLevel: "high" },
      execution: { thinkingLevel: "medium" },
    }));
    await writeFile(join(cwd, ".pi", "claude-plan-mode.json"), JSON.stringify({
      tools: ["read", "github_search"],
      planning: { thinkingLevel: "xhigh" },
    }));
    const loaded = loadPlanModeConfig(cwd, { agentDir, configDirName: ".pi" });
    assert.deepEqual(loaded.config.tools, ["read", "github_search"]);
    assert.deepEqual(loaded.config.planning, {
      provider: "anthropic",
      model: "planner",
      thinkingLevel: "xhigh",
    });
    assert.deepEqual(loaded.globalConfig.tools, ["read", "grep"]);
    assert.deepEqual(loaded.projectConfig.tools, ["read", "github_search"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("savePlanModeConfig writes a normalized configuration", async () => {
  const { root, agentDir } = await fixture();
  try {
    const path = join(agentDir, "claude-plan-mode.json");
    await savePlanModeConfig(path, {
      tools: ["read", "read", " shell_command "],
      planning: { provider: "planner", model: "model", thinkingLevel: "high" },
      execution: { thinkingLevel: "xhigh" },
    });
    const saved = JSON.parse(await readFile(path, "utf8"));
    assert.deepEqual(saved.tools, ["read", "shell_command"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
