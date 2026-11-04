import { resolve } from "node:path";
import { formatLocalStamp, type ResolvedConfig, type Runtime, readRuntime, type WatchContainer } from "variant-config";
import { containerName, engineHas, networkName, resolveContainerEngine, runEngine } from "../containers.js";
import { announce, logToStderr } from "../ready.js";
import { type VariantRun, variantVariables } from "../run-context.js";
import { variantConfigDir, writeVariantRuntime } from "../runtime-state.js";
import { sleep } from "../sleep.js";
import { resolveSlug } from "../slug.js";
import type { UpOptions, UpResult, WatchReport } from "../types.js";
import { prepareVariant } from "./prepare.js";
import type { OperationContext } from "./types.js";

/** The runtime state of a variant, with the process ids of the watches that run as host processes. */
export const runtimeOf = (
  config: ResolvedConfig,
  run: VariantRun,
  mode: "up" | "watch",
  pids: Readonly<Record<string, number>> = {},
  log?: string,
  now: Date = new Date(),
): Runtime => {
  let previous: Runtime | undefined;
  try {
    previous = readRuntime(variantConfigDir(config, run.worktree), {});
  } catch {
    previous = undefined;
  }
  const startedAt = formatLocalStamp(now);
  const db = config.db;
  return {
    slug: run.slug,
    mode,
    dir: run.worktree,
    ...(log ? { log } : {}),
    ...(previous?.createdAt ? { createdAt: previous.createdAt } : {}),
    db: {
      ...(db.dialect ? { dialect: db.dialect } : {}),
      ...(db.dialect === "sqlite" ? { filename: run.target } : { schema: run.target }),
    },
    watches: Object.fromEntries(
      [...new Set([...Object.keys(config.variant.watches), ...Object.keys(pids)])].map((key) => {
        const starting = mode === "up" || pids[key] !== undefined;
        const kept = previous?.watches?.[key]?.startedAt;
        const stamp = starting ? startedAt : kept;
        return [
          key,
          {
            ...(run.ports[key] !== undefined ? { port: run.ports[key] } : {}),
            ...(run.urls[key] ? { url: run.urls[key] } : {}),
            ...(pids[key] !== undefined ? { pid: pids[key] } : {}),
            ...(stamp ? { startedAt: stamp } : {}),
          },
        ];
      }),
    ),
  };
};

/** The port, URL, process id and container of every watch, for results. */
export const watchReports = (
  run: VariantRun,
  pids: Readonly<Record<string, number>> = {},
  containers: Readonly<Record<string, string>> = {},
): Record<string, WatchReport> =>
  Object.fromEntries(
    [...new Set([...Object.keys(run.ports), ...Object.keys(pids)])].map((key) => [
      key,
      {
        ...(run.ports[key] !== undefined ? { port: run.ports[key] } : {}),
        ...(run.urls[key] ? { url: run.urls[key] } : {}),
        ...(pids[key] !== undefined ? { pid: pids[key] } : {}),
        ...(containers[key] ? { container: containers[key] } : {}),
      },
    ]),
  );

/** The image of a container watch: always built from its Dockerfile, tagged `v-<key>:v-<slug>`. */
const imageOf = (key: string, slug: string): string => `v-${key}:v-${slug}`;

/** The arguments of `run` for one container watch. Only the variant variables reach the container. */
const runArguments = (context: OperationContext, run: VariantRun, key: string, image: string): string[] => {
  const { config } = context;
  const container = config.variant.watches[key]?.container as WatchContainer;
  const environment = variantVariables(config, run, "container");
  const args = ["run", "-d", "--name", containerName(key, run.slug), "--network", networkName(run.slug)];
  args.push("-p", `0.0.0.0:${run.ports[key]}:${container.internalPort ?? 80}`);
  if (environment.POSTGRES_HOST === "host.docker.internal" || environment.MYSQL_HOST === "host.docker.internal") {
    args.push("--add-host", "host.docker.internal:host-gateway");
  }
  // AIDEV-NOTE: a container sees no host path: SQLITE_DATABASE and the storage variable belong to host commands.
  const hostOnly = new Set(["SQLITE_DATABASE", config.variant.storage?.envVarName]);
  for (const [name, value] of Object.entries(environment)) {
    if (!hostOnly.has(name)) {
      args.push("-e", `${name}=${value}`);
    }
  }
  args.push(image);
  return args;
};

/**
 * Starts the containers of every watch that has a `container`, in the listed order: the image build,
 * the network, then the container itself (an earlier one of that name is replaced).
 */
const startContainers = async (
  context: OperationContext,
  run: VariantRun,
  engine: string,
  log: (line: string) => void,
): Promise<{ started: UpResult["containers"] }> => {
  const { config } = context;
  const started: UpResult["containers"] = [];
  const network = networkName(run.slug);
  const delay = config.variant.supervise.startDelaySeconds * 1000;

  for (const [key, watch] of Object.entries(config.variant.watches)) {
    const container = watch.container;
    if (!container) {
      continue;
    }
    if (started.length > 0 && delay > 0) {
      await sleep(delay);
    }
    const image = imageOf(key, run.slug);
    runEngine(
      engine,
      ["build", "-f", resolve(run.projectDir, container.dockerfile), "-t", image, run.projectDir],
      undefined,
      log,
    );
    if (!engineHas(engine, "network", network)) {
      runEngine(engine, ["network", "create", network], undefined, log);
    }
    const name = containerName(key, run.slug);
    if (engineHas(engine, "container", name)) {
      runEngine(engine, ["rm", "-f", name], undefined, log);
    }
    runEngine(engine, runArguments(context, run, key, image), undefined, log);
    started.push({ key, name, port: run.ports[key] as number });
  }
  return { started };
};

/**
 * Brings a variant up as containers: prepares it (clean database target, provisioning), builds and starts every watch
 * that has a `container` and records the runtime state. Fails before anything happens when no container engine exists.
 */
export const upVariant = async (
  context: OperationContext,
  requestedSlug?: string,
  options: UpOptions & { from?: string } = {},
): Promise<UpResult> => {
  const { config } = context;
  const slug = resolveSlug(requestedSlug, context.cwd, config.variant.branchPrefixes, config.variant);
  const engine = resolveContainerEngine(config);
  const { run, provisioned } = await prepareVariant(context, slug, "up", options);
  const { started } = await startContainers(context, run, engine, options.log ?? logToStderr);
  writeVariantRuntime(config, run.worktree, runtimeOf(config, run, "up", {}, undefined, context.now?.() ?? new Date()));
  await announce(context, run, options);
  return {
    slug,
    mode: "up",
    worktree: run.worktree,
    target: run.target,
    watches: watchReports(run, {}, Object.fromEntries(started.map(({ key, name }) => [key, name]))),
    containers: started,
    urls: run.urls,
    commands: provisioned.commands,
    output: provisioned.output,
  };
};
