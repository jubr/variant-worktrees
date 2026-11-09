import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { amendDotenv, dotenvFor, loadConfig, parseDotenv } from "./index.js";
import type { VariantWatch } from "./schema.js";

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

  it("amends the file named by the watch, relative to its dir", () =>
    withProject((directory) => {
      writeFileSync(join(directory, "server", ".env"), "PORT=3000\n");
      const watch: VariantWatch = { kind: "nestjs", dir: "server", env: { sourceFile: ".env" } };

      expect(dotenvFor(loadConfig({ cwd: directory }), watch, { PORT: "62061" })).toBe("PORT=62061\n");
    }));

  it("falls back to the .example file when the source does not exist", () =>
    withProject((directory) => {
      writeFileSync(join(directory, "server", ".env.example"), "PORT=3000\n");
      const watch: VariantWatch = { kind: "nestjs", dir: "server", env: { sourceFile: ".env" } };

      expect(dotenvFor(loadConfig({ cwd: directory }), watch, { PORT: "62061" })).toBe("PORT=62061\n");
    }));

  it("prefers the source over its .example file", () =>
    withProject((directory) => {
      writeFileSync(join(directory, "server", ".env"), "A=1\n");
      writeFileSync(join(directory, "server", ".env.example"), "B=2\n");
      const watch: VariantWatch = { kind: "nestjs", dir: "server", env: { sourceFile: ".env" } };

      expect(dotenvFor(loadConfig({ cwd: directory }), watch, { PORT: "1" })).toBe("A=1\nPORT=1\n");
    }));

  it("treats a missing source as empty", () =>
    withProject((directory) => {
      const watch: VariantWatch = { kind: "nestjs", dir: "server", env: { sourceFile: ".env" } };

      expect(dotenvFor(loadConfig({ cwd: directory }), watch, { PORT: "1" })).toBe("PORT=1\n");
    }));

  it("returns nothing for a watch without env.sourceFile", () =>
    withProject((directory) => {
      const watch: VariantWatch = { kind: "nestjs", dir: "server" };

      expect(dotenvFor(loadConfig({ cwd: directory }), watch, { PORT: "1" })).toBeUndefined();
    }));
});

describe("parseDotenv", () => {
  it("reads KEY=value lines as Mise prints them, without unquoting", () => {
    expect(parseDotenv("A=plain\nB=with space\nC=quote'single\nD=dq\"x\nE=a=b\nF=\n")).toEqual({
      A: "plain",
      B: "with space",
      C: "quote'single",
      D: 'dq"x',
      E: "a=b",
      F: "",
    });
  });

  it("joins the lines of a multi-line value", () => {
    expect(parseDotenv("A=one\ntwo\n\nthree\nB=x\n")).toEqual({ A: "one\ntwo\n\nthree", B: "x" });
  });

  it("lets a later definition win and tolerates a missing final newline and CRLF", () => {
    expect(parseDotenv("A=1\r\nA=2")).toEqual({ A: "2" });
  });

  it("ignores text before the first assignment", () => {
    expect(parseDotenv("# comment\n\nA=1\n")).toEqual({ A: "1" });
  });
});
