import { describe, expect, it } from "bun:test";

import { createLogger, silentLogger } from "./log";

describe("createLogger", () => {
  const fixedNow = () => new Date("2026-10-09T15:04:05.678Z");

  it("writes one timestamped line per message with the level", () => {
    const lines: string[] = [];
    const log = createLogger({ appendLine: (line) => lines.push(line) }, fixedNow);

    log.info("hook installed");
    log.warn("could not clean");
    log.error("rename failed");

    expect(lines).toEqual([
      "2026-10-09T15:04:05.678Z INFO  hook installed",
      "2026-10-09T15:04:05.678Z WARN  could not clean",
      "2026-10-09T15:04:05.678Z ERROR rename failed",
    ]);
  });

  it("formats errors with their message", () => {
    const lines: string[] = [];
    const log = createLogger({ appendLine: (line) => lines.push(line) }, fixedNow);

    log.error("rename failed", new Error("gate closed"));
    log.error("rename failed", "plain text");

    expect(lines[0]).toEndWith("ERROR rename failed: gate closed");
    expect(lines[1]).toEndWith("ERROR rename failed: plain text");
  });

  it("has a silent logger that never throws", () => {
    expect(() => {
      silentLogger.info("x");
      silentLogger.warn("x");
      silentLogger.error("x", new Error("y"));
    }).not.toThrow();
  });
});
