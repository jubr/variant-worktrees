import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  type LoadConfigOptions,
  loadConfig,
  parseDotenv,
  type ResolvedConfig,
  resolveMiseBinary,
} from "variant-config";

/**
 * Specification: openspec/specs/tools/mise/spec.md
 *
 * Everything that runs Mise lives here, so the CLI, the MCP server and the extension share it. The executable comes
 * from `resolveMiseBinary` (variant-config).
 */

const MAX_OUTPUT = 16 * 1024 * 1024;

/** A failed run of Mise: the directory, Mise's message, and whether it refused an untrusted configuration. */
export class MiseError extends Error {
  readonly directory: string;
  /** Mise's own message, without the directory. */
  readonly detail: string;
  /** Whether Mise reported that configuration files are not trusted, which `mise trust` fixes. */
  readonly untrusted: boolean;

  constructor(directory: string, detail: string) {
    super(`mise failed in ${directory}: ${detail}`);
    this.name = "MiseError";
    this.directory = directory;
    this.detail = detail;
    this.untrusted = /not trusted/i.test(detail);
  }
}

interface MiseRun {
  directory: string;
  binary: string;
}

/** Runs `mise -C <directory> <args>` and returns its output; any failure is a `MiseError`. */
const runMise = ({ directory, binary }: MiseRun, args: readonly string[]): string => {
  const result = spawnSync(binary, ["-C", directory, ...args], {
    encoding: "utf8",
    maxBuffer: MAX_OUTPUT,
    env: process.env,
  });
  if (result.error) {
    throw new MiseError(directory, result.error.message);
  }
  if (result.status !== 0) {
    const message = (result.stderr || result.stdout || "").trim();
    throw new MiseError(directory, message === "" ? `mise exited with status ${result.status}` : message);
  }
  return result.stdout;
};

export interface MiseEnvironmentOptions {
  directory: string;
  /** The Mise executable; without one the environment is `base` alone. */
  binary: string | undefined;
  /** What Mise's values are merged over; the process environment by default. */
  base?: NodeJS.ProcessEnv;
}

/**
 * The environment provider of `loadConfig`: `mise -C <directory> env --dotenv --quiet`, run when the returned
 * function is first called and not again, merged over `base`. A value from Mise wins. Without a Mise executable the
 * process environment is used alone, so CI and containers without Mise keep working; a Mise that fails throws
 * `MiseError` rather than falling back, because the wrong database would be worse.
 */
export const miseEnvironment = (options: MiseEnvironmentOptions): (() => NodeJS.ProcessEnv) => {
  let cached: NodeJS.ProcessEnv | undefined;
  return () => {
    if (cached === undefined) {
      const base = options.base ?? process.env;
      cached = options.binary
        ? {
            ...base,
            ...parseDotenv(
              runMise({ directory: options.directory, binary: options.binary }, ["env", "--dotenv", "--quiet"]),
            ),
          }
        : base;
    }
    return cached;
  };
};

export interface VariableSourcesOptions {
  directory: string;
  binary: string | undefined;
  /** What `~` stands for; the home directory by default. */
  home?: string;
}

/** A source that is no absolute path or `~/...`: a path with spaces cannot be told from the value. */
export const UNKNOWN_SOURCE = "mise";

/**
 * Where each variable that Mise lists is defined: `mise set --raw --quiet` prints `KEY VALUE SOURCE` per variable, the
 * source with the home directory as `~`. A variable that Mise does not list is not in the result (it comes from the
 * process environment). A line whose last token is no path maps to `UNKNOWN_SOURCE`. Empty without a Mise executable.
 */
export const readVariableSources = (options: VariableSourcesOptions): Record<string, string> => {
  if (!options.binary) {
    return {};
  }
  const home = options.home ?? homedir();
  const sources: Record<string, string> = {};
  const output = runMise({ directory: options.directory, binary: options.binary }, ["set", "--raw", "--quiet"]);
  for (const line of output.split("\n")) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s+(.*\S)\s*$/.exec(line);
    if (!match?.[1] || !match[2]) {
      continue;
    }
    const source = match[2].split(/\s+/).at(-1) ?? "";
    sources[match[1]] = source.startsWith("~/")
      ? join(home, source.slice(2))
      : source.startsWith("/")
        ? source
        : UNKNOWN_SOURCE;
  }
  return sources;
};

/** `mise trust --all` in `directory`: the files in it and its parents, which is the set `mise env` refuses. */
export const runMiseTrust = (run: MiseRun): void => {
  runMise(run, ["trust", "--all"]);
};

export interface LoadVariantConfigOptions extends Omit<LoadConfigOptions, "environment"> {
  /** The Mise executable the caller was given (the editor setting `variant.mise.binPath`); wins over the file. */
  miseBinPath?: string;
}

/** The Mise executable for `config`: the caller's path, the `variant.mise.binPath` key, `PATH`, usual locations. */
export const miseBinaryFor = (config: ResolvedConfig, configured?: string): string | undefined =>
  resolveMiseBinary({ configured, fromConfig: config.variant.mise?.binPath, configDir: config.configDir });

/**
 * `loadConfig` with the environment read through Mise: lazily, once per loaded configuration, with the executable
 * resolved when it is first needed. Use it wherever the process is the CLI, the MCP server or the extension.
 */
export const loadVariantConfig = (options: LoadVariantConfigOptions = {}): ResolvedConfig => {
  const { miseBinPath, ...rest } = options;
  const holder: { config?: ResolvedConfig } = {};
  let provider: (() => NodeJS.ProcessEnv) | undefined;
  holder.config = loadConfig({
    ...rest,
    environment: () => {
      const config = holder.config as ResolvedConfig;
      provider ??= miseEnvironment({ directory: config.configDir, binary: miseBinaryFor(config, miseBinPath) });
      return provider();
    },
  });
  return holder.config;
};
