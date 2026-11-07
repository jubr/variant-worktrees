import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { platformToken, VERSION_BANNER } from "../src/version-line.js";
import { runCli, runCommand } from "./support/cli.js";

/** The version token for this checkout, built from git rather than from the formatter. */
const versionToken = (version: string): string => {
  const directory = join(import.meta.dir, "..");
  const git = (args: string[]): string => execFileSync("git", ["-C", directory, ...args], { encoding: "utf8" }).trim();
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  const commit = git(["rev-parse", "HEAD"]);
  let commits = git(["rev-list", "--count", "HEAD"]);
  try {
    const tag = git(["describe", "--tags", "--abbrev=0"]);
    commits = git(["rev-list", "--count", `${tag}..HEAD`]);
  } catch {
    // A checkout with no tag counts every commit.
  }
  const slug = branch.replace(/^(feat|fix|feature)\//, "");
  const suffix = branch === "main" ? "" : `-${slug}-${commits}-${commit.slice(0, 4)}`;
  return `${version}${suffix}`;
};

const detailsLine = `${platformToken(process.platform, process.arch)}, https://github.com/jubr/variant-worktrees`;

const expectVersionOutput = (stdout: string, token: string): void => {
  const lines = stdout.trimEnd().split("\n");
  expect(lines[0]).toMatch(
    new RegExp(`^${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\(\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\)$`),
  );
  expect(lines.slice(1, 6).join("\n")).toBe(VERSION_BANNER);
  expect(lines[6]).toBe("");
  expect(lines[7]).toBe(detailsLine);
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

  it("reports the package version in help and --version", async () => {
    const { version } = (await Bun.file(`${import.meta.dir}/../package.json`).json()) as { version: string };
    const help = await runCli(["--help"]);
    const flag = await runCli(["--version"]);
    const token = versionToken(version);

    expect(help.stdout.trimStart().startsWith(`variant v${version}`)).toBe(true);
    expect(help.stdout).not.toContain(VERSION_BANNER);
    expect(help.stdout).not.toContain("https://github.com/jubr/variant-worktrees");
    expect(flag.exitCode).toBe(0);
    expectVersionOutput(flag.stdout, token);
  });

  it("has no destroy command; implode replaces it", async () => {
    const help = await runCli(["--help"]);
    const destroy = await runCli(["destroy"]);

    expect(help.stdout).toContain("implode");
    expect(help.stdout).not.toContain("destroy");
    expect(destroy.exitCode).not.toBe(0);
  });

  it("lists the runtime commands with their descriptions", async () => {
    const help = (await runCli(["--help"])).stdout;

    for (const name of ["up", "down", "deprovision", "watch", "implode"]) {
      expect(help).toMatch(new RegExp(`^\\s+${name}\\s+\\S`, "m"));
    }
  });

  it("lists --from with no short flag on the commands that create a worktree", async () => {
    for (const name of ["create", "provision", "up", "watch"]) {
      const help = (await runCli([name, "--help"])).stdout;
      expect(help).toContain("--from");
      expect(help).not.toContain("-f, --from");
    }
    const short = await runCli(["create", "-f", "feat/other"]);
    expect(short.exitCode).not.toBe(0);
    expect(short.stderr).toContain("Unknown flag");
  });

  it("lists --pull-ff with no short flag on the commands that create a worktree", async () => {
    for (const name of ["create", "provision", "up", "watch"]) {
      const help = (await runCli([name, "--help"])).stdout;
      expect(help).toContain("--pull-ff");
      expect(help).not.toMatch(/-\w, --pull-ff/);
    }
  });

  it("rejects --pull-ff on down and implode", async () => {
    for (const name of ["down", "implode"]) {
      const result = await runCli([name, "--pull-ff"]);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Unknown flag: --pull-ff");
    }
  });

  it("rejects --from on down and implode", async () => {
    for (const name of ["down", "implode"]) {
      const result = await runCli([name, "--from", "abc123"]);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Unknown flag: --from");
    }
  });

  it("takes --detach, --force and --verbose", async () => {
    expect((await runCli(["watch", "--help"])).stdout).toContain("--detach");
    expect((await runCli(["watch", "--help"])).stdout).toContain("--reprovision");
    expect((await runCli(["implode", "--help"])).stdout).toContain("--force");
    expect((await runCli(["provision", "--help"])).stdout).toContain("--verbose");
  });

  it("takes -v as the short form of --verbose on every command", async () => {
    for (const name of ["config", "create", "list", "provision", "up", "down", "deprovision", "watch", "implode"]) {
      expect((await runCli([name, "--help"])).stdout).toContain("-v, --verbose");
    }
    expect((await runCli(["config", "-v"])).exitCode).toBe(0);
  });

  it("keeps --version as the only version flag", async () => {
    const { version } = (await Bun.file(`${import.meta.dir}/../package.json`).json()) as { version: string };
    const token = versionToken(version);
    const verbose = await runCli(["-v"]);
    const flag = await runCli(["--version"]);

    expect(verbose.stdout).not.toContain(token);
    expect(verbose.stdout).not.toContain(VERSION_BANNER);
    expectVersionOutput(flag.stdout, token);
  });

  describe("warnings for extra properties", () => {
    const withExtra = async (run: (environment: Record<string, string>) => Promise<void>): Promise<void> => {
      const directory = mkdtempSync(join("/tmp", "variant-cli-warn-"));
      const configPath = join(directory, "variants.yaml");
      writeFileSync(configPath, "db:\n  dialect: sqlite\n  colour: red\nvariant:\n  ui:\n    color: red\n");
      try {
        await run({ VARIANT_CONFIG: configPath });
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    };

    it("prints one warning line per extra key on stderr and still runs the command", () =>
      withExtra(async (environment) => {
        const result = await runCli(["config", "--json"], environment);
        const lines = result.stderr.split("\n").filter((line) => line.startsWith("warning:"));

        expect(result.exitCode).toBe(0);
        expect(lines).toHaveLength(2);
        expect(lines.join("\n")).toContain("variants.yaml: unknown key db.colour");
        expect(lines.join("\n")).toContain("variants.yaml: unknown key variant.ui.color");
        expect(JSON.parse(result.stdout).warnings).toHaveLength(2);
      }));

    it("keeps standard output free of warnings", () =>
      withExtra(async (environment) => {
        const result = await runCli(["list", "--json"], environment);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain("warning:");
        expect(JSON.parse(result.stdout)).toBeArray();
      }));

    it("prints nothing for a configuration without extra keys", async () => {
      const directory = mkdtempSync(join("/tmp", "variant-cli-warn-"));
      const configPath = join(directory, "variants.yaml");
      writeFileSync(configPath, "db:\n  dialect: sqlite\n");
      try {
        const result = await runCli(["config", "--json"], { VARIANT_CONFIG: configPath });

        expect(result.stderr).not.toContain("warning:");
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    });
  });

  it("sets the exit code of an attached watch from its result", async () => {
    const directory = mkdtempSync(join("/tmp", "variant-cli-watch-"));
    const configPath = join(directory, "variants.yaml");
    writeFileSync(
      configPath,
      "db:\n  dialect: sqlite\nvariant:\n  open: false\n  watches:\n    be: { kind: nestjs, dir: ., watch: exit 0 }\n",
    );
    try {
      const result = await runCli(["watch", "-s", "demo", "--json"], { VARIANT_CONFIG: configPath });

      expect(JSON.parse(result.stdout).exitCode).toBe(1);
      expect(result.exitCode).toBe(1);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("prints detected config as JSON with --json", async () => {
    const result = await runCli(["config", "--json"]);
    expect(result.exitCode).toBe(0);
    const config = JSON.parse(result.stdout);
    expect(config.db).toBeDefined();
    expect(config.variant).toBeDefined();
    expect(config.db.password).not.toBe("pnv_password");
  });

  it("runs the config, create, list, implode smoke sequence", async () => {
    const directory = realpathSync(mkdtempSync(join("/tmp", "variant-cli-")));
    const configPath = join(directory, "variants.yaml");
    writeFileSync(configPath, "db:\n  dialect: sqlite\n");
    execFileSync("git", ["init", "-q", "-b", "main", directory]);
    execFileSync("git", ["-C", directory, "config", "user.email", "variant@example.test"]);
    execFileSync("git", ["-C", directory, "config", "user.name", "Variant Tests"]);
    execFileSync("git", ["-C", directory, "commit", "-q", "--allow-empty", "-m", "initial"]);
    const environment = { VARIANT_CONFIG: configPath, VARIANT_WORKTREE: "1" };
    const variant = (args: string[]) =>
      runCommand(["bun", join(import.meta.dir, "../src/cli.ts")], args, environment, directory);
    try {
      expect((await variant(["config"])).exitCode).toBe(0);
      expect((await variant(["create", "-s", "test-feature"])).exitCode).toBe(0);
      expect((await variant(["list"])).stdout).toContain("test-feature");
      expect((await variant(["implode", "-s", "test-feature"])).exitCode).toBe(0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
