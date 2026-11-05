import { existsSync, rmSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { globSync } from "tinyglobby";
import { renderTemplate } from "variant-config";
import { git, runGit } from "./git.js";

/**
 * The paths below `worktree` that match one of `patterns` (`${slug}` replaced), matched from each of `bases`, and that
 * `removeMatching` would delete: not `.git`, not a tracked file, not a directory that holds one. Symlinks are not
 * followed. Paths are relative to `worktree`; nothing is deleted.
 */
export const findRemovable = (
  worktree: string,
  bases: readonly string[],
  patterns: readonly string[],
  slug: string,
  environment?: () => NodeJS.ProcessEnv,
): Array<{ base: string; match: string; path: string }> => {
  const found: Array<{ base: string; match: string; path: string }> = [];
  for (const base of new Set(bases)) {
    for (const pattern of patterns) {
      for (const entry of globSync(
        renderTemplate(pattern, { slug, env: environment, setting: "variant.implode.preRm" }),
        {
          cwd: base,
          dot: true,
          onlyFiles: false,
          // AIDEV-NOTE: matched literally, symlinks not followed: what Bun.Glob did before this ran on Node too.
          expandDirectories: false,
          followSymbolicLinks: false,
        },
      )) {
        const match = entry.replace(/\/+$/, "");
        const path = relative(worktree, resolve(base, match));
        if (path === "" || path.startsWith("..") || isAbsolute(path) || basename(match) === ".git") {
          continue;
        }
        if (git(base, ["--literal-pathspecs", "ls-files", "--", match]).trim() === "") {
          found.push({ base, match, path });
        }
      }
    }
  }
  return found;
};

/**
 * Deletes every path below `worktree` that `findRemovable` reports. Returns the removed paths relative to `worktree`.
 *
 * Specification: openspec/specs/variant-api/node-runtime/spec.md (Implode cleanup patterns on both runtimes)
 */
export const removeMatching = (
  worktree: string,
  bases: readonly string[],
  patterns: readonly string[],
  slug: string,
  environment?: () => NodeJS.ProcessEnv,
): string[] => {
  const removed: string[] = [];
  for (const { base, match, path } of findRemovable(worktree, bases, patterns, slug, environment)) {
    if (existsSync(join(base, match))) {
      rmSync(join(base, match), { recursive: true, force: true });
      removed.push(path);
    }
  }
  return removed;
};

const TRACE_YELLOW = "\x1b[33m";
const TRACE_RESET = "\x1b[0m";

/** `git -c color.ui=never` so a user's `color.ui=always` cannot paint captured output. The `-c` is not part of the trace. */
const plainGit = (worktree: string, args: readonly string[]): string =>
  git(worktree, ["-c", "color.ui=never", ...args]);

const droppedHeader = (line: string): boolean =>
  line.startsWith("diff --git ") || /^index [0-9a-f]+\.\.[0-9a-f]+ /.test(line) || line.startsWith("--- ");

/** Drops `diff --git`, `index <hex>..<hex>`, and `--- ` lines wherever they sit. Keeps the trailing newline. */
const filterPatch = (patch: string): { text: string; lines: number } => {
  if (patch === "") {
    return { text: "", lines: 0 };
  }
  const trailingNewline = patch.endsWith("\n");
  const kept = (trailingNewline ? patch.slice(0, -1) : patch).split("\n").filter((line) => !droppedHeader(line));
  if (kept.length === 0) {
    return { text: "", lines: 0 };
  }
  return { text: `${kept.join("\n")}${trailingNewline ? "\n" : ""}`, lines: kept.length };
};

/** A path with whitespace is quoted so the traced command is still one shell word. */
const tracePath = (path: string): string =>
  /\s/.test(path) ? `"${path.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"` : path;

const traced = (command: string, output: string): string =>
  output === "" ? "" : `\n${TRACE_YELLOW}+ ${command}${TRACE_RESET}\n${output}`;

/** Added hunk lines are green and removed hunk lines are red. `+++` and context stay plain. */
const colorHunk = (text: string): string => {
  const trailingNewline = text.endsWith("\n");
  const body = trailingNewline ? text.slice(0, -1) : text;
  const colored = body
    .split("\n")
    .map((line) => {
      if (line.startsWith("+++") || line.startsWith("---")) {
        return line;
      }
      if (line.startsWith("+")) {
        return `\x1b[32m${line}\x1b[0m`;
      }
      if (line.startsWith("-")) {
        return `\x1b[31m${line}\x1b[0m`;
      }
      return line;
    })
    .join("\n");
  return trailingNewline ? `${colored}\n` : colored;
};

/**
 * What would be lost with the worktree: a dark-yellow trace of `git status --porcelain`, `git diff --stat`, and, when
 * the kept patch lines fit in `maxDiffLines`, one filtered `git diff -U1` per path.
 *
 * Specification: openspec/specs/variant-api/implode/spec.md
 */
export const worktreeReport = (worktree: string, maxDiffLines: number): string => {
  const status = plainGit(worktree, ["status", "--porcelain"]);
  const stat = plainGit(worktree, ["diff", "--stat"]);
  const names = plainGit(worktree, ["diff", "-z", "--name-only"])
    .split("\0")
    .filter((name) => name !== "");
  const patches = names.map((name) => {
    const filtered = filterPatch(plainGit(worktree, ["diff", "-U1", "--", name]));
    return { command: `git diff -U1 ${tracePath(name)}`, ...filtered };
  });
  const keptLines = patches.reduce((total, patch) => total + patch.lines, 0);
  const shown = keptLines <= maxDiffLines ? patches : [];
  return [
    traced("git status --porcelain", status),
    traced("git diff --stat", stat),
    ...shown.map((patch) => traced(patch.command, colorHunk(patch.text))),
  ].join("");
};

/** Discards the local modifications of tracked files whose base name is in `names`. */
export const restoreTracked = (worktree: string, names: readonly string[]): string[] => {
  const modified = git(worktree, ["ls-files", "-m"])
    .split("\n")
    .filter((file) => file !== "" && names.includes(basename(file)));
  if (modified.length > 0) {
    git(worktree, ["checkout", "--", ...modified]);
  }
  return modified;
};

/** Whether `HEAD` of `worktree` is contained in `origin/<base>`, or in `<base>` when there is no such remote branch. */
export const isMerged = (worktree: string, base: string): { merged: boolean; into: string } => {
  const remote = `origin/${base}`;
  const into = runGit(worktree, ["rev-parse", "--verify", "--quiet", `refs/remotes/${remote}`]).ok ? remote : base;
  return { merged: runGit(worktree, ["merge-base", "--is-ancestor", "HEAD", into]).ok, into };
};

/** Removes the worktree from git; `force` also removes one with local changes. */
export const removeWorktree = (primary: string, worktree: string, force: boolean): void => {
  git(primary, ["worktree", "remove", ...(force ? ["--force"] : []), worktree]);
};
