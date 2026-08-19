import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

async function ensurePackage(relativeDir, packageJson, declarationSource) {
  const packageDir = join(root, "node_modules", ...relativeDir);
  const manifestPath = join(packageDir, "package.json");
  if (existsSync(manifestPath)) return;

  await mkdir(packageDir, { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
  const declaration = await readFile(join(root, declarationSource), "utf8");
  await writeFile(join(packageDir, "index.d.ts"), declaration, "utf8");
}

await ensurePackage(
  ["@earendil-works", "pi-coding-agent"],
  {
    name: "@earendil-works/pi-coding-agent",
    version: "0.0.0-test-stub",
    types: "index.d.ts",
  },
  "types/pi-coding-agent.d.ts",
);

await ensurePackage(
  ["typebox"],
  {
    name: "typebox",
    version: "0.0.0-test-stub",
    types: "index.d.ts",
  },
  "types/typebox.d.ts",
);

await ensurePackage(
  ["@types", "node"],
  {
    name: "@types/node",
    version: "0.0.0-test-stub",
    types: "index.d.ts",
  },
  "types/node-shim.d.ts",
);
