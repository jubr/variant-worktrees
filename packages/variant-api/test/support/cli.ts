import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** Runs `variant <args>` from source in a child process, without worktree handling unless `environment` says so. */
export const runCli = async (args: string[], environment: Record<string, string> = {}): Promise<CliResult> => {
  const proc = Bun.spawn(["bun", "run", "src/cli.ts", ...args], {
    cwd: `${import.meta.dir}/../..`,
    env: { ...process.env, VARIANT_WORKTREE: "0", ...environment },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { stdout, stderr, exitCode };
};

/**
 * A SQLite project with variants `alpha` (a worktree with a runtime state) and `beta` (a database file only);
 * `files` adds or replaces files below the project directory. `run` receives the environment for `runCli`.
 */
export const withVariants = async (
  run: (environment: Record<string, string>, directory: string) => Promise<void>,
  files: Record<string, string> = {},
  yaml = "db:\n  dialect: sqlite\n",
): Promise<void> => {
  const directory = realpathSync(mkdtempSync(join("/tmp", "variant-cli-")));
  try {
    const put = (path: string, content: string): void => {
      mkdirSync(join(directory, path, ".."), { recursive: true });
      writeFileSync(join(directory, path), content);
    };
    put("variants.yaml", yaml);
    put(".cache/variants/beta.db", "");
    put(".cache/variants/alpha.db", "");
    put(
      "_v-alpha/variants.local.yaml",
      "runtime:\n  slug: alpha\n  mode: watch\n  instances:\n    fe: { port: 62060, url: 'http://alpha.vw.localhost:62060/' }\n",
    );
    for (const [path, content] of Object.entries(files)) {
      put(path, content);
    }
    await run({ VARIANT_CONFIG: join(directory, "variants.yaml") }, directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};
