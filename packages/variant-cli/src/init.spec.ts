import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { runCommand } from "./test/cli.js";

/** Specification: openspec/specs/variant-api/init/spec.md (Init command, Existing configuration) */

let directory: string;

beforeEach(() => {
  directory = realpathSync(mkdtempSync(join("/tmp", "variant-cli-init-")));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

const init = (...args: string[]) =>
  runCommand(["bun", "run", `${import.meta.dir}/../src/cli.ts`, "init", ...args], [], {}, directory);

describe("variant init", () => {
  it("writes the file and .gitignore and names each step in the text output", async () => {
    const result = await init("--mise=false");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(`Initialized ${directory}`);
    expect(result.stdout).toMatch(/variants\.yaml:\s+written to /);
    expect(result.stdout).toMatch(/\.gitignore:\s+created \.gitignore with _v-\*/);
    expect(result.stdout).toMatch(/mise:\s+skipped/);
    expect(parseYaml(readFileSync(join(directory, "variants.yaml"), "utf8")).variant.prefix).toBe("_v-");
  });

  it("skips a step turned off with =false", async () => {
    const result = await init("--gitignore=false", "--mise=false");

    expect(result.exitCode).toBe(0);
    expect(existsSync(join(directory, ".gitignore"))).toBe(false);
    expect(existsSync(join(directory, "variants.yaml"))).toBe(true);
    expect(result.stdout).toMatch(/\.gitignore:\s+skipped/);
  });

  it("takes the prefix", async () => {
    await init("--prefix", "wt-", "--mise=false");

    expect(readFileSync(join(directory, ".gitignore"), "utf8")).toBe("wt-*\n");
  });

  it("renders the result as JSON and YAML", async () => {
    const json = JSON.parse((await init("--json", "--mise=false")).stdout);

    expect(json).toMatchObject({
      directory,
      prefix: "_v-",
      gitignore: { status: "created" },
      mise: { status: "skipped" },
    });
    rmSync(join(directory, "variants.yaml"));
    const yaml = parseYaml((await init("--yaml", "--mise=false", "--gitignore=false")).stdout);
    expect(yaml.file).toBe(join(directory, "variants.yaml"));
  });

  it("fails on an existing file, naming it, with exit code 1 and no change", async () => {
    writeFileSync(join(directory, "variants.yaml"), "db:\n  dialect: sqlite\n");

    const result = await init("--mise=false");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(join(directory, "variants.yaml"));
    expect(existsSync(join(directory, ".gitignore"))).toBe(false);
  });

  it("refuses an invalid prefix", async () => {
    const result = await init("--prefix", "a/b");

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("a/b");
    expect(existsSync(join(directory, "variants.yaml"))).toBe(false);
  });
});
