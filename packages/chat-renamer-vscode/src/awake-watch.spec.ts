import { describe, expect, it } from "bun:test";

import { createActivityWatch } from "./awake-watch";

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
