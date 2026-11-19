import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { until, WAIT_MS } from "./wait.js";

// Specification: openspec/specs/meta/local-checks/spec.md

describe("test waits", () => {
  it("fails naming the condition when it does not hold in time", async () => {
    const started = Date.now();

    await expect(until(() => false, 80, "the watch is ready")).rejects.toThrow("the watch is ready");

    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("returns as soon as the condition holds", async () => {
    let calls = 0;

    await until(() => ++calls === 3, 1000);

    expect(calls).toBe(3);
  });

  it("gives up before the test timeout of the package", () => {
    const { scripts } = JSON.parse(readFileSync(join(import.meta.dir, "../..", "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const timeout = Number(/--timeout[ =](\d+)/.exec(scripts.test ?? "")?.[1]);

    expect(timeout).toBeGreaterThan(WAIT_MS);
  });
});
