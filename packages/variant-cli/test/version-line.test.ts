import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  formatVersionLine,
  platformToken,
  readVariant,
  renderBanner,
  variantString,
  versionColor,
} from "../src/version-line.js";

describe("version line", () => {
  it("prints the package version, the platform, the build date, and the repository URL", () => {
    expect(
      formatVersionLine({
        version: "1.2.3",
        platform: "macos-arm64",
        date: "2001-02-03",
        variant: "",
      }),
    ).toBe("1.2.3 macos-arm64 (2001-02-03 https://github.com/jubr/variant-worktrees)");
  });

  it("appends the variant string when it is not empty", () => {
    expect(
      formatVersionLine({
        version: "1.2.3",
        platform: "macos-arm64",
        date: "2001-02-03",
        variant: "version-details-4-abcd",
      }),
    ).toBe("1.2.3-version-details-4-abcd macos-arm64 (2001-02-03 https://github.com/jubr/variant-worktrees)");
  });

  it("names Darwin as macos, Windows as windows, and keeps Linux", () => {
    expect(platformToken("darwin", "arm64")).toBe("macos-arm64");
    expect(platformToken("win32", "x64")).toBe("windows-x64");
    expect(platformToken("linux", "x64")).toBe("linux-x64");
  });

  it("builds slug-n-hash4 and leaves main empty", () => {
    const commit = "abcdef0123456789abcdef0123456789abcdef01";

    expect(variantString({ branch: "feat/version-details", commitsSinceTag: 4, commit })).toBe(
      "version-details-4-abcd",
    );
    expect(variantString({ branch: "main", commitsSinceTag: 4, commit })).toBe("");
    expect(variantString({ branch: "feat/version-details", commitsSinceTag: 0, commit })).toBe(
      "version-details-0-abcd",
    );
    expect(variantString({ branch: "feat/other", commitsSinceTag: 1, commit: "not-a-hash" })).toBe("");
    expect(
      variantString({
        branch: "fix/watch-log",
        commitsSinceTag: 2,
        commit: "abcdabcdabcdabcdabcdabcdabcdabcdabcdabcd",
      }),
    ).toBe("watch-log-2-abcd");
  });

  it("prints the cursive variant-worktrees drawing", () => {
    expect(renderBanner(false)).toBe(`${DRAWING}\n`);
  });

  it("colors the drawing orange and leaves the glyphs unchanged", () => {
    const colored = renderBanner(true);

    expect(colored.startsWith("\u001b[38;5;208m")).toBe(true);
    expect(colored.endsWith("\u001b[0m")).toBe(true);
    expect(colored.replaceAll("\u001b[38;5;208m", "").replaceAll("\u001b[0m", "")).toBe(`${DRAWING}\n`);
  });

  it("colors only when stdout is a terminal and NO_COLOR is unset", () => {
    expect(versionColor({ isTTY: true })).toBe(true);
    expect(versionColor({ isTTY: false })).toBe(false);
    expect(versionColor({ isTTY: true, NO_COLOR: "1" })).toBe(false);
    expect(versionColor({ isTTY: true, NO_COLOR: "" })).toBe(false);
  });

  it("returns no variant string outside a git checkout", () => {
    const directory = mkdtempSync(join(tmpdir(), "variant-line-"));
    try {
      expect(readVariant(directory)).toBe("");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("reads slug-n-hash4 from a feature checkout and nothing from main", () => {
    const feature = mkdtempSync(join(tmpdir(), "variant-line-"));
    const main = mkdtempSync(join(tmpdir(), "variant-line-"));
    const commitIn = (directory: string, branch: string): string => {
      execFileSync("git", ["init", "-q", "-b", branch, directory]);
      execFileSync("git", ["-C", directory, "config", "user.email", "variant@example.test"]);
      execFileSync("git", ["-C", directory, "config", "user.name", "Variant Tests"]);
      writeFileSync(join(directory, "readme"), "hi\n");
      execFileSync("git", ["-C", directory, "add", "readme"]);
      execFileSync("git", ["-C", directory, "commit", "-q", "-m", "initial"]);
      return execFileSync("git", ["-C", directory, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    };
    try {
      const commit = commitIn(feature, "feat/sample");
      expect(readVariant(feature)).toBe(`sample-1-${commit.slice(0, 4)}`);
      commitIn(main, "main");
      expect(readVariant(main)).toBe("");
    } finally {
      rmSync(feature, { recursive: true, force: true });
      rmSync(main, { recursive: true, force: true });
    }
  });
});

const DRAWING = [
  "                                                            _",
  "                 o                                         | |",
  "      __,   ,_       __,   _  _  _|_             __   ,_   | | _|_  ,_    _   _   ,",
  "|  |_/  |  /  |  |  /  |  / |/ |  |-----|  |  |_/  \\_/  |  |/_) |  /  |  |/  |/  / \\_",
  " \\/  \\_/|_/   |_/|_/\\_/|_/  |  |_/|_/    \\/ \\/  \\__/    |_/| \\_/|_/   |_/|__/|__/ \\/",
].join("\n");
