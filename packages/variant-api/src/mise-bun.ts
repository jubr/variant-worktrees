import { spawnSync } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { delimiter, join } from "node:path";
import type { ProgressLog } from "./echo.js";
import { runMise } from "./mise.js";

/**
 * Specification: openspec/specs/tools/mise/spec.md (Bun on PATH matches the Bun Mise pins)
 */

const PROBE_TIMEOUT_MS = 5000;

export interface BunCheckOptions {
  /** The project directory Mise resolves the pinned Bun for. */
  directory: string;
  /** The Mise executable; without one the check is skipped. */
  binary: string | undefined;
  /** The environment host commands run with; its `PATH` decides which `bun` they find. */
  env: NodeJS.ProcessEnv;
  log: ProgressLog;
}

/** The version Mise resolves for Bun in `directory`, or nothing when it pins none or Mise fails. */
const pinnedVersion = (directory: string, binary: string): string | undefined => {
  try {
    const parsed: unknown = JSON.parse(runMise({ directory, binary }, ["ls", "--current", "--json", "bun"]));
    const entries = Array.isArray(parsed) ? parsed : ((parsed as { bun?: unknown } | null)?.bun ?? []);
    const first = Array.isArray(entries) ? (entries[0] as { version?: unknown } | undefined) : undefined;
    return typeof first?.version === "string" && first.version !== "" ? first.version : undefined;
  } catch {
    return undefined;
  }
};

/** The first executable `bun` in the directories of `path`. */
const firstBun = (path: string): { executable: string; directory: string } | undefined => {
  for (const directory of path.split(delimiter).filter((entry) => entry !== "")) {
    const executable = join(directory, "bun");
    try {
      accessSync(executable, constants.X_OK);
      return { executable, directory };
    } catch {}
  }
  return undefined;
};

const versionOf = (executable: string, env: NodeJS.ProcessEnv): string | undefined => {
  const result = spawnSync(executable, ["--version"], { encoding: "utf8", env, timeout: PROBE_TIMEOUT_MS });
  const version = result.status === 0 ? result.stdout.trim().replace(/^v/, "") : "";
  return version === "" ? undefined : version;
};

const miseBunPath = (directory: string, binary: string): string => {
  try {
    return runMise({ directory, binary }, ["which", "bun"]).trim() || "(unknown)";
  } catch {
    return "(unknown)";
  }
};

/** Logs one warning when the `bun` on the command `PATH` is another version than the one Mise pins. */
export const warnWhenBunDiffers = ({ directory, binary, env, log }: BunCheckOptions): void => {
  if (!binary) {
    return;
  }
  const expected = pinnedVersion(directory, binary);
  const found = expected === undefined ? undefined : firstBun(env.PATH ?? "");
  if (expected === undefined || found === undefined) {
    return;
  }
  const actual = versionOf(found.executable, env);
  if (actual === undefined || actual === expected) {
    return;
  }
  log(
    `Warning: bun ${actual} (${found.executable}) is first on PATH, but Mise pins bun ${expected} ` +
      `(${miseBunPath(directory, binary)}). Put the Mise tool directories before ${found.directory} on PATH.`,
  );
};
