import { describe, expect, it } from "bun:test";
import { LOG_LEVELS, type LogEvent, LogLevel, log, logD, logE, logI, logT, logW, setLogSink } from "./index.js";

describe("level enum", () => {
  it("exposes one enum of the five levels in order", () => {
    expect([LogLevel.trace, LogLevel.debug, LogLevel.info, LogLevel.warn, LogLevel.error]).toEqual([
      "trace",
      "debug",
      "info",
      "warn",
      "error",
    ]);
    expect(Object.values(LogLevel)).toEqual(["trace", "debug", "info", "warn", "error"]);
    expect(LOG_LEVELS).toEqual([LogLevel.trace, LogLevel.debug, LogLevel.info, LogLevel.warn, LogLevel.error]);
  });

  it("emits the info member from the info shorthand", () => {
    const events: LogEvent[] = [];
    setLogSink((event) => {
      events.push(event);
    });
    try {
      logI("ready");
    } finally {
      setLogSink(undefined);
    }
    expect(events[0]?.level).toBe(LogLevel.info);
  });
});

describe("shared log event", () => {
  it("delivers step and slug as fields and keeps them out of the message", () => {
    const events: LogEvent[] = [];
    setLogSink((event) => {
      events.push(event);
    });
    try {
      log(LogLevel.info, "+ mise install", { step: "create", slug: "add-auth" });
    } finally {
      setLogSink(undefined);
    }

    expect(events).toEqual([{ level: "info", message: "+ mise install", step: "create", slug: "add-auth" }]);
    expect(events[0]?.message).not.toContain("[create]");
    expect(events[0]?.message).not.toContain("[add-auth]");
  });

  it("delivers info from the info shorthand", () => {
    const events: LogEvent[] = [];
    setLogSink((event) => {
      events.push(event);
    });
    try {
      logI("ready", { slug: "demo" });
    } finally {
      setLogSink(undefined);
    }

    expect(events).toEqual([{ level: "info", message: "ready", slug: "demo" }]);
  });

  it("does not throw or write standard output when the warn shorthand has no host", () => {
    setLogSink(undefined);
    const writes: string[] = [];
    const original = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
    try {
      expect(() => logW("database down")).not.toThrow();
    } finally {
      process.stdout.write = original;
    }
    expect(writes).toEqual([]);
  });

  it("delivers error and step when the caller chooses the level", () => {
    const events: LogEvent[] = [];
    setLogSink((event) => {
      events.push(event);
    });
    try {
      log(LogLevel.error, "socket already listening", { step: "listen" });
    } finally {
      setLogSink(undefined);
    }

    expect(events).toEqual([{ level: "error", message: "socket already listening", step: "listen" }]);
  });

  it("delivers trace from the trace shorthand", () => {
    const events: LogEvent[] = [];
    setLogSink((event) => {
      events.push(event);
    });
    try {
      logT("enter");
    } finally {
      setLogSink(undefined);
    }

    expect(events).toEqual([{ level: "trace", message: "enter" }]);
  });

  it("delivers debug from the debug shorthand", () => {
    const events: LogEvent[] = [];
    setLogSink((event) => {
      events.push(event);
    });
    try {
      logD("branch");
    } finally {
      setLogSink(undefined);
    }

    expect(events).toEqual([{ level: "debug", message: "branch" }]);
  });

  it("delivers error from the error shorthand", () => {
    const events: LogEvent[] = [];
    setLogSink((event) => {
      events.push(event);
    });
    try {
      logE("failed");
    } finally {
      setLogSink(undefined);
    }

    expect(events).toEqual([{ level: "error", message: "failed" }]);
  });
});
