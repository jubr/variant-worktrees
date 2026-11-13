import { describe, expect, it } from "bun:test";
import { createLogger, type Description, type LogSink } from "chat-renamer-api";

import { RETRIEVAL_EXTENSION_ID, startTurnWatch, type TurnRef, type TurnWatchDeps } from "./turn-watcher";

type Entry = { level: string; message: string };

const logger = () => {
  const entries: Entry[] = [];
  const sink: LogSink = {
    trace: (message) => entries.push({ level: "trace", message }),
    debug: (message) => entries.push({ level: "debug", message }),
    info: (message) => entries.push({ level: "info", message }),
    warn: (message) => entries.push({ level: "warn", message }),
    error: (message) => entries.push({ level: "error", message }),
  };
  return { log: createLogger(sink), entries };
};

const identity = (value: string, builtin: boolean, proposals: string[]): Description => ({
  identifier: { value, _lower: value.toLowerCase() },
  isBuiltin: builtin,
  enabledApiProposals: proposals,
});

const fakeWatcher = () => {
  const starts = new Set<(event: TurnRef) => void>();
  const ends = new Set<(event: TurnRef) => void>();
  return {
    watcher: {
      onDidStartTurn: (listener: (event: TurnRef) => void) => {
        starts.add(listener);
        return { dispose: () => starts.delete(listener) };
      },
      onDidEndTurn: (listener: (event: TurnRef) => void) => {
        ends.add(listener);
        return { dispose: () => ends.delete(listener) };
      },
      dispose: () => {
        starts.clear();
        ends.clear();
      },
    },
    start: (event: TurnRef) => {
      for (const listener of starts) listener(event);
    },
    end: (event: TurnRef) => {
      for (const listener of ends) listener(event);
    },
  };
};

const turn = { sessionId: "sess-1", turnId: "turn-1" };

describe("startTurnWatch", () => {
  it("traces start and end only when awake.agentHostEvents is enabled", () => {
    const enabled = logger();
    const on = fakeWatcher();
    const categories = ["awake.agentHostEvents"];
    const watch = startTurnWatch({
      mine: identity("jubr.chat-renamer", false, []),
      donor: identity(RETRIEVAL_EXTENSION_ID, true, ["cursorAgentHost"]),
      create: () => on.watcher,
      log: enabled.log,
      highVolumeCategories: () => categories,
    });
    on.start(turn);
    on.end(turn);
    const traces = enabled.entries.filter((entry) => entry.level === "trace").map((entry) => entry.message);
    expect(
      traces.some(
        (line) =>
          line.includes("[awake]") && line.includes("sess-1") && line.includes("turn-1") && line.includes("start"),
      ),
    ).toBe(true);
    expect(
      traces.some(
        (line) =>
          line.includes("[awake]") && line.includes("sess-1") && line.includes("turn-1") && line.includes("end"),
      ),
    ).toBe(true);
    expect(enabled.entries.some((entry) => entry.level === "info" && entry.message.includes("sess-1"))).toBe(false);
    watch.dispose();

    const quiet = logger();
    const off = fakeWatcher();
    startTurnWatch({
      mine: identity("jubr.chat-renamer", false, []),
      donor: identity(RETRIEVAL_EXTENSION_ID, true, ["cursorAgentHost"]),
      create: () => off.watcher,
      log: quiet.log,
      highVolumeCategories: () => [],
    });
    off.start(turn);
    off.end(turn);
    expect(quiet.entries).toEqual([]);
  });

  it("holds the sample from a turn start until the poll is idle, and clears that set on dispose", () => {
    const { log } = logger();
    const fake = fakeWatcher();
    const watch = startTurnWatch({
      mine: identity("jubr.chat-renamer", false, []),
      donor: identity(RETRIEVAL_EXTENSION_ID, true, ["cursorAgentHost"]),
      create: () => fake.watcher,
      log,
      highVolumeCategories: () => [],
    });

    expect(watch.active()).toBe(false);
    fake.start(turn);
    expect(watch.active()).toBe(true);
    watch.setPollActive(true);
    fake.end(turn);
    expect(watch.active()).toBe(true);
    watch.setPollActive(false);
    expect(watch.active()).toBe(false);

    fake.start(turn);
    watch.dispose();
    expect(watch.active()).toBe(false);
    fake.end(turn);
    expect(watch.active()).toBe(false);
  });

  it("borrows cursor-retrieval only for the create call and stays on the poll when create throws", () => {
    const mine = identity("jubr.chat-renamer", false, []);
    const donor = identity(RETRIEVAL_EXTENSION_ID, true, ["cursorAgentHost"]);
    const seen: { value?: string; builtin?: boolean } = {};
    const { log } = logger();
    const deps = (create: TurnWatchDeps["create"]): TurnWatchDeps => ({
      mine,
      donor,
      create,
      log,
      highVolumeCategories: () => [],
    });

    const created = startTurnWatch(
      deps(() => {
        const identifier = mine.identifier as { value?: string };
        seen.value = identifier.value;
        seen.builtin = mine.isBuiltin;
        return fakeWatcher().watcher;
      }),
    );
    expect(created.created).toBe(true);
    expect(seen).toEqual({ value: RETRIEVAL_EXTENSION_ID, builtin: true });
    expect(mine.isBuiltin).toBe(false);
    expect((mine.identifier as { value?: string }).value).toBe("jubr.chat-renamer");

    const failed = startTurnWatch(
      deps(() => {
        throw new Error("create failed");
      }),
    );
    expect(failed.created).toBe(false);
    expect(mine.isBuiltin).toBe(false);
    failed.setPollActive(true);
    expect(failed.active()).toBe(true);
    failed.setPollActive(false);
    expect(failed.active()).toBe(false);
  });
});
