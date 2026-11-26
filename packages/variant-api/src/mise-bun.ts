import { spawnSync } from "node:child_process";
import { accessSync, constants, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join, sep } from "node:path";
import type { ProgressLog } from "./echo.js";
import { runMise } from "./mise.js";

/**
 * Specification: openspec/specs/tools/mise/spec.md (Bun on PATH matches the Bun Mise pins)
 */

const PROBE_TIMEOUT_MS = 5000;

/** The shell startup files whose lines are searched for the directory of a foreign Bun, relative to the home. */
const STARTUP_FILES = [
  ".zshrc",
  ".zshenv",
  ".zprofile",
  ".bashrc",
  ".bash_profile",
  ".profile",
  join(".config", "fish", "config.fish"),
];

export interface BunCheckOptions {
  /** The project directory Mise resolves the pinned Bun for. */
  directory: string;
  /** The Mise executable; without one the check is skipped. */
  binary: string | undefined;
  /** The environment host commands run with; its `PATH` decides which `bun` they find. */
  env: NodeJS.ProcessEnv;
  /** What `~` and `$HOME` stand for in the shell startup files; the home directory by default. */
  home?: string;
}

/** What the check found: `differs` carries the `hint`, the other statuses leave it empty. */
export interface BunCheck {
  status: "matches" | "differs" | "unchecked";
  message: string;
  hint: string[];
}

const unchecked: BunCheck = {
  status: "unchecked",
  message: "not checked: it needs Mise, a Bun that Mise pins, and a bun on PATH",
  hint: [],
};

/** The version Mise resolves for Bun in `directory`, or nothing when it pins none or Mise fails. */
const pinnedVersion = (directory: string, binary: string): string | undefined => {
  try {
    const parsed: unknown = JSON.parse(runMise({ directory, binary }, ["ls", "--current", "--json", "bun"]));
    const entries = Array.isArray(parsed) ? parsed : ((parsed as { bun?: unknown } | null)?.bun ?? []);
    const first = Array.isArray(entries) ? (entries[0] as { version?: unknown } | undefined) : undefined;
    return typeof first?.version === "string" && first.version !== "" ? first.version : undefined;
  } catch {
    return undefined;
  }
};

/** The first executable `bun` in the directories of `path`. */
const firstBun = (path: string): { executable: string; directory: string } | undefined => {
  for (const directory of path.split(delimiter).filter((entry) => entry !== "")) {
    const executable = join(directory, "bun");
    try {
      accessSync(executable, constants.X_OK);
      return { executable, directory };
    } catch {}
  }
  return undefined;
};

const versionOf = (executable: string, env: NodeJS.ProcessEnv): string | undefined => {
  const result = spawnSync(executable, ["--version"], { encoding: "utf8", env, timeout: PROBE_TIMEOUT_MS });
  const version = result.status === 0 ? result.stdout.trim().replace(/^v/, "") : "";
  return version === "" ? undefined : version;
};

const miseBunPath = (directory: string, binary: string): string => {
  try {
    return runMise({ directory, binary }, ["which", "bun"]).trim() || "(unknown)";
  } catch {
    return "(unknown)";
  }
};

const underHome = (path: string, home: string): string | undefined =>
  path === home || path.startsWith(`${home}${sep}`) ? path.slice(home.length + 1) : undefined;

const tilde = (path: string, home: string): string => {
  const relative = underHome(path, home);
  return relative === undefined ? path : relative === "" ? "~" : join("~", relative);
};

const realOrSelf = (path: string): string => {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};

/** Whether the path is inside a Mise `installs` directory: the default layout, or the `installs` of `MISE_DATA_DIR`. */
const inMiseInstalls = (paths: string[], env: NodeJS.ProcessEnv): boolean => {
  const data = env.MISE_DATA_DIR;
  return paths.some(
    (path) =>
      path.includes(`${sep}mise${sep}installs${sep}`) ||
      (data !== undefined && data !== "" && path.startsWith(join(data, "installs") + sep)),
  );
};

