import type { PlanDocument } from "./types.js";
export declare function hashPlan(content: string): string;
export declare function isManagedPlanDocument(document: PlanDocument, agentDir: string): boolean;
export declare function buildInitialPlan(reason?: string): string;
export declare function createPlanDocument(agentDir: string, reason?: string, options?: {
    id?: string;
}): Promise<PlanDocument>;
export declare function ensurePlanDocument(document: PlanDocument): Promise<PlanDocument>;
export declare function readPlanContent(document: PlanDocument): Promise<string>;
export declare function updatePlanDocument(document: PlanDocument, content: string, expectedRevision?: number): Promise<PlanDocument>;
export declare function refreshPlanDocument(document: PlanDocument): Promise<{
    document: PlanDocument;
    content: string;
    changed: boolean;
}>;
export declare function isPlanReady(content: string): {
    ready: boolean;
    reason?: string;
};
