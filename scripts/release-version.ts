#!/usr/bin/env bun
/**
 * Print the lockstep release version shared by the root package, variant-api,
 * variant-vscode and chat-renamer.
 *
 * Specification: openspec/specs/meta/release-artifacts/spec.md (Lockstep release version)
 *
 * Usage: bun scripts/release-version.ts [workspaceRoot]
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.argv[2] ?? join(import.meta.dir, ".."));

/** Every package that ships in a release; they share one version. */
const RELEASE_PACKAGES = [
  "package.json",
  "packages/variant-api/package.json",
  "packages/variant-vscode/package.json",
  "packages/chat-renamer-vscode/package.json",
];

const versions = RELEASE_PACKAGES.map((file) => ({
  file,
  version: JSON.parse(readFileSync(join(root, file), "utf8")).version as string,
}));

const distinct = new Set(versions.map(({ version }) => version));
if (distinct.size > 1) {
  console.error("release packages must share one version:");
  for (const { file, version } of versions) {
    console.error(`  ${file}: ${version}`);
  }
  process.exit(1);
}

console.log(versions[0].version);
