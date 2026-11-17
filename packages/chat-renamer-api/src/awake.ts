import { type AwakeWhen, DEFAULT_AWAKE_CMD, DEFAULT_AWAKE_GRACE_DELAY_SECS } from "chat-renamer-config";
import { registerHighVolumeCategory } from "variant-log";

import type { Logger } from "./log";

/** High-volume traces for agent-host turn start and end. Off until the checkbox is set. */
export const AWAKE_AGENT_HOST_EVENTS = "awake.agentHostEvents";

registerHighVolumeCategory(AWAKE_AGENT_HOST_EVENTS);

/** One awake child. The caller must not detach it. `error` is a program that cannot be executed. */
export type AwakeProcess = {
  pid: number;
  kill(signal?: NodeJS.Signals): boolean;
  once(event: "exit" | "error", listener: (error?: Error) => void): void;
};

export type AwakeInput = {
  when: AwakeWhen;
  /** Command template. `${extensionHostPid}` is this host's pid. */
  cmd: string;
  active: boolean;
  owned: boolean;
  graceDelaySecs: number;
};

export type AwakeDetection = "agentHost+poll" | "poll";

export type AwakeControllerDeps = {
  spawn: (argv: readonly string[]) => AwakeProcess;
  /** Pid of the extension host. `caffeinate -w` exits when this process exits. */
  parentPid: number;
  /** Called once, when the controller is created. */
  caffeinateAvailable: () => boolean;
  /** `agentHost+poll` when the turn watcher was created, otherwise `poll`. */
  detection: AwakeDetection;
  log: Logger;
  now: () => number;
  schedule: (ms: number, run: () => void) => { cancel(): void };
};

export type AwakeController = {
  update(input: AwakeInput): void;
  dispose(): void;
};

type Tracked = {
  pid: number;
  args: readonly string[];
  process: AwakeProcess;
  stopRequested: boolean;
  startedAt: number;
};

/** An exit this soon after the start counts as a failed start, not as a process that ended. */
const FAILED_START_WINDOW_MS = 1000;

type Grace = { since: number; delaySecs: number; timer: { cancel(): void } | null };

const sameArgv = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((part, index) => part === right[index]);

/** Split `cmd` into a program and arguments, substituting this host's pid. */
const argvFor = (cmd: string, pid: number): readonly string[] =>
  cmd
    .replaceAll("${extensionHostPid}", String(pid))
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);

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
  parentPid,
  caffeinateAvailable,
  detection,
  log,
  now,
  schedule,
}: AwakeControllerDeps): AwakeController => {
  const awake = log.child("awake");
  const available = caffeinateAvailable();
  awake.info(available ? `caffeinate available method="${detection}"` : "caffeinate unavailable");

  let tracked: Tracked | null = null;
  let pendingArgs: readonly string[] | null = null;
  let grace: Grace | null = null;
  let latest: AwakeInput = {
    when: "chatsActive",
    cmd: DEFAULT_AWAKE_CMD,
    active: false,
    owned: true,
    graceDelaySecs: DEFAULT_AWAKE_GRACE_DELAY_SECS,
  };
  let disposed = false;
  /** Commands already warned about. A command warns once for the life of the controller. */
  const warned = new Set<string>();

  const oneArgv = (): readonly string[] => ["/usr/bin/caffeinate", "-disu", "-w", String(parentPid)];

  /** Any non-empty command is tried. Only the default needs the `caffeinate` binary the startup check looked for. */
  const argvRunnable = (argv: readonly string[]): boolean =>
    argv.length > 0 && (available || !sameArgv(argv, oneArgv()));

  const runnable = (cmd: string): boolean => argvRunnable(argvFor(cmd, parentPid));

  const wantsRun = (): boolean =>
    latest.owned && latest.when === "chatsActive" && latest.active && runnable(latest.cmd);

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

  const startFailed = (args: readonly string[], reason: string): void => {
    const command = args.join(" ");
    if (warned.has(command)) {
      awake.trace("start failed", { command, reason });
      return;
    }
    warned.add(command);
    awake.warn("start failed", { command, reason });
  };

  const onExit = (child: Tracked, error?: Error): void => {
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
    const failed = unexpected && (error !== undefined || now() - child.startedAt <= FAILED_START_WINDOW_MS);
    if (failed) {
      dropGrace();
      startFailed(child.args, error ? error.message : "exited within 1s");
    } else if (unexpected && wantsRun()) {
      awake.warn("exit", { pid });
      start(child.args);
      return;
    } else if (unexpected) {
      dropGrace();
    }
    const next = pendingArgs;
    pendingArgs = null;
    if (next && wantsRun()) {
      start(next);
    }
  };

  const start = (args: readonly string[]): void => {
    if (tracked || !argvRunnable(args)) {
      return;
    }
    try {
      const child = spawn(args);
      const running: Tracked = { pid: child.pid, args, process: child, stopRequested: false, startedAt: now() };
      tracked = running;
      child.once("exit", () => onExit(running));
      child.once("error", (error) => onExit(running, error ?? new Error("spawn failed")));
      awake.debug(`+ "${args.join(" ")}"`, { pid: child.pid, reason: "activity" });
    } catch (error) {
      startFailed(args, error instanceof Error ? error.message : String(error));
    }
  };

  const ensure = (args: readonly string[]): void => {
    if (tracked && !tracked.stopRequested && sameArgv(tracked.args, args)) {
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
    if (disposed) {
      return;
    }
    latest = input;
    if (wantsRun()) {
      cancelGrace();
      ensure(argvFor(latest.cmd, parentPid));
      return;
    }
    if (input.owned && input.when === "chatsActive" && input.active && !runnable(input.cmd)) {
      pendingArgs = null;
      cancelGrace();
      stop("mode changed");
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
