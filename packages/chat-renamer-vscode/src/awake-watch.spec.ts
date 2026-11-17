import { describe, expect, it } from "bun:test";

import { createActivityWatch, spawnCaffeinate } from "./awake-watch";

describe("createActivityWatch", () => {
  it("reports a generating session and stays quiet when polling is off", async () => {
    let polling = true;
    let generating = true;
    const reads: number[] = [];
    const timers: Array<{ run: () => void; cancelled: boolean }> = [];
    const watch = createActivityWatch({
      read: async () => {
        reads.push(1);
        return generating;
      },
      everyMs: 1000,
      shouldPoll: () => polling,
      schedule: (_ms, run) => {
        const timer = { run, cancelled: false };
        timers.push(timer);
        return {
          cancel: () => {
            timer.cancelled = true;
          },
        };
      },
    });

    expect(await watch.sync()).toBe(true);
    expect(reads).toHaveLength(1);
    expect(timers).toHaveLength(1);

    generating = false;
    timers[0]?.run();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(reads).toHaveLength(2);

    polling = false;
    expect(await watch.sync()).toBe(false);
    expect(reads).toHaveLength(2);
    watch.dispose();
  });
});

// openspec/specs/chat-renamer/awake/spec.md
describe("spawnCaffeinate", () => {
  it("reports a program that cannot be executed through once('error') instead of throwing", async () => {
    const child = spawnCaffeinate(["/nonexistent/keep-awake", "--pid", "5151"]);

    const error = await new Promise<Error | undefined>((resolve) => child.once("error", resolve));

    expect(error?.message).toContain("/nonexistent/keep-awake");
  });

  it("reports a process that ends through once('exit')", async () => {
    const child = spawnCaffeinate([process.execPath, "-e", "process.exit(0)"]);

    await new Promise<void>((resolve) => child.once("exit", () => resolve()));

    expect(child.pid).toBeGreaterThan(0);
  });

  it("still throws for an empty command", () => {
    expect(() => spawnCaffeinate([])).toThrow("awake command is empty");
  });
});
