import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

async function installRuntimeStubs(agentDir) {
  const codingAgentDir = join(root, "node_modules", "@earendil-works", "pi-coding-agent");
  const typeboxDir = join(root, "node_modules", "typebox");
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

function createHarness(tempRoot, options = {}) {
  const sessionEntries = [];
  const handlers = new Map();
  const commands = new Map();
  const tools = new Map();
  const allTools = new Set(["shell_command", "apply_patch", "read", "grep", "find", "ls", "ask_user_question"]);
  let activeTools = ["shell_command", "apply_patch"];
  let thinkingLevel = "medium";
  const sentMessages = [];
  const notifications = [];
  const widget = new Map();
  const models = new Map([
    ["base/base-model", { provider: "base", id: "base-model" }],
    ["planner/planner-model", { provider: "planner", id: "planner-model" }],
    ["executor/executor-model", { provider: "executor", id: "executor-model" }],
  ]);

  const sessionId = options.sessionId ?? "plan-session";
  const sessionFile = options.sessionFile ?? join(tempRoot, `${sessionId}.jsonl`);
  let sessionName = options.sessionName ?? "feature-plan";

  const sessionManager = {
    getSessionId: () => sessionId,
    getSessionFile: () => sessionFile,
    getEntries: () => sessionEntries,
    getBranch: () => sessionEntries,
    appendCustomEntry(customType, data) {
      sessionEntries.push({ type: "custom", customType, data });
      return `custom-${sessionEntries.length}`;
    },
    appendCustomMessageEntry(customType, content, display, details) {
      sessionEntries.push({ type: "custom_message", customType, content, display, details });
      return `custom-message-${sessionEntries.length}`;
    },
    appendSessionInfo(name) {
      sessionName = name;
      sessionEntries.push({ type: "session_info", name });
      return `session-info-${sessionEntries.length}`;
    },
  };

  const ctx = {
    cwd: tempRoot,
    mode: "tui",
    hasUI: true,
    sessionManager,
    model: models.get("base/base-model"),
    modelRegistry: { find: (provider, model) => models.get(`${provider}/${model}`) },
    thinkingLevel,
    isIdle: () => true,
    isProjectTrusted: () => options.projectTrusted ?? true,
    hasPendingMessages: () => options.hasPendingMessages ?? false,
    getSystemPrompt: () => "base prompt",
    waitForIdle: async () => undefined,
    ui: {
      theme: { fg: (_color, text) => text },
      select: async () => undefined,
      confirm: async () => true,
      input: async () => undefined,
      editor: async () => undefined,
      notify: (message, type = "info") => notifications.push({ message, type }),
      setStatus: (key, value) => widget.set(`status:${key}`, value),
      setWidget: (key, value) => widget.set(`widget:${key}`, value),
      getEditorText: () => "",
      setEditorText: (value) => widget.set("editor", value),
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
    setSessionName(name) { sessionName = name; },
    getSessionName() { return sessionName; },
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

  return {
    pi,
    ctx,
    emit,
    commands,
    tools,
    sessionEntries,
    sentMessages,
    notifications,
    get activeTools() { return activeTools; },
    get thinkingLevel() { return thinkingLevel; },
    get sessionName() { return sessionName; },
  };
}

test("full Plan flow supports fresh-child and keep-context execution", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "pi-plan-extension-"));
  const agentDir = join(tempRoot, "agent");
  try {
    await installRuntimeStubs(agentDir);
    await mkdir(agentDir, { recursive: true });
    await writeFile(
      join(agentDir, "claude-plan-mode.json"),
      JSON.stringify({
        planning: { provider: "planner", model: "planner-model", thinkingLevel: "high" },
        execution: { provider: "executor", model: "executor-model", thinkingLevel: "xhigh" },
      }),
    );

    const moduleUrl = `${pathToFileURL(join(root, "dist", "index.js")).href}?test=${Date.now()}`;
    const {
      default: extension,
      PLAN_CONTINUE_MESSAGE,
      PLAN_STATE_ENTRY,
      PLAN_HANDOFF_MESSAGE,
    } = await import(moduleUrl);

    const modelEntryHarness = createHarness(tempRoot, {
      sessionId: "model-entry-session",
      sessionFile: join(tempRoot, "model-entry-session.jsonl"),
    });
    extension(modelEntryHarness.pi);
    await modelEntryHarness.emit("session_start", { reason: "startup" });
    const enterResult = await modelEntryHarness.tools.get("EnterPlanMode").execute(
      "enter-1",
      { reason: "Plan a non-trivial implementation" },
      undefined,
      undefined,
      modelEntryHarness.ctx,
    );
    assert.equal(enterResult.terminate, true);
    assert.deepEqual(modelEntryHarness.activeTools, [
      "read",
      "grep",
      "find",
      "ls",
      "plan_write",
      "ExitPlanMode",
      "ask_user_question",
    ]);
    assert.equal(modelEntryHarness.sentMessages.length, 0);
    await modelEntryHarness.emit("agent_settled");
    const continuation = modelEntryHarness.sentMessages.at(-1);
    assert.equal(continuation.message.customType, PLAN_CONTINUE_MESSAGE);
    assert.equal(continuation.message.display, false);
    assert.equal(continuation.options.triggerTurn, true);

    const harness = createHarness(tempRoot);
    extension(harness.pi);
    await harness.emit("session_start", { reason: "startup" });
    assert.deepEqual(harness.activeTools, ["shell_command", "apply_patch", "EnterPlanMode"]);

    await harness.commands.get("plan")("Implement the requested behavior safely", harness.ctx);
    assert.equal(harness.sentMessages.at(-1).user, "Implement the requested behavior safely");
    assert.deepEqual(harness.activeTools, [
      "read",
      "grep",
      "find",
      "ls",
      "plan_write",
      "ExitPlanMode",
      "ask_user_question",
    ]);
    assert.equal(harness.ctx.model.provider, "planner");
    assert.equal(harness.thinkingLevel, "high");

    // Tree navigation must not leak Plan-only tools into a branch that
    // predates the Plan state, and returning to the Plan branch must restore it.
    const planningBranchEntries = [...harness.sessionEntries];
    harness.sessionEntries.splice(0);
    await harness.emit("session_tree", { newLeafId: null, oldLeafId: "plan" });
    assert.deepEqual(harness.activeTools, ["shell_command", "apply_patch", "EnterPlanMode"]);
    harness.sessionEntries.push(...planningBranchEntries);
    await harness.emit("session_tree", { newLeafId: "plan", oldLeafId: null });
    assert.deepEqual(harness.activeTools, [
      "read",
      "grep",
      "find",
      "ls",
      "plan_write",
      "ExitPlanMode",
      "ask_user_question",
    ]);

    const validPlan = `# Implementation Plan

## Objective
Implement the requested behavior without changing unrelated functionality.

## Repository Findings
The relevant code follows an existing extension registration pattern.

## Design Decisions
Use a focused state transition and preserve current defaults.

## Critical Files
- src/index.ts — integrate the workflow.

## Implementation Steps
1. Add the focused state transition and canonical data flow.
2. Integrate the behavior with the existing extension lifecycle.
3. Add regression tests for both execution choices and state restoration.

## Validation
Run type checking and the complete automated test suite.

## Risks
Avoid stale session context and accidental Plan-only tool exposure.
`;
    await harness.tools.get("plan_write").execute("write-1", { content: validPlan, expected_revision: 1 }, undefined, undefined, harness.ctx);
    const exitResult = await harness.tools.get("ExitPlanMode").execute("exit-1", {}, undefined, undefined, harness.ctx);
    assert.equal(exitResult.terminate, true);
    assert.equal(harness.sessionEntries.at(-1).data.stage, "ready");

    let newSessionOptions;
    let executionHarness;
    let replacementTrigger;
    harness.ctx.newSession = async (options) => {
      newSessionOptions = options;

      // Match stock Pi's replacement lifecycle: setup mutates the new
      // SessionManager before the replacement extension receives session_start.
      executionHarness = createHarness(tempRoot, {
        sessionId: "execution-session",
        sessionFile: join(tempRoot, "execution-session.jsonl"),
      });
      await options.setup?.(executionHarness.ctx.sessionManager);
      extension(executionHarness.pi);
      await executionHarness.emit("session_start", {
        reason: "new",
        previousSessionFile: harness.ctx.sessionManager.getSessionFile(),
      });
      assert.equal(executionHarness.sentMessages.length, 0);

      await options.withSession({
        ...executionHarness.ctx,
        sendMessage: async (message, sendOptions) => {
          replacementTrigger = { message, sendOptions };
          executionHarness.sentMessages.push({ message, options: sendOptions });
        },
      });
      return { cancelled: false };
    };

    await harness.commands.get("plan-approve")("clear", harness.ctx);
    assert.equal(newSessionOptions.parentSession, join(tempRoot, "plan-session.jsonl"));
    assert.equal(typeof newSessionOptions.setup, "function");

    const executionStateEntry = executionHarness.sessionEntries.find(
      (entry) => entry.type === "custom" && entry.customType === PLAN_STATE_ENTRY,
    );
    assert.equal(executionStateEntry.data.stage, "executing");
    assert.equal(executionStateEntry.data.executionProfile.provider, "executor");
    assert.equal(executionStateEntry.data.executionProfile.model, "executor-model");
    assert.equal(executionStateEntry.data.executionProfile.thinkingLevel, "xhigh");
    assert.deepEqual(executionHarness.activeTools, ["shell_command", "apply_patch", "EnterPlanMode"]);
    assert.equal(executionHarness.ctx.model.provider, "executor");
    assert.equal(executionHarness.thinkingLevel, "xhigh");
    assert.match(executionHarness.sessionName, /^execute-/);

    assert.equal(replacementTrigger.message.customType, PLAN_HANDOFF_MESSAGE);
    assert.match(replacementTrigger.message.content, /Implement the requested behavior/);
    assert.match(replacementTrigger.message.content, /plan-session\.jsonl/);
    assert.equal(replacementTrigger.message.display, true);
    assert.equal(replacementTrigger.sendOptions.triggerTurn, true);
    assert.equal(harness.sessionEntries.at(-1).data.stage, "handed_off");

    // If Pi is interrupted after execution state persistence but before the
    // handoff message is stored, resuming the child session reconstructs the
    // exact approved snapshot without auto-triggering another turn.
    const recoveryHarness = createHarness(tempRoot, {
      sessionId: "execution-recovery",
      sessionFile: join(tempRoot, "execution-recovery.jsonl"),
    });
    recoveryHarness.sessionEntries.push(
      {
        type: "custom_message",
        customType: PLAN_HANDOFF_MESSAGE,
        details: { planId: "older-plan", revision: 1, hash: "older-hash" },
      },
      {
        type: "custom",
        customType: PLAN_STATE_ENTRY,
        data: executionStateEntry.data,
      },
    );
    extension(recoveryHarness.pi);
    await recoveryHarness.emit("session_start", { reason: "resume" });
    const recoveredHandoff = recoveryHarness.sentMessages.find(
      (entry) => entry.message?.customType === PLAN_HANDOFF_MESSAGE,
    );
    assert.match(recoveredHandoff.message.content, /Implement the requested behavior/);
    assert.equal(recoveredHandoff.options.triggerTurn, false);

    const planPath = executionStateEntry.data.plan.path;
    assert.match(await readFile(planPath, "utf8"), /Implementation Steps/);

    // A cancelled stock-Pi session replacement must leave the planning
    // session ready, with its canonical plan and planning profile intact.
    const cancelledHarness = createHarness(tempRoot, {
      sessionId: "cancelled-plan-session",
      sessionFile: join(tempRoot, "cancelled-plan-session.jsonl"),
    });
    extension(cancelledHarness.pi);
    await cancelledHarness.emit("session_start", { reason: "startup" });
    await cancelledHarness.commands.get("plan")("Implement cancellation recovery", cancelledHarness.ctx);
    await cancelledHarness.tools.get("plan_write").execute(
      "cancel-write",
      { content: validPlan.replace("requested behavior", "cancellation recovery"), expected_revision: 1 },
      undefined,
      undefined,
      cancelledHarness.ctx,
    );
    await cancelledHarness.tools.get("ExitPlanMode").execute(
      "cancel-exit",
      {},
      undefined,
      undefined,
      cancelledHarness.ctx,
    );
    cancelledHarness.ctx.newSession = async () => ({ cancelled: true });
    await cancelledHarness.commands.get("plan-approve")("clear", cancelledHarness.ctx);
    assert.equal(cancelledHarness.sessionEntries.at(-1).data.stage, "ready");
    assert.equal(cancelledHarness.ctx.model.provider, "planner");
    assert.deepEqual(cancelledHarness.activeTools, [
      "read",
      "grep",
      "find",
      "ls",
      "plan_write",
      "ExitPlanMode",
      "ask_user_question",
    ]);

    // The keep-context branch must stay in the current Plan session, apply
    // the execution profile, and allow an explicit return to the baseline.
    const keepHarness = createHarness(tempRoot, {
      sessionId: "keep-plan-session",
      sessionFile: join(tempRoot, "keep-plan-session.jsonl"),
    });
    extension(keepHarness.pi);
    await keepHarness.emit("session_start", { reason: "startup" });
    await keepHarness.commands.get("plan")("Implement keep-context execution", keepHarness.ctx);
    await keepHarness.tools.get("plan_write").execute(
      "keep-write",
      { content: validPlan.replace("requested behavior", "keep-context execution"), expected_revision: 1 },
      undefined,
      undefined,
      keepHarness.ctx,
    );
    await keepHarness.tools.get("ExitPlanMode").execute(
      "keep-exit",
      {},
      undefined,
      undefined,
      keepHarness.ctx,
    );
    keepHarness.ctx.newSession = async () => {
      throw new Error("keep-context approval must not create a new session");
    };
    await keepHarness.commands.get("plan-approve")("keep", keepHarness.ctx);
    assert.deepEqual(keepHarness.activeTools, ["shell_command", "apply_patch", "EnterPlanMode"]);
    assert.equal(keepHarness.ctx.model.provider, "executor");
    assert.equal(keepHarness.thinkingLevel, "xhigh");
    assert.equal(keepHarness.sessionEntries.at(-1).data.stage, "executing");
    const keepHandoff = keepHarness.sentMessages.find(
      (entry) => entry.message?.customType === PLAN_HANDOFF_MESSAGE,
    );
    assert.match(keepHandoff.message.content, /keep-context execution/);
    assert.equal(keepHandoff.options.triggerTurn, true);

    await keepHarness.commands.get("plan")("finish", keepHarness.ctx);
    assert.deepEqual(keepHarness.activeTools, ["shell_command", "apply_patch", "EnterPlanMode"]);
    assert.equal(keepHarness.ctx.model.provider, "base");
    assert.equal(keepHarness.thinkingLevel, "medium");
    assert.equal(keepHarness.sessionEntries.at(-1).data.stage, "idle");
  } finally {
    await rm(join(root, "node_modules"), { recursive: true, force: true });
    await rm(tempRoot, { recursive: true, force: true });
  }
});
