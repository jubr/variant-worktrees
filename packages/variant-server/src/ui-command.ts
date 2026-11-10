import { spawn } from "node:child_process";
import { createVariantClient } from "variant-api";
import { startUiServer, type UiServer } from "./server.js";
import { defaultStaticDir, type StaticApp } from "./static.js";
import {
  chooseUiPort,
  readEntry,
  readToken,
  removeEntry,
  removeToken,
  runningEntry,
  writeEntry,
  writeToken,
} from "./ui-watch.js";

export interface UiCommandOptions {
  /** Any directory of the project. */
  cwd: string;
  env?: NodeJS.ProcessEnv;
  /** Receives every line the command prints. */
  print: (line: string) => void;
  /** Start the server in the background and return once it serves. Needs `respawn`. */
  detach?: boolean;
  /** Stop the server of the project instead of starting one. */
  stop?: boolean;
  /** The command line that runs this command attached, for `detach`: the executable followed by its arguments. */
  respawn?: string[];
  /** The built app (a directory, or a map from file names to paths); the one of the `variant-ui` package by default. */
  staticDir?: StaticApp;
  /** Ends an attached run, the way an interrupt does. */
  signal?: AbortSignal;
  /** Decides whether a port of the range is free, instead of a loopback listen; for tests. */
  isFree?: (port: number) => Promise<boolean>;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
};

const withToken = (url: string, token: string | undefined): string =>
  token === undefined ? url : `${url}/?token=${token}`;

const stopServer = async (options: UiCommandOptions): Promise<number> => {
  const entry = readEntry(options.cwd);
  if (entry?.pid !== undefined && alive(entry.pid)) {
    process.kill(entry.pid, "SIGTERM");
    for (let attempt = 0; attempt < 100 && alive(entry.pid); attempt += 1) {
      await sleep(50);
    }
    if (alive(entry.pid)) {
      process.kill(entry.pid, "SIGKILL");
    }
  }
  // A server that was killed could not clean up after itself.
  removeEntry(options.cwd);
  removeToken(options.cwd);
  return 0;
};

const detached = async (options: UiCommandOptions): Promise<number> => {
  const [command, ...args] = options.respawn ?? [];
  if (command === undefined) {
    throw new Error("--detach needs the command line to start the server with");
  }
  const child = spawn(command, args, { cwd: options.cwd, env: options.env, detached: true, stdio: "ignore" });
  child.unref();
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const entry = runningEntry(options.cwd);
    const token = readToken(options.cwd);
    if (entry?.pid === child.pid && entry?.url !== undefined && token !== undefined) {
      options.print(withToken(entry.url, token));
      return 0;
    }
    await sleep(50);
  }
  options.print("The server did not start in time");
  return 1;
};

/** Binds the server, trying once more with another port when a picked one was taken in the meantime. */
const bind = async (
  options: UiCommandOptions,
  abbr: string,
  client: ReturnType<typeof createVariantClient>,
): Promise<UiServer> => {
  const env = options.env ?? process.env;
  const staticDir = options.staticDir ?? defaultStaticDir();
  for (let attempt = 0; ; attempt += 1) {
    const port = await chooseUiPort(client.config(), env, options.isFree);
    try {
      return await startUiServer({ client, port, abbr, staticDir });
    } catch (error) {
      if (attempt > 0 || (error as NodeJS.ErrnoException).code !== "EADDRINUSE") {
        throw error;
      }
    }
  }
};

/** `variant ui`: start the server attached or detached, report the running one, or stop it. Returns the exit code. */
export const runUi = async (options: UiCommandOptions): Promise<number> => {
  if (options.stop) {
    return stopServer(options);
  }
  const running = runningEntry(options.cwd);
  if (running?.url !== undefined) {
    options.print(withToken(running.url, readToken(options.cwd)));
    return 0;
  }
  if (options.detach) {
    return detached(options);
  }

  const client = createVariantClient({ cwd: options.cwd, worktree: false });
  const server = await bind(options, client.config().variant.abbr, client);
  try {
    writeToken(options.cwd, server.token);
    writeEntry(options.cwd, { port: server.port, pid: process.pid, url: server.url });
    options.print(withToken(server.url, server.token));
    await new Promise<void>((resolve) => {
      if (options.signal?.aborted) {
        resolve();
      }
      options.signal?.addEventListener("abort", () => resolve(), { once: true });
    });
  } finally {
    removeEntry(options.cwd, process.pid);
    removeToken(options.cwd);
    await server.close();
  }
  return 0;
};
