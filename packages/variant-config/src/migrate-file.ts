import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { parse as parseYaml } from "yaml";
import { migrateLegacy, migrateText } from "./legacy.js";
import { LOCAL_FILENAME } from "./schema.js";

/**
 * Specification: openspec/specs/variant-cli/config-migration/spec.md
 */

export type MigrationResult =
  | { status: "rewritten"; file: string; notices: string[]; backup?: string }
  | { status: "skipped"; file: string; notices: string[]; reason: string };

const OFF_VALUES = new Set(["", "0", "false"]);

const git = (directory: string, args: string[]): string =>
  execFileSync("git", ["-C", directory, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });

/**
 * What keeps `git checkout` from reverting a rewrite of `variants.yaml`: `untracked` (not in git, or no repository), in
 * which case the rewrite saves a backup instead; or the reason it must not be rewritten at all (changes that a
 * `git checkout` would lose).
 */
const gitObstacle = (path: string): { untracked: true } | { reason: string } | undefined => {
  const directory = dirname(path);
  const name = basename(path);
  try {
    git(directory, ["ls-files", "--error-unmatch", "--", name]);
  } catch {
    return { untracked: true };
  }
  try {
    if (git(directory, ["status", "--porcelain", "--", name]).trim() !== "") {
      return { reason: `${name} has uncommitted changes, so the rewrite could not be reverted` };
    }
  } catch {
    return { reason: `git could not tell whether ${name} has uncommitted changes` };
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
 * `VARIANT_MIGRATE=0`; `variants.yaml` also when it is tracked by git but has uncommitted changes, which a
 * `git checkout -- <file>` would lose. An untracked `variants.yaml` is rewritten after its old text is saved next to it
 * as `<file>~` (skipped when that backup exists, so no earlier backup is lost). `variants.local.yaml` is git-ignored and
 * written by the tool, so the git conditions and the backup do not apply. Never throws: a failure is the reason of a skip. Only the `variant` CLI and the editor
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
    const isLocal = basename(path) === LOCAL_FILENAME;
    const obstacle = isLocal ? undefined : gitObstacle(path);
    const untracked = obstacle !== undefined && "untracked" in obstacle;
    const reason = optOut(env) ?? (obstacle !== undefined && "reason" in obstacle ? obstacle.reason : undefined);
    if (reason !== undefined) {
      return { status: "skipped", file: path, notices, reason };
    }
    const backup = untracked ? `${path}~` : undefined;
    try {
      if (backup !== undefined) {
        try {
          writeFileSync(backup, text, { flag: "wx" });
        } catch (error) {
          const exists = (error as NodeJS.ErrnoException).code === "EEXIST";
          throw exists ? new Error(`${basename(backup)} already exists, so the old text could not be saved`) : error;
        }
      }
      try {
        writeFileSync(path, migrated);
      } catch (error) {
        if (backup !== undefined) {
          rmSync(backup, { force: true });
        }
        throw error;
      }
    } catch (error) {
      return { status: "skipped", file: path, notices, reason: error instanceof Error ? error.message : String(error) };
    }
    return { status: "rewritten", file: path, notices, ...(backup !== undefined ? { backup } : {}) };
  } catch {
    return undefined;
  }
};
