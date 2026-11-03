import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { parse as parseYaml } from "yaml";
import { migrateLegacy, migrateText } from "./legacy.js";
import { LOCAL_FILENAME } from "./schema.js";

/**
 * Specification: openspec/specs/variant-cli/config-migration/spec.md
 */

export type MigrationResult =
  | { status: "rewritten"; file: string; notices: string[] }
  | { status: "skipped"; file: string; notices: string[]; reason: string };

const OFF_VALUES = new Set(["", "0", "false"]);

const git = (directory: string, args: string[]): string =>
  execFileSync("git", ["-C", directory, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });

/** Why `variants.yaml` must not be rewritten: untracked, or changes that a `git checkout` of it would lose. */
const gitObstacle = (path: string): string | undefined => {
  const directory = dirname(path);
  const name = basename(path);
  try {
    git(directory, ["ls-files", "--error-unmatch", "--", name]);
  } catch {
    return `${name} is not tracked by git, so the rewrite could not be reverted`;
  }
  try {
    if (git(directory, ["status", "--porcelain", "--", name]).trim() !== "") {
      return `${name} has uncommitted changes, so the rewrite could not be reverted`;
    }
  } catch {
    return `git could not tell whether ${name} has uncommitted changes`;
  }
  return undefined;
};

const optOut = (env: NodeJS.ProcessEnv): string | undefined => {
  if (env.CI !== undefined && !OFF_VALUES.has(env.CI.toLowerCase())) {
    return "CI is set";
  }
  if (env.VARIANT_MIGRATE === "0") {
    return "VARIANT_MIGRATE=0";
  }
  return undefined;
};

/**
 * Rewrites a `variants.yaml` or `variants.local.yaml` that uses names of an earlier version, best effort. Nothing when
 * the file is missing or needs no change. Skipped, with the reason, when `CI` is set (not empty, `0` or `false`) or
 * `VARIANT_MIGRATE=0`; `variants.yaml` also only when git tracks it and it has no uncommitted changes, so that
 * `git checkout -- <file>` reverts the rewrite. `variants.local.yaml` is git-ignored and written by the tool, so the git
 * conditions do not apply. Never throws: a failure is the reason of a skip. Only the `variant` CLI and the editor
 * extension call it; the library, the MCP server and `variant ui` never write.
 */
export const migrateFile = (path: string, env: NodeJS.ProcessEnv = process.env): MigrationResult | undefined => {
  try {
    const text = readFileSync(path, "utf8");
    const migrated = migrateText(text);
    if (migrated === undefined) {
      return undefined;
    }
    const notices = migrateLegacy(parseYaml(text), path).notices;
    const reason = optOut(env) ?? (basename(path) === LOCAL_FILENAME ? undefined : gitObstacle(path));
    if (reason !== undefined) {
      return { status: "skipped", file: path, notices, reason };
    }
    try {
      writeFileSync(path, migrated);
    } catch (error) {
      return { status: "skipped", file: path, notices, reason: error instanceof Error ? error.message : String(error) };
    }
    return { status: "rewritten", file: path, notices };
  } catch {
    return undefined;
  }
};
