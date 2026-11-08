import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { type AwakeProcess, COMPOSER_ACTIVITY_SQL, composerRowsActive, runSqlite3 } from "chat-renamer-api";

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
}: {
  read: () => Promise<boolean>;
  everyMs?: number;
  schedule: (ms: number, run: () => void) => AwakeTimer;
  shouldPoll: () => boolean;
  /** Called with each sample, including a forced idle sample when polling stops. */
  onActive?: (active: boolean) => void;
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
      onActive?.(false);
      return false;
    }
    let active = false;
    try {
      active = await read();
    } catch {
      active = false;
    }
    if (stopped) {
      return false;
    }
    if (!shouldPoll()) {
      timer?.cancel();
      timer = null;
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

/** Not detached, so the extension host does not leave the child behind. */
export const spawnCaffeinate = (args: string): AwakeProcess => {
  const child = spawn("caffeinate", [args], { stdio: "ignore" });
  return {
    pid: child.pid ?? -1,
    kill: (signal = "SIGTERM") => child.kill(signal),
    once: (_event, listener) => {
      child.once("exit", () => listener());
    },
  };
};

/** Reads composer status fields from Cursor's state database. A missing database is idle. */
export const readComposerActivity = async (dbPath: string): Promise<boolean> => {
  if (!existsSync(dbPath)) {
    return false;
  }
  try {
    return composerRowsActive(await runSqlite3(dbPath, COMPOSER_ACTIVITY_SQL));
  } catch {
    return false;
  }
};
