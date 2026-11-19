import { afterEach, describe, expect, it } from "bun:test";
import { spawn } from "node:child_process";
import { closeSync, mkdirSync, mkdtempSync, openSync, realpathSync, rmSync } from "node:fs";
import { join } from "node:path";
import { type LogEvent, setLogSink } from "./log.js";
import { isProcessAlive } from "./runtime-state.js";
import { cleanupVanishedWorktree, survivingDirectory, worktreeGone, worktreeIdentity } from "./watch-cleanup.js";

const directories: string[] = [];
const sleepers: number[] = [];
afterEach(() => {
  setLogSink(undefined);
  for (const pid of sleepers.splice(0)) {
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

const temporary = (): string => {
  const directory = realpathSync(mkdtempSync(join("/tmp", "variant-cleanup-")));
  directories.push(directory);
  return directory;
};

const sleeper = async (): Promise<number> => {
  const child = spawn("sleep", ["300"], { detached: true, stdio: "ignore" });
  const pid = child.pid as number;
  sleepers.push(pid);
  for (let attempt = 0; attempt < 100 && !isProcessAlive(pid); attempt += 1) {
    await new Promise((done) => setTimeout(done, 20));
  }
  return pid;
};

const capture = (): LogEvent[] => {
  const events: LogEvent[] = [];
  setLogSink((event) => events.push(event));
  return events;
};

describe("worktree identity", () => {
  it("is gone when the directory does not exist", () => {
    const parent = temporary();
    const worktree = join(parent, "_v-demo");
    mkdirSync(worktree);
    const identity = worktreeIdentity(worktree);
    expect(worktreeGone(worktree, identity)).toBe(false);

    rmSync(worktree, { recursive: true });

    expect(worktreeGone(worktree, identity)).toBe(true);
  });

  it("is gone when another directory stands at the path", () => {
    const parent = temporary();
    const worktree = join(parent, "_v-demo");
    mkdirSync(worktree);
    const identity = worktreeIdentity(worktree);
    // AIDEV-NOTE: an open handle keeps the removed inode allocated, so the new directory cannot reuse its number.
    const hold = openSync(worktree, "r");
    try {
      rmSync(worktree, { recursive: true });
      mkdirSync(join(worktree, ".cache"), { recursive: true });

      expect(worktreeGone(worktree, identity)).toBe(true);
    } finally {
      closeSync(hold);
    }
  });

  it("is not gone when the directory was never identified and still exists", () => {
    const parent = temporary();

    expect(worktreeGone(parent, undefined)).toBe(false);
  });
});

describe("surviving directory", () => {
  it("is the first candidate that exists and is not the vanished path", () => {
    const parent = temporary();
    const worktree = join(parent, "_v-demo");
    mkdirSync(worktree);

    expect(survivingDirectory([join(parent, "missing"), worktree, parent], worktree)).toBe(parent);
  });
});

describe("cleanup of a vanished worktree", () => {
  const request = (overrides: Partial<Parameters<typeof cleanupVanishedWorktree>[0]> = {}) => ({
    slug: "demo",
    worktree: "/work/_v-demo",
    directory: "/work/app",
    processes: [] as { key: string; pid: number }[],
    silence: () => {},
    implode: async () => ({}),
    ...overrides,
  });

  it("silences the writers before it stops a process or implodes", async () => {
    const order: string[] = [];
    const pid = await sleeper();

    await cleanupVanishedWorktree(
      request({
        processes: [{ key: "fe", pid }],
        silence: () => order.push(isProcessAlive(pid) ? "silence while running" : "silence after stop"),
        implode: async () => {
          order.push(isProcessAlive(pid) ? "implode while running" : "implode after stop");
          return {};
        },
      }),
    );

    expect(order).toEqual(["silence while running", "implode after stop"]);
    expect(isProcessAlive(pid)).toBe(false);
  });

  it("implodes with the branch kept", async () => {
    let received: { branchRm?: string } = {};

    await cleanupVanishedWorktree(
      request({
        implode: async (options) => {
          received = options;
          return {};
        },
      }),
    );

    expect(received.branchRm).toBe("no");
  });

  it("only stops the processes of main", async () => {
    let imploded = false;
    const pid = await sleeper();

    await cleanupVanishedWorktree(
      request({
        slug: "main",
        processes: [{ key: "fe", pid }],
        implode: async () => {
          imploded = true;
          return {};
        },
      }),
    );

    expect(imploded).toBe(false);
    expect(isProcessAlive(pid)).toBe(false);
  });

  it("emits one warn that the worktree is gone and the rest at debug, before each action", async () => {
    const events = capture();
    const pid = await sleeper();
    const seen: string[] = [];

    await cleanupVanishedWorktree(
      request({
        processes: [{ key: "fe", pid }],
        implode: async ({ announce }) => {
          seen.push(...events.map((event) => event.message));
          announce("removing state file /work/.cache/variants/demo.yaml");
          announce("git worktree prune");
          return {};
        },
      }),
    );

    const messages = events.map((event) => event.message);
    expect(messages[0]).toContain("/work/_v-demo");
    expect(messages[1]).toBe(`stopping watch fe pid ${pid}`);
    expect(messages).toContain("removing state file /work/.cache/variants/demo.yaml");
    expect(messages.indexOf("git worktree prune")).toBeGreaterThan(messages.indexOf(`stopping watch fe pid ${pid}`));
    expect(seen).toContain(`stopping watch fe pid ${pid}`);
    expect(events.map((event) => event.level)).toEqual(events.map((_, index) => (index === 0 ? "warn" : "debug")));
    for (const event of events) {
      expect(event).toMatchObject({ step: "watch-cleanup", slug: "demo" });
    }
  });

  it("emits one warn and debug events when the project directory is not a known temporary directory", async () => {
    const events = capture();

    await cleanupVanishedWorktree(request({ directory: "/work/app", slug: "main" }));

    expect(events.filter((event) => event.level === "warn")).toHaveLength(1);
    expect(events.filter((event) => event.level === "debug").length).toBeGreaterThan(0);
  });

  it("emits trace under a temporary directory", async () => {
    const events = capture();

    await cleanupVanishedWorktree(request({ directory: "/tmp/variant-app" }));

    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(event.level).toBe("trace");
    }
  });

  it("reports a failed implode and still returns", async () => {
    const events = capture();

    await cleanupVanishedWorktree(
      request({
        implode: async () => {
          throw new Error("boom");
        },
      }),
    );

    expect(events.map((event) => event.message)).toContain("implode failed: boom");
    expect(events.find((event) => event.message === "implode failed: boom")?.level).toBe("warn");
  });
});
