import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import type { AwakeProcess } from "chat-renamer-api";

export type AwakeTimer = { cancel(): void };

export type ActivityWatch = {
  /** Reads once when polling is on. Returns whether any chat is in a turn. */
  sync(): Promise<boolean>;
  dispose(): void;
};

/**
 * Polls composer status about once a second. The grace delay lives in the caffeinate controller, not here.
 */
export const createActivityWatch = ({
  read,
  everyMs = 1000,
  schedule,
  shouldPoll,
  onActive,
  trace,
}: {
  read: () => Promise<boolean>;
  everyMs?: number;
  schedule: (ms: number, run: () => void) => AwakeTimer;
  shouldPoll: () => boolean;
  /** Called with each sample, including a forced idle sample when polling stops. */
  onActive?: (active: boolean) => void;
  /** Trace when the poll stops or the read fails. A steady sample is silent. Absent in tests. */
  trace?: (message: string, fields: Record<string, unknown>) => void;
}): ActivityWatch => {
  let timer: AwakeTimer | null = null;
  let stopped = false;

  const arm = (): void => {
    timer?.cancel();
    timer = null;
    if (stopped || !shouldPoll()) {
      return;
    }
    timer = schedule(everyMs, () => {
      void sync();
    });
  };

  const sync = async (): Promise<boolean> => {
    if (stopped) {
      timer?.cancel();
      timer = null;
      return false;
    }
    if (!shouldPoll()) {
      timer?.cancel();
      timer = null;
      trace?.("activity", { active: false, reason: "poll off" });
      onActive?.(false);
      return false;
    }
    let active = false;
    let readError: string | undefined;
    try {
      active = await read();
    } catch (error) {
      active = false;
      readError = error instanceof Error ? error.message : String(error);
      trace?.("activity", { active: false, reason: "read failed", detail: readError });
    }
    if (stopped) {
      return false;
    }
    if (!shouldPoll()) {
      timer?.cancel();
      timer = null;
      trace?.("activity", { active: false, reason: "poll off" });
      onActive?.(false);
      return false;
    }
    onActive?.(active);
    arm();
    return active;
  };

  return {
    sync,
    dispose: () => {
      stopped = true;
      timer?.cancel();
      timer = null;
    },
  };
};

/** `caffeinate` on macOS. Missing file means the platform cannot run it. */
export const caffeinateOnPath = (): boolean => existsSync("/usr/bin/caffeinate");

/** Not detached, so dispose can signal the child. `-w` in `argv` exits it when the host dies. */
export const spawnCaffeinate = (argv: readonly string[]): AwakeProcess => {
  const child = spawn("caffeinate", [...argv], { stdio: "ignore" });
  return {
    pid: child.pid ?? -1,
    kill: (signal = "SIGTERM") => child.kill(signal),
    once: (_event, listener) => {
      child.once("exit", () => listener());
    },
  };
};
