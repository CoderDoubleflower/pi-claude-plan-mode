import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
export interface PlanConfigUiResult {
    saved: boolean;
}
export declare function openPlanModeConfig(pi: ExtensionAPI, ctx: ExtensionCommandContext, options: {
    agentDir: string;
    configDirName: string;
}): Promise<PlanConfigUiResult>;
