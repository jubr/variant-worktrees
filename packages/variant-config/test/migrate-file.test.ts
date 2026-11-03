import { afterEach, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { migrateFile } from "../src/index.js";

const OLD = "variant:\n  instances:\n    fe:\n      kind: vite\n";
const NEW = "variant:\n  watches:\n    fe:\n      kind: vite\n";
const OLD_LOCAL = "runtime:\n  instances:\n    fe:\n      port: 62060\n";
const NEW_LOCAL = "runtime:\n  watches:\n    fe:\n      port: 62060\n";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

/** A git repository with `files` committed, and `local` files written but not committed. */
const repository = (committed: Record<string, string> = {}, untracked: Record<string, string> = {}): string => {
  const directory = mkdtempSync(join("/tmp", "variant-migrate-"));
  directories.push(directory);
  const git = (...args: string[]) => execFileSync("git", ["-C", directory, ...args], { stdio: "ignore" });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "variant@example.test");
  git("config", "user.name", "Variant Tests");
  writeFileSync(join(directory, ".gitignore"), "variants.local.yaml\n");
  for (const [name, content] of Object.entries(committed)) {
    writeFileSync(join(directory, name), content);
  }
  git("add", ".");
  git("commit", "-q", "-m", "initial");
  for (const [name, content] of Object.entries(untracked)) {
    writeFileSync(join(directory, name), content);
  }
  return directory;
};

const read = (directory: string, name: string): string => readFileSync(join(directory, name), "utf8");

