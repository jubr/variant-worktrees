import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { readRuntime } from "variant-config";

const markerPid = (path: string): number | undefined => {
  try {
    const pid = Number(readFileSync(path, "utf8"));
    return Number.isInteger(pid) && pid > 1 ? pid : undefined;
  } catch {
    return undefined;
  }
};

/**
 * The pids of the processes a test project started: the `started-*.txt` marker its watch scripts write into
 * their directory, and the pids in the runtime state of the project.
 */
export const projectPids = (directory: string): number[] => {
  const pids = new Set<number>();
  if (!existsSync(directory)) {
    return [];
  }
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    for (const file of readdirSync(join(directory, entry.name))) {
      const pid = /^started-.+\.txt$/.test(file) ? markerPid(join(directory, entry.name, file)) : undefined;
      if (pid !== undefined) {
        pids.add(pid);
      }
    }
  }
  try {
    for (const watch of Object.values(readRuntime(directory)?.watches ?? {})) {
      if (watch.pid !== undefined && watch.pid > 1) {
        pids.add(watch.pid);
      }
    }
  } catch {
    // no runtime state, or not readable
  }
  // AIDEV-NOTE: The runtime state of an attached watch can name the test run itself; killing its group ends `bun test`.
  pids.delete(process.pid);
  pids.delete(process.ppid);
  return [...pids];
};

/** Stops every process of the given test project directories, removes them, and returns the pids it found. */
export const stopProjectProcesses = (directories: readonly string[]): number[] => {
  const stopped: number[] = [];
  for (const directory of directories) {
    for (const pid of projectPids(directory)) {
      for (const target of [-pid, pid]) {
        try {
          process.kill(target, "SIGKILL");
        } catch {
          // already gone, or not a group leader
        }
      }
      stopped.push(pid);
    }
    rmSync(directory, { recursive: true, force: true });
  }
  return stopped;
};
