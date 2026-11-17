import { describe, expect, it } from "bun:test";
import { DEFAULT_AWAKE_CMD } from "chat-renamer-config";
import { listHighVolumeCategories } from "variant-log";

import { type AwakeInput, type AwakeProcess, createAwakeController } from "./awake";
import { createLogger, type LogSink } from "./log";

type Entry = { level: string; message: string };

type Fake = AwakeProcess & {
  args: readonly string[];
  signals: NodeJS.Signals[];
  exited: boolean;
  finish: () => void;
  fail: (error: Error) => void;
};

type Detection = "agentHost+poll" | "poll";

const harness = (available = true, detection: Detection = "poll") => {
  const entries: Entry[] = [];
  const children: Fake[] = [];
  let pid = 4242;
  let clock = 0;
  const timers: { at: number; run: () => void; cancelled: boolean }[] = [];
  const sink: LogSink = {
    trace: (message) => entries.push({ level: "trace", message }),
    debug: (message) => entries.push({ level: "debug", message }),
    info: (message) => entries.push({ level: "info", message }),
    warn: (message) => entries.push({ level: "warn", message }),
    error: (message) => entries.push({ level: "error", message }),
  };
  let failStarts = 0;
  const unrunnable = new Set<string>();
  const spawn = (args: readonly string[]): AwakeProcess => {
    if (args[0] !== undefined && unrunnable.has(args[0])) {
      throw new Error(`spawn ${args[0]} ENOENT`);
    }
    if (failStarts > 0) {
      failStarts -= 1;
      throw new Error("spawn failed");
    }
    const exitListeners: Array<() => void> = [];
    const errorListeners: Array<(error: Error) => void> = [];
    const child: Fake = {
      pid: pid++,
      args,
      signals: [],
      exited: false,
      kill(signal = "SIGTERM") {
        this.signals.push(signal);
        return true;
      },
      once(event, listener) {
        if (event === "error") {
          errorListeners.push(listener as (error: Error) => void);
        } else {
          exitListeners.push(listener as () => void);
        }
      },
      finish() {
        if (this.exited) {
          return;
        }
        this.exited = true;
        for (const listener of exitListeners) {
          listener();
        }
      },
      fail(error) {
        for (const listener of errorListeners) {
          listener(error);
        }
      },
    };
    children.push(child);
    return child;
  };
  const controller = createAwakeController({
    spawn,
    parentPid: 5151,
    caffeinateAvailable: () => available,
    detection,
    log: createLogger(sink),
    now: () => clock,
    schedule: (ms, run) => {
      const timer = { at: clock + ms, run, cancelled: false };
      timers.push(timer);
      return {
        cancel: () => {
          timer.cancelled = true;
        },
      };
    },
  });
  const advance = (ms: number) => {
    clock += ms;
    for (const timer of [...timers]) {
      if (!timer.cancelled && timer.at <= clock) {
        timer.cancelled = true;
        timer.run();
      }
    }
  };
  return {
    controller,
    children,
    entries,
    advance,
    failNext: (count: number) => {
      failStarts = count;
    },
    /** Spawning this program throws, like a program that cannot be executed. */
    breakProgram: (program: string) => {
      unrunnable.add(program);
    },
    now: () => clock,
  };
};

const active = (over: Partial<AwakeInput> = {}): AwakeInput => ({
  when: "chatsActive",
  cmd: DEFAULT_AWAKE_CMD,
  active: true,
  owned: true,
  graceDelaySecs: 60,
  ...over,
});

const idle = (over: Partial<AwakeInput> = {}): AwakeInput => active({ active: false, ...over });

const infos = (entries: Entry[]) => entries.filter((entry) => entry.level === "info").map((entry) => entry.message);
const traces = (entries: Entry[]) => entries.filter((entry) => entry.level === "trace").map((entry) => entry.message);
const debugs = (entries: Entry[]) => entries.filter((entry) => entry.level === "debug").map((entry) => entry.message);

describe("high-volume categories", () => {
  it("registers awake.agentHostEvents when the awake module loads", () => {
    expect(listHighVolumeCategories()).toContain("awake.agentHostEvents");
  });
});