describe("migrateFile", () => {
  it("rewrites a tracked variants.yaml without uncommitted changes", () => {
    const directory = repository({ "variants.yaml": OLD });

    const result = migrateFile(join(directory, "variants.yaml"), {});

    expect(result).toMatchObject({ status: "rewritten", file: join(directory, "variants.yaml") });
    expect(result?.notices).toHaveLength(1);
    expect(read(directory, "variants.yaml")).toBe(NEW);
  });

  it("leaves a rewritten file revertible with git checkout", () => {
    const directory = repository({ "variants.yaml": OLD });
    migrateFile(join(directory, "variants.yaml"), {});

    execFileSync("git", ["-C", directory, "checkout", "--", "variants.yaml"]);

    expect(read(directory, "variants.yaml")).toBe(OLD);
  });

  it("rewrites an untracked variants.yaml after saving the old text as variants.yaml~", () => {
    const directory = repository({}, { "variants.yaml": OLD });

    const result = migrateFile(join(directory, "variants.yaml"), {});

    expect(result).toMatchObject({
      status: "rewritten",
      file: join(directory, "variants.yaml"),
      backup: join(directory, "variants.yaml~"),
    });
    expect(read(directory, "variants.yaml")).toBe(NEW);
    expect(read(directory, "variants.yaml~")).toBe(OLD);
  });

  it("rewrites a variants.yaml outside a git repository after saving a backup", () => {
    const directory = mkdtempSync(join("/tmp", "variant-migrate-plain-"));
    directories.push(directory);
    writeFileSync(join(directory, "variants.yaml"), OLD);

    expect(migrateFile(join(directory, "variants.yaml"), {})).toMatchObject({ status: "rewritten" });
    expect(read(directory, "variants.yaml")).toBe(NEW);
    expect(read(directory, "variants.yaml~")).toBe(OLD);
  });

  it("does not touch an untracked file, nor write a backup, when an opt-out applies", () => {
    const directory = repository({}, { "variants.yaml": OLD });

    const result = migrateFile(join(directory, "variants.yaml"), { VARIANT_MIGRATE: "0" });

    expect(result).toMatchObject({ status: "skipped" });
    expect(read(directory, "variants.yaml")).toBe(OLD);
    expect(existsSync(join(directory, "variants.yaml~"))).toBe(false);
  });

  it("skips an untracked file whose backup already exists, and keeps both files", () => {
    const directory = repository({}, { "variants.yaml": OLD, "variants.yaml~": "older backup\n" });

    const result = migrateFile(join(directory, "variants.yaml"), {});

    expect(result?.status === "skipped" && result.reason).toContain("variants.yaml~");
    expect(read(directory, "variants.yaml")).toBe(OLD);
    expect(read(directory, "variants.yaml~")).toBe("older backup\n");
  });

  it("writes no backup for a tracked file", () => {
    const directory = repository({ "variants.yaml": OLD });

    const result = migrateFile(join(directory, "variants.yaml"), {});

    expect(result).toMatchObject({ status: "rewritten" });
    expect(result && "backup" in result).toBe(false);
    expect(existsSync(join(directory, "variants.yaml~"))).toBe(false);
  });

  it("skips a tracked file with uncommitted changes", () => {
    const directory = repository({ "variants.yaml": OLD });
    writeFileSync(join(directory, "variants.yaml"), `${OLD}# my edit\n`);

    const result = migrateFile(join(directory, "variants.yaml"), {});

    expect(result?.status === "skipped" && result.reason).toContain("uncommitted");
    expect(read(directory, "variants.yaml")).toBe(`${OLD}# my edit\n`);
  });

  it("skips a tracked file with staged changes", () => {
    const directory = repository({ "variants.yaml": OLD });
    writeFileSync(join(directory, "variants.yaml"), `${OLD}# staged\n`);
    execFileSync("git", ["-C", directory, "add", "variants.yaml"]);

    expect(migrateFile(join(directory, "variants.yaml"), {})).toMatchObject({ status: "skipped" });
  });

  it.each([["true"], ["1"], ["yes"]])("skips when CI is %p", (ci) => {
    const directory = repository({ "variants.yaml": OLD });

    const result = migrateFile(join(directory, "variants.yaml"), { CI: ci });

    expect(result?.status === "skipped" && result.reason).toContain("CI");
    expect(read(directory, "variants.yaml")).toBe(OLD);
  });

  it.each([["0"], ["false"], [""]])("does not skip when CI is %p", (ci) => {
    const directory = repository({ "variants.yaml": OLD });

    expect(migrateFile(join(directory, "variants.yaml"), { CI: ci })).toMatchObject({ status: "rewritten" });
  });

  it("skips when VARIANT_MIGRATE is 0 and names it", () => {
    const directory = repository({ "variants.yaml": OLD });

    const result = migrateFile(join(directory, "variants.yaml"), { VARIANT_MIGRATE: "0" });

    expect(result?.status === "skipped" && result.reason).toContain("VARIANT_MIGRATE");
    expect(read(directory, "variants.yaml")).toBe(OLD);
  });

  it("rewrites a git-ignored variants.local.yaml without the git conditions", () => {
    const directory = repository({ "variants.yaml": NEW }, { "variants.local.yaml": OLD_LOCAL });

    expect(migrateFile(join(directory, "variants.local.yaml"), {})).toMatchObject({ status: "rewritten" });
    expect(read(directory, "variants.local.yaml")).toBe(NEW_LOCAL);
  });

  it("rewrites a variants.local.yaml outside a git repository", () => {
    const directory = mkdtempSync(join("/tmp", "variant-migrate-plain-"));
    directories.push(directory);
    writeFileSync(join(directory, "variants.local.yaml"), OLD_LOCAL);

    expect(migrateFile(join(directory, "variants.local.yaml"), {})).toMatchObject({ status: "rewritten" });
  });

  it("still skips variants.local.yaml when CI is set", () => {
    const directory = repository({}, { "variants.local.yaml": OLD_LOCAL });

    expect(migrateFile(join(directory, "variants.local.yaml"), { CI: "true" })).toMatchObject({ status: "skipped" });
    expect(read(directory, "variants.local.yaml")).toBe(OLD_LOCAL);
  });

  it("returns nothing for a current file and for a missing one", () => {
    const directory = repository({ "variants.yaml": NEW });

    expect(migrateFile(join(directory, "variants.yaml"), {})).toBeUndefined();
    expect(migrateFile(join(directory, "missing.yaml"), {})).toBeUndefined();
  });

  it("reports a write failure as the reason and does not throw", () => {
    const directory = repository({}, { "variants.local.yaml": OLD_LOCAL });
    chmodSync(join(directory, "variants.local.yaml"), 0o444);

    const result = migrateFile(join(directory, "variants.local.yaml"), {});

    expect(result).toMatchObject({ status: "skipped" });
    expect(result?.status === "skipped" && result.reason).not.toBe("");
    expect(read(directory, "variants.local.yaml")).toBe(OLD_LOCAL);
  });

  it("does not throw for a path that is a directory or holds invalid YAML", () => {
    const directory = repository({}, { "variants.local.yaml": "a: [\n" });
    mkdirSync(join(directory, "variants.yaml"));

    expect(() => migrateFile(join(directory, "variants.yaml"), {})).not.toThrow();
    expect(() => migrateFile(join(directory, "variants.local.yaml"), {})).not.toThrow();
  });
});
