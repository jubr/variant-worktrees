import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runCli } from "./support/cli.js";

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

    expect(help.stdout).toContain(`variant v${version}`);
    expect(flag.stdout.trim()).toBe(version);
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

    for (const name of ["up", "down", "watch", "implode"]) {
      expect(help).toMatch(new RegExp(`^\\s+${name}\\s+\\S`, "m"));
    }
  });

  it("takes --detach, --force and --verbose", async () => {
    expect((await runCli(["watch", "--help"])).stdout).toContain("--detach");
    expect((await runCli(["implode", "--help"])).stdout).toContain("--force");
    expect((await runCli(["provision", "--help"])).stdout).toContain("--verbose");
  });

  it("takes -v as the short form of --verbose on every command", async () => {
    for (const name of ["config", "create", "list", "provision", "up", "down", "watch", "implode"]) {
      expect((await runCli([name, "--help"])).stdout).toContain("-v, --verbose");
    }
    expect((await runCli(["config", "-v"])).exitCode).toBe(0);
  });

  it("keeps --version as the only version flag", async () => {
    const { version } = (await Bun.file(`${import.meta.dir}/../package.json`).json()) as { version: string };

    expect((await runCli(["-v"])).stdout.trim()).not.toBe(version);
    expect((await runCli(["--version"])).stdout.trim()).toBe(version);
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
      "db:\n  dialect: sqlite\nvariant:\n  open: false\n  instances:\n    be: { kind: nestjs, dir: ., watch: exit 0 }\n",
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
});
