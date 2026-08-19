import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { ModelProfile, PhaseProfileConfig } from "./types.js";
export declare function captureCurrentProfile(pi: ExtensionAPI, ctx: ExtensionContext): ModelProfile;
export declare function resolvePhaseProfile(baseline: ModelProfile, configured: PhaseProfileConfig): ModelProfile;
export declare function applyProfile(pi: ExtensionAPI, ctx: ExtensionContext, target: ModelProfile, fallback: ModelProfile, label: string): Promise<void>;
