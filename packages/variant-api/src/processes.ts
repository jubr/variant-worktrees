import { execFileSync } from "node:child_process";
import { readlinkSync, realpathSync } from "node:fs";
import { isAbsolute, relative } from "node:path";
import { isProcessAlive } from "./runtime-state.js";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** The working directory of a process, where the system reports it (`/proc`, else `lsof`). */
export const processCwd = (pid: number): string | undefined => {
  try {
    return readlinkSync(`/proc/${pid}/cwd`);
  } catch {
    // no /proc here
  }
  try {
    const output = execFileSync("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return output
      .split("\n")
      .find((line) => line.startsWith("n"))
      ?.slice(1);
  } catch {
    return undefined;
  }
};

const realpathOrSelf = (path: string): string => {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};

/**
 * Whether a recorded pid may be signalled for the variant in `worktree`: it is alive and, where the system reports its
 * working directory, that directory is the worktree or below it. A reused pid of an unrelated process is left alone.
 */
export const ownedByWorktree = (pid: number, worktree: string): boolean => {
  if (!isProcessAlive(pid)) {
    return false;
  }
  const cwd = processCwd(pid);
  if (cwd === undefined) {
    return true;
  }
  const path = relative(realpathOrSelf(worktree), realpathOrSelf(cwd));
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
};

/** The pids of all descendants of `pid`, deepest last. */
const descendants = (pid: number): number[] => {
  let table: string;
  try {
    table = execFileSync("ps", ["-A", "-o", "pid=,ppid="], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return [];
  }
  const children = new Map<number, number[]>();
  for (const line of table.split("\n")) {
    const [child, parent] = line.trim().split(/\s+/).map(Number);
    if (child !== undefined && parent !== undefined && !Number.isNaN(child) && !Number.isNaN(parent)) {
      children.set(parent, [...(children.get(parent) ?? []), child]);
    }
  }
  const found: number[] = [];
  const queue = [pid];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    for (const child of children.get(next) ?? []) {
      found.push(child);
      queue.push(child);
    }
  }
  return found;
};

const signal = (pid: number, name: NodeJS.Signals, group: boolean): void => {
  try {
    process.kill(group ? -pid : pid, name);
  } catch {
    // already gone, or not ours to signal
  }
};

/**
 * Ends a process with everything it started: SIGTERM to its process group and to each descendant, then SIGKILL to what is
 * still running after `graceMs`. Resolves when none of them is left.
 */
export const stopProcessTree = async (pid: number, graceMs = 5000): Promise<void> => {
  const everyone = [pid, ...descendants(pid)];
  signal(pid, "SIGTERM", true);
  for (const target of everyone) {
    signal(target, "SIGTERM", false);
  }
  const deadline = Date.now() + graceMs;
  while (everyone.some(isProcessAlive) && Date.now() < deadline) {
    await sleep(50);
  }
  for (const target of everyone.filter(isProcessAlive)) {
    signal(target, "SIGKILL", false);
  }
  signal(pid, "SIGKILL", true);
  for (let attempt = 0; attempt < 40 && everyone.some(isProcessAlive); attempt += 1) {
    await sleep(50);
  }
};
