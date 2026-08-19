import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openPlanModeConfig } from "../dist/config-ui.js";

test("interactive config UI persists tools, models, and thinking levels", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-plan-config-ui-"));
  const agentDir = join(root, "agent");
  const steps = [
    (_title, options) => options.find((x) => x === "Global configuration"),
    (_title, options) => options.find((x) => x.startsWith("Allowed tools")),
    (_title, options) => options.find((x) => x.includes("shell_command")),
    (_title, options) => options.find((x) => x === "Done"),
    (_title, options) => options.find((x) => x.startsWith("Plan model")),
    (_title, options) => options.find((x) => x.startsWith("planner/planner-model")),
    (_title, options) => options.find((x) => x.startsWith("Plan thinking")),
    (_title, options) => options.find((x) => x === "high"),
    (_title, options) => options.find((x) => x.startsWith("Execute model")),
    (_title, options) => options.find((x) => x.startsWith("executor/executor-model")),
    (_title, options) => options.find((x) => x.startsWith("Execute thinking")),
    (_title, options) => options.find((x) => x === "xhigh"),
    (_title, options) => options.find((x) => x === "Save and close"),
    (_title, options) => options.find((x) => x === "Close"),
  ];
  const notifications = [];
  const ctx = {
    cwd: join(root, "project"),
    hasUI: true,
    model: { provider: "base", id: "base" },
    scopedModels: [],
    modelRegistry: {
      getAvailable: () => [
        { provider: "planner", id: "planner-model", name: "Planner" },
        { provider: "executor", id: "executor-model", name: "Executor" },
      ],
    },
    isProjectTrusted: () => true,
    ui: {
      select: async (title, options) => {
        const step = steps.shift();
        assert.ok(step, `unexpected selector: ${title}`);
        const result = step(title, options);
        assert.ok(result, `no option selected for ${title}: ${options.join(" | ")}`);
        return result;
      },
      confirm: async () => true,
      notify: (message, type) => notifications.push({ message, type }),
    },
  };
  const pi = {
    getAllTools: () => [
      "read", "grep", "find", "ls", "shell_command", "plan_write", "ExitPlanMode", "EnterPlanMode",
    ].map((name) => ({ name })),
  };
  try {
    const result = await openPlanModeConfig(pi, ctx, { agentDir, configDirName: ".pi" });
    assert.equal(result.saved, true);
    assert.equal(steps.length, 0);
    const saved = JSON.parse(await readFile(join(agentDir, "claude-plan-mode.json"), "utf8"));
    assert.deepEqual(saved.tools, ["find", "grep", "ls", "read", "shell_command"]);
    assert.deepEqual(saved.planning, {
      provider: "planner",
      model: "planner-model",
      thinkingLevel: "high",
    });
    assert.deepEqual(saved.execution, {
      provider: "executor",
      model: "executor-model",
      thinkingLevel: "xhigh",
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
