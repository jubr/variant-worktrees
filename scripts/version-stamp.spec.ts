import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { utcDate, variantString } from "variant-api/bundle";
import { versionDefines } from "./version-stamp.ts";

const repo = join(import.meta.dir, "..");

const git = (directory: string, args: string[]): string =>
  execFileSync("git", ["-C", directory, ...args], { encoding: "utf8" }).trim();

describe("version stamp", () => {
  it("defines the build date and the variant string for this checkout", () => {
    const branch = git(repo, ["rev-parse", "--abbrev-ref", "HEAD"]);
    const commit = git(repo, ["rev-parse", "HEAD"]);
    let commits = git(repo, ["rev-list", "--count", "HEAD"]);
    try {
      const tag = git(repo, ["describe", "--tags", "--abbrev=0"]);
      commits = git(repo, ["rev-list", "--count", `${tag}..HEAD`]);
    } catch {
      // A checkout with no tag counts every commit.
    }
    const now = new Date("2001-02-03T04:05:06Z");
    const variant = variantString({ branch, commitsSinceTag: Number(commits), commit });
    const defines = versionDefines(repo, now);

    expect(JSON.parse(defines.VARIANT_BUILD_DATE)).toBe(utcDate(now, variant));
    expect(JSON.parse(defines.VARIANT_BUILD_VARIANT)).toBe(variant);
  });

  it("bakes a date without a time on main", () => {
    const directory = mkdtempSync(join("/tmp", "variant-stamp-main-"));
    try {
      execFileSync("git", ["init", "-q", "-b", "main", directory]);
      execFileSync("git", ["-C", directory, "config", "user.email", "variant@example.test"]);
      execFileSync("git", ["-C", directory, "config", "user.name", "Variant Tests"]);
      writeFileSync(join(directory, "readme"), "hi\n");
      execFileSync("git", ["-C", directory, "add", "readme"]);
      execFileSync("git", ["-C", directory, "commit", "-q", "-m", "initial"]);
      const defines = versionDefines(directory, new Date("2001-02-03T04:05:06Z"));

      expect(JSON.parse(defines.VARIANT_BUILD_DATE)).toBe("2001-02-03");
      expect(JSON.parse(defines.VARIANT_BUILD_VARIANT)).toBe("");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("omits the variant define when the directory is not a git checkout", () => {
    const directory = mkdtempSync(join("/tmp", "variant-stamp-"));
    try {
      const defines = versionDefines(directory, new Date("2001-02-03T04:05:06Z"));
      expect(JSON.parse(defines.VARIANT_BUILD_DATE)).toBe("2001-02-03");
      expect(defines.VARIANT_BUILD_VARIANT).toBeUndefined();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
