export declare const THINKING_LEVELS: readonly ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
export type ThinkingLevel = (typeof THINKING_LEVELS)[number];
export type PlanStage = "idle" | "planning" | "ready" | "executing" | "handed_off";
export interface PhaseProfileConfig {
    provider?: string;
    model?: string;
    thinkingLevel?: ThinkingLevel;
}
export interface PlanModeConfig {
    planning: PhaseProfileConfig;
    execution: PhaseProfileConfig;
}
export interface ModelProfile {
    provider?: string;
    model?: string;
    thinkingLevel: ThinkingLevel;
}
export interface SessionBaseline {
    profile: ModelProfile;
    tools: string[];
}
export interface PlanDocument {
    id: string;
    path: string;
    revision: number;
    hash: string;
}
export interface ReadyPlanSnapshot {
    revision: number;
    hash: string;
    preparedAt: string;
}
export interface ApprovedPlanSnapshot {
    revision: number;
    hash: string;
    content: string;
    approvedAt: string;
}
export interface ExecutionSource {
    sourceSessionId: string;
    sourceSessionFile?: string;
    sourceSessionName?: string;
    clearContext: boolean;
}
export interface PlanModeState {
    schemaVersion: 1;
    stage: PlanStage;
    plan?: PlanDocument;
    baseline?: SessionBaseline;
    planningProfile?: ModelProfile;
    executionProfile?: ModelProfile;
    executionTools?: string[];
    ready?: ReadyPlanSnapshot;
    approved?: ApprovedPlanSnapshot;
    source?: ExecutionSource;
    lastFeedback?: string;
    updatedAt: string;
}
export interface LoadedPlanModeConfig {
    config: PlanModeConfig;
    globalPath: string;
    projectPath: string;
    warnings: string[];
}
export interface PlanHandoffDetails {
    planId: string;
    planPath: string;
    revision: number;
    hash: string;
    sourceSessionId: string;
    sourceSessionFile?: string;
    clearContext: boolean;
}
