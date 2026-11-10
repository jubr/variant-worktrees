import { type ChildProcess, spawn } from "node:child_process";
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { stopProcessTree } from "../processes.js";
import { announce, logToStderr } from "../ready.js";
import { commandEnvironment, expandSetting, type VariantRun } from "../run-context.js";
import { clearVariantRuntime, watchLogPath, writeVariantRuntime } from "../runtime-state.js";
import { sleep } from "../sleep.js";
import { resolveSlug } from "../slug.js";
import type { WatchOptions, WatchResult } from "../types.js";
import { launchWatches } from "../watch-relay.js";
import { prepareVariant } from "./prepare.js";
import type { OperationContext } from "./types.js";
import { runtimeOf, watchReports } from "./up.js";

interface Launch {
  key: string;
  command: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
}

interface Started extends Launch {
  child: ChildProcess;
  pid: number;
}

type Outcome = "interrupted" | "ended" | "checkout";

const launches = (context: OperationContext, run: VariantRun): Launch[] => {
  const { config } = context;
  return Object.entries(config.variant.watches).flatMap(([key, watch]) =>
    watch.watch
      ? [
          {
            key,
            command: expandSetting(config, run, watch.watch, `variant.watches.${key}.watch`, key),
            cwd: resolve(run.projectDir, watch.dir),
            env: commandEnvironment(config, run, watch.env?.overrides, key),
          },
        ]
      : [],
  );
};

/** `output` is the descriptor a detached process writes its stdout and stderr to; an attached one uses the console. */
const spawnProcess = (launch: Launch, output: number | undefined): Started => {
  const detach = output !== undefined;
  const child = spawn("sh", ["-c", launch.command], {
    cwd: launch.cwd,
    env: launch.env,
    detached: true,
    stdio: detach ? ["ignore", output, output] : "inherit",
  });
  // a spawn failure is also reported as an event, which must not end the process
  child.on("error", () => {});
  if (!child.pid) {
    throw new Error(`Could not start ${launch.key} in ${launch.cwd}: ${launch.command}`);
  }
  if (detach) {
    child.unref();
  }
  return { ...launch, child, pid: child.pid };
};

/** Resolves with what ended an attached watch: an interrupt, a process that ended, or the vanished worktree. */
const untilEnd = (
  context: OperationContext,
  worktree: string,
  started: Started[],
  signal: AbortSignal | undefined,
): Promise<Outcome> =>
  new Promise((resolveOutcome) => {
    const cleanups: (() => void)[] = [];
    const settle = (outcome: Outcome): void => {
      for (const cleanup of cleanups.splice(0)) {
        cleanup();
      }
      resolveOutcome(outcome);
    };
    const interrupt = (): void => settle("interrupted");
    if (signal?.aborted) {
      return interrupt();
    }
    signal?.addEventListener("abort", interrupt, { once: true });
    cleanups.push(() => signal?.removeEventListener("abort", interrupt));
    for (const name of ["SIGINT", "SIGTERM"] as const) {
      process.once(name, interrupt);
      cleanups.push(() => process.off(name, interrupt));
    }
    for (const { child } of started) {
      const ended = (): void => settle("ended");
      if (child.exitCode !== null || child.signalCode !== null) {
        return settle("ended");
      }
      child.once("exit", ended);
      cleanups.push(() => child.off("exit", ended));
    }
    const poll = context.config.variant.supervise.checkoutPollSeconds;
    if (poll > 0) {
      const timer = setInterval(() => {
        if (!existsSync(worktree)) {
          settle("checkout");
        }
      }, poll * 1000);
      cleanups.push(() => clearInterval(timer));
    }
  });

/**
 * Runs the `watch` command of every watch as a host process in the watch directory and records the process ids.
 * Detached, it returns right away. Attached, it supervises: an interrupt ends everything with 130, one process that ends
 * takes the others down with 1, and so does a worktree that disappears (which also drops the variant's database target).
 */
