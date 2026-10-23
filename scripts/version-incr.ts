#!/usr/bin/env bun
/**
 * Bump the patch version of the root package and every `packages/*` package,
 * and mirror the new version into the workspace entries of `bun.lock`.
 *
 * Specification: openspec/specs/meta/release-artifacts/spec.md (Patch version bump)
 *
 * Usage: bun scripts/version-incr.ts [workspaceRoot]
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.argv[2] ?? join(import.meta.dir, ".."));

const fail = (lines: string[]): never => {
  for (const line of lines) {
    console.error(line);
  }
  process.exit(1);
};

/** Root `package.json` first, then every `packages/<dir>/package.json`. */
const packageFiles = (): string[] => {
  const dirs = existsSync(join(root, "packages"))
    ? readdirSync(join(root, "packages"), { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && existsSync(join(root, "packages", entry.name, "package.json")))
        .map((entry) => `packages/${entry.name}/package.json`)
        .sort()
    : [];
  return ["package.json", ...dirs];
};

const VERSION_FIELD = /("version"\s*:\s*")([^"]+)(")/;

const files = packageFiles().map((file) => {
  const text = readFileSync(join(root, file), "utf8");
  const version = JSON.parse(text).version as string;
  return { file, text, version };
});

const distinct = new Set(files.map(({ version }) => version));
if (distinct.size > 1) {
  fail([
    "packages must share one version before a bump:",
    ...files.map(({ file, version }) => `  ${file}: ${version}`),
  ]);
}

const current = files[0].version;
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);
if (!match) {
  fail([`version must be plain major.minor.patch, got ${current}`]);
}
const [, major, minor, patch] = match as RegExpExecArray;
const next = `${major}.${minor}.${Number(patch) + 1}`;

for (const { file, text } of files) {
  writeFileSync(join(root, file), text.replace(VERSION_FIELD, `$1${next}$3`));
}

// AIDEV-NOTE: bun.lock records a version only for packages/* workspace entries, not the root entry.
const lockPath = join(root, "bun.lock");
if (existsSync(lockPath)) {
  const lock = readFileSync(lockPath, "utf8").replace(
    /("packages\/[^"]+": \{\s*"name": "[^"]+",\s*"version": ")[^"]+(")/g,
    `$1${next}$2`,
  );
  writeFileSync(lockPath, lock);
}

console.log(next);
