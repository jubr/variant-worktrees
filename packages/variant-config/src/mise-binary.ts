import { accessSync, constants, statSync } from "node:fs";
import { delimiter, isAbsolute, join, resolve } from "node:path";

/**
 * Specification: openspec/specs/tools/mise/spec.md (Mise executable resolution)
 */

export interface ResolveMiseOptions {
  /** The path the caller was given, the VS Code setting `variant.mise.binPath`. */
  configured?: string;
  /** The key `variant.mise.binPath` of `variants.yaml`; a relative value resolves against `configDir`. */
  fromConfig?: string;
  /** The directory of the `variants.yaml` that `fromConfig` came from. */
  configDir?: string;
  /** Supplies `PATH`; the process environment by default. */
  env?: NodeJS.ProcessEnv;
  /** The home directory that `~` stands for in the usual locations. */
  home?: string;
  platform?: NodeJS.Platform;
  /** The usual locations to try after `PATH`; the built-in list by default. */
  locations?: readonly string[];
}

const executableName = (platform: NodeJS.Platform): string => (platform === "win32" ? "mise.exe" : "mise");

/** Where an editor started from the desktop, with a `PATH` that lacks them, still finds Mise. */
const usualLocations = (home: string, platform: NodeJS.Platform, env: NodeJS.ProcessEnv): string[] => [
  "/opt/homebrew/bin/mise",
  "/usr/local/bin/mise",
  "/usr/bin/mise",
  "/home/linuxbrew/.linuxbrew/bin/mise",
  join(home, ".local", "bin", "mise"),
  join(home, ".local", "share", "mise", "bin", "mise"),
  join(home, ".cargo", "bin", "mise"),
  ...(platform === "win32" && env.LOCALAPPDATA ? [join(env.LOCALAPPDATA, "mise", "bin", "mise.exe")] : []),
];

const homeOf = (options: ResolveMiseOptions, env: NodeJS.ProcessEnv): string => options.home ?? env.HOME ?? "";

/** The places `resolveMiseBinary` tries after the configured paths: every `PATH` directory, then the usual locations. */
export const miseSearchPlaces = (options: ResolveMiseOptions = {}): string[] => {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const directories = (env.PATH ?? "").split(delimiter).filter((directory) => directory !== "");
  return [
    ...directories.map((directory) => join(directory, executableName(platform))),
    ...(options.locations ?? usualLocations(homeOf(options, env), platform, env)),
  ];
};

const isExecutableFile = (path: string): boolean => {
  try {
    if (!statSync(path).isFile()) {
      return false;
    }
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

/**
 * The Mise executable: the path the caller passes (the editor setting), the `variant.mise.binPath` key of
 * `variants.yaml`, the directories of `PATH`, then the usual install locations. A configured path that is not an
 * executable file is an error naming where it came from rather than a fall-through to another Mise. Nothing when no
 * place holds one.
 */
export const resolveMiseBinary = (options: ResolveMiseOptions = {}): string | undefined => {
  if (options.configured !== undefined && options.configured !== "") {
    if (!isExecutableFile(options.configured)) {
      throw new Error(`variant.mise.binPath setting ${options.configured} is not an executable file`);
    }
    return options.configured;
  }
  if (options.fromConfig !== undefined) {
    const path = isAbsolute(options.fromConfig)
      ? options.fromConfig
      : resolve(options.configDir ?? process.cwd(), options.fromConfig);
    if (!isExecutableFile(path)) {
      throw new Error(`variant.mise.binPath in variants.yaml ${path} is not an executable file`);
    }
    return path;
  }
  return miseSearchPlaces(options).find(isExecutableFile);
};
