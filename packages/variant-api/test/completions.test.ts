import { describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, realpathSync, rmSync } from "node:fs";
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
