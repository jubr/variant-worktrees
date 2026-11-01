import { describe, expect, it } from "bun:test";
import { parse as parseYaml } from "yaml";
import { runCli, withVariants } from "./support/cli.js";

const isJson = (text: string): boolean => {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
};

describe("output formats", () => {
  it("prints text, not JSON, when no flag is given", () =>
    withVariants(async (environment) => {
      const result = await runCli(["list"], environment);

      expect(result.exitCode).toBe(0);
      expect(isJson(result.stdout)).toBe(false);
      expect(result.stdout).toContain("alpha");
    }));

  it("prints the result as JSON with --json", () =>
    withVariants(async (environment) => {
      const result = await runCli(["list", "--json"], environment);

      expect(JSON.parse(result.stdout).map((record: { slug: string }) => record.slug)).toEqual(["alpha", "beta"]);
      expect(result.stdout).toBe(`${JSON.stringify(JSON.parse(result.stdout), null, 2)}\n`);
    }));

  it("prints the same value as YAML with --yaml", () =>
    withVariants(async (environment) => {
      const json = await runCli(["list", "--json"], environment);
      const yaml = await runCli(["list", "--yaml"], environment);

      expect(isJson(yaml.stdout)).toBe(false);
      expect(parseYaml(yaml.stdout)).toEqual(JSON.parse(json.stdout));
    }));

  it("accepts the flag before the command name", () =>
    withVariants(async (environment) => {
      const before = await runCli(["--json", "list"], environment);
      const after = await runCli(["list", "--json"], environment);

      expect(before.exitCode).toBe(0);
      expect(before.stdout).toBe(after.stdout);
    }));

  it("fails before running anything when both --json and --yaml are given", () =>
    withVariants(async (environment) => {
      const result = await runCli(["list", "--json", "--yaml"], environment);

      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("--json");
      expect(result.stderr).toContain("--yaml");
    }));

  it("keeps the exit status of the result", () =>
    withVariants(
      async (environment) => {
        const result = await runCli(["watch", "-s", "demo", "--json"], environment);

        expect(JSON.parse(result.stdout).exitCode).toBe(1);
        expect(result.exitCode).toBe(1);
      },
      {},
      "db:\n  dialect: sqlite\nvariant:\n  watch: exit 0\n  open: false\n",
    ));

  it("redacts the password in text, JSON and YAML", () =>
    withVariants(
      async (environment) => {
        for (const flags of [[], ["--json"], ["--yaml"]]) {
          const result = await runCli(["config", ...flags], environment);

          expect(result.exitCode).toBe(0);
          expect(result.stdout).not.toContain("hunter2");
          expect(result.stdout).toContain("***");
        }
      },
      {},
      "db:\n  dialect: postgres\n  host: db.example\n  user: app\n  password: hunter2\n  database: app\n",
    ));

  it("prints a non-empty text summary for every command that runs without a runtime", () =>
    withVariants(async (environment) => {
      for (const args of [
        ["config"],
        ["create", "-s", "gamma"],
        ["list"],
        ["provision", "-s", "gamma"],
        ["down", "-s", "gamma"],
        ["implode", "-s", "gamma"],
      ]) {
        const result = await runCli(args, environment);

        expect(result.exitCode).toBe(0);
        expect(result.stdout.trim().length).toBeGreaterThan(0);
        expect(isJson(result.stdout)).toBe(false);
      }
    }));

  describe("status", () => {
    it("prints the facts and runtime meta information of one variant as text", () =>
      withVariants(async (environment, directory) => {
        const result = await runCli(["status", "alpha"], environment);

        expect(result.exitCode).toBe(0);
        expect(result.stdout.split("\n")[0]).toBe("alpha");
        expect(result.stdout).toMatch(/mode:\s+watch/);
        expect(result.stdout).toMatch(/fe\s+port 62060\s+http:\/\/alpha\.vw\.localhost:62060\//);
        expect(result.stdout).toContain(`file: ${directory}/_v-alpha/variants.local.yaml`);
        expect(result.stdout).not.toContain("beta");
      }));

    it("prints the same record as JSON and YAML", () =>
      withVariants(async (environment) => {
        const json = await runCli(["status", "alpha", "--json"], environment);
        const yaml = await runCli(["status", "alpha", "--yaml"], environment);

        expect(JSON.parse(json.stdout)).toMatchObject({ slug: "alpha", mode: "watch", runtime: { slug: "alpha" } });
        expect(parseYaml(yaml.stdout)).toEqual(JSON.parse(json.stdout));
      }));

    it("takes the slug from -s as well as from the positional argument", () =>
      withVariants(async (environment) => {
        const positional = await runCli(["status", "alpha", "--json"], environment);
        const flag = await runCli(["status", "-s", "alpha", "--json"], environment);

        expect(flag.stdout).toBe(positional.stdout);
      }));

    it("fails with a message naming an unknown slug", () =>
      withVariants(async (environment) => {
        const result = await runCli(["status", "ghost"], environment);

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain("Unknown variant: ghost");
        expect(result.stdout).toBe("");
      }));
  });
});
