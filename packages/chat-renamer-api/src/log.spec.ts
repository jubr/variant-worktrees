import { describe, expect, it } from "bun:test";

import { createLogger, type LogSink, lineSink, silentLogger } from "./log";

type Entry = { level: string; message: string };

const collect = (): { entries: Entry[]; sink: LogSink } => {
  const entries: Entry[] = [];
  const at = (level: string) => (message: string) => {
    entries.push({ level, message });
  };
  return {
    entries,
    sink: { trace: at("trace"), debug: at("debug"), info: at("info"), warn: at("warn"), error: at("error") },
  };
};

describe("createLogger", () => {
  it("passes each level to the matching sink method without timestamp or level text", () => {
    const { entries, sink } = collect();
    const log = createLogger(sink);

    log.trace("t");
    log.debug("d");
    log.info("i");
    log.warn("w");
    log.error("e");

    expect(entries).toEqual([
      { level: "trace", message: "t" },
      { level: "debug", message: "d" },
      { level: "info", message: "i" },
      { level: "warn", message: "w" },
      { level: "error", message: "e" },
    ]);
  });

  it("prefixes the category of a child and joins nested categories with a dot", () => {
    const { entries, sink } = collect();
    const log = createLogger(sink);

    log.child("title-event").info("decision");
    log.child("a").child("b").debug("deep");

    expect(entries).toEqual([
      { level: "info", message: "[title-event] decision" },
      { level: "debug", message: "[a.b] deep" },
    ]);
  });

  it("renders fields as key=value in call order, JSON for strings, objects and arrays", () => {
    const { entries, sink } = collect();
    const log = createLogger(sink);

    log.info("decision", {
      session: "abc-1",
      matched: true,
      pattern: 2,
      title: "two words",
      tags: ["a", "b"],
      none: null,
    });

    expect(entries[0]?.message).toBe(
      'decision session="abc-1" matched=true pattern=2 title="two words" tags=["a","b"] none=null',
    );
  });

  it("drops undefined fields", () => {
    const { entries, sink } = collect();

    createLogger(sink).info("x", { a: 1, b: undefined });

    expect(entries[0]?.message).toBe("x a=1");
  });

  it("formats errors with their message, then fields", () => {
    const { entries, sink } = collect();
    const log = createLogger(sink);

    log.error("rename failed", new Error("gate closed"));
    log.error("rename failed", "plain text");
    log.error("rename failed", new Error("gate closed"), { session: "s1" });
    log.error("rename failed", undefined, { session: "s1" });

    expect(entries.map((entry) => entry.message)).toEqual([
      "rename failed: gate closed",
      "rename failed: plain text",
      'rename failed: gate closed session="s1"',
      'rename failed session="s1"',
    ]);
  });
});

describe("lineSink", () => {
  const fixedNow = () => new Date("2026-10-09T15:04:05.678Z");

  it("writes one timestamped line per message with the level", () => {
    const lines: string[] = [];
    const log = createLogger(lineSink((line) => lines.push(line), fixedNow));

    log.trace("prompt");
    log.info("hook installed");
    log.warn("could not clean");
    log.error("rename failed", new Error("gate closed"));

    expect(lines).toEqual([
      "2026-10-09T15:04:05.678Z TRACE prompt",
      "2026-10-09T15:04:05.678Z INFO  hook installed",
      "2026-10-09T15:04:05.678Z WARN  could not clean",
      "2026-10-09T15:04:05.678Z ERROR rename failed: gate closed",
    ]);
  });
});

describe("silentLogger", () => {
  it("never throws and its children are silent too", () => {
    expect(() => {
      silentLogger.trace("x");
      silentLogger.debug("x");
      silentLogger.info("x", { a: 1 });
      silentLogger.warn("x");
      silentLogger.error("x", new Error("y"));
      silentLogger.child("c").info("x");
    }).not.toThrow();
  });
});
