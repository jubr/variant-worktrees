import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { LogLevel, log } from "./log.js";
import { levelForDirectory } from "./log-directory.js";
import { stopProcessTree } from "./processes.js";

/** Specification: openspec/specs/variant-api/runtime/spec.md (Watch follows its worktree) */

/** The log step of every event the cleanup emits. The CLI keeps it off the editor socket. */
export const WATCH_CLEANUP_STEP = "watch-cleanup";

export interface WorktreeIdentity {
  dev: number;
  ino: number;
}

/** Which directory stands at `path` right now, or `undefined` when none does. */
export const worktreeIdentity = (path: string): WorktreeIdentity | undefined => {
  try {
    const { dev, ino } = statSync(path);
    return { dev, ino };
  } catch {
    return undefined;
  }
};

/**
 * Whether the worktree directory is gone: missing, or another directory than the one that was identified. A watch
 * process that writes below the removed path can recreate it, and a plain existence check would then say it is there.
 */
export const worktreeGone = (path: string, identity: WorktreeIdentity | undefined): boolean => {
  const now = worktreeIdentity(path);
  if (now === undefined) {
    return true;
  }
  return identity !== undefined && (now.dev !== identity.dev || now.ino !== identity.ino);
};

/** The first candidate that exists and is not the vanished path. The last candidate when none does. */
export const survivingDirectory = (candidates: readonly string[], vanished: string): string => {
  const gone = resolve(vanished);
  const found = candidates.find((candidate) => resolve(candidate) !== gone && existsSync(candidate));
  return found ?? (candidates.at(-1) as string);
};

export interface ImplodeForCleanup {
  branchRm: "no";
  announce: (message: string) => void;
}

export interface CleanupRequest {
  slug: string;
  /** The path that was found gone. */
  worktree: string;
  /** A directory that still exists. It decides the level of the events, as a project directory does elsewhere. */
  directory: string;
  /** The watch processes this process started, with the pids it holds. */
  processes: readonly { key: string; pid: number }[];
  /** Makes every writer under the worktree drop what it has and write nothing more. Runs first. */
  silence: () => void;
  /** Implodes the variant. Not called for `main`. */
  implode: (options: ImplodeForCleanup) => Promise<unknown>;
}

/**
 * What a watch does once its worktree is gone: silence its writers, stop its processes, implode the variant keeping the
 * local branch. One `watch-cleanup` warning says the worktree is gone; each action is announced at debug before it runs. Nothing here writes below the worktree.
 * A failed implode is reported and does not throw, so the caller can still end.
 */
export const cleanupVanishedWorktree = async (request: CleanupRequest): Promise<void> => {
  const emit = (level: LogLevel, message: string): void => {
    log(levelForDirectory(level, request.directory), message, { slug: request.slug, step: WATCH_CLEANUP_STEP });
  };
  /** The one `warn`: the worktree is gone and what that causes. Everything after it is `debug`. */
  const warn = (message: string): void => emit(LogLevel.warn, message);
  const say = (message: string): void => emit(LogLevel.debug, message);
  request.silence();
  warn(
    request.slug === "main"
      ? `worktree ${request.worktree} is gone: stopping the watches of main`
      : `worktree ${request.worktree} is gone: stopping the watches of ${request.slug}, then imploding it and keeping its branch`,
  );
  for (const { key, pid } of request.processes) {
    say(`stopping watch ${key} pid ${pid}`);
    await stopProcessTree(pid);
  }
  if (request.slug === "main") {
    say("main is never imploded");
    return;
  }
  try {
    await request.implode({ branchRm: "no", announce: say });
  } catch (error) {
    // A failure is not routine: it stays visible at warn.
    warn(`implode failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};
