import { type ChildProcess, spawn } from "node:child_process";
import { createWriteStream, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { stopProcessTree } from "./processes.js";
import { sleep } from "./sleep.js";

export interface WatchLaunch {
  key: string;
  command: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
}

export interface LaunchWatchesOptions {
  launches: readonly WatchLaunch[];
  startDelayMs: number;
  /** Prefixed stdout lines. Absent when capture only writes the log file. */
  stdout?: NodeJS.WritableStream;
  /** Prefixed stderr lines. Absent when capture only writes the log file. */
  stderr?: NodeJS.WritableStream;
  /** Absolute path of `.cache/variant/watch.log`. Truncated when the launch starts. */
  logPath?: string;
  /** Attached watches keep the caller's stdin. */
  inheritStdin?: boolean;
  /** `[key] command`, without a trailing newline. The relay also writes that line to the log. */
  onBanner?: (line: string) => void;
}

export interface LaunchedWatch {
  key: string;
  command: string;
  pid: number;
  child: ChildProcess;
}

export interface LaunchResult {
  processes: LaunchedWatch[];
  /** Waits until every captured stream has ended, then flushes the log. */
  close: () => Promise<void>;
}

/** A log file that accepts lines without delaying the console write that queued them. */
const openLog = (path: string): { write: (text: string) => void; close: () => Promise<void> } => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "");
  const stream = createWriteStream(path, { flags: "a" });
  // AIDEV-NOTE: a full file buffer queues lines in order and writes them on drain; the console write does not wait.
  const pending: string[] = [];
  let blocked = false;
  const pump = (): void => {
    while (!blocked && pending.length > 0) {
      const text = pending.shift() as string;
      blocked = stream.write(text) === false;
    }
  };
  stream.on("drain", () => {
    blocked = false;
    pump();
  });
  stream.on("error", () => {});
  return {
    write: (text) => {
      pending.push(text);
      pump();
    },
    close: () =>
      new Promise((resolve) => {
        const finish = (): void => {
          if (pending.length > 0 || blocked) {
            stream.once("drain", () => {
              blocked = false;
              pump();
              finish();
            });
            return;
          }
          stream.end(() => resolve());
        };
        finish();
      }),
  };
};

/** Prefixes each line of `stream` and tees it to the console sink and the log. A partial line is flushed at the end. */
const relay = (
  stream: NodeJS.ReadableStream,
  key: string,
  consoleSink: NodeJS.WritableStream | undefined,
  writeLog: ((text: string) => void) | undefined,
  finished: Promise<void>[],
): void => {
  let buffer = "";
  const emit = (line: string): void => {
    const text = `[${key}] ${line}\n`;
    consoleSink?.write(text);
    writeLog?.(text);
  };
  const take = (raw: string): void => {
    buffer += raw;
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      let line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (line.endsWith("\r")) {
        line = line.slice(0, -1);
      }
      emit(line);
      newline = buffer.indexOf("\n");
    }
  };
  stream.setEncoding("utf8");
  stream.on("data", (chunk: string) => take(chunk));
  finished.push(
    new Promise((resolve) => {
      stream.on("end", () => {
        if (buffer.length > 0) {
          const line = buffer.endsWith("\r") ? buffer.slice(0, -1) : buffer;
          buffer = "";
          emit(line);
        }
        resolve();
      });
      stream.on("error", () => resolve());
    }),
  );
};

/**
 * Starts each watch, prefixes its stdout and stderr, and tees those lines to the console sinks and the log file.
 * Specification: openspec/specs/variant-api/runtime/spec.md
 */
export const launchWatches = async (options: LaunchWatchesOptions): Promise<LaunchResult> => {
  const log = options.logPath === undefined ? undefined : openLog(options.logPath);
  const processes: LaunchedWatch[] = [];
  const finished: Promise<void>[] = [];
  try {
    for (const launch of options.launches) {
      if (processes.length > 0 && options.startDelayMs > 0) {
        await sleep(options.startDelayMs);
      }
      const banner = `[${launch.key}] ${launch.command}`;
      options.onBanner?.(banner);
      log?.write(`${banner}\n`);
      let child: ChildProcess;
      try {
        child = spawn("sh", ["-c", launch.command], {
          cwd: launch.cwd,
          env: launch.env,
          detached: true,
          stdio: [options.inheritStdin === true ? "inherit" : "ignore", "pipe", "pipe"],
        });
      } catch {
        throw new Error(`Could not start ${launch.key} in ${launch.cwd}: ${launch.command}`);
      }
      child.on("error", () => {});
      if (!child.pid || child.stdout === null || child.stderr === null) {
        throw new Error(`Could not start ${launch.key} in ${launch.cwd}: ${launch.command}`);
      }
      relay(child.stdout, launch.key, options.stdout, log?.write, finished);
      relay(child.stderr, launch.key, options.stderr, log?.write, finished);
      processes.push({ key: launch.key, command: launch.command, pid: child.pid, child });
    }
  } catch (error) {
    await Promise.all(processes.map(({ pid }) => stopProcessTree(pid)));
    await log?.close();
    throw error;
  }
  return {
    processes,
    close: async () => {
      await Promise.all(finished);
      await log?.close();
    },
  };
};
