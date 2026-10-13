import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { stopProcessTree } from "../processes.js";
import { announce, logToStderr } from "../ready.js";
import { commandEnvironment, type VariantRun } from "../run-context.js";
import { clearVariantRuntime, writeVariantRuntime } from "../runtime-state.js";
import { sleep } from "../sleep.js";
import { resolveSlug } from "../slug.js";
import type { WatchOptions, WatchResult } from "../types.js";
import { prepareVariant } from "./prepare.js";
import type { OperationContext } from "./types.js";
import { runtimeOf } from "./up.js";

/** The key of the one process that runs `variant.watch` when no instance has a command of its own. */
const VARIANT_KEY = "variant";

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
  const own = Object.entries(config.variant.instances).flatMap(([key, instance]) =>
    instance.watch
      ? [
          {
            key,
            command: instance.watch,
            cwd: resolve(run.worktree, instance.dir),
            env: commandEnvironment(config, run, instance.env, key),
          },
        ]
      : [],
  );
  if (own.length > 0 || !config.variant.watch) {
    return own;
  }
  return [
    {
      key: VARIANT_KEY,
      command: config.variant.watch,
      cwd: run.worktree,
      env: commandEnvironment(config, run, undefined),
    },
  ];
};

const spawnProcess = (launch: Launch, detach: boolean): Started => {
  const child = spawn("sh", ["-c", launch.command], {
    cwd: launch.cwd,
    env: launch.env,
    detached: true,
    stdio: detach ? "ignore" : "inherit",
  });
  if (!child.pid) {
    throw new Error(`Could not start ${launch.key}: ${launch.command}`);
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
 * Runs the `watch` command of every instance as a host process in the instance directory and records the process ids.
 * Detached, it returns right away. Attached, it supervises: an interrupt ends everything with 130, one process that ends
 * takes the others down with 1, and so does a worktree that disappears (which also drops the variant's database target).
 */
export const watchVariant = async (
  context: OperationContext,
  requestedSlug?: string,
  options: WatchOptions = {},
): Promise<WatchResult> => {
  const { config } = context;
  const log = options.log ?? logToStderr;
  const slug = resolveSlug(requestedSlug, context.cwd, config.variant.branchPrefixes);
  const { run, provisioned } = await prepareVariant(context, slug, "watch", options);

  const delay = config.variant.supervise.startDelaySeconds * 1000;
  const started: Started[] = [];
  for (const launch of launches(context, run)) {
    if (started.length > 0 && delay > 0) {
      await sleep(delay);
    }
    log(`[${launch.key}] ${launch.command}`);
    started.push(spawnProcess(launch, options.detach === true));
  }
  const pids = Object.fromEntries(started.map(({ key, pid }) => [key, pid]));
  writeVariantRuntime(config, run.worktree, runtimeOf(config, run, "watch", pids));

  const result: WatchResult = {
    slug,
    worktree: run.worktree,
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
  await announced;

  if (outcome === "checkout") {
    log(`The worktree ${run.worktree} is gone: stopped ${slug}`);
    if (slug !== "main") {
      await context.adapter.destroy(slug);
    }
    clearVariantRuntime(config, run.worktree);
  } else if (existsSync(run.worktree)) {
    writeVariantRuntime(config, run.worktree, runtimeOf(config, run, "watch"));
  }
  return { ...result, exitCode: outcome === "interrupted" ? 130 : 1 };
};
