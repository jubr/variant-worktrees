import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import {
  type AwakeProcess,
  COMPOSER_ACTIVITY_SQL,
  composerDataActivitySql,
  composerIdsFromHeaders,
  composerRowsActive,
  RECENT_COMPOSER_SQL,
  runSqlite3,
} from "chat-renamer-api";

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
export const readComposerActivity = async (dbPath: string, alsoIds: readonly string[] = []): Promise<boolean> => {
  if (!existsSync(dbPath)) {
    return false;
  }
  try {
    const headerIds = composerIdsFromHeaders(await runSqlite3(dbPath, RECENT_COMPOSER_SQL));
    // Newest headers first. The open-id list is over 100 and would otherwise fill the 20-row cap.
    const ids = [...new Set([...headerIds, ...alsoIds])];
    const pointSql = composerDataActivitySql(ids);
    const json = pointSql === undefined ? "[]" : await runSqlite3(dbPath, pointSql);
    return composerRowsActive(json);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (!detail.includes("no such table")) {
      return false;
    }
    try {
      return composerRowsActive(await runSqlite3(dbPath, COMPOSER_ACTIVITY_SQL));
    } catch {
      return false;
    }
  }
};
