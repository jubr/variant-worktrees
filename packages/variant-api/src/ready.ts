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
}

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

const answers = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
    return response.ok;
  } catch {
    return false;
  }
};

/**
 * Polls `http://127.0.0.1:<port><ready>` once per second for every instance that sets `ready`, until all answer with a
 * success status or `supervise.readyTimeoutSeconds` have passed.
 */
const waitUntilReady = async (
  context: OperationContext,
  run: VariantRun,
  signal: AbortSignal | undefined,
): Promise<boolean> => {
  const waiting = Object.entries(context.config.variant.instances).flatMap(([key, instance]) =>
    instance.ready === undefined ? [] : [{ key, url: `http://127.0.0.1:${run.ports[key]}${instance.ready}` }],
  );
  const deadline = Date.now() + context.config.variant.supervise.readyTimeoutSeconds * 1000;
  while (waiting.length > 0) {
    const checks = await Promise.all(waiting.map(({ url }) => answers(url)));
    for (let index = checks.length - 1; index >= 0; index -= 1) {
      if (checks[index]) {
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
 * Once the instances serve (or right away when none sets `ready`), prints the URL of every instance that has an `open`
 * template and opens each one unless `variant.open` is off. On timeout it warns and opens nothing. Returns whether the
 * instances became ready.
 */
export const announce = async (
  context: OperationContext,
  run: VariantRun,
  options: AnnounceOptions = {},
): Promise<boolean> => {
  const log = options.log ?? logToStderr;
  const ready = await waitUntilReady(context, run, options.signal);
  if (options.signal?.aborted) {
    return false;
  }
  if (!ready) {
    log(
      `Warning: not all instances answered within ${context.config.variant.supervise.readyTimeoutSeconds}s; they keep running`,
    );
    return false;
  }
  const opener = options.opener ?? openInBrowser;
  for (const [key, url] of Object.entries(run.urls)) {
    log(`${key}: ${url}`);
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
