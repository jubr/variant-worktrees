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
  renderVersion,
  resolveVersionFacts,
  variantString,
  versionColor,
} from "./version-line.js";

describe("version line", () => {
  it("prints the package version, the platform, the build date, and the repository URL", () => {
    expect(
      formatVersionLine({
        version: "1.2.3",
        platform: "macos-arm64",
        date: "2001-02-03 04:05:06",
        variant: "",
      }),
    ).toBe(`1.2.3 (2001-02-03 04:05:06)\n${DRAWING}\n\nmacos-arm64, https://github.com/jubr/variant-worktrees`);
  });

  it("appends the variant string when it is not empty", () => {
    expect(
      formatVersionLine({
        version: "1.2.3",
        platform: "macos-arm64",
        date: "2001-02-03 04:05:06",
        variant: "version-details-4-abcd",
      }),
    ).toBe(
      `1.2.3-version-details-4-abcd (2001-02-03 04:05:06)\n${DRAWING}\n\nmacos-arm64, https://github.com/jubr/variant-worktrees`,
    );
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

  it("turns slashes and dots that are not a branch prefix into single hyphens", () => {
    const commit = "838c6e3aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    expect(variantString({ branch: "release/v0.0.8", commitsSinceTag: 150, commit })).toBe("release-v0-0-8-150-838c");
  });

  it("prints the drawing and a blank line when the banner is requested", () => {
    expect(
      renderVersion({
        version: "1.2.3",
        platform: "macos-arm64",
        date: "2001-02-03",
        color: false,
        banner: true,
      }),
    ).toBe(`1.2.3 (2001-02-03)\n${DRAWING}\n\nmacos-arm64, https://github.com/jubr/variant-worktrees\n`);
  });

  it("omits the drawing and the blank line when the banner is off", () => {
    expect(
      renderVersion({
        version: "1.2.3",
        platform: "macos-arm64",
        date: "2001-02-03",
        color: true,
        banner: false,
      }),
    ).toBe("1.2.3 (2001-02-03)\nmacos-arm64, https://github.com/jubr/variant-worktrees\n");
  });

  it("prints the cursive variant-worktrees drawing", () => {
    expect(renderBanner(false)).toBe(`${DRAWING}\n`);
  });

  it("colors the drawing orange and leaves the hyphen in the default color", () => {
    const colored = renderBanner(true);
    const orange = "\u001b[38;5;208m";
    const reset = "\u001b[0m";
    const plainHyphen = ` ${reset}-${orange}${reset}-${orange}${reset}-${orange} `;

    expect(colored.startsWith(orange)).toBe(true);
    expect(colored.endsWith(reset)).toBe(true);
    expect(colored.replaceAll(orange, "").replaceAll(reset, "")).toBe(`${DRAWING}\n`);
    expect(colored).toContain(`|${plainHyphen}|`);
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
      expect(resolveVersionFacts(main, new Date("2001-02-03T04:05:06Z")).date).toBe("2001-02-03");
      expect(resolveVersionFacts(feature, new Date("2001-02-03T04:05:06Z")).date).toBe("2001-02-03 04:05:06");
    } finally {
      rmSync(feature, { recursive: true, force: true });
      rmSync(main, { recursive: true, force: true });
    }
  });
});

const DRAWING = [
  " _                                       _                     _",
  "(_|   |_/          o                    (_|   |   |_/         | |",
  "  |   | __,   ,_       __,   _  _  _|_    |   |   | __   ,_   | | _|_  ,_    _   _   ,",
  "  |   |/  |  /  |  |  /  |  / |/ |  | --- |   |   |/  \\_/  |  |/_) |  /  |  |/  |/  / \\_",
  "   \\_/ \\_/|_/   |_/|_/\\_/|_/  |  |_/|_/    \\_/ \\_/ \\__/    |_/| \\_/|_/   |_/|__/|__/ \\/",
].join("\n");
