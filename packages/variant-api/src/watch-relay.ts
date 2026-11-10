import { type ChildProcess, spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, realpathSync, writeFileSync, writeSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
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

export interface LaunchedWatch extends WatchLaunch {
  pid: number;
  child: ChildProcess;
}

export interface LaunchResult {
  processes: LaunchedWatch[];
  /** Appends an already-formatted chunk to the log without blocking the console. */
  writeLog?: (text: string) => void;
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
      processes.push({ ...launch, pid: child.pid, child });
    }
  } catch (error) {
    await Promise.all(processes.map(({ pid }) => stopProcessTree(pid)));
    await log?.close();
    throw error;
  }
  return {
    processes,
    ...(log ? { writeLog: (text: string) => log.write(text) } : {}),
    close: async () => {
      await Promise.all(finished);
      await log?.close();
    },
  };
};

/** A compiled executable reports its script inside an embedded file system. Same test `variant ui` uses. */
const EMBEDDED_SCRIPT = /^(\/\$bunfs\/|[A-Za-z]:[\\/]~BUN[\\/])/;

/** This module on disk, when the process is running the TypeScript source. */
export const relayModulePath = (): string => fileURLToPath(import.meta.url);

/**
 * The command that runs this relay. A source checkout executes the module file. A compiled executable, or a bundle
 * whose script is not this file, re-enters itself with `--internal-watch-relay`.
 */
export const relaySpawnArgs = (execPath: string, script: string | undefined, relayFile: string): string[] => {
  if (existsSync(relayFile) && relayFile.endsWith("watch-relay.ts")) {
    return [execPath, relayFile];
  }
  if (script !== undefined && !EMBEDDED_SCRIPT.test(script) && existsSync(script)) {
    return [execPath, script, "--internal-watch-relay"];
  }
  return [execPath, "--internal-watch-relay"];
};

export interface RelayPlan {
  launches: readonly WatchLaunch[];
  startDelayMs: number;
  logPath: string;
}

const readStdin = async (): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
};

const readLine = (stream: NodeJS.ReadableStream): Promise<string> =>
  new Promise((resolve, reject) => {
    let buffer = "";
    const onData = (chunk: string | Buffer): void => {
      buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
      const newline = buffer.indexOf("\n");
      if (newline !== -1) {
        stream.off("data", onData);
        resolve(buffer.slice(0, newline));
      }
    };
    stream.on("data", onData);
    stream.on("error", reject);
    stream.on("end", () => reject(new Error("watch relay ended before it reported pids")));
  });

/** Entry the relay child runs: one JSON plan on stdin, one JSON line of pids on stdout, then the watches. */
export const runWatchRelay = async (): Promise<void> => {
  const plan = JSON.parse(await readStdin()) as RelayPlan;
  try {
    const launched = await launchWatches({
      launches: plan.launches,
      startDelayMs: plan.startDelayMs,
      logPath: plan.logPath,
    });
    const pids = Object.fromEntries(launched.processes.map(({ key, pid }) => [key, pid]));
    writeSync(1, `${JSON.stringify({ pids })}\n`);
    await Promise.all(
      launched.processes.map(
        ({ child }) =>
          new Promise<void>((resolve) => {
            if (child.exitCode !== null || child.signalCode !== null) {
              resolve();
              return;
            }
            child.once("exit", () => resolve());
          }),
      ),
    );
    await launched.close();
  } catch (error) {
    writeSync(1, `${JSON.stringify({ error: (error as Error).message })}\n`);
    process.exitCode = 1;
  }
};

/**
 * Spawns the relay and returns when the watches are running. The child keeps capturing after this returns and does
 * not use the caller's terminal.
 */
export const startDetachedRelay = async (plan: RelayPlan): Promise<Record<string, number>> => {
  const args = relaySpawnArgs(process.execPath, process.argv[1], relayModulePath());
  const child = spawn(args[0] as string, args.slice(1), {
    detached: true,
    stdio: ["pipe", "pipe", "ignore"],
    env: process.env,
  });
  child.unref();
  child.on("error", () => {});
  if (!child.pid || child.stdin === null || child.stdout === null) {
    throw new Error("Could not start the watch relay");
  }
  const line = readLine(child.stdout);
  child.stdin.end(JSON.stringify(plan));
  let message: { pids?: Record<string, number>; error?: string };
  try {
    message = JSON.parse(await line) as { pids?: Record<string, number>; error?: string };
  } finally {
    child.stdout.destroy();
  }
  if (message.error !== undefined) {
    throw new Error(message.error);
  }
  const pids = message.pids ?? {};
  for (const launch of plan.launches) {
    if (pids[launch.key] === undefined) {
      throw new Error(`Could not start ${launch.key} in ${launch.cwd}: ${launch.command}`);
    }
  }
  return pids;
};

const invokedDirectly = (): boolean => {
  const script = process.argv[1];
  // A bundled CLI shares this module. Only the spawned source file should enter the relay on its own.
  if (script === undefined || !script.endsWith("watch-relay.ts")) {
    return false;
  }
  try {
    return realpathSync(script) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return pathToFileURL(script).href === import.meta.url;
  }
};

if (invokedDirectly()) {
  await runWatchRelay();
}
