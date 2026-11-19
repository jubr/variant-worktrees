import { afterEach, describe, expect, it } from "bun:test";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isProcessAlive } from "../runtime-state.js";
import { projectPids, stopProjectProcesses } from "./project-processes.js";

// Specification: openspec/specs/meta/local-checks/spec.md

const directories: string[] = [];
const spawned: number[] = [];

afterEach(() => {
  for (const pid of spawned.splice(0)) {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      // already gone
    }
  }
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

const project = (): string => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), "variant-watch-project-")));
  directories.push(directory);
  mkdirSync(join(directory, "fe"));
  mkdirSync(join(directory, "be"));
  return directory;
};

/** An idle process in its own process group that records its pid in `<directory>/<who>/started-<who>.txt`. */
const idle = (directory: string, who: string): number => {
  const script = `require("node:fs").writeFileSync("started-${who}.txt", String(process.pid)); setInterval(() => {}, 1000);`;
  const child = spawn(process.execPath, ["-e", script], { cwd: join(directory, who), detached: true, stdio: "ignore" });
  child.unref();
  const pid = child.pid as number;
  spawned.push(pid);
  return pid;
};

const waitForMarkers = async (directory: string, who: string[]): Promise<void> => {
  const written = (name: string): boolean => {
    try {
      return readFileSync(join(directory, name, `started-${name}.txt`), "utf8") !== "";
    } catch {
      return false;
    }
  };
  for (const deadline = Date.now() + 5000; Date.now() < deadline; await Bun.sleep(20)) {
    if (who.every(written)) {
      return;
    }
  }
  throw new Error("markers not written");
};

describe("project processes", () => {
  it("stops the processes of every watch of a project, not only the first", async () => {
    const directory = project();
    const be = idle(directory, "be");
    const fe = idle(directory, "fe");
    await waitForMarkers(directory, ["be", "fe"]);

    const stopped = stopProjectProcesses([directory]);
    await Bun.sleep(100);

    expect(stopped.sort()).toEqual([be, fe].sort());
    expect(isProcessAlive(be)).toBe(false);
    expect(isProcessAlive(fe)).toBe(false);
  });

  it("removes the project directory", async () => {
    const directory = project();
    idle(directory, "fe");
    await waitForMarkers(directory, ["fe"]);

    stopProjectProcesses([directory]);

    expect(await Bun.file(join(directory, "fe", "started-fe.txt")).exists()).toBe(false);
  });

  it("ignores a project without markers or with a stale or empty marker", () => {
    const directory = project();
    writeFileSync(join(directory, "be", "started-be.txt"), "");
    writeFileSync(join(directory, "fe", "started-fe.txt"), "999999999");

    expect(() => stopProjectProcesses([directory, join(directory, "gone")])).not.toThrow();
  });

  it("never stops the test run itself, even when the runtime state names it", () => {
    const directory = project();
    writeFileSync(
      join(directory, "variants.local.yaml"),
      `runtime:\n  watches:\n    fe: { pid: ${process.pid} }\n    be: { pid: ${process.ppid} }\n`,
    );

    expect(projectPids(directory)).toEqual([]);
    expect(stopProjectProcesses([directory])).toEqual([]);
    expect(isProcessAlive(process.pid)).toBe(true);
  });
});
