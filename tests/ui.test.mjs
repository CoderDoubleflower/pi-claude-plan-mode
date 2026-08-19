import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

async function installRuntimeStubs(runtimeRoot, agentDir) {
  const codingAgentDir = join(runtimeRoot, "node_modules", "@earendil-works", "pi-coding-agent");
  const typeboxDir = join(runtimeRoot, "node_modules", "typebox");
  await mkdir(codingAgentDir, { recursive: true });
  await mkdir(typeboxDir, { recursive: true });
  await writeFile(
    join(codingAgentDir, "package.json"),
    JSON.stringify({ name: "@earendil-works/pi-coding-agent", type: "module", exports: "./index.js" }),
  );
  await writeFile(
    join(codingAgentDir, "index.js"),
    `export const CONFIG_DIR_NAME = ".pi";\nexport function getAgentDir() { return ${JSON.stringify(agentDir)}; }\n`,
  );
  await writeFile(
    join(typeboxDir, "package.json"),
    JSON.stringify({ name: "typebox", type: "module", exports: "./index.js" }),
  );
  await writeFile(
    join(typeboxDir, "index.js"),
    `export const Type = {
      Object: (properties, options = {}) => ({ type: "object", properties, ...options }),
      String: (options = {}) => ({ type: "string", ...options }),
      Integer: (options = {}) => ({ type: "integer", ...options }),
      Boolean: (options = {}) => ({ type: "boolean", ...options }),
      Optional: (schema) => ({ ...schema, optional: true }),
    };\n`,
  );
}

function createHarness(tempRoot) {
  const handlers = new Map();
  const commands = new Map();
  const tools = new Map();
  const sessionEntries = [];
  const sentMessages = [];
  const notifications = [];
  const status = new Map();
  const widgetValues = [];
  const allTools = new Set(["shell_command", "apply_patch", "read", "grep", "find", "ls", "ask_user_question"]);
  let activeTools = ["shell_command", "apply_patch"];
  let thinkingLevel = "medium";
  const baseModel = { provider: "base", id: "base-model" };

  const sessionManager = {
    getSessionId: () => "ui-session",
    getSessionFile: () => join(tempRoot, "ui-session.jsonl"),
    getEntries: () => sessionEntries,
    getBranch: () => sessionEntries,
  };

  const ctx = {
    cwd: tempRoot,
    mode: "tui",
    hasUI: true,
    sessionManager,
    model: baseModel,
    modelRegistry: { find: () => baseModel },
    thinkingLevel,
    isIdle: () => true,
    isProjectTrusted: () => true,
    hasPendingMessages: () => false,
    getSystemPrompt: () => "base prompt",
    waitForIdle: async () => undefined,
    ui: {
      theme: { fg: (_color, text) => text },
      select: async () => undefined,
      confirm: async () => true,
      input: async () => undefined,
      editor: async () => undefined,
      notify: (message, type = "info") => notifications.push({ message, type }),
      setStatus: (key, value) => status.set(key, value),
      setWidget: (_key, value) => widgetValues.push(value),
      getEditorText: () => "",
      setEditorText: () => undefined,
    },
  };

  const pi = {
    on(event, handler) {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    },
    registerTool(tool) {
      tools.set(tool.name, tool);
      allTools.add(tool.name);
      activeTools.push(tool.name);
    },
    registerCommand(name, options) {
      commands.set(name, options.handler);
    },
    registerFlag() {},
    getFlag() { return false; },
    sendMessage(message, options) { sentMessages.push({ message, options }); },
    sendUserMessage(content, options) { sentMessages.push({ user: content, options }); },
    appendEntry(customType, data) { sessionEntries.push({ type: "custom", customType, data }); },
    setSessionName() {},
    getSessionName() { return "ui-plan"; },
    getActiveTools() { return [...activeTools]; },
    getAllTools() { return [...allTools].map((name) => ({ name })); },
    setActiveTools(names) { activeTools = [...names]; },
    async setModel(model) { ctx.model = model; return true; },
    getThinkingLevel() { return thinkingLevel; },
    setThinkingLevel(level) { thinkingLevel = level; ctx.thinkingLevel = level; },
  };

  async function emit(event, payload = {}) {
    for (const handler of handlers.get(event) ?? []) await handler({ type: event, ...payload }, ctx);
  }

  return { pi, ctx, emit, commands, tools, sessionEntries, sentMessages, notifications, status, widgetValues };
}

const validPlan = `# Implementation Plan

## Context
Users need a stable indication that planning restrictions are active without seeing internal workflow stages or revision metadata.

## Implementation Steps
1. \`src/index.ts\`
   - Use the existing Plan UI keys to render one Plan Mode status for both planning and ready states.
   - Clear the status before approved-plan execution starts and remove the above-editor widget.
2. \`tests/ui.test.mjs\`
   - Exercise planning, ready, and keep-context execution transitions.

## Verification
- \`npm test\`
- Confirm no persistent widget receives non-empty content and no stage or revision is displayed.
`;

test("persistent UI exposes only whether Plan Mode is active", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "pi-plan-ui-"));
  const agentDir = join(tempRoot, "agent");
  try {
    const runtimeRoot = join(tempRoot, "runtime");
    await cp(join(root, "dist"), join(runtimeRoot, "dist"), { recursive: true });
    await installRuntimeStubs(runtimeRoot, agentDir);
    await mkdir(agentDir, { recursive: true });
    const moduleUrl = `${pathToFileURL(join(runtimeRoot, "dist", "index.js")).href}?ui=${Date.now()}`;
    const { default: extension, PLAN_STATUS_KEY } = await import(moduleUrl);
    const harness = createHarness(tempRoot);
    extension(harness.pi);
    await harness.emit("session_start", { reason: "startup" });

    await harness.commands.get("plan")("Reduce the persistent Plan Mode UI", harness.ctx);
    assert.equal(harness.status.get(PLAN_STATUS_KEY), "Plan Mode");
    assert.equal(harness.widgetValues.some((value) => value !== undefined), false);

    await harness.tools.get("plan_write").execute(
      "write",
      { content: validPlan, expected_revision: 1 },
      undefined,
      undefined,
      harness.ctx,
    );
    await harness.tools.get("ExitPlanMode").execute("exit", {}, undefined, undefined, harness.ctx);
    assert.equal(harness.sessionEntries.at(-1).data.stage, "ready");
    assert.equal(harness.status.get(PLAN_STATUS_KEY), "Plan Mode");
    assert.equal(harness.widgetValues.some((value) => value !== undefined), false);
    await harness.commands.get("plan")("status", harness.ctx);
    assert.equal(harness.notifications.at(-1).message, "Plan Mode is active.");

    await harness.commands.get("plan-approve")("keep", harness.ctx);
    assert.equal(harness.sessionEntries.at(-1).data.stage, "executing");
    assert.equal(harness.status.get(PLAN_STATUS_KEY), undefined);
    assert.equal(harness.widgetValues.some((value) => value !== undefined), false);
    await harness.commands.get("plan")("status", harness.ctx);
    assert.equal(harness.notifications.at(-1).message, "Plan Mode is inactive.");
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