/** How to remove the Bun, from where it lies; the installer shows in the path. */
const removal = (
  executable: string,
  home: string,
  env: NodeJS.ProcessEnv,
): { advice: string; installer: boolean; mise?: true } => {
  const paths = [executable, realOrSelf(executable)];
  // AIDEV-NOTE: a Mise install is checked first: deleting it would break Mise, and the `PATH` entry came from the environment of a parent process.
  if (inMiseInstalls(paths, env)) {
    return {
      advice:
        "that Bun is another version installed by Mise; do not delete it. PATH was probably inherited from a process that had Mise active for another project: start the editor or terminal again from a shell without it",
      installer: false,
      mise: true,
    };
  }
  if (paths.some((path) => underHome(path, join(home, ".bun")) !== undefined || path === join(home, ".bun"))) {
    return { advice: "rm -rf ~/.bun (the official installer; also drop BUN_INSTALL)", installer: true };
  }
  if (paths.some((path) => /\/(homebrew|linuxbrew|Cellar)\//i.test(path))) {
    return { advice: "brew uninstall bun", installer: false };
  }
  if (paths.some((path) => path.includes(`${sep}node_modules${sep}`))) {
    return { advice: "npm uninstall -g bun (or the pnpm or yarn equivalent)", installer: false };
  }
  return { advice: `delete ${executable}, or uninstall the package that put it there`, installer: false };
};

/** The non-comment lines of the shell startup files that mention `directory`, as `~/<file>:<line>: <text>`. */
const startupLines = (directory: string, home: string, extra: string[]): string[] => {
  const relative = underHome(directory, home);
  const needles = [
    directory,
    ...(relative === undefined ? [] : [`~/${relative}`, `$HOME/${relative}`, `\${HOME}/${relative}`]),
    ...extra,
  ];
  const found: string[] = [];
  for (const name of STARTUP_FILES) {
    let text: string;
    try {
      text = readFileSync(join(home, name), "utf8");
    } catch {
      continue;
    }
    text.split("\n").forEach((line, index) => {
      if (!line.trimStart().startsWith("#") && needles.some((needle) => line.includes(needle))) {
        found.push(`${tilde(join(home, name), home)}:${index + 1}: ${line.trim()}`);
      }
    });
  }
  return found;
};

const hintFor = (found: { executable: string; directory: string }, home: string, env: NodeJS.ProcessEnv): string[] => {
  const { advice, installer, mise } = removal(found.executable, home, env);
  const lines = startupLines(found.directory, home, installer ? ["BUN_INSTALL"] : []);
  return [
    `${found.directory} comes before the Mise directories on PATH.`,
    mise ? `${advice[0]?.toUpperCase()}${advice.slice(1)}.` : `Remove that Bun: ${advice}`,
    ...(lines.length > 0
      ? ["Remove or move behind Mise the line that adds it to PATH:", ...lines]
      : mise
        ? ["No startup file adds it; it came with the environment of the parent process."]
        : [
            `No line in ${STARTUP_FILES.map((name) => tilde(join(home, name), home)).join(", ")} mentions ${found.directory}; a tool or another file your shell reads adds it.`,
          ]),
    "Then open a new terminal and run `which -a bun`: the Mise bun must be first (`mise activate` belongs at the end of the startup file).",
  ];
};

/** Compares the Bun on `env.PATH` with the one Mise pins for the directory. Reads files and runs probes, changes nothing. */
export const checkBun = ({ directory, binary, env, home = homedir() }: BunCheckOptions): BunCheck => {
  if (!binary) {
    return unchecked;
  }
  const expected = pinnedVersion(directory, binary);
  const found = expected === undefined ? undefined : firstBun(env.PATH ?? "");
  if (expected === undefined || found === undefined) {
    return unchecked;
  }
  const actual = versionOf(found.executable, env);
  if (actual === undefined) {
    return unchecked;
  }
  if (actual === expected) {
    return { status: "matches", message: `bun ${actual} on PATH is the version Mise pins`, hint: [] };
  }
  return {
    status: "differs",
    message: `bun ${actual} (${found.executable}) is first on PATH, but Mise pins bun ${expected} (${miseBunPath(directory, binary)})`,
    hint: hintFor(found, home, env),
  };
};

/** The warning for a `differs` check: its message, then the hint indented. */
export const bunWarning = (check: BunCheck): string =>
  [`Warning: ${check.message}.`, ...check.hint.map((line) => `  ${line}`)].join("\n");

/** Logs one warning when the `bun` on the command `PATH` is another version than the one Mise pins. */
export const warnWhenBunDiffers = (options: BunCheckOptions & { log: ProgressLog }): void => {
  const check = checkBun(options);
  if (check.status === "differs") {
    options.log(bunWarning(check));
  }
};
