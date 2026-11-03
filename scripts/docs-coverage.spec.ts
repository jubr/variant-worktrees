/**
 * Specification: openspec/specs/docs/readmes/spec.md
 *
 * CONTRIBUTING.md requires every added command or functionality to be added to the README and to `docs/`. This test
 * enforces it for commands: a command that is registered but not documented fails here.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { commands } from "../packages/variant-api/src/commands.ts";
import { GLOBAL_FLAGS } from "../packages/variant-cli/src/output.ts";

const root = join(import.meta.dir, "..");
const read = (path: string): string => readFileSync(join(root, path), "utf8");

/** The text of the `##` section of a markdown file that starts with `heading`, up to the next `##` heading. */
const section = (markdown: string, heading: string): string => {
  const start = markdown.indexOf(`\n## ${heading}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const rest = markdown.slice(start + 1);
  const end = rest.indexOf("\n## ", 1);
  return end === -1 ? rest : rest.slice(0, end);
};

const names = commands.map((command) => String(command.name));

describe("CONTRIBUTING", () => {
  test("requires new commands and functionality to be added to the README and the documentation", () => {
    const text = read("CONTRIBUTING.md").replace(/\s+/g, " ");

    expect(text).toMatch(/any (extra )?commands? or functionality/i);
    expect(text).toContain("README.md");
    expect(text).toContain("docs/");
  });
});

describe("README CLI section", () => {
  const cli = section(read("README.md"), "CLI");

  test("shows every command", () => {
    for (const name of names) {
      expect(cli).toContain(`variant ${name}`);
    }
  });

  test("lists the global flags in a subsection of their own", () => {
    const start = cli.indexOf("### Global flags");
    expect(start).toBeGreaterThanOrEqual(0);
    const globals = cli.slice(start);
    for (const { name } of GLOBAL_FLAGS) {
      expect(globals).toContain(`--${name}`);
    }
    for (const flag of ["--slug", "--detach", "--force", "--verbose"]) {
      expect(globals).not.toContain(flag);
    }
  });

  test("names the watch log file and the minimal list columns", () => {
    expect(cli).toContain("variants.watch.log");
    expect(cli).toContain("variant list -v");
  });
});

describe("documentation", () => {
  test("the core guide has a section for every command", () => {
    const core = read("docs/guide/core.md");
    for (const name of names) {
      expect(core).toContain(`\n## ${name}\n`);
    }
  });

  test("the core guide explains the global flags", () => {
    const core = read("docs/guide/core.md");

    expect(core).toContain("## Global flags");
    for (const { name } of GLOBAL_FLAGS) {
      expect(core).toContain(`--${name}`);
    }
  });

  test("the MCP guide lists a tool for every command", () => {
    const mcp = read("docs/mcp.md");
    for (const name of names) {
      expect(mcp).toContain(`variant_${name}`);
    }
  });

  test("the configuration guide documents the runtime log path", () => {
    expect(read("docs/guide/configuration.md")).toContain("variants.watch.log");
  });
});

describe("VARIANT_* environment variables", () => {
  const variables = [
    "VARIANT_SLUG",
    "VARIANT_TARGET",
    "VARIANT_CONFIG",
    "VARIANT_<KEY>_PORT",
    "VARIANT_<KEY>_URL",
    "VARIANT_<KEY>_PID",
    "VARIANT_OPEN",
    "VARIANT_ENV_SOURCE",
    "VARIANT_STEP_<NAME>",
  ];

  for (const path of ["README.md", "docs/guide/configuration.md"]) {
    test(`${path} names every variable`, () => {
      const text = read(path);
      for (const variable of variables) {
        expect(text).toContain(variable);
      }
    });

    test(`${path} ties each variable to its setting or placeholder`, () => {
      const text = read(path);
      for (const setting of [
        "{{slug}}",
        "{{schema}}",
        "{{<key>.port}}",
        "runtime.watches.<key>.port",
        "variant.open",
        "env.sourceFile",
      ]) {
        expect(text).toContain(setting);
      }
    });

    test(`${path} says how <KEY> and <NAME> are derived`, () => {
      expect(read(path).replace(/\s+/g, " ")).toMatch(/uppercase[^.]*every other character[^.]*`_`/i);
    });
  }
});
