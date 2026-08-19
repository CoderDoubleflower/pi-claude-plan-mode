import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { PLAN_TEMPLATE_MARKER } from "./constants.js";
export function hashPlan(content) {
    return createHash("sha256").update(content, "utf8").digest("hex");
}
function isValidPlanId(id) {
    return /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/.test(id);
}
export function isManagedPlanDocument(document, agentDir) {
    if (!isValidPlanId(document.id))
        return false;
    return resolve(document.path) === resolve(agentDir, "plans", `${document.id}.md`);
}
export function buildInitialPlan(reason) {
    const objective = reason?.trim() ? reason.trim() : "Describe the requested change and its intended outcome.";
    return `# Implementation Plan

${PLAN_TEMPLATE_MARKER}

## Objective
${objective}

## User Requirements
- Capture the user's explicit requirements and constraints.

## Repository Findings
- Record the relevant architecture, call paths, and existing patterns discovered during exploration.

## Design Decisions
- Explain the selected implementation and meaningful alternatives.

## Critical Files
- List the files expected to change and why.

## Implementation Steps
1. Replace this template with concrete, ordered implementation steps.

## Validation
- List tests, type checks, builds, or manual checks needed after implementation.

## Risks
- Record regressions, edge cases, compatibility concerns, and rollback considerations.
`;
}
function errorCode(error) {
    return error && typeof error === "object" && "code" in error
        ? String(error.code)
        : undefined;
}
async function assertSafeDirectory(directory) {
    const info = await lstat(directory);
    if (info.isSymbolicLink())
        throw new Error(`Plan directory must not be a symbolic link: ${directory}`);
    if (!info.isDirectory())
        throw new Error(`Plan directory is not a directory: ${directory}`);
}
async function assertRegularPlanFile(filePath) {
    const info = await lstat(filePath);
    if (info.isSymbolicLink())
        throw new Error(`Plan file must not be a symbolic link: ${filePath}`);
    if (!info.isFile())
        throw new Error(`Plan path is not a regular file: ${filePath}`);
}
async function atomicWrite(filePath, content) {
    const directory = dirname(filePath);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await assertSafeDirectory(directory);
    const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
    try {
        await writeFile(tempPath, content, { encoding: "utf8", flag: "wx", mode: 0o600 });
        await rename(tempPath, filePath);
    }
    catch (error) {
        await rm(tempPath, { force: true }).catch(() => undefined);
        throw error;
    }
}
export async function createPlanDocument(agentDir, reason, options) {
    const id = options?.id ?? randomUUID();
    if (!isValidPlanId(id))
        throw new Error(`Invalid Plan document id: ${id}`);
    const path = join(agentDir, "plans", `${id}.md`);
    const content = buildInitialPlan(reason);
    await atomicWrite(path, content);
    return {
        id,
        path,
        revision: 1,
        hash: hashPlan(content),
    };
}
export async function ensurePlanDocument(document) {
    try {
        await assertRegularPlanFile(document.path);
        return document;
    }
    catch (error) {
        if (errorCode(error) !== "ENOENT")
            throw error;
        const content = buildInitialPlan();
        await atomicWrite(document.path, content);
        return {
            ...document,
            revision: document.revision + 1,
            hash: hashPlan(content),
        };
    }
}
export async function readPlanContent(document) {
    await assertRegularPlanFile(document.path);
    return readFile(document.path, "utf8");
}
export async function updatePlanDocument(document, content, expectedRevision) {
    if (expectedRevision !== undefined && expectedRevision !== document.revision) {
        throw new Error(`Plan revision mismatch: expected ${expectedRevision}, current revision is ${document.revision}.`);
    }
    const normalized = content.endsWith("\n") ? content : `${content}\n`;
    await atomicWrite(document.path, normalized);
    return {
        ...document,
        revision: document.revision + 1,
        hash: hashPlan(normalized),
    };
}
export async function refreshPlanDocument(document) {
    const content = await readPlanContent(document);
    const hash = hashPlan(content);
    if (hash === document.hash) {
        return { document, content, changed: false };
    }
    return {
        content,
        changed: true,
        document: {
            ...document,
            revision: document.revision + 1,
            hash,
        },
    };
}
export function isPlanReady(content) {
    const trimmed = content.trim();
    if (!trimmed)
        return { ready: false, reason: "The plan is empty." };
    if (content.includes(PLAN_TEMPLATE_MARKER)) {
        return { ready: false, reason: "The plan still contains the initial template marker." };
    }
    if (!/^##\s+Implementation Steps\s*$/im.test(content)) {
        return { ready: false, reason: 'The plan must contain an "## Implementation Steps" section.' };
    }
    if (!/^\s*\d+[.)]\s+\S+/m.test(content)) {
        return { ready: false, reason: "The implementation steps section must contain at least one numbered step." };
    }
    if (trimmed.length < 120) {
        return { ready: false, reason: "The plan is too short to review reliably." };
    }
    return { ready: true };
}