describe("createAwakeController", () => {
  it("names the detection method once on the startup info line", () => {
    const withWatcher = harness(true, "agentHost+poll");
    expect(infos(withWatcher.entries)).toEqual(['[awake] caffeinate available method="agentHost+poll"']);
    withWatcher.controller.update(active());
    expect(infos(withWatcher.entries)).toEqual(['[awake] caffeinate available method="agentHost+poll"']);

    const pollOnly = harness(true, "poll");
    expect(infos(pollOnly.entries)).toEqual(['[awake] caffeinate available method="poll"']);

    const missingBinary = harness(false, "agentHost+poll");
    expect(infos(missingBinary.entries)).toEqual(["[awake] caffeinate unavailable"]);
  });

  it("logs the binary once at startup and spawns caffeinate -disu while a chat is active", () => {
    const { controller, children, entries } = harness();

    expect(infos(entries)).toEqual(['[awake] caffeinate available method="poll"']);
    controller.update(active());

    expect(children.map((child) => child.args)).toEqual([["/usr/bin/caffeinate", "-disu", "-w", "5151"]]);
    expect(debugs(entries).at(-1)).toBe('[awake] + "/usr/bin/caffeinate -disu -w 5151" pid=4242 reason="activity"');
    expect(traces(entries).some((line) => line.includes("caffeinate"))).toBe(false);
    expect(infos(entries)).toEqual(['[awake] caffeinate available method="poll"']);

    controller.update(active());
    expect(children).toHaveLength(1);
    expect(infos(entries).filter((line) => line.includes("caffeinate available"))).toHaveLength(1);
  });

  it("runs awake.cmd with the extension host pid substituted", () => {
    const { controller, children, entries } = harness();

    controller.update(active({ cmd: "caffeinate -dis -w ${extensionHostPid}" }));

    expect(children.map((child) => child.args)).toEqual([["caffeinate", "-dis", "-w", "5151"]]);
    expect(debugs(entries).at(-1)).toBe('[awake] + "caffeinate -dis -w 5151" pid=4242 reason="activity"');
  });

  it("runs a command that is not caffeinate", () => {
    const { controller, children } = harness();

    controller.update(active({ cmd: "/usr/local/bin/keep-awake --pid ${extensionHostPid}" }));

    expect(children.map((child) => child.args)).toEqual([["/usr/local/bin/keep-awake", "--pid", "5151"]]);
  });

  it("still runs a custom command when caffeinate cannot be run, and not the default", () => {
    const missing = harness(false);

    missing.controller.update(active());
    expect(missing.children).toHaveLength(0);

    missing.controller.update(active({ cmd: "/usr/local/bin/keep-awake --pid ${extensionHostPid}" }));
    expect(missing.children.map((child) => child.args)).toEqual([["/usr/local/bin/keep-awake", "--pid", "5151"]]);
  });

  it("kills a custom command at once for never, loss of ownership, and dispose", () => {
    const cmd = "/usr/local/bin/keep-awake --pid ${extensionHostPid}";
    const never = harness();
    never.controller.update(active({ cmd }));
    never.controller.update(idle({ cmd, when: "never" }));
    expect(never.children[0]?.signals).toEqual(["SIGTERM", "SIGKILL"]);

    const owner = harness();
    owner.controller.update(active({ cmd }));
    owner.controller.update(idle({ cmd, owned: false }));
    expect(owner.children[0]?.signals).toEqual(["SIGTERM", "SIGKILL"]);

    const disposed = harness();
    disposed.controller.update(active({ cmd }));
    disposed.controller.dispose();
    expect(disposed.children[0]?.signals).toEqual(["SIGTERM", "SIGKILL"]);
  });

  it("keeps the process for the grace delay, logs that only at trace, then stops it", () => {
    const { controller, children, entries, advance } = harness();
    controller.update(active());
    const infoBefore = infos(entries).length;

    controller.update(idle());
    expect(children[0]?.signals).toEqual([]);
    expect(traces(entries).some((line) => line.includes("60"))).toBe(true);
    expect(infos(entries)).toHaveLength(infoBefore);

    advance(59_999);
    expect(children[0]?.signals).toEqual([]);
    advance(1);
    expect(children[0]?.signals).toEqual(["SIGTERM", "SIGKILL"]);
    expect(debugs(entries).at(-1)).toBe('[awake] + "kill 4242" reason="idle"');
    expect(debugs(entries).at(-1)).not.toContain("caffeinate");
    expect(traces(entries).some((line) => line.includes("kill"))).toBe(false);
    expect(infos(entries)).toHaveLength(infoBefore);
    expect(entries.filter((entry) => entry.level === "info" && entry.message.includes("grace"))).toEqual([]);
  });

  it("keeps the same process when activity returns during the delay", () => {
    const { controller, children, entries, advance } = harness();
    controller.update(active());
    controller.update(idle());
    advance(30_000);

    controller.update(active());
    advance(60_000);

    expect(children).toHaveLength(1);
    expect(children[0]?.signals).toEqual([]);
    expect(traces(entries).some((line) => line.includes("cancel"))).toBe(true);
  });

  it("applies a shorter grace measured from when the session went idle", () => {
    const { controller, children, advance } = harness();
    controller.update(active());
    controller.update(idle());
    advance(10_000);

    controller.update(idle({ graceDelaySecs: 0 }));

    expect(children[0]?.signals).toEqual(["SIGTERM", "SIGKILL"]);
  });

  it("stops at once when the grace delay is 0", () => {
    const { controller, children } = harness();
    controller.update(active({ graceDelaySecs: 0 }));

    controller.update(idle({ graceDelaySecs: 0 }));

    expect(children[0]?.signals).toEqual(["SIGTERM", "SIGKILL"]);
  });

  it("kills at once for never, loss of ownership, and dispose, without waiting", () => {
    const never = harness();
    never.controller.update(active());
    never.controller.update(idle({ when: "never" }));
    expect(never.children[0]?.signals).toEqual(["SIGTERM", "SIGKILL"]);
    expect(debugs(never.entries).at(-1)).toBe('[awake] + "kill 4242" reason="never"');

    const owner = harness();
    owner.controller.update(active());
    owner.controller.update(idle({ owned: false }));
    expect(debugs(owner.entries).at(-1)).toContain('reason="not owner"');

    const disposed = harness();
    disposed.controller.update(active());
    disposed.controller.dispose();
    expect(debugs(disposed.entries).at(-1)).toContain('reason="disposed"');
    disposed.children[0]?.finish();
    disposed.controller.update(active());
    expect(disposed.children).toHaveLength(1);
  });

  it("replaces the process when awake.cmd changes while a session is active", () => {
    const { controller, children, entries } = harness();
    controller.update(active());

    controller.update(active({ cmd: "caffeinate -dis -w ${extensionHostPid}" }));
    expect(children).toHaveLength(1);
    expect(debugs(entries).at(-1)).toBe('[awake] + "kill 4242" reason="mode changed"');

    children[0]?.finish();
    expect(children.map((child) => child.args)).toEqual([
      ["/usr/bin/caffeinate", "-disu", "-w", "5151"],
      ["caffeinate", "-dis", "-w", "5151"],
    ]);
  });

  it("stops and starts nothing when awake.cmd changes to the default that cannot run", () => {
    const { controller, children } = harness(false);
    controller.update(active({ cmd: "/usr/local/bin/keep-awake --pid ${extensionHostPid}" }));

    controller.update(active());
    children[0]?.finish();

    expect(children).toHaveLength(1);
    expect(children[0]?.signals).toEqual(["SIGTERM", "SIGKILL"]);
  });

  it("starts a replacement when the process exits while a session is still active", () => {
    const { controller, children, entries, advance } = harness();
    controller.update(active());

    advance(1001);
    children[0]?.finish();

    expect(entries.some((entry) => entry.level === "warn" && entry.message.includes("[awake]"))).toBe(true);
    expect(children).toHaveLength(2);
    const warnAt = entries.findIndex((entry) => entry.level === "warn");
    const restartAt = entries.findIndex(
      (entry, index) => index > warnAt && entry.message.includes('reason="activity"'),
    );
    expect(restartAt).toBeGreaterThan(warnAt);
  });

  it("tries again on the next update after a failed start", () => {
    const { controller, children, failNext } = harness();
    failNext(1);

    controller.update(active());
    expect(children).toHaveLength(0);

    controller.update(active());
    expect(children).toHaveLength(1);
  });

  describe("a start that fails", () => {
    const cmd = "/nonexistent/keep-awake --pid ${extensionHostPid}";
    const warns = (entries: Entry[]) => entries.filter((entry) => entry.level === "warn").map((entry) => entry.message);

    it("warns once for a program that cannot be executed, however often it is tried", () => {
      const { controller, children, entries, breakProgram } = harness();
      breakProgram("/nonexistent/keep-awake");

      controller.update(active({ cmd }));
      controller.update(active({ cmd }));
      controller.update(active({ cmd }));

      expect(children).toHaveLength(0);
      expect(warns(entries)).toEqual([
        '[awake] start failed command="/nonexistent/keep-awake --pid 5151" reason="spawn /nonexistent/keep-awake ENOENT"',
      ]);
      expect(entries.some((entry) => entry.level === "error")).toBe(false);
    });

    it("warns once when the spawn reports an error, does not replace it at once, and tries again later", () => {
      const { controller, children, entries } = harness();
      controller.update(active({ cmd }));

      children[0]?.fail(new Error("spawn /nonexistent/keep-awake ENOENT"));
      expect(children).toHaveLength(1);
      expect(warns(entries)).toEqual([
        '[awake] start failed command="/nonexistent/keep-awake --pid 5151" reason="spawn /nonexistent/keep-awake ENOENT"',
      ]);

      controller.update(active({ cmd }));
      expect(children).toHaveLength(2);
      children[1]?.fail(new Error("spawn /nonexistent/keep-awake ENOENT"));
      controller.update(active({ cmd }));
      expect(children).toHaveLength(3);
      expect(warns(entries)).toHaveLength(1);
    });

    it("counts an exit within 1 second as a failed start", () => {
      const { controller, children, entries, advance } = harness();
      controller.update(active({ cmd }));

      advance(1000);
      children[0]?.finish();

      expect(children).toHaveLength(1);
      expect(warns(entries)).toEqual([
        '[awake] start failed command="/nonexistent/keep-awake --pid 5151" reason="exited within 1s"',
      ]);

      controller.update(active({ cmd }));
      expect(children).toHaveLength(2);
      children[1]?.finish();
      expect(warns(entries)).toHaveLength(1);
    });

    it("replaces a process that exits after more than 1 second, with the exit warn", () => {
      const { controller, children, entries, advance } = harness();
      controller.update(active({ cmd }));

      advance(1001);
      children[0]?.finish();

      expect(children).toHaveLength(2);
      expect(warns(entries)).toEqual(["[awake] exit pid=4242"]);
    });

    it("warns again for a different command that fails", () => {
      const { controller, entries, breakProgram } = harness();
      breakProgram("/nonexistent/keep-awake");
      breakProgram("/nonexistent/other");

      controller.update(active({ cmd }));
      controller.update(active({ cmd: "/nonexistent/other" }));
      controller.update(active({ cmd }));

      expect(warns(entries)).toEqual([
        '[awake] start failed command="/nonexistent/keep-awake --pid 5151" reason="spawn /nonexistent/keep-awake ENOENT"',
        '[awake] start failed command="/nonexistent/other" reason="spawn /nonexistent/other ENOENT"',
      ]);
    });

    it("logs a repeat failure of a warned command at trace only", () => {
      const { controller, entries, breakProgram } = harness();
      breakProgram("/nonexistent/keep-awake");

      controller.update(active({ cmd }));
      controller.update(active({ cmd }));

      expect(traces(entries).filter((line) => line.includes("start failed"))).toHaveLength(1);
    });
  });

  it("logs once at startup when caffeinate cannot be run and never spawns", () => {
    const { controller, children, entries } = harness(false);

    expect(infos(entries)).toEqual(["[awake] caffeinate unavailable"]);
    controller.update(active());
    controller.update(active());

    expect(children).toHaveLength(0);
    expect(infos(entries)).toEqual(["[awake] caffeinate unavailable"]);
  });
});
