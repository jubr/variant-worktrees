#!/usr/bin/env bun
/**
 * Move the repository to another Bun version and commit it as `chore(bun): bump to vX.Y.Z`.
 *
 * The version is `VERSION` (or the first argument), else the newest release of github.com/jubr/bun-slim without its
 * build number (`bun-slim-v1.4.5-0` is 1.4.5). The places that name a Bun version are `mise.toml`, the `@types/bun`
 * range of every `package.json` that has one (`latest` stays), and `bun.lock`.
 *
 * Specification: openspec/specs/meta/bun-bump/spec.md (Bun version bump)
 *
 * Usage: task chore:bun:bump [VERSION=1.4.6]
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { type Gh, latestSlimRelease, releaseTags } from "./bun-slim.ts";

/** `1.4.6` or `v1.4.6` as `1.4.6`. */
export const normalizeVersion = (value: string): string => {
  const match = /^v?(\d+\.\d+\.\d+)$/.exec(value.trim());
  if (match === null) {
    throw new Error(`"${value}" is not a plain major.minor.patch Bun version`);
  }
  return match[1] as string;
};

/** The override when there is one, else the version of the newest bun-slim release. */
export const bumpVersion = (override: string | undefined, tags: string[]): string => {
  if (override !== undefined && override.trim() !== "") {
    return normalizeVersion(override);
  }
  const release = latestSlimRelease(tags);
  if (release === undefined) {
    throw new Error("no bun-slim release found and no VERSION given");
  }
  return release.version;
};

const MISE_BUN = /^(bun\s*=\s*")[^"]*(")/m;

export const setMiseBun = (toml: string, version: string): string => {
  if (!MISE_BUN.test(toml)) {
    throw new Error("mise.toml pins no bun version");
  }
  return toml.replace(MISE_BUN, `$1${version}$2`);
};

const TYPES_BUN = /("@types\/bun"\s*:\s*")\^[^"]*(")/g;

/** Moves a `^` range of `@types/bun` to the version. `latest` and other specs stay as they are. */
export const setTypesBun = (json: string, version: string): string => json.replace(TYPES_BUN, `$1^${version}$2`);

const packageFiles = (root: string): string[] => [
  "package.json",
  ...(existsSync(join(root, "packages"))
    ? readdirSync(join(root, "packages"))
        .map((name) => join("packages", name, "package.json"))
        .filter((file) => existsSync(join(root, file)))
    : []),
];

/** Edit `mise.toml` and the `package.json` files; returns the paths (relative to `root`) that changed. */
export const bumpFiles = (root: string, version: string): string[] => {
  const edits: [string, (text: string) => string][] = [
    ["mise.toml", (text) => setMiseBun(text, version)],
    ...packageFiles(root).map((file): [string, (text: string) => string] => [file, (text) => setTypesBun(text, version)]),
  ];
  const changed: string[] = [];
  for (const [file, edit] of edits) {
    const path = join(root, file);
    const before = readFileSync(path, "utf8");
    const after = edit(before);
    if (after !== before) {
      writeFileSync(path, after);
      changed.push(relative(root, path));
    }
  }
  return changed;
};

if (import.meta.main) {
  const root = join(import.meta.dir, "..");
  const run = (command: string, args: string[]): string =>
    execFileSync(command, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  const gh: Gh = (args) => run("gh", args);
  const override = process.argv[2] || process.env.VERSION;
  const version = bumpVersion(override, override ? [] : releaseTags(gh));
  const changed = bumpFiles(root, version);
  if (changed.length === 0) {
    console.log(`already on Bun ${version}; nothing to commit`);
  } else {
    // AIDEV-NOTE: `mise x bun@<version>` installs that Bun when it is missing, so the lockfile is written by the new Bun.
    run("mise", ["x", `bun@${version}`, "--", "bun", "install"]);
    const files = [...changed, "bun.lock"];
    run("git", ["add", "--", ...files]);
    run("git", ["commit", "-m", `chore(bun): bump to v${version}`, "--", ...files]);
    console.log(`bumped to Bun ${version}: ${changed.join(", ")}, bun.lock`);
  }
}
