export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export interface ModelLike {
  provider: string;
  id: string;
  name?: string;
}

export interface ModelRegistryLike {
  find(provider: string, model: string): ModelLike | undefined;
}

export interface SessionEntryLike {
  type: string;
  customType?: string;
  data?: unknown;
}

export interface ReadonlySessionManagerLike {
  getSessionId(): string;
  getSessionFile(): string | undefined;
  getEntries(): SessionEntryLike[];
  getBranch(): SessionEntryLike[];
}

export interface MutableSessionManagerLike extends ReadonlySessionManagerLike {
  appendCustomEntry(customType: string, data?: unknown): string;
  appendCustomMessageEntry<T = unknown>(
    customType: string,
    content: string | Array<{ type: string; text?: string }>,
    display: boolean,
    details?: T,
  ): string;
  appendSessionInfo(name: string): string;
}

export interface ExtensionUIContext {
  select(title: string, options: string[], opts?: unknown): Promise<string | undefined>;
  confirm(title: string, message: string, opts?: unknown): Promise<boolean>;
  input(title: string, placeholder?: string, opts?: unknown): Promise<string | undefined>;
  editor(title: string, prefill?: string): Promise<string | undefined>;
  notify(message: string, type?: "info" | "warning" | "error"): void;
  setStatus(key: string, text: string | undefined): void;
  setWidget(
    key: string,
    content: string[] | undefined,
    options?: { placement?: "aboveEditor" | "belowEditor" },
  ): void;
  setEditorText(text: string): void;
  getEditorText(): string;
  theme: {
    fg(color: string, text: string): string;
  };
}

export interface ExtensionContext {
  ui: ExtensionUIContext;
  mode: "tui" | "rpc" | "json" | "print";
  hasUI: boolean;
  cwd: string;
  sessionManager: ReadonlySessionManagerLike;
  modelRegistry: ModelRegistryLike;
  model: ModelLike | undefined;
  thinkingLevel?: ThinkingLevel;
  isIdle(): boolean;
  isProjectTrusted(): boolean;
  hasPendingMessages(): boolean;
  getSystemPrompt(): string;
}

export interface ReplacedSessionContext extends ExtensionCommandContext {
  sendMessage<T = unknown>(
    message: {
      customType: string;
      content: string | Array<{ type: string; text?: string }>;
      display: boolean;
      details?: T;
    },
    options?: { triggerTurn?: boolean; deliverAs?: "steer" | "followUp" | "nextTurn" },
  ): Promise<void>;
}

export interface ExtensionCommandContext extends ExtensionContext {
  waitForIdle(): Promise<void>;
  newSession(options?: {
    parentSession?: string;
    setup?: (sessionManager: MutableSessionManagerLike) => Promise<void>;
    withSession?: (ctx: ReplacedSessionContext) => Promise<void>;
  }): Promise<{ cancelled: boolean }>;
}

export interface ToolInfo {
  name: string;
  description?: string;
  sourceInfo?: unknown;
}


export interface ToolDefinitionLike {
  name: string;
  label: string;
  description: string;
  promptSnippet?: string;
  promptGuidelines?: string[];
  parameters: unknown;
  executionMode?: "sequential" | "parallel";
  execute(
    toolCallId: string,
    params: any,
    signal: AbortSignal | undefined,
    onUpdate: unknown,
    ctx: ExtensionContext,
  ): Promise<any>;
}

export interface ExtensionAPI {
  on(event: string, handler: (event: any, ctx: ExtensionContext) => Promise<any> | any): void;
  registerTool(tool: ToolDefinitionLike): void;
  registerCommand(
    name: string,
    options: {
      description?: string;
      handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
    },
  ): void;
  registerFlag(
    name: string,
    options:
      | { description?: string; type: "boolean"; default?: boolean }
      | { description?: string; type: "string"; default?: string },
  ): void;
  getFlag(name: string): boolean | string | undefined;
  sendMessage<T = unknown>(
    message: {
      customType: string;
      content: string | Array<{ type: string; text?: string }>;
      display: boolean;
      details?: T;
    },
    options?: { triggerTurn?: boolean; deliverAs?: "steer" | "followUp" | "nextTurn" },
  ): void;
  sendUserMessage(
    content: string | Array<{ type: string; text?: string }>,
    options?: { deliverAs?: "steer" | "followUp"; expandPromptTemplates?: boolean },
  ): void;
  appendEntry<T = unknown>(customType: string, data?: T): void;
  setSessionName(name: string): void;
  getSessionName(): string | undefined;
  getActiveTools(): string[];
  getAllTools(): ToolInfo[];
  setActiveTools(toolNames: string[]): void;
  setModel(model: ModelLike): Promise<boolean>;
  getThinkingLevel(): ThinkingLevel;
  setThinkingLevel(level: ThinkingLevel): void;
}

export const CONFIG_DIR_NAME: string;
export function getAgentDir(): string;
