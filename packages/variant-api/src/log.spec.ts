import { describe, expect, it } from "bun:test";
import { type LogEvent, LogLevel, log, setLogSink } from "./log.js";

describe("log levels", () => {
  it("delivers trace, debug, info, warn, and error to the attached host", () => {
    const events: LogEvent[] = [];
    setLogSink((event) => {
      events.push(event);
    });
    try {
      log(LogLevel.trace, "enter");
      log(LogLevel.debug, "branch");
      log(LogLevel.info, "ready");
      log(LogLevel.warn, "degraded");
      log(LogLevel.error, "failed");
    } finally {
      setLogSink(undefined);
    }

    expect(events).toEqual([
      { level: "trace", message: "enter" },
      { level: "debug", message: "branch" },
      { level: "info", message: "ready" },
      { level: "warn", message: "degraded" },
      { level: "error", message: "failed" },
    ]);
  });

  it("does not throw or write standard output when no host is attached", () => {
    setLogSink(undefined);
    const writes: string[] = [];
    const original = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
    try {
      expect(() => log(LogLevel.warn, "database down")).not.toThrow();
    } finally {
      process.stdout.write = original;
    }
    expect(writes).toEqual([]);
  });
});
