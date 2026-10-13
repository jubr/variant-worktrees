import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { InstanceContainer, ResolvedConfig, Runtime } from "variant-config";
import { renderTemplate } from "variant-config";
import {
  containerName,
  engineHas,
  networkName,
  nginxConfigPath,
  resolveContainerEngine,
  runEngine,
} from "../containers.js";
import { hostOf, STATIC_ROOT, staticSiteConfig } from "../nginx.js";
import { execute, type ProvisionOptions } from "../provisioning.js";
import { commandEnvironment, expandEnv, templateContext, type VariantRun, variantVariables } from "../run-context.js";
import { writeVariantRuntime } from "../runtime-state.js";
import { resolveSlug } from "../slug.js";
import type { UpResult } from "../types.js";
import { prepareVariant } from "./prepare.js";
import type { OperationContext } from "./types.js";

const STATIC_IMAGE = "nginx:alpine";
const NGINX_CONF_TARGET = "/etc/nginx/conf.d/default.conf";

export const sleep = (milliseconds: number): Promise<void> => new Promise((done) => setTimeout(done, milliseconds));

/** The runtime state of a variant, with the process ids of the instances that run as host processes. */
export const runtimeOf = (
  config: ResolvedConfig,
  run: VariantRun,
  mode: "up" | "watch",
  pids: Readonly<Record<string, number>> = {},
): Runtime => {
  const db = config.db;
  return {
    slug: run.slug,
    mode,
    dir: run.worktree,
    db: {
      ...(db.dialect ? { dialect: db.dialect } : {}),
      ...(db.dialect === "sqlite" ? { filename: run.target } : { schema: run.target }),
    },
    instances: Object.fromEntries(
      Object.keys(config.variant.instances).map((key) => [
        key,
        {
          port: run.ports[key],
          ...(run.urls[key] ? { url: run.urls[key] } : {}),
          ...(pids[key] !== undefined ? { pid: pids[key] } : {}),
        },
      ]),
    ),
  };
};

/** The image a container instance runs and, for a `dockerfile`, the build that produces it. */
const imageOf = (key: string, slug: string, container: InstanceContainer): { image: string; build: boolean } => {
  if (container.dockerfile !== undefined) {
    return { image: `${container.image ?? `v-${key}`}:v-${slug}`, build: true };
  }
  return { image: container.image ?? STATIC_IMAGE, build: false };
};

/** The generated web server configuration of a static instance, written next to the state files. */
const writeSiteConfig = (
  context: OperationContext,
  run: VariantRun,
  key: string,
  container: InstanceContainer,
): string => {
  const { config, stateDir } = context;
  const target = container.proxy ? config.variant.instances[container.proxy.to]?.container : undefined;
  const path = nginxConfigPath(stateDir, run.slug, key);
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(
    path,
    staticSiteConfig({
      host: hostOf(run.urls[key]),
      ...(container.proxy && target?.port !== undefined
        ? {
            proxy: {
              path: container.proxy.path,
              upstream: `http://${containerName(container.proxy.to, run.slug)}:${target.port}`,
            },
          }
        : {}),
    }),
  );
  return path;
};

/** The arguments of `run` for one container instance. */
const runArguments = (
  context: OperationContext,
  run: VariantRun,
  key: string,
  image: string,
  siteConfig: string | undefined,
): string[] => {
  const { config } = context;
  const instance = config.variant.instances[key];
  const container = instance?.container as InstanceContainer;
  const variables = variantVariables(config, run, "container");
  const environment = { ...variables, ...expandEnv(instance?.env, run, key), ...expandEnv(container.env, run, key) };
  const args = ["run", "-d", "--name", containerName(key, run.slug), "--network", networkName(run.slug)];
  args.push("-p", `0.0.0.0:${run.ports[key]}:${container.port ?? 80}`);
  if (variables.POSTGRES_HOST === "host.docker.internal" || variables.MYSQL_HOST === "host.docker.internal") {
    args.push("--add-host", "host.docker.internal:host-gateway");
  }
  for (const [name, value] of Object.entries(environment)) {
    args.push("-e", `${name}=${value}`);
  }
  if (container.static !== undefined) {
    args.push("-v", `${resolve(run.worktree, instance?.dir ?? ".", container.static)}:${STATIC_ROOT}:ro`);
    if (siteConfig) {
      args.push("-v", `${siteConfig}:${NGINX_CONF_TARGET}:ro`);
    }
  }
  for (const volume of container.volumes ?? []) {
    args.push("-v", renderTemplate(volume, templateContext(run, key)));
  }
  args.push(image);
  return args;
};

/**
 * Starts the containers of every instance that has a `container`, in the listed order: its build command, the image,
 * the network, then the container itself (an earlier one of that name is replaced).
 */
const startContainers = async (
  context: OperationContext,
  run: VariantRun,
  engine: string,
): Promise<{ started: UpResult["containers"]; output: string; commands: string[] }> => {
  const { config } = context;
  const started: UpResult["containers"] = [];
  const commands: string[] = [];
  let output = "";
  const network = networkName(run.slug);
  const delay = config.variant.supervise.startDelaySeconds * 1000;

  for (const [key, instance] of Object.entries(config.variant.instances)) {
    const container = instance.container;
    if (!container) {
      continue;
    }
    if (started.length > 0 && delay > 0) {
      await sleep(delay);
    }
    const directory = resolve(run.worktree, instance.dir);
    if (container.build) {
      commands.push(container.build);
      const result = execute(container.build, directory, commandEnvironment(config, run, instance.env, key));
      if (!result.ok) {
        throw new Error(`Build of ${key} failed (${result.status}): ${container.build}\n${result.output}`);
      }
      output += result.output;
    }
    const { image, build } = imageOf(key, run.slug, container);
    if (build) {
      runEngine(engine, [
        "build",
        "-f",
        resolve(run.worktree, container.dockerfile as string),
        "-t",
        image,
        run.worktree,
      ]);
    }
    if (!engineHas(engine, "network", network)) {
      runEngine(engine, ["network", "create", network]);
    }
    const name = containerName(key, run.slug);
    if (engineHas(engine, "container", name)) {
      runEngine(engine, ["rm", "-f", name]);
    }
    const siteConfig = container.static !== undefined ? writeSiteConfig(context, run, key, container) : undefined;
    runEngine(engine, runArguments(context, run, key, image, siteConfig));
    started.push({ key, name, port: run.ports[key] as number });
  }
  return { started, output, commands };
};

/**
 * Brings a variant up as containers: prepares it (clean database target, provisioning), builds and starts every instance
 * that has a `container` and records the runtime state. Fails before anything happens when no container engine exists.
 */
export const upVariant = async (
  context: OperationContext,
  requestedSlug?: string,
  options: ProvisionOptions = {},
): Promise<UpResult> => {
  const { config } = context;
  const slug = resolveSlug(requestedSlug, context.cwd, config.variant.branchPrefixes);
  const engine = resolveContainerEngine(config);
  const { run, provisioned } = await prepareVariant(context, slug, "up", options);
  const { started, output, commands } = await startContainers(context, run, engine);
  writeVariantRuntime(config, run.worktree, runtimeOf(config, run, "up"));
  return {
    slug,
    worktree: run.worktree,
    containers: started,
    urls: run.urls,
    commands: [...provisioned.commands, ...commands],
    output: `${provisioned.output}${output}`,
  };
};
