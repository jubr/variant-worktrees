import type { AwakeWhat, AwakeWhen } from "chat-renamer-config";

import type { Logger } from "./log";

/** One `caffeinate` child. The caller must not detach it. */
export type AwakeProcess = {
  pid: number;
  kill(signal?: NodeJS.Signals): boolean;
  once(event: "exit", listener: () => void): void;
};

export type AwakeInput = {
  when: AwakeWhen;
  what: AwakeWhat;
  active: boolean;
  owned: boolean;
  graceDelaySecs: number;
};

export type AwakeControllerDeps = {
  spawn: (args: string) => AwakeProcess;
  /** Called once, when the controller is created. */
  caffeinateAvailable: () => boolean;
  log: Logger;
  now: () => number;
  schedule: (ms: number, run: () => void) => { cancel(): void };
};

export type AwakeController = {
  update(input: AwakeInput): void;
  dispose(): void;
};

type Tracked = { pid: number; args: string; process: AwakeProcess; stopRequested: boolean };

type Grace = { since: number; delaySecs: number; timer: { cancel(): void } | null };

const argsFor = (what: AwakeWhat): string => (what === "cpu" ? "-dis" : "-disu");

const signal = (child: AwakeProcess, name: NodeJS.Signals): void => {
  try {
    child.kill(name);
  } catch {
    // The process is already gone.
  }
};

/**
 * Starts and kills one `caffeinate` process from chat activity.
 *
 * AIDEV-NOTE: the idle delay is trace-only. The binary check is one info line at construction.
 */
export const createAwakeController = ({
  spawn,
  caffeinateAvailable,
  log,
  now,
  schedule,
}: AwakeControllerDeps): AwakeController => {
  const awake = log.child("awake");
  const available = caffeinateAvailable();
  awake.info(available ? "caffeinate available" : "caffeinate unavailable");

  let tracked: Tracked | null = null;
  let pendingArgs: string | null = null;
  let grace: Grace | null = null;
  let latest: AwakeInput = {
    when: "chatsActive",
    what: "screen",
    active: false,
    owned: true,
    graceDelaySecs: 60,
  };
  let disposed = false;

  const wantsRun = (): boolean => latest.owned && latest.when === "chatsActive" && latest.active && available;

  const dropGrace = (): void => {
    grace?.timer?.cancel();
    grace = null;
  };

  const stop = (reason: "idle" | "never" | "disposed" | "not owner" | "mode changed"): void => {
    if (!tracked || tracked.stopRequested) {
      return;
    }
    const child = tracked;
    child.stopRequested = true;
    awake.debug(`+ "kill ${child.pid}"`, { reason });
    signal(child.process, "SIGTERM");
    // Exit is asynchronous. SIGKILL covers a child that ignored SIGTERM.
    if (tracked === child) {
      signal(child.process, "SIGKILL");
    }
  };

  const onExit = (child: Tracked): void => {
    if (tracked !== child) {
      return;
    }
    const unexpected = !child.stopRequested;
    const pid = child.pid;
    tracked = null;
    if (disposed) {
      pendingArgs = null;
      return;
    }
    if (unexpected && wantsRun()) {
      awake.warn("exit", { pid });
      start(child.args);
      return;
    }
    if (unexpected) {
      dropGrace();
    }
    const next = pendingArgs;
    pendingArgs = null;
    if (next && wantsRun()) {
      start(next);
    }
  };

  const start = (args: string): void => {
    if (!available || tracked) {
      return;
    }
    try {
      const child = spawn(args);
      const running: Tracked = { pid: child.pid, args, process: child, stopRequested: false };
      tracked = running;
      child.once("exit", () => onExit(running));
      awake.debug(`+ "caffeinate ${args}"`, { pid: child.pid, reason: "activity" });
    } catch (error) {
      awake.error("start failed", error);
    }
  };

  const ensure = (args: string): void => {
    if (tracked && !tracked.stopRequested && tracked.args === args) {
      pendingArgs = null;
      return;
    }
    if (tracked && !tracked.stopRequested) {
      pendingArgs = args;
      stop("mode changed");
      return;
    }
    if (tracked?.stopRequested) {
      pendingArgs = args;
      return;
    }
    pendingArgs = null;
    start(args);
  };

  const armGrace = (delaySecs: number): void => {
    const since = grace?.since ?? now();
    if (grace && grace.delaySecs === delaySecs) {
      return;
    }
    const first = grace === null;
    grace?.timer?.cancel();
    if (delaySecs <= 0) {
      grace = null;
      stop("idle");
      return;
    }
    const wait = since + delaySecs * 1000 - now();
    if (first) {
      awake.trace("grace", { delaySecs, phase: "start" });
    }
    if (wait <= 0) {
      grace = null;
      awake.trace("grace", { delaySecs, phase: "elapsed" });
      stop("idle");
      return;
    }
    const timer = schedule(wait, () => {
      grace = null;
      awake.trace("grace", { delaySecs, phase: "elapsed" });
      stop("idle");
    });
    grace = { since, delaySecs, timer };
  };

  const cancelGrace = (): void => {
    if (!grace) {
      return;
    }
    dropGrace();
    awake.trace("grace", { phase: "cancel" });
  };

  const update = (input: AwakeInput): void => {
    if (disposed || !available) {
      return;
    }
    latest = input;
    if (wantsRun()) {
      cancelGrace();
      ensure(argsFor(input.what));
      return;
    }
    if (!input.owned) {
      pendingArgs = null;
      cancelGrace();
      stop("not owner");
      return;
    }
    if (input.when === "never") {
      pendingArgs = null;
      cancelGrace();
      stop("never");
      return;
    }
    if (tracked && !tracked.stopRequested) {
      armGrace(input.graceDelaySecs);
      return;
    }
    pendingArgs = null;
  };

  return {
    update,
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      pendingArgs = null;
      cancelGrace();
      stop("disposed");
    },
  };
};
