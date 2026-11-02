import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cliPath = `${import.meta.dir}/../src/cli.ts`;

interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const runCli = async (
  args: string[],
  options: { cwd?: string; env?: Record<string, string> } = {},
): Promise<CliResult> => {
  const proc = Bun.spawn(["bun", "run", cliPath, ...args], {
    cwd: options.cwd ?? `${import.meta.dir}/..`,
    env: { ...process.env, VARIANT_WORKTREE: "0", ...options.env },
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

describe("variant completions", () => {
  it.each([
    ["zsh", "#compdef variant"],
    ["bash", "complete -F _variant variant"],
    ["fish", "complete -c variant"],
  ])("prints a %s completion script to stdout", async (shell, marker) => {
    const result = await runCli(["completions", shell]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain(marker);
  });

  it("works in a directory without git or variants.yaml and writes no file", async () => {
    const directory = realpathSync(mkdtempSync(join(tmpdir(), "variant-completions-bare-")));
    try {
      const result = await runCli(["completions", "bash"], { cwd: directory, env: { VARIANT_CONFIG: "" } });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("complete -F _variant variant");
      expect(readdirSync(directory)).toEqual([]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it.each([
    ["an unknown shell", ["completions", "powershell"]],
    ["a missing shell", ["completions"]],
  ])("fails for %s, naming the supported shells", async (_label, args) => {
    const result = await runCli(args);

    expect(result.exitCode).not.toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("zsh");
    expect(result.stderr).toContain("bash");
    expect(result.stderr).toContain("fish");
  });

  it("does not create a state directory when the shell is unsupported", async () => {
    const directory = realpathSync(mkdtempSync(join(tmpdir(), "variant-completions-bad-")));
    try {
      await runCli(["completions", "powershell"], { cwd: directory, env: { VARIANT_CONFIG: "" } });

      expect(existsSync(join(directory, ".cache"))).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("is listed in --help with a description", async () => {
    const help = await runCli(["--help"]);

    expect(help.stdout).toMatch(/^\s+completions\s+\S/m);
  });
});

describe("variant completions --list-slugs", () => {
  /** A temporary project with `variants.yaml`; `run` gets its directory and the CLI environment. */
  const inProject = async (
    config: string,
    run: (directory: string, options: { cwd: string; env: Record<string, string> }) => Promise<void>,
  ): Promise<void> => {
    const directory = realpathSync(mkdtempSync(join(tmpdir(), "variant-slugs-")));
    try {
      writeFileSync(join(directory, "variants.yaml"), config);
      await run(directory, { cwd: directory, env: { VARIANT_CONFIG: join(directory, "variants.yaml") } });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  };
  const sqlite = "db:\n  dialect: sqlite\n";
  const state = (directory: string, slug: string): void => {
    mkdirSync(join(directory, ".cache", "variants"), { recursive: true });
    writeFileSync(join(directory, ".cache", "variants", `${slug}.yaml`), `slug: ${slug}\n`);
  };
  /** Every file and directory below `directory`, to compare before and after. */
  const tree = (directory: string): string[] =>
    (readdirSync(directory, { recursive: true }) as string[]).map(String).sort();

  it("prints states and worktree directories together, once each, sorted", () =>
    inProject(sqlite, async (directory, options) => {
      state(directory, "shared");
      state(directory, "add-auth");
      mkdirSync(join(directory, "_v-fix-login"));
      mkdirSync(join(directory, "_v-shared"));

      const result = await runCli(["completions", "--list-slugs"], options);

      expect(result.stdout).toBe("add-auth\nfix-login\nshared\n");
      expect(result.stderr).toBe("");
      expect(result.exitCode).toBe(0);
    }));

  it("needs no shell with --list-slugs", () =>
    inProject(sqlite, async (_directory, options) => {
      const result = await runCli(["completions", "--list-slugs"], options);

      expect(result.exitCode).toBe(0);
    }));

  it("uses the configured variant.prefix", () =>
    inProject("db:\n  dialect: sqlite\nvariant:\n  prefix: wt-\n", async (directory, options) => {
      mkdirSync(join(directory, "wt-add-auth"));
      mkdirSync(join(directory, "_v-ignored"));

      const result = await runCli(["completions", "--list-slugs"], options);

      expect(result.stdout).toBe("add-auth\n");
    }));

  it("skips names that are not valid slugs and plain files", () =>
    inProject(sqlite, async (directory, options) => {
      for (const name of ["_v-bad name", "_v-Upper", "_v-a--b", "_v-", "_v-trailing-"]) {
        mkdirSync(join(directory, name));
      }
      writeFileSync(join(directory, "_v-file"), "");
      mkdirSync(join(directory, "_v-fine"));

      const result = await runCli(["completions", "--list-slugs"], options);

      expect(result.stdout).toBe("fine\n");
    }));

  it("prints nothing when no variant exists", () =>
    inProject(sqlite, async (_directory, options) => {
      const result = await runCli(["completions", "--list-slugs"], options);

      expect(result.stdout).toBe("");
      expect(result.exitCode).toBe(0);
    }));

  it("prints nothing, silently, when the configuration is invalid", () =>
    inProject("db: [unclosed\n", async (directory, options) => {
      mkdirSync(join(directory, "_v-add-auth"));

      const result = await runCli(["completions", "--list-slugs"], options);

      expect(result).toEqual({ stdout: "", stderr: "", exitCode: 0 });
    }));

  it("prints nothing, silently, outside a project", async () => {
    const directory = realpathSync(mkdtempSync(join(tmpdir(), "variant-slugs-bare-")));
    try {
      mkdirSync(join(directory, "_v-add-auth"));

      const result = await runCli(["completions", "--list-slugs"], { cwd: directory, env: { VARIANT_CONFIG: "" } });

      expect(result).toEqual({ stdout: "", stderr: "", exitCode: 0 });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("creates no file or directory and never opens the database", () =>
    // An unreachable PostgreSQL server: a connection attempt would fail or hang, so success proves none was made.
    inProject(
      "db:\n  dialect: postgres\n  host: 127.0.0.1\n  port: 1\n  user: nobody\n  password: nothing\n  database: none\n",
      async (directory, options) => {
        mkdirSync(join(directory, "_v-add-auth"));
        const before = tree(directory);

        const result = await runCli(["completions", "--list-slugs"], options);

        expect(result.stdout).toBe("add-auth\n");
        expect(result.exitCode).toBe(0);
        expect(tree(directory)).toEqual(before);
        expect(existsSync(join(directory, ".cache"))).toBe(false);
      },
    ));

  it("lists the same slugs as `list` for the file-based variants", () =>
    inProject(sqlite, async (directory, options) => {
      state(directory, "beta");
      state(directory, "gamma");
      mkdirSync(join(directory, "_v-alpha"));
      writeFileSync(join(directory, "_v-alpha", "variants.local.yaml"), "runtime:\n  slug: alpha\n");
      mkdirSync(join(directory, "_v-gamma"));

      const listing = await runCli(["completions", "--list-slugs"], options);
      const records = JSON.parse((await runCli(["list", "--json"], options)).stdout) as { slug: string }[];

      expect(listing.stdout.trim().split("\n")).toEqual(records.map((record) => record.slug));
      expect(listing.stdout.trim().split("\n")).toEqual(["alpha", "beta", "gamma"]);
    }));
});
