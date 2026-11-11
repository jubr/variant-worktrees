import type { ChildProcess } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { stopProcessTree } from "../processes.js";
import { announce, logToStderr } from "../ready.js";
import { commandEnvironment, expandSetting, type VariantRun } from "../run-context.js";
import { clearVariantRuntime, watchLogPath, writeVariantRuntime } from "../runtime-state.js";
import { resolveSlug } from "../slug.js";
import type { WatchOptions, WatchResult } from "../types.js";
import { launchWatches, startDetachedRelay } from "../watch-relay.js";
import { prepareVariant } from "./prepare.js";
import type { OperationContext } from "./types.js";
import { runtimeOf, watchReports } from "./up.js";

interface Launch {
  key: string;
  command: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  outputMode?: "tty" | "no-tty";
}

interface Started extends Launch {
  child: ChildProcess;
  pid: number;
}

type Outcome = "interrupted" | "ended" | "checkout";

const launches = (context: OperationContext, run: VariantRun, outputMode?: "tty" | "no-tty"): Launch[] => {
  const { config } = context;
  return Object.entries(config.variant.watches).flatMap(([key, watch]) => {
    if (!watch.watch) {
      return [];
    }
    const mode = watch.output?.mode ?? outputMode;
    return [
      {
        key,
        command: expandSetting(config, run, watch.watch, `variant.watches.${key}.watch`, key),
        cwd: resolve(run.projectDir, watch.dir),
        env: commandEnvironment(config, run, watch.env?.overrides, key),
        ...(mode !== undefined ? { outputMode: mode } : {}),
      },
    ];
  });
};

/** Flags of this invocation. A default `miseInstall` of `bg` is omitted, because the CLI fills that in. */
const invocationArgs = (
  options: WatchOptions & { from?: string; pullFf?: boolean; miseInstall?: "bg" | "sync" | "no" },
): string => {
  const args: string[] = [];
  if (options.detach === true) args.push("--detach");
  if (options.reprovision === true) args.push("--reprovision");
  if (options.from !== undefined) args.push("--from", options.from);
  if (options.pullFf === true) args.push("--pull-ff");
  if (options.miseInstall !== undefined && options.miseInstall !== "bg") {
    args.push(`--mise-install=${options.miseInstall}`);
  }
  return args.join(" ");
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
  const toStart = launches(context, run, options.outputMode);
  const args = invocationArgs(options);
  if (toStart.length === 0) {
    log("Warning: nothing was started: no watch has a watch command. Set `watch` on a watch in variants.yaml.");
  }
  // AIDEV-NOTE: detach cannot prefix from this process, because the CLI exits. A child runs the same relay and
  // outlives the call. Attached capture stays in this process. The log is truncated when that relay starts.
  const logFile = toStart.length === 0 ? undefined : watchLogPath(config, run.worktree);
  let closeLog: () => Promise<void> = async () => {};
  let record: ((line: string) => void) | undefined;
  let detachedPids: Record<string, number> | undefined;
  if (options.detach === true) {
    for (const launch of toStart) {
      log(`[${launch.key}] ${launch.command}`);
    }
    if (logFile) {
      try {
        detachedPids = await startDetachedRelay({
          launches: toStart,
          startDelayMs: delay,
          logPath: logFile,
          args,
        });
      } catch (error) {
        rmSync(logFile, { force: true });
        throw error;
      }
    }
  } else if (toStart.length > 0 && logFile) {
    try {
      const launched = await launchWatches({
        launches: toStart,
        startDelayMs: delay,
        stdout: process.stdout,
        stderr: process.stderr,
        logPath: logFile,
        inheritStdin: true,
        onBanner: log,
        args,
      });
      closeLog = launched.close;
      if (launched.writeLog) {
        const writeLog = launched.writeLog;
        record = (line) => writeLog(`${line}\n`);
      }
      started.push(...launched.processes);
    } catch (error) {
      rmSync(logFile, { force: true });
      throw error;
    }
  }
  const pids = detachedPids ?? Object.fromEntries(started.map(({ key, pid }) => [key, pid]));
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
    processes: (detachedPids === undefined ? started : toStart).flatMap((launch) => {
      const pid = pids[launch.key];
      return pid === undefined ? [] : [{ key: launch.key, pid, command: launch.command }];
    }),
    urls: run.urls,
    exitCode: 0,
    commands: [...provisioned.commands, ...started.map(({ command }) => command)],
    output: provisioned.output,
  };
  options.onStarted?.(result);
  if (options.detach) {
    return result;
  }

  const stopAnnouncing = new AbortController();
  const announced = announce(context, run, { ...options, log, signal: stopAnnouncing.signal, record });
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
