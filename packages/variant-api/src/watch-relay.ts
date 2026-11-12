import { type ChildProcess, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { createWriteStream, existsSync, mkdirSync, realpathSync, writeFileSync, writeSync } from "node:fs";
import { dirname, join } from "node:path";
import { PassThrough } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";
import { stopProcessTree } from "./processes.js";
import { sleep } from "./sleep.js";

/** `tty` gives the process a terminal. `no-tty` keeps pipes. */
export type WatchOutputMode = "tty" | "no-tty";

export interface WatchLaunch {
  key: string;
  command: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  /** Absent means pipes. */
  outputMode?: WatchOutputMode;
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
  /** Flags of this watch invocation, such as `--detach`. Empty when none were set. */
  args?: string;
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

const ANSI_ESCAPE = "\u001b";
const ANSI_RESET = "\u001b[0m";

/** A tty line that already contains an escape ends with a reset, so color does not bleed into the next prefix. */
const closeAnsi = (line: string, resetAnsi: boolean): string =>
  resetAnsi && line.includes(ANSI_ESCAPE) ? `${line}${ANSI_RESET}` : line;

const ttyModeLine = (args: string): string => {
  const head = args.length > 0 ? `[watch] ${args} mode=tty` : "[watch] mode=tty";
  return `${head} # set to 'no-tty' likely suppresses ansi escape sequences\n`;
};

/** Prefixes each line of `stream` and tees it to the console sink and the log. A partial line is flushed at the end. */
const relay = (
  stream: NodeJS.ReadableStream,
  key: string,
  consoleSink: NodeJS.WritableStream | undefined,
  writeLog: ((text: string) => void) | undefined,
  finished: Promise<void>[],
  resetAnsi: boolean,
): void => {
  let buffer = "";
  const emit = (line: string): void => {
    const text = `[${key}] ${closeAnsi(line, resetAnsi)}\n`;
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

/** BSD `script` writes this when its stdin is `/dev/null`, before the process output. */
const SCRIPT_EOF = "^\u0044\b\b";

/** Drops a leading `^D` backspace echo. Later bytes pass through. */
const withoutScriptEof = (stream: NodeJS.ReadableStream): NodeJS.ReadableStream => {
  const out = new PassThrough();
  let pending = "";
  let decided = false;
  const emit = (text: string): void => {
    if (text.length > 0) {
      out.write(text);
    }
  };
  stream.setEncoding("utf8");
  stream.on("data", (chunk: string) => {
    if (decided) {
      emit(chunk);
      return;
    }
    pending += chunk;
    if (SCRIPT_EOF.startsWith(pending) && pending.length < SCRIPT_EOF.length) {
      return;
    }
    decided = true;
    emit(pending.startsWith(SCRIPT_EOF) ? pending.slice(SCRIPT_EOF.length) : pending);
    pending = "";
  });
  stream.on("end", () => {
    if (!decided && pending.length > 0) {
      emit(pending);
    }
    out.end();
  });
  stream.on("error", () => out.end());
  return out;
};

const colorTerm = (env: NodeJS.ProcessEnv): NodeJS.ProcessEnv => {
  const term = env.TERM;
  if (term === undefined || term.length === 0 || term === "dumb") {
    return { ...env, TERM: "xterm-256color" };
  }
  return env;
};

/** Wide terminal, then the watch command. The command variable is unset before the command runs. */
const TTY_WRAPPER =
  'cmd=$VARIANT_WATCH_COMMAND; unset VARIANT_WATCH_COMMAND; stty cols 10000 rows 200; exec sh -c "$cmd"';

/** `script` flags differ. Linux takes `-c`. macOS takes the command after the typescript file. */
const ttySpawnArgs = (): string[] =>
  process.platform === "linux"
    ? ["-q", "-e", "-f", "-c", TTY_WRAPPER, "/dev/null"]
    : ["-q", "/dev/null", "sh", "-c", TTY_WRAPPER];

interface PtyTerminal {
  close: () => void;
}

interface PtyRuntime {
  spawn: (
    command: string[],
    options: {
      cwd: string;
      env: NodeJS.ProcessEnv;
      terminal: {
        cols: number;
        rows: number;
        data: (terminal: PtyTerminal, data: Uint8Array) => void;
        exit: (terminal: PtyTerminal, exitCode: number, signal: string | null) => void;
      };
    },
  ) => { pid: number; exited: Promise<number>; terminal: PtyTerminal };
}

/** The runtime pty, when this process is Bun. Property access stays `.Bun` so the bundle has no `Bun.` token. */
const ptyRuntime = (): PtyRuntime | undefined => {
  const runtime = (globalThis as { Bun?: PtyRuntime }).Bun;
  return typeof runtime?.spawn === "function" ? runtime : undefined;
};

/** Kept alive so a terminal is not closed by collection while its command runs. */
const openTerminals = new Set<PtyTerminal>();

const spawnOnBunTerminal = (runtime: PtyRuntime, launch: WatchLaunch): ChildProcess => {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const child = new EventEmitter() as ChildProcess;
  const finish = (code: number | null): void => {
    child.exitCode = code;
    stdout.end();
    stderr.end();
  };
  const proc = runtime.spawn(["sh", "-c", launch.command], {
    cwd: launch.cwd,
    env: colorTerm(launch.env),
    terminal: {
      cols: 10000,
      rows: 200,
      data(_terminal, data) {
        stdout.write(data);
      },
      exit() {
        finish(child.exitCode);
      },
    },
  });
  openTerminals.add(proc.terminal);
  child.pid = proc.pid;
  child.stdout = stdout;
  child.stderr = stderr;
  child.exitCode = null;
  child.signalCode = null;
  void proc.exited.then((code) => {
    openTerminals.delete(proc.terminal);
    proc.terminal.close();
    finish(code);
    child.emit("exit", code, null);
  });
  return child;
};

const spawnOnScript = (launch: WatchLaunch): ChildProcess =>
  // AIDEV-NOTE: `/dev/null` is immediate EOF. script writes that EOF into the terminal, and a program such as vite exits.
  // bash holds the read end open with `tail -f /dev/null`, then becomes `script`, so the watched pid is still script.
  spawn("bash", ["-c", 'exec < <(tail -f /dev/null); exec "$@"', "bash", "script", ...ttySpawnArgs()], {
    cwd: launch.cwd,
    env: { ...colorTerm(launch.env), VARIANT_WATCH_COMMAND: launch.command },
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

/** A Bun process allocates the terminal itself. Any other process still uses `script`. */
const spawnOnTerminal = (launch: WatchLaunch): { child: ChildProcess; stripEof: boolean } => {
  const runtime = ptyRuntime();
  if (runtime !== undefined) {
    return { child: spawnOnBunTerminal(runtime, launch), stripEof: false };
  }
  return { child: spawnOnScript(launch), stripEof: true };
};

/**
 * Starts each watch, prefixes its stdout and stderr, and tees those lines to the console sinks and the log file.
 * Specification: openspec/specs/variant-api/runtime/spec.md
 */
export const launchWatches = async (options: LaunchWatchesOptions): Promise<LaunchResult> => {
  const log = options.logPath === undefined ? undefined : openLog(options.logPath);
  const processes: LaunchedWatch[] = [];
  const finished: Promise<void>[] = [];
  if (options.launches.some((launch) => launch.outputMode === "tty")) {
    log?.write(ttyModeLine(options.args ?? ""));
  }
  try {
    for (const launch of options.launches) {
      if (processes.length > 0 && options.startDelayMs > 0) {
        await sleep(options.startDelayMs);
      }
      const banner = `[${launch.key}] ${launch.command}`;
      options.onBanner?.(banner);
      log?.write(`${banner}\n`);
      const terminal = launch.outputMode === "tty";
      let child: ChildProcess;
      let stripEof = false;
      try {
        if (terminal) {
          const spawned = spawnOnTerminal(launch);
          child = spawned.child;
          stripEof = spawned.stripEof;
        } else {
          child = spawn("sh", ["-c", launch.command], {
            cwd: launch.cwd,
            env: launch.env,
            detached: true,
            stdio: [options.inheritStdin === true ? "inherit" : "ignore", "pipe", "pipe"],
          });
        }
      } catch {
        throw new Error(`Could not start ${launch.key} in ${launch.cwd}: ${launch.command}`);
      }
      child.on("error", () => {});
      if (!child.pid || child.stdout === null || child.stderr === null) {
        throw new Error(`Could not start ${launch.key} in ${launch.cwd}: ${launch.command}`);
      }
      // AIDEV-NOTE: a terminal mixes the process stderr into the transcript. That transcript is the stdout stream.
      relay(
        stripEof ? withoutScriptEof(child.stdout) : child.stdout,
        launch.key,
        options.stdout,
        log?.write,
        finished,
        terminal,
      );
      relay(child.stderr, launch.key, options.stderr, log?.write, finished, terminal);
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

const RELAY_FILE = /watch-relay\.(ts|js)$/;

/**
 * The relay file to spawn. The source file while tests import this module. The sibling `watch-relay.js` when this
 * module was bundled into `dist/index.js` or the extension. Anything else is not a relay file.
 */
export const relayModulePath = (): string => {
  const self = fileURLToPath(import.meta.url);
  if (RELAY_FILE.test(self)) {
    return self;
  }
  const sibling = join(dirname(self), "watch-relay.js");
  return existsSync(sibling) ? sibling : self;
};

/**
 * The command that runs this relay. A source checkout or a `watch-relay.js` bundle executes that file. A compiled
 * executable, or a bundle with no relay file beside it, re-enters itself with `--internal-watch-relay`.
 */
export const relaySpawnArgs = (execPath: string, script: string | undefined, relayFile: string): string[] => {
  if (existsSync(relayFile) && RELAY_FILE.test(relayFile)) {
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
  /** Flags of this watch invocation, such as `--detach`. */
  args?: string;
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
  try {
    const plan = JSON.parse(await readStdin()) as RelayPlan;
    const launched = await launchWatches({
      launches: plan.launches,
      startDelayMs: plan.startDelayMs,
      logPath: plan.logPath,
      ...(plan.args === undefined ? {} : { args: plan.args }),
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
  const env = { ...process.env };
  if (process.versions.electron !== undefined) {
    env.ELECTRON_RUN_AS_NODE = "1";
  }
  const child = spawn(args[0] as string, args.slice(1), {
    detached: true,
    stdio: ["pipe", "pipe", "ignore"],
    env,
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
  if (script === undefined || !RELAY_FILE.test(script)) {
    return false;
  }
  try {
    return realpathSync(script) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return pathToFileURL(script).href === import.meta.url;
  }
};

if (invokedDirectly()) {
  // AIDEV-NOTE: No top-level await. The VS Code extension bundles this module as CommonJS.
  void runWatchRelay();
}
