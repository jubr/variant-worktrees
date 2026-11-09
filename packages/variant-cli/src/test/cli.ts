import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { findSchemaHeader, schemaHeaderFor } from "variant-config";

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

/** Runs `command` (with `args`) in a child process, without worktree handling unless `environment` says so. */
export const runCommand = async (
  command: string[],
  args: string[],
  environment: Record<string, string> = {},
  cwd = `${import.meta.dir}/../..`,
): Promise<CliResult> => {
  // AIDEV-NOTE: a colored terminal or CI wraps help titles in escape codes; tests read plain text
  const { FORCE_COLOR: _color, ...inherited } = process.env;
  const proc = Bun.spawn([...command, ...args], {
    cwd,
    env: { ...inherited, NO_COLOR: "1", VARIANT_WORKTREE: "0", ...environment },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { stdout: stdout.replace(ANSI, ""), stderr: stderr.replace(ANSI, ""), exitCode };
};

/** Runs `variant <args>` from source in a child process, without worktree handling unless `environment` says so. */
export const runCli = (args: string[], environment: Record<string, string> = {}): Promise<CliResult> =>
  runCommand(["bun", "run", "src/cli.ts"], args, environment);

/**
 * A SQLite project with variants `alpha` (a worktree with a runtime state) and `beta` (a database file only);
 * `files` adds or replaces files below the project directory. `run` receives the environment for `runCli`.
 */
export const withVariants = async (
  run: (environment: Record<string, string>, directory: string) => Promise<void>,
  files: Record<string, string> | ((directory: string) => Record<string, string>) = {},
  yaml = "db:\n  dialect: sqlite\n",
): Promise<void> => {
  const directory = realpathSync(mkdtempSync(join("/tmp", "variant-cli-")));
  try {
    const put = (path: string, content: string): void => {
      mkdirSync(join(directory, path, ".."), { recursive: true });
      writeFileSync(join(directory, path), content);
    };
    // AIDEV-NOTE: the schema header keeps the migration quiet, so tests that assert an empty stderr see only their own output
    put("variants.yaml", findSchemaHeader(yaml) ? yaml : `${schemaHeaderFor("variants.yaml")}\n\n${yaml}`);
    put(".cache/variants/beta.db", "");
    put(".cache/variants/alpha.db", "");
    put(
      "_v-alpha/variants.local.yaml",
      `${schemaHeaderFor("variants.local.yaml")}\n\nruntime:\n  slug: alpha\n  mode: watch\n  watches:\n    fe: { port: 62060, url: 'http://alpha.vw.localhost:62060/' }\n`,
    );
    const extra = typeof files === "function" ? files(directory) : files;
    for (const [path, content] of Object.entries(extra)) {
      put(path, content);
    }
    await run({ VARIANT_CONFIG: join(directory, "variants.yaml") }, directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};
