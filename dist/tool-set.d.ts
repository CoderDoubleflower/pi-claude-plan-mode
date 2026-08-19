export declare function buildIdleTools(current: readonly string[], allToolNames: ReadonlySet<string>): string[];
export declare function getMissingPlanningTools(allToolNames: ReadonlySet<string>): string[];
export declare function buildPlanningTools(allToolNames: ReadonlySet<string>): string[];
export declare function buildExecutionTools(baseline: readonly string[], allToolNames: ReadonlySet<string>): string[];
export declare function isPlanningToolAllowed(toolName: string, allToolNames: ReadonlySet<string>): boolean;
