import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const runCli = async (
  args: string[],
  environment: Record<string, string> = {},
): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
  const proc = Bun.spawn(["bun", "run", "src/cli.ts", ...args], {
    cwd: `${import.meta.dir}/..`,
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

describe("variant CLI", () => {
  it("lists lifecycle commands in help", async () => {
    const result = await runCli(["--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("create");
    expect(result.stdout).toContain("provision");
  });

  it("shows help when invoked without arguments", async () => {
    const noArgs = await runCli([]);
    const explicitHelp = await runCli(["--help"]);
    expect(noArgs.exitCode).toBe(0);
    expect(noArgs.stdout).toBe(explicitHelp.stdout);
    expect(noArgs.stderr).toBe(explicitHelp.stderr);
  });

  it("has no destroy command; implode replaces it", async () => {
    const help = await runCli(["--help"]);
    const destroy = await runCli(["destroy"]);

    expect(help.stdout).toContain("implode");
    expect(help.stdout).not.toContain("destroy");
    expect(destroy.exitCode).not.toBe(0);
  });

  it("prints detected config as JSON", async () => {
    const result = await runCli(["config"]);
    expect(result.exitCode).toBe(0);
    const config = JSON.parse(result.stdout);
    expect(config.db).toBeDefined();
    expect(config.variant).toBeDefined();
    expect(config.db.password).not.toBe("pnv_password");
  });

  it("runs the config, create, list, implode smoke sequence", async () => {
    const directory = mkdtempSync(join("/tmp", "variant-cli-"));
    const configPath = join(directory, "variants.yaml");
    writeFileSync(configPath, "db:\n  dialect: sqlite\n");
    const environment = { VARIANT_CONFIG: configPath };
    try {
      expect((await runCli(["config"], environment)).exitCode).toBe(0);
      expect((await runCli(["create", "-s", "test-feature"], environment)).exitCode).toBe(0);
      expect((await runCli(["list"], environment)).stdout).toContain("test-feature");
      expect((await runCli(["implode", "-s", "test-feature"], environment)).exitCode).toBe(0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  describe("list --table", () => {
    const withVariants = async (run: (environment: Record<string, string>) => Promise<void>): Promise<void> => {
      const directory = realpathSync(mkdtempSync(join("/tmp", "variant-cli-table-")));
      try {
        writeFileSync(join(directory, "variants.yaml"), "db:\n  dialect: sqlite\n");
        mkdirSync(join(directory, ".cache", "variants"), { recursive: true });
        writeFileSync(join(directory, ".cache", "variants", "beta.db"), "");
        writeFileSync(join(directory, ".cache", "variants", "alpha.db"), "");
        mkdirSync(join(directory, "_v-alpha"));
        writeFileSync(
          join(directory, "_v-alpha", "variants.local.yaml"),
          "runtime:\n  slug: alpha\n  instances:\n    fe: { url: 'http://alpha.vw.localhost:62060' }\n",
        );
        await run({ VARIANT_CONFIG: join(directory, "variants.yaml") });
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    };

    it("prints a header and one row per variant sorted by slug, with - for missing values", () =>
      withVariants(async (environment) => {
        const result = await runCli(["list", "--table"], environment);
        const rows = result.stdout
          .trim()
          .split("\n")
          .map((line) => line.trim().split(/\s{2,}/));

        expect(result.exitCode).toBe(0);
        expect(rows[0]).toEqual(["slug", "dir", "url", "schema"]);
        expect(rows[1]?.slice(0, 3)).toEqual(["alpha", "_v-alpha", "http://alpha.vw.localhost:62060"]);
        expect(rows[1]?.[3]).toEndWith("alpha.db");
        expect(rows[2]?.slice(0, 3)).toEqual(["beta", "-", "-"]);
        expect(rows).toHaveLength(3);
      }));

    it("keeps JSON as the default output", () =>
      withVariants(async (environment) => {
        const result = await runCli(["list"], environment);

        expect(JSON.parse(result.stdout).map((record: { slug: string }) => record.slug)).toEqual(["alpha", "beta"]);
      }));
  });
});
