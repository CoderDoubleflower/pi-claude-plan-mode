import { type LoadedPlanModeConfig, type PlanModeConfig } from "./types.js";
export declare function createEmptyPlanModeConfig(): PlanModeConfig;
export declare function savePlanModeConfig(filePath: string, config: PlanModeConfig): Promise<void>;
export declare function loadPlanModeConfig(cwd: string, options: {
    agentDir: string;
    configDirName: string;
    loadProjectConfig?: boolean;
}): LoadedPlanModeConfig;
