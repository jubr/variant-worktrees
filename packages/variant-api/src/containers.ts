import { execFileSync } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { delimiter, join } from "node:path";
import type { ResolvedConfig } from "variant-config";
import { echoCommand, engineCommandLine, type ProgressLog } from "./echo.js";

export type ContainerEngine = string;

export const containerName = (key: string, slug: string): string => `v-${key}-${slug}`;
export const networkName = (slug: string): string => `v-net-${slug}`;
/** The generated web server configuration of a static instance, next to the state files. */
export const nginxConfigPath = (stateDir: string, slug: string, key: string): string =>
  join(stateDir, `${slug}.${key}.nginx.conf`);

const onPath = (name: string, env: NodeJS.ProcessEnv): boolean =>
  (env.PATH ?? "").split(delimiter).some((directory) => {
    try {
      accessSync(join(directory, name), constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });

/** The engine that runs containers, or nothing: `CONTAINER_ENGINE`, `variant.containerEngine`, `docker`, `podman`. */
export const findContainerEngine = (
  config: ResolvedConfig,
  env: NodeJS.ProcessEnv = process.env,
): ContainerEngine | undefined =>
  env.CONTAINER_ENGINE || config.variant.containerEngine || ["docker", "podman"].find((name) => onPath(name, env));

/** Like `findContainerEngine`, but fails naming both engines when there is none. */
export const resolveContainerEngine = (
  config: ResolvedConfig,
  env: NodeJS.ProcessEnv = process.env,
): ContainerEngine => {
  const engine = findContainerEngine(config, env);
  if (!engine) {
    throw new Error("No container engine found: install docker or podman, or set CONTAINER_ENGINE");
  }
  return engine;
};

/**
 * Runs the engine with arguments (never through a shell) and returns its output; throws with the output on failure.
 * A `log` receives the command line first, with the values of `-e` arguments hidden.
 */
export const runEngine = (engine: ContainerEngine, args: string[], cwd?: string, log?: ProgressLog): string => {
  if (log) {
    echoCommand(engineCommandLine(engine, args), log);
  }
  try {
    return execFileSync(engine, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string; status?: number };
    throw new Error(
      `${engine} ${args.join(" ")} failed (${failure.status ?? 1}): ${`${failure.stdout ?? ""}${failure.stderr ?? ""}`.trim()}`,
    );
  }
};

/** Whether the engine knows the container or network (`inspect` succeeds). */
export const engineHas = (engine: ContainerEngine, kind: "container" | "network", name: string): boolean => {
  try {
    runEngine(engine, kind === "network" ? ["network", "inspect", name] : ["inspect", name]);
    return true;
  } catch {
    return false;
  }
};
