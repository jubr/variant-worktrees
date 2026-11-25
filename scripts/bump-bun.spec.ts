/**
 * Specification: openspec/specs/meta/bun-bump/spec.md (Bun version bump)
 */
import { afterEach, describe, expect, test } from "bun:test";
import { parse } from "yaml";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bumpFiles, bumpVersion, normalizeVersion, setMiseBun, setTypesBun } from "./bump-bun.ts";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("normalizeVersion", () => {
  test("takes X.Y.Z with or without a leading v", () => {
    expect(normalizeVersion("1.4.6")).toBe("1.4.6");
    expect(normalizeVersion("v1.4.6")).toBe("1.4.6");
  });

  test("rejects a version that is not plain major.minor.patch", () => {
    expect(() => normalizeVersion("1.4")).toThrow("1.4");
    expect(() => normalizeVersion("1.4.6-0")).toThrow("1.4.6-0");
    expect(() => normalizeVersion("latest")).toThrow("latest");
  });
});

describe("bumpVersion", () => {
  const tags = ["bun-slim-v1.4.5-0", "bun-slim-v1.4.5-1", "bun-slim-v1.4.4-9", "nightly"];

  test("is the newest release version without its build number", () => {
    expect(bumpVersion(undefined, tags)).toBe("1.4.5");
  });

  test("is the override when one is given, release or not", () => {
    expect(bumpVersion("v1.4.9", tags)).toBe("1.4.9");
    expect(bumpVersion("1.4.4", tags)).toBe("1.4.4");
  });

  test("treats an empty override as none", () => {
    expect(bumpVersion("", tags)).toBe("1.4.5");
  });

  test("fails when there is no override and no release", () => {
    expect(() => bumpVersion(undefined, ["nightly"])).toThrow("release");
  });
});

describe("setMiseBun", () => {
  test("changes the bun pin and nothing else", () => {
    const toml = '[tools]\nactionlint = "1.7.12"\nbun = "1.4.2"\nhk = "2.8.0"\n# bun = "0.0.1"\n';

    expect(setMiseBun(toml, "1.4.5")).toBe('[tools]\nactionlint = "1.7.12"\nbun = "1.4.5"\nhk = "2.8.0"\n# bun = "0.0.1"\n');
  });

  test("fails when bun is not pinned", () => {
    expect(() => setMiseBun('[tools]\nhk = "2.8.0"\n', "1.4.5")).toThrow("bun");
  });
});

describe("setTypesBun", () => {
  test("moves a caret range of @types/bun to the version", () => {
    const json = '{\n  "devDependencies": {\n    "@types/bun": "^1.3.9",\n    "typescript": "^5.0.0"\n  }\n}\n';

    expect(setTypesBun(json, "1.4.5")).toBe(
      '{\n  "devDependencies": {\n    "@types/bun": "^1.4.5",\n    "typescript": "^5.0.0"\n  }\n}\n',
    );
  });

  test("leaves latest and a package without @types/bun alone", () => {
    const latest = '{ "devDependencies": { "@types/bun": "latest" } }';
    const none = '{ "devDependencies": {} }';

    expect(setTypesBun(latest, "1.4.5")).toBe(latest);
    expect(setTypesBun(none, "1.4.5")).toBe(none);
  });
});

describe("bumpFiles", () => {
  const workspace = (): string => {
    const root = mkdtempSync(join("/tmp", "bump-bun-"));
    directories.push(root);
    writeFileSync(join(root, "mise.toml"), '[tools]\nbun = "1.4.2"\n');
    writeFileSync(join(root, "package.json"), '{ "devDependencies": { "@types/bun": "^1.3.9" } }\n');
    mkdirSync(join(root, "packages/a"), { recursive: true });
    writeFileSync(join(root, "packages/a/package.json"), '{ "devDependencies": { "@types/bun": "latest" } }\n');
    mkdirSync(join(root, "packages/b"), { recursive: true });
    writeFileSync(join(root, "packages/b/package.json"), '{ "devDependencies": { "@types/bun": "^1.2.0" } }\n');
    return root;
  };

  test("edits mise.toml and every package.json with an @types/bun range, and names the files it changed", () => {
    const root = workspace();

    expect(bumpFiles(root, "1.4.5").sort()).toEqual(["mise.toml", "package.json", "packages/b/package.json"]);
    expect(readFileSync(join(root, "mise.toml"), "utf8")).toBe('[tools]\nbun = "1.4.5"\n');
    expect(readFileSync(join(root, "package.json"), "utf8")).toContain('"^1.4.5"');
    expect(readFileSync(join(root, "packages/a/package.json"), "utf8")).toContain('"latest"');
    expect(readFileSync(join(root, "packages/b/package.json"), "utf8")).toContain('"^1.4.5"');
  });

  test("changes nothing the second time", () => {
    const root = workspace();
    bumpFiles(root, "1.4.5");

    expect(bumpFiles(root, "1.4.5")).toEqual([]);
  });
});

describe("Taskfile", () => {
  test("has chore:bun:bump, which runs the script and takes VERSION from the environment Task builds from its variables", () => {
    const tasks = parse(readFileSync(join(import.meta.dir, "..", "Taskfile.yaml"), "utf8")).tasks as Record<
      string,
      { desc?: string; cmds?: string[] }
    >;

    expect(tasks["chore:bun:bump"]?.cmds).toEqual(["bun scripts/bump-bun.ts"]);
    expect(tasks["chore:bun:bump"]?.desc).toContain("VERSION");
  });
});
