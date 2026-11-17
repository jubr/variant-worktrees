import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync } from "node:fs";
import { join } from "node:path";
import { commandMessage } from "./command-message.js";
import { LogLevel, log } from "./log.js";
import { levelForDirectory } from "./log-directory.js";
import { logToStderr } from "./ready.js";

/**
 * Specification: openspec/specs/variant-api/core/spec.md
 *
 * Trusts a worktree and installs its Mise tools. Runs only when that directory itself holds a Mise config.
 */

const CONFIG_FILES = [
  "mise.toml",
  ".mise.toml",
  join(".config", "mise", "config.toml"),
  join("mise", "config.toml"),
  ".tool-versions",
] as const;

export type MiseInstallMode = "bg" | "sync" | "no";

/** `undefined` is `bg`. Any other value is an error. */
export const parseMiseInstall = (value: unknown): MiseInstallMode => {
  if (value === undefined) {
    return "bg";
  }
  if (value === "bg" || value === "sync" || value === "no") {
    return value;
  }
  throw new Error(`miseInstall must be bg, sync, or no, not ${String(value)}`);
};

export const worktreeHasMiseConfig = (directory: string): boolean =>
  CONFIG_FILES.some((file) => existsSync(join(directory, file)));

const writeOutput = (output: string): void => {
  const text = output.endsWith("\n") ? output.slice(0, -1) : output;
  if (text !== "") {
    logToStderr(text);
  }
};

const announceMise = (action: string, command: string, slug: string, directory: string): void => {
  log(
    levelForDirectory(LogLevel.debug, directory),
    commandMessage(command),
    slug === "" ? { step: action } : { step: action, slug },
  );
};

/** `mise -C <directory> trust --all`, then `install` when trust exits 0. The caller waits. */
export const installMiseSync = (binary: string, directory: string, action = "create", slug = ""): void => {
  announceMise(action, "mise trust --all", slug, directory);
  const trust = spawnSync(binary, ["-C", directory, "trust", "--all"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const trustOutput = `${trust.stdout ?? ""}${trust.stderr ?? ""}${trust.error?.message ?? ""}`;
  writeOutput(trustOutput);
  if (trust.error || (trust.status ?? 1) !== 0) {
    throw new Error(trustOutput.trim());
  }
  announceMise(action, "mise install", slug, directory);
  const install = spawnSync(binary, ["-C", directory, "install"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const installOutput = `${install.stdout ?? ""}${install.stderr ?? ""}${install.error?.message ?? ""}`;
  writeOutput(installOutput);
  if (install.error || (install.status ?? 1) !== 0) {
    throw new Error(installOutput.trim());
  }
};

const started = (child: ChildProcess): Promise<void> =>
  new Promise((resolve, reject) => {
    child.once("spawn", () => resolve());
    child.once("error", (error) => reject(error));
  });

/** Installs when `directory` has a Mise config. `bg` returns while the run continues. */
export const installMiseInWorktree = async (
  directory: string | undefined,
  mode: MiseInstallMode,
  resolveBinary: () => string | undefined,
  action = "create",
  slug = "",
): Promise<void> => {
  if (directory === undefined || mode === "no" || !worktreeHasMiseConfig(directory)) {
    return;
  }
  let binary: string | undefined;
  try {
    binary = resolveBinary();
  } catch (error) {
    throw new Error(`Mise was not found. ${error instanceof Error ? error.message : String(error)}`);
  }
  if (binary === undefined) {
    throw new Error("Mise was not found. Set variant.mise.binPath to the executable.");
  }
  if (mode === "sync") {
    installMiseSync(binary, directory, action, slug);
    return;
  }
  announceMise(action, "mise trust --all", slug, directory);
  announceMise(action, "mise install", slug, directory);
  await installMiseBackground(binary, directory);
};

/**
 * The command that runs trust, then install only when trust exits 0. The system shell does the chaining. Re-entering
 * `process.execPath` would break in a compiled `variant` (it reads the script path as a command) and in an editor host.
 */
const chainedMiseCommand = (shell: string, binary: string, directory: string): { file: string; args: string[] } => {
  if (process.platform === "win32") {
    const quote = (value: string): string => `"${value}"`;
    return {
      file: shell,
      args: [
        "/d",
        "/s",
        "/c",
        `"${quote(binary)} -C ${quote(directory)} trust --all && ${quote(binary)} -C ${quote(directory)} install"`,
      ],
    };
  }
  return {
    file: shell,
    args: ["-c", '"$1" -C "$2" trust --all && exec "$1" -C "$2" install', "sh", binary, directory],
  };
};

/** Starts trust then install and returns while that run continues. Its output replaces the log. */
export const installMiseBackground = async (
  binary: string,
  directory: string,
  shell: string = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "/bin/sh",
): Promise<void> => {
  const cache = join(directory, ".cache", "variant");
  mkdirSync(cache, { recursive: true });
  const logPath = join(cache, "mise-install.log");
  const log = openSync(logPath, "w");
  const command = chainedMiseCommand(shell, binary, directory);
  const child = spawn(command.file, command.args, {
    detached: true,
    stdio: ["ignore", log, log],
    windowsVerbatimArguments: process.platform === "win32",
  });
  try {
    await started(child);
  } catch (error) {
    closeSync(log);
    throw new Error(`Mise install could not be started. ${error instanceof Error ? error.message : String(error)}`);
  }
  closeSync(log);
  child.unref();
  logToStderr(`mise install started in the background: ${logPath}`);
};
