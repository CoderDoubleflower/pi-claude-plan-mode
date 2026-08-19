import { type LoadedPlanModeConfig } from "./types.js";
export declare function loadPlanModeConfig(cwd: string, options: {
    agentDir: string;
    configDirName: string;
    loadProjectConfig?: boolean;
}): LoadedPlanModeConfig;
