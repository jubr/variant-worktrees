import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../src/index.js";
import { parseConfig } from "../src/parse.js";
import { VariantsConfigSchema } from "../src/schema.js";

const FILE = "/p/variants.yaml";

describe("parseConfig", () => {
  it("returns the data and no warning for a valid document", () => {
    const { data, warnings } = parseConfig(VariantsConfigSchema, { db: { dialect: "sqlite" } }, FILE);

    expect(data.db?.dialect).toBe("sqlite");
    expect(warnings).toEqual([]);
  });

  it("drops an extra key and warns with the file and the key path", () => {
    const { data, warnings } = parseConfig(VariantsConfigSchema, { db: { dialect: "sqlite", colour: "red" } }, FILE);

    expect(data.db).toEqual({ dialect: "sqlite" });
    expect(warnings).toEqual([`${FILE}: unknown key db.colour`]);
  });

  it("warns for an extra top-level key", () => {
    const { warnings } = parseConfig(VariantsConfigSchema, { seed: "bun run db:seed" }, FILE);

    expect(warnings).toEqual([`${FILE}: unknown key seed`]);
  });

  it("warns once per extra key at several depths", () => {
    const { data, warnings } = parseConfig(
      VariantsConfigSchema,
      {
        variant: {
          ui: { color: "red" },
          steps: [{ name: "one", run: "true", colour: "red" }],
        },
        chatRenamer: { colour: "red" },
        extra: 1,
      },
      FILE,
    );

    expect(data.variant?.ui).toEqual({});
    expect(data.chatRenamer).toEqual({});
    expect([...warnings].sort()).toEqual(
      [
        `${FILE}: unknown key chatRenamer.colour`,
        `${FILE}: unknown key extra`,
        `${FILE}: unknown key variant.steps.0.colour`,
        `${FILE}: unknown key variant.ui.color`,
      ].sort(),
    );
  });

  it("warns for each of several extra keys in one object", () => {
    const { warnings } = parseConfig(VariantsConfigSchema, { db: { dialect: "sqlite", a: 1, b: 2 } }, FILE);

    expect([...warnings].sort()).toEqual([`${FILE}: unknown key db.a`, `${FILE}: unknown key db.b`]);
  });

  it("does not change the data that was passed in", () => {
    const input = { db: { dialect: "sqlite", colour: "red" } };

    parseConfig(VariantsConfigSchema, input, FILE);

    expect(input.db).toEqual({ dialect: "sqlite", colour: "red" });
  });

  it("throws for a wrong type", () => {
    expect(() =>
      parseConfig(VariantsConfigSchema, { db: { dialect: "postgres", host: "h", port: "x" } }, FILE),
    ).toThrow(/port/);
  });

  it("throws for a missing required key", () => {
    expect(() => parseConfig(VariantsConfigSchema, { db: { port: 5432 } }, FILE)).toThrow(/host/);
  });

  it("throws for a failed cross-field rule although an extra key is present", () => {
    const duplicate = {
      variant: {
        steps: [
          { name: "a", run: "true" },
          { name: "a", run: "true" },
        ],
        ui: { color: "red" },
      },
    };

    expect(() => parseConfig(VariantsConfigSchema, duplicate, FILE)).toThrow(/duplicate step name a/);
  });

  it("throws for a cross-field rule that only shows once the extra key is dropped", () => {
    const reserved = { variant: { watches: { "variant-ui": { kind: "vite", dir: "ui", colour: "red" } } } };

    expect(() => parseConfig(VariantsConfigSchema, reserved, FILE)).toThrow(/reserved/);
  });

  it("reports the warning together with the error", () => {
    const document = { db: { dialect: "postgres", host: "h", port: "abc", colour: "red" } };

    let message = "";
    try {
      parseConfig(VariantsConfigSchema, document, FILE);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain("port");
    expect(message).toContain(`${FILE}: unknown key db.colour`);
  });
});

describe("loadConfig warnings", () => {
  const withProject = (yaml: string, run: (directory: string) => void): void => {
    const directory = mkdtempSync(join("/tmp", "variant-config-warn-"));
    try {
      writeFileSync(join(directory, "variants.yaml"), yaml);
      run(directory);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  };

  it("carries the warnings of an extra property in the resolved configuration", () => {
    withProject("db:\n  dialect: sqlite\n  colour: red\n", (directory) => {
      const config = loadConfig({ cwd: directory });

      expect(config.warnings).toEqual([`${join(directory, "variants.yaml")}: unknown key db.colour`]);
      expect(config.db).not.toHaveProperty("colour");
    });
  });

  it("has an empty warning list for a clean file and for no file", () => {
    withProject("db:\n  dialect: sqlite\n", (directory) => {
      expect(loadConfig({ cwd: directory }).warnings).toEqual([]);
    });
    const empty = mkdtempSync(join("/tmp", "variant-config-warn-"));
    try {
      expect(loadConfig({ cwd: empty }).warnings).toEqual([]);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it("fails for an error and names the extra property in the same message", () => {
    withProject("db:\n  dialect: postgres\n  host: h\n  port: abc\n  colour: red\n", (directory) => {
      expect(() => loadConfig({ cwd: directory })).toThrow(/db\.colour/);
    });
  });
});
