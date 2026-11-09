import { afterEach, describe, expect, it } from "bun:test";
import { type ChildProcess, spawn } from "node:child_process";
import { parseElapsed, processUptimeSeconds } from "./uptime.js";

const children: ChildProcess[] = [];
afterEach(() => {
  for (const child of children.splice(0)) {
    child.kill("SIGKILL");
  }
});

describe("parseElapsed", () => {
  it("reads mm:ss", () => {
    expect(parseElapsed("05:09")).toBe(309);
  });

  it("reads hh:mm:ss with padding around it", () => {
    expect(parseElapsed("  02:05:00\n")).toBe(7500);
  });

  it("reads dd-hh:mm:ss", () => {
    expect(parseElapsed("3-01:00:01")).toBe(3 * 86400 + 3600 + 1);
  });

  it("reads plain seconds", () => {
    expect(parseElapsed("42")).toBe(42);
  });

  it("gives nothing for text that is not a duration", () => {
    expect(parseElapsed("")).toBeUndefined();
    expect(parseElapsed("abc")).toBeUndefined();
  });
});

describe("processUptimeSeconds", () => {
  it("is the time a running process has been up", () => {
    const child = spawn("sleep", ["30"], { stdio: "ignore" });
    children.push(child);

    const seconds = processUptimeSeconds(child.pid as number);

    expect(seconds).toBeGreaterThanOrEqual(0);
    expect(seconds).toBeLessThan(10);
  });

  it("is nothing for a process that does not exist", () => {
    expect(processUptimeSeconds(2147483000)).toBeUndefined();
  });
});
