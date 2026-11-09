import { readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** A file touched inside this window counts as activity. Coarse on purpose. */
export const PROJECT_SESSION_FRESH_MS = 30_000;

const MAX_STATS = 400;

/** Same slug Cursor uses for `~/.cursor/projects/<slug>`. */
export const projectSlug = (workspacePath: string): string =>
  workspacePath
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Transcript files for one workspace. Cursor writes a session here while a chat runs. */
export const projectSessionsDir = (workspacePath: string, home = homedir()): string =>
  join(home, ".cursor", "projects", projectSlug(workspacePath), "agent-transcripts");

/**
 * Age of the newest file under the project sessions directory.
 * Missing directory is undefined. Does not read file contents.
 */
export const newestSessionAgeMs = (dir: string, now = Date.now()): number | undefined => {
  let newest: number | undefined;
  let stats = 0;

  const consider = (mtimeMs: number): void => {
    if (Number.isFinite(mtimeMs) && (newest === undefined || mtimeMs > newest)) {
      newest = mtimeMs;
    }
  };

  const walk = (path: string, depth: number): void => {
    if (stats >= MAX_STATS) {
      return;
    }
    let entries: ReturnType<typeof readdirSync>;
    try {
      entries = readdirSync(path, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (stats >= MAX_STATS || entry.name === "node_modules") {
        continue;
      }
      const child = join(path, entry.name);
      stats += 1;
      if (entry.isDirectory()) {
        if (depth > 0) {
          walk(child, depth - 1);
        }
        continue;
      }
      try {
        consider(statSync(child).mtimeMs);
      } catch {}
    }
  };

  walk(dir, 2);
  return newest === undefined ? undefined : Math.max(0, now - newest);
};

/** True when any session file was touched inside the fresh window. */
export const sessionFilesActive = (dir: string, now = Date.now(), freshMs = PROJECT_SESSION_FRESH_MS): boolean => {
  const age = newestSessionAgeMs(dir, now);
  return age !== undefined && age <= freshMs;
};
