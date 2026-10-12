import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { amendDotenv, dotenvFor, loadConfig } from "../src/index.js";
import type { VariantInstance } from "../src/schema.js";

describe("amendDotenv", () => {
  it("replaces a variable in place, keeps other lines, and appends the missing ones", () => {
    const source = "# keep\nPORT=3000\nOTHER=1\n";

    expect(amendDotenv(source, { PORT: "62061", POSTGRES_SCHEMA: "v_demo" })).toBe(
      "# keep\nPORT=62061\nOTHER=1\nPOSTGRES_SCHEMA=v_demo\n",
    );
  });

  it("replaces an exported variable and keeps the export", () => {
    expect(amendDotenv("export PORT=3000\n", { PORT: "1" })).toBe("export PORT=1\n");
  });

  it("quotes values with whitespace or a hash", () => {
    expect(amendDotenv("", { A: "x y", B: "x#y", C: "plain" })).toBe('A="x y"\nB="x#y"\nC=plain\n');
  });

  it("holds only the variant values for an empty source", () => {
    expect(amendDotenv("", { PORT: "1" })).toBe("PORT=1\n");
  });
});

describe("dotenvFor", () => {
  const withProject = (run: (directory: string) => void): void => {
    const directory = mkdtempSync(join("/tmp", "variant-dotenv-"));
    try {
      writeFileSync(join(directory, "variants.yaml"), "db:\n  dialect: sqlite\n");
      mkdirSync(join(directory, "server"));
      run(directory);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  };

  it("amends the file named by the instance, relative to its dir", () =>
    withProject((directory) => {
      writeFileSync(join(directory, "server", ".env"), "PORT=3000\n");
      const instance: VariantInstance = { kind: "nestjs", dir: "server", dotenv: ".env" };

      expect(dotenvFor(loadConfig({ cwd: directory }), instance, { PORT: "62061" })).toBe("PORT=62061\n");
    }));

  it("treats a missing source as empty", () =>
    withProject((directory) => {
      const instance: VariantInstance = { kind: "nestjs", dir: "server", dotenv: ".env" };

      expect(dotenvFor(loadConfig({ cwd: directory }), instance, { PORT: "1" })).toBe("PORT=1\n");
    }));

  it("returns nothing for an instance without dotenv", () =>
    withProject((directory) => {
      const instance: VariantInstance = { kind: "nestjs", dir: "server" };

      expect(dotenvFor(loadConfig({ cwd: directory }), instance, { PORT: "1" })).toBeUndefined();
    }));
});