export const watchVariant = async (
  context: OperationContext,
  requestedSlug?: string,
  options: WatchOptions & { from?: string; pullFf?: boolean; miseInstall?: "bg" | "sync" | "no" } = {},
): Promise<WatchResult> => {
  const { config } = context;
  const log = options.log ?? logToStderr;
  const slug = resolveSlug(requestedSlug, context.cwd, config.variant.branchPrefixes, config.variant);
  const { run, provisioned } = await prepareVariant(context, slug, "watch", options);

  const delay = config.variant.supervise.startDelaySeconds * 1000;
  const started: Started[] = [];
  const toStart = launches(context, run);
  if (toStart.length === 0) {
    log("Warning: nothing was started: no watch has a watch command. Set `watch` on a watch in variants.yaml.");
  }
  // AIDEV-NOTE: a detached watch has no console, so every process appends to one file the kernel writes directly
  // (no pipe), which keeps the output real-time and alive after this process exits. Truncated on each start.
  const detachedLog = options.detach === true && toStart.length > 0 ? watchLogPath(config, run.worktree) : undefined;
  const attachedLog = options.detach === true || toStart.length === 0 ? undefined : watchLogPath(config, run.worktree);
  let closeLog: () => Promise<void> = async () => {};
  if (detachedLog) {
    mkdirSync(dirname(detachedLog), { recursive: true });
    writeFileSync(detachedLog, "");
  }
  const output = detachedLog ? openSync(detachedLog, "a") : undefined;
  try {
    if (options.detach === true) {
      for (const launch of toStart) {
        if (started.length > 0 && delay > 0) {
          await sleep(delay);
        }
        log(`[${launch.key}] ${launch.command}`);
        if (detachedLog) {
          appendFileSync(detachedLog, `[${launch.key}] ${launch.command}\n`);
        }
        try {
          started.push(spawnProcess(launch, output));
        } catch (error) {
          await Promise.all(started.map(({ pid }) => stopProcessTree(pid)));
          if (detachedLog) {
            rmSync(detachedLog, { force: true });
          }
          throw error;
        }
      }
    } else if (toStart.length > 0) {
      try {
        const launched = await launchWatches({
          launches: toStart,
          startDelayMs: delay,
          stdout: process.stdout,
          stderr: process.stderr,
          logPath: attachedLog,
          inheritStdin: true,
          onBanner: log,
        });
        closeLog = launched.close;
        started.push(...launched.processes);
      } catch (error) {
        if (attachedLog) {
          rmSync(attachedLog, { force: true });
        }
        throw error;
      }
    }
  } finally {
    if (output !== undefined) {
      closeSync(output);
    }
  }
  const logFile = detachedLog ?? attachedLog;
  const pids = Object.fromEntries(started.map(({ key, pid }) => [key, pid]));
  writeVariantRuntime(
    config,
    run.worktree,
    runtimeOf(config, run, "watch", pids, logFile, context.now?.() ?? new Date()),
  );

  const result: WatchResult = {
    slug,
    mode: "watch",
    worktree: run.worktree,
    target: run.target,
    watches: watchReports(run, pids),
    processes: started.map(({ key, pid, command }) => ({ key, pid, command })),
    urls: run.urls,
    exitCode: 0,
    commands: [...provisioned.commands, ...started.map(({ command }) => command)],
    output: provisioned.output,
  };
  if (options.detach) {
    return result;
  }

  const stopAnnouncing = new AbortController();
  const announced = announce(context, run, { ...options, log, signal: stopAnnouncing.signal });
  const outcome = await untilEnd(context, run.worktree, started, options.signal);
  stopAnnouncing.abort();
  await Promise.all(started.map(({ pid }) => stopProcessTree(pid)));
  await closeLog();
  await announced;

  if (outcome === "checkout") {
    log(`The worktree ${run.worktree} is gone: stopped ${slug}`);
    if (slug !== "main") {
      await context.adapter.destroy(slug);
    }
    clearVariantRuntime(config, run.worktree);
  } else if (existsSync(run.worktree)) {
    writeVariantRuntime(
      config,
      run.worktree,
      runtimeOf(config, run, "watch", {}, undefined, context.now?.() ?? new Date()),
    );
  }
  return { ...result, exitCode: outcome === "interrupted" ? 130 : 1 };
};
