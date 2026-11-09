import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "./index.js";

const git = (cwd: string, ...args: string[]): string =>
  execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();

/** Loads the configuration of a checkout that is called `name` and holds the given variants.yaml. */
const abbrOf = (name: string, yaml = "variant: {}\n"): string => {
  const parent = mkdtempSync(join("/tmp", "variant-abbr-"));
  try {
    const directory = join(parent, name);
    mkdirSync(directory);
    writeFileSync(join(directory, "variants.yaml"), yaml);
    return loadConfig({ cwd: directory, env: {} }).variant.abbr;
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
};

describe("variant.abbr autodetection", () => {
  it.each([
    ["variant-worktrees", "vw"],
    ["OtherTitleCase", "otc"],
    ["moreStuff", "ms"],
    ["lower_example", "le"],
    ["shop", "s"],
    ["API", "a"],
    ["my-APIServer", "ma"],
    ["2fast_2furious", "22"],
    ["___", "app"],
  ])("derives the abbreviation of %s as %s", (name, expected) => {
    expect(abbrOf(name)).toBe(expected);
  });

  it("prefers an explicit value", () => {
    expect(abbrOf("variant-worktrees", "variant:\n  abbr: shop\n")).toBe("shop");
  });

  it("accepts a hyphenated explicit value", () => {
    expect(abbrOf("variant-worktrees", "variant:\n  abbr: my-shop\n")).toBe("my-shop");
  });

  it.each(["Shop", "a.b", "", "-a", "a-", "a--b", "a b"])("rejects the explicit value %p", (value) => {
    expect(() => abbrOf("variant-worktrees", `variant:\n  abbr: ${JSON.stringify(value)}\n`)).toThrow();
  });

  it("is the same from a linked worktree of the main checkout", () => {
    const parent = mkdtempSync(join("/tmp", "variant-abbr-"));
    const main = join(parent, "variant-worktrees");
    const linked = join(parent, "_v-add-auth");
    try {
      mkdirSync(main);
      execFileSync("git", ["init", "-b", "main", main], { encoding: "utf8" });
      git(main, "config", "user.email", "variant@example.test");
      git(main, "config", "user.name", "Variant Tests");
      writeFileSync(join(main, "variants.yaml"), "variant: {}\n");
      git(main, "add", "variants.yaml");
      git(main, "commit", "-m", "initial");
      git(main, "worktree", "add", "-b", "feat/add-auth", linked, "main");

      expect(loadConfig({ cwd: main, env: {} }).variant.abbr).toBe("vw");
      expect(loadConfig({ cwd: linked, env: {} }).variant.abbr).toBe("vw");
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});
