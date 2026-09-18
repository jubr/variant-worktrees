import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

  it("prints detected config as JSON", async () => {
    const result = await runCli(["config"]);
    expect(result.exitCode).toBe(0);
    const config = JSON.parse(result.stdout);
    expect(config.db).toBeDefined();
    expect(config.variant).toBeDefined();
    expect(config.db.password).not.toBe("pnv_password");
  });

  it("runs the config, create, list, destroy smoke sequence", async () => {
    const directory = mkdtempSync(join("/tmp", "variant-cli-"));
    const configPath = join(directory, "variants.yaml");
    writeFileSync(configPath, "db:\n  dialect: sqlite\n");
    const environment = { VARIANT_CONFIG: configPath };
    try {
      expect((await runCli(["config"], environment)).exitCode).toBe(0);
      expect((await runCli(["create", "-s", "test-feature"], environment)).exitCode).toBe(0);
      expect((await runCli(["list"], environment)).stdout).toContain("test-feature");
      expect((await runCli(["destroy", "-s", "test-feature"], environment)).exitCode).toBe(0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
