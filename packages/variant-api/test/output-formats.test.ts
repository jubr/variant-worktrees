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
});
