import { execFileSync } from "node:child_process";
import { existsSync, type FSWatcher, watch as fsWatch, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Specification: openspec/changes/variant-init-onboarding/specs/variant-vscode/onboarding/spec.md
 * (One-time onboarding notification)
 *
 * Notices a local commit: the newest entry of the `HEAD` reflog is a `commit` entry that was not there before.
 */

/** Whether a reflog line records a commit: `commit:`, `commit (initial):` or `commit (amend):`. Merges, pulls, rebases, checkouts and clones do not. */
export const isCommitEntry = (line: string): boolean => {
  const message = line.split("\t")[1] ?? "";
  return /^commit(?: \((?:initial|amend)\))?:/.test(message);
};

/** The last non-empty line of the file, or nothing when it does not exist or is empty. */
export const lastEntry = (file: string): string | undefined => {
  try {
    return readFileSync(file, "utf8")
      .split("\n")
      .filter((line) => line !== "")
      .at(-1);
  } catch {
    return undefined;
  }
};

/** The reflog file of `HEAD` of the working tree at `root`, per worktree, or nothing outside a repository. */
export const headReflogPath = (root: string): string | undefined => {
  try {
    const path = execFileSync("git", ["rev-parse", "--git-path", "logs/HEAD"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return path === "" ? undefined : resolve(root, path);
  } catch {
    return undefined;
  }
};

export interface Watching {
  dispose(): void;
}

/** Calls `listener` whenever something in `directory` changes. */
export type WatchDirectory = (directory: string, listener: () => void) => Watching;

const watchDirectory: WatchDirectory = (directory, listener) => {
  let watcher: FSWatcher | undefined;
  try {
    watcher = fsWatch(directory, () => listener());
    watcher.on("error", () => watcher?.close());
  } catch {
    // The directory is gone or cannot be watched; the next check tries again.
  }
  return { dispose: () => watcher?.close() };
};

export interface CommitWatcherOptions {
  root: string;
  /** Called once per new local commit. */
  onCommit: () => void;
  /** Watches a directory; `fs.watch` by default. */
  watch?: WatchDirectory;
  /** The reflog file; `git rev-parse --git-path logs/HEAD` by default. */
  reflogPath?: (root: string) => string | undefined;
}

export interface CommitWatcher {
  /** Looks at the reflog now. The watch calls it; a test calls it directly. */
  check(): void;
  dispose(): void;
}

/**
 * Watches the `HEAD` reflog of `root`. The newest entry at the start is only remembered, so commits that exist when
 * the editor starts do not trigger. Nothing happens outside a git repository.
 */
export const createCommitWatcher = (options: CommitWatcherOptions): CommitWatcher => {
  const file = (options.reflogPath ?? headReflogPath)(options.root);
  const watch = options.watch ?? watchDirectory;
  let seen = file === undefined ? undefined : lastEntry(file);
  let watching: { directory: string; handle: Watching } | undefined;

  /** Watches the logs directory, or until it exists (before the first commit) the git directory above it. */
  const arm = (): void => {
    if (file === undefined) {
      return;
    }
    const logs = dirname(file);
    const directory = existsSync(logs) ? logs : dirname(logs);
    if (watching?.directory === directory || !existsSync(directory)) {
      return;
    }
    watching?.handle.dispose();
    watching = { directory, handle: watch(directory, () => check()) };
  };

  const check = (): void => {
    if (file === undefined) {
      return;
    }
    arm();
    const entry = lastEntry(file);
    if (entry === undefined || entry === seen) {
      return;
    }
    seen = entry;
    if (isCommitEntry(entry)) {
      options.onCommit();
    }
  };

  arm();
  return {
    check,
    dispose: () => {
      watching?.handle.dispose();
      watching = undefined;
    },
  };
};
