import { spawn } from "node:child_process";
import type { OperationContext } from "./operations/types.js";
import type { VariantRun } from "./run-context.js";
import { sleep } from "./sleep.js";

/** Writes a line for the person running the command. It goes to stderr: stdout belongs to results and to MCP. */
export const logToStderr = (line: string): void => {
  process.stderr.write(`${line}\n`);
};

export interface AnnounceOptions {
  /** Opens a URL; the default launches the system browser. A failure is reported, never thrown. */
  opener?: (url: string) => void | Promise<void>;
  log?: (line: string) => void;
  /** Ends the readiness polling early. */
  signal?: AbortSignal;
  /** Appends the same ready line to the watch log. `up` leaves this unset. */
  record?: (line: string) => void;
  /** Attached `watch` whose stderr is a terminal. Prints the key hint once every ready watch has returned 200. */
  tty?: boolean;
  /** Fires when the watches are up, after the hint when `tty` is set. */
  onRunning?: () => void;
}

const ESC = "\u001b";
const RESET = `${ESC}[0m`;
/** Bold cyan, the same code git uses for `HEAD`. */
const HEAD = `${ESC}[1;36m`;
/** Yellow, the same code the Nest log text uses. */
const YELLOW = `${ESC}[33m`;
/** Dark gray, the same code yq uses for a comment. */
const COMMENT = `${ESC}[90m`;

/** A `[watch]` comment introducing the last 50 log lines. The `#` clause uses the yq comment gray. */
export const watchTailComment = (color: boolean): string => {
  const comment = "# already running: reattached, showing last 50 lines";
  return color ? `[watch] ${COMMENT}${comment}${RESET}` : `[watch] ${comment}`;
};

/** The key hint. Numbers use the HEAD color, the words use the Nest yellow, and the parenthetical is a comment. */
const interactiveWatchLine = (color: boolean): string => {
  const key = (value: string): string => (color ? `${HEAD}${value}${RESET}` : value);
  const word = (value: string): string => (color ? `${YELLOW}${value}${RESET}` : value);
  const hint = "(press number + ⏎)";
  return `[watch] Interactive:   ${key("1")} ${word("restart")}   ${key("2")} ${word("detach")}   ${key("3")} ${word("quit")}   ${color ? `${COMMENT}${hint}${RESET}` : hint}`;
};

/** The interactive command line, colored when `color` is set. */
export const watchCommandLine = (color: boolean): string => interactiveWatchLine(color);

/** Launches the system browser for `url`. Rejects when the launcher cannot be started. */
export const openInBrowser = (url: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const [command, args]: [string, string[]] =
      process.platform === "darwin"
        ? ["open", [url]]
        : process.platform === "win32"
          ? ["cmd", ["/c", "start", "", url]]
          : ["xdg-open", [url]];
    const child = spawn(command, args, { stdio: "ignore", detached: true });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });

/** `[watch] {name} URL try {url}` or `[watch] {name} URL 200 {url}`. Shared with the variants tree. */
export const readyProbeLine = (name: string, phase: "try" | "200", url: string): string =>
  `[watch] ${name} URL ${phase} ${url}`;

/** Joins a rendered watch URL with `ready`, keeping a single slash. */
const joinReady = (base: string, ready: string): string => {
  const left = base.endsWith("/") ? base.slice(0, -1) : base;
  const right = ready.startsWith("/") ? ready : `/${ready}`;
  return `${left}${right}`;
};

const answers = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
    return response.status === 200;
  } catch {
    return false;
  }
};

/** `[watch] {name} URL 200 {url}` for every watch whose `ready` URL answers 200, in config order. */
export const readyStatusLines = async (context: OperationContext, run: VariantRun): Promise<string[]> => {
  const waiting = Object.entries(context.config.variant.watches).flatMap(([key, watch]) => {
    if (watch.ready === undefined) {
      return [];
    }
    const url = run.urls[key]
      ? joinReady(run.urls[key], watch.ready)
      : `http://127.0.0.1:${run.ports[key]}${watch.ready}`;
    return [{ key, url }];
  });
  const lines: string[] = [];
  for (const item of waiting) {
    if (await answers(item.url)) {
      lines.push(readyProbeLine(item.key, "200", item.url));
    }
  }
  return lines;
};

/**
 * Polls every watch that sets `ready` once per second, until each has returned status 200 or
 * `supervise.readyTimeoutSeconds` have passed. A watch with a URL is probed at that URL joined with `ready`;
 * otherwise at `http://127.0.0.1:<port><ready>`.
 * Specification: openspec/specs/variant-api/runtime/spec.md
 */
const waitUntilReady = async (
  context: OperationContext,
  run: VariantRun,
  log: (line: string) => void,
  record: ((line: string) => void) | undefined,
  signal: AbortSignal | undefined,
): Promise<boolean> => {
  const waiting = Object.entries(context.config.variant.watches).flatMap(([key, watch]) => {
    if (watch.ready === undefined) {
      return [];
    }
    const url = run.urls[key]
      ? joinReady(run.urls[key], watch.ready)
      : `http://127.0.0.1:${run.ports[key]}${watch.ready}`;
    return [{ key, url }];
  });
  const tried = new Set<string>();
  const ready = new Set<string>();
  const report = (key: string, phase: "try" | "200", url: string): void => {
    const line = readyProbeLine(key, phase, url);
    log(line);
    record?.(line);
  };
  const deadline = Date.now() + context.config.variant.supervise.readyTimeoutSeconds * 1000;
  while (waiting.length > 0) {
    for (const item of waiting) {
      if (!tried.has(item.key)) {
        tried.add(item.key);
        report(item.key, "try", item.url);
      }
    }
    const checks = await Promise.all(waiting.map(({ url }) => answers(url)));
    for (let index = checks.length - 1; index >= 0; index -= 1) {
      const item = waiting[index];
      if (item && checks[index]) {
        if (!ready.has(item.key)) {
          ready.add(item.key);
          report(item.key, "200", item.url);
        }
        waiting.splice(index, 1);
      }
    }
    if (waiting.length === 0) {
      return true;
    }
    if (signal?.aborted || Date.now() >= deadline) {
      return false;
    }
    await sleep(1000, signal);
  }
  return true;
};

/**
 * Once the watches serve (or right away when none sets `ready`), opens the URL of every watch that has one unless
 * `variant.open` is off. On timeout it warns and opens nothing. Returns whether the watches became ready.
 */
export const announce = async (
  context: OperationContext,
  run: VariantRun,
  options: AnnounceOptions = {},
): Promise<boolean> => {
  const log = options.log ?? logToStderr;
  const ready = await waitUntilReady(context, run, log, options.record, options.signal);
  if (options.signal?.aborted) {
    return false;
  }
  if (!ready) {
    log(
      `Warning: not all watches answered within ${context.config.variant.supervise.readyTimeoutSeconds}s; they keep running`,
    );
    return false;
  }
  if (options.tty === true) {
    log(interactiveWatchLine(process.env.NO_COLOR === undefined));
  }
  options.onRunning?.();
  const opener = options.opener ?? openInBrowser;
  for (const url of Object.values(run.urls)) {
    if (context.config.variant.open) {
      try {
        await opener(url);
      } catch (error) {
        log(`Could not open ${url}: ${(error as Error).message}`);
      }
    }
  }
  return true;
};
